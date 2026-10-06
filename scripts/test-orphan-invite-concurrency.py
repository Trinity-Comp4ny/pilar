#!/usr/bin/env python3
"""Teste de concorrência da RPC no Supabase local (não acessa staging/prod)."""
import concurrent.futures
import os
import subprocess
import threading
import uuid

USER_ID = str(uuid.uuid4())
COMPANY_ID = str(uuid.uuid4())
ENV = {**os.environ, "PGPASSWORD": "postgres", "PGCONNECT_TIMEOUT": "5"}
COMMAND = ["psql", "-X", "-h", "127.0.0.1", "-p", "54332", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-At"]


def sql(statement):
    result = subprocess.run(COMMAND, input=statement, env=ENV, capture_output=True, text=True, timeout=20)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout


cleanup = f"""
BEGIN;
SELECT set_config('request.jwt.claims', '{{"role":"service_role"}}', true);
DELETE FROM public.convites WHERE empresa_id = '{COMPANY_ID}';
DELETE FROM public.profiles WHERE id = '{USER_ID}';
DELETE FROM auth.users WHERE id = '{USER_ID}';
DELETE FROM public.empresas WHERE id = '{COMPANY_ID}';
COMMIT;
"""
try:
    sql(f"""
BEGIN;
SET LOCAL session_replication_role = replica;
INSERT INTO auth.users (id, email, email_confirmed_at, aud, role, raw_user_meta_data, raw_app_meta_data)
VALUES ('{USER_ID}', 'concurrency@recovery.test', now(), 'authenticated', 'authenticated', '{{}}', '{{}}');
SET LOCAL session_replication_role = origin;
INSERT INTO public.empresas (id, nome) VALUES ('{COMPANY_ID}', 'Recovery concurrency test');
INSERT INTO public.convites (empresa_id, email, cargo, created_at)
VALUES ('{COMPANY_ID}', 'concurrency@recovery.test', 'user', now() - interval '1 hour'),
       ('{COMPANY_ID}', 'concurrency@recovery.test', 'user', now());
COMMIT;
""")
    barrier = threading.Barrier(2)

    def recover(_):
        barrier.wait(timeout=5)
        return sql(f"""
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{{"sub":"{USER_ID}","role":"authenticated"}}', true);
SELECT public.aceitar_convite_pendente();
SELECT pg_sleep(0.2);
COMMIT;
""")

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(recover, range(2)))
    assert all(USER_ID in result for result in results), results
    result = sql(f"""
SELECT (SELECT count(*) FROM public.profiles WHERE id = '{USER_ID}') || ':' ||
       (SELECT count(*) FROM public.convites WHERE empresa_id = '{COMPANY_ID}' AND usado_em IS NOT NULL);
""").strip()
    assert result == "1:1", result
finally:
    sql(cleanup)

print("PASS: duas chamadas simultâneas, um profile, um convite consumido; fixtures removidas.")
