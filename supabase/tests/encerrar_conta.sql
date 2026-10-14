-- pgTAP: encerrar conta (SPEC 116, migration 20261028000000).
--
-- 1. Conta desativada perde o acesso a dado na hora, mesmo com token válido.
-- 2. Fila de exclusão LGPD: só ultra admin lê; "único admin" calculado certo.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(9);

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

-- a: admin da empresa A. b: membro da empresa A. c: ultra admin.
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role, email_confirmed_at)
VALUES
  ('fdb11600-0000-0000-0000-00000000000a', 'enc_admin@empresareal.com.br', jsonb_build_object('company_name', 'ENC Empresa'), 'authenticated', 'authenticated', now()),
  ('fdb11600-0000-0000-0000-00000000000b', 'enc_membro@empresareal.com.br', jsonb_build_object('company_name', 'ENC Outra'), 'authenticated', 'authenticated', now()),
  ('fdb11600-0000-0000-0000-00000000000c', 'enc_ultra@empresareal.com.br', jsonb_build_object('company_name', 'ENC Ultra'), 'authenticated', 'authenticated', now());

UPDATE public.profiles
SET empresa_id = (SELECT empresa_id FROM public.profiles WHERE id = 'fdb11600-0000-0000-0000-00000000000a'),
    role = 'colaborador'
WHERE id = 'fdb11600-0000-0000-0000-00000000000b';
UPDATE public.profiles SET role = 'admin' WHERE id = 'fdb11600-0000-0000-0000-00000000000a';
UPDATE public.profiles SET role = 'ultra_admin' WHERE id = 'fdb11600-0000-0000-0000-00000000000c';

INSERT INTO public.data_deletion_requests (user_id, empresa_id, motivo)
SELECT id, empresa_id, 'teste' FROM public.profiles
WHERE id IN ('fdb11600-0000-0000-0000-00000000000a', 'fdb11600-0000-0000-0000-00000000000b');

-- =============================================
-- 1. Conta desativada: get_user_empresa_id() devolve NULL.
-- =============================================
SELECT test_set_auth('fdb11600-0000-0000-0000-00000000000b');
SELECT ok(public.get_user_empresa_id() IS NOT NULL, 'membro ativo enxerga a própria empresa');

SELECT test_set_postgres();
UPDATE public.profiles SET desativado_em = now() WHERE id = 'fdb11600-0000-0000-0000-00000000000b';

SELECT test_set_auth('fdb11600-0000-0000-0000-00000000000b');
SELECT ok(public.get_user_empresa_id() IS NULL, 'membro desativado não enxerga empresa nenhuma');
SELECT ok(public.get_user_empresa_id_text() IS NULL, 'a versão texto também ignora desativado');
SELECT is(
  (SELECT count(*)::int FROM public.profiles WHERE empresa_id = (
     SELECT empresa_id FROM public.profiles WHERE id = 'fdb11600-0000-0000-0000-00000000000a')),
  0,
  'token de conta desativada não lê perfis da empresa (RLS)'
);

-- =============================================
-- 2. Fila de pedidos de exclusão.
-- =============================================
SELECT test_set_auth('fdb11600-0000-0000-0000-00000000000a');
SELECT throws_ok(
  $$SELECT * FROM public.ultra_admin_listar_pedidos_exclusao()$$,
  '42501', NULL,
  'admin comum não lê a fila de exclusão'
);

SELECT test_set_auth('fdb11600-0000-0000-0000-00000000000c');
SELECT is(
  (SELECT unico_admin FROM public.ultra_admin_listar_pedidos_exclusao()
   WHERE user_id = 'fdb11600-0000-0000-0000-00000000000a'),
  true,
  'único admin ativo da empresa é marcado'
);
SELECT is(
  (SELECT unico_admin FROM public.ultra_admin_listar_pedidos_exclusao()
   WHERE user_id = 'fdb11600-0000-0000-0000-00000000000b'),
  false,
  'membro sem papel de admin não é marcado'
);
SELECT is(
  (SELECT prazo_em - requested_at FROM public.ultra_admin_listar_pedidos_exclusao()
   WHERE user_id = 'fdb11600-0000-0000-0000-00000000000a'),
  interval '15 days',
  'prazo é de 15 dias a partir do pedido'
);

-- =============================================
-- 3. Falha ao executar fica registrada.
-- =============================================
SELECT test_set_postgres();
SELECT lives_ok(
  $$UPDATE public.data_deletion_requests SET status = 'failed'
    WHERE user_id = 'fdb11600-0000-0000-0000-00000000000b'$$,
  'status failed é aceito'
);

SELECT * FROM finish();
ROLLBACK;
