-- pgTAP: manutenção programada (SPEC 153, migration 20261212000000).
-- Leitura pública como a status page; só ultra admin cria e cancela; fim depois do início.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(6);

CREATE OR REPLACE FUNCTION test_set_auth(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

CREATE OR REPLACE FUNCTION test_set_postgres()
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('role', 'postgres', true);
END; $$;

SELECT test_set_postgres();

INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role, email_confirmed_at)
VALUES
  ('f1530000-0000-4000-8000-00000000000a', 'manut_ultra@empresareal.com.br', jsonb_build_object('company_name', 'Manut Ultra'), 'authenticated', 'authenticated', now()),
  ('f1530000-0000-4000-8000-00000000000b', 'manut_comum@empresareal.com.br', jsonb_build_object('company_name', 'Manut Comum'), 'authenticated', 'authenticated', now());

UPDATE public.profiles SET role = 'ultra_admin' WHERE id = 'f1530000-0000-4000-8000-00000000000a';

SELECT test_set_auth('f1530000-0000-4000-8000-00000000000b');
SELECT throws_ok(
  $$INSERT INTO public.status_manutencoes (titulo, inicio, fim) VALUES ('Janela', now(), now() + interval '1 hour')$$,
  '42501', NULL,
  'usuário comum não cria manutenção'
);

SELECT test_set_auth('f1530000-0000-4000-8000-00000000000a');
SELECT lives_ok(
  $$INSERT INTO public.status_manutencoes (id, titulo, inicio, fim)
    VALUES ('f1530000-0000-4000-8000-0000000000c1', 'Janela', now() + interval '2 hours', now() + interval '3 hours')$$,
  'ultra admin cria manutenção'
);
SELECT throws_ok(
  $$INSERT INTO public.status_manutencoes (titulo, inicio, fim) VALUES ('Errada', now(), now() - interval '1 hour')$$,
  '23514', NULL,
  'fim antes do início é recusado'
);

SELECT test_set_auth('f1530000-0000-4000-8000-00000000000b');
UPDATE public.status_manutencoes SET cancelada_em = now() WHERE id = 'f1530000-0000-4000-8000-0000000000c1';
SELECT is(
  (SELECT cancelada_em FROM public.status_manutencoes WHERE id = 'f1530000-0000-4000-8000-0000000000c1'),
  NULL,
  'usuário comum lê, mas não cancela'
);

SELECT test_set_auth('f1530000-0000-4000-8000-00000000000a');
UPDATE public.status_manutencoes SET cancelada_em = now() WHERE id = 'f1530000-0000-4000-8000-0000000000c1';
SELECT isnt(
  (SELECT cancelada_em FROM public.status_manutencoes WHERE id = 'f1530000-0000-4000-8000-0000000000c1'),
  NULL,
  'ultra admin cancela'
);

SELECT test_set_postgres();
SET LOCAL ROLE anon;
SELECT is((SELECT count(*)::int FROM public.status_manutencoes), 1, 'anon lê como na status page');

SELECT * FROM finish();
ROLLBACK;
