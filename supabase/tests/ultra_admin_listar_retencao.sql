-- pgTAP: ultra_admin_listar_retencao (SPEC 098 Fase 3, migration
-- 20260938000000, ADR 0043).

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(7);

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

CREATE OR REPLACE FUNCTION test_set_service()
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  PERFORM set_config('role', 'service_role', true);
END; $$;

SELECT test_set_postgres();

INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role, email_confirmed_at)
VALUES
  ('fdb01111-0000-0000-0000-00000000000a', 'ualr_leitura@empresareal.com.br', jsonb_build_object('company_name', 'UALR Leitura'), 'authenticated', 'authenticated', now()),
  ('fdb01111-0000-0000-0000-00000000000b', 'ualr_trial@empresareal.com.br', jsonb_build_object('company_name', 'UALR Trial'), 'authenticated', 'authenticated', now()),
  ('fdb01111-0000-0000-0000-00000000000c', 'ualr_admin@empresareal.com.br', jsonb_build_object('company_name', 'UALR Admin'), 'authenticated', 'authenticated', now());

UPDATE public.profiles SET role = 'ultra_admin' WHERE id = 'fdb01111-0000-0000-0000-00000000000c';

UPDATE public.empresas
SET leitura_desde = now() - interval '65 days',
    retencao_aviso_60d_sent_at = now() - interval '5 days'
WHERE owner_id = 'fdb01111-0000-0000-0000-00000000000a';

-- =============================================
-- 1. Sem ultra_admin: recusa.
-- =============================================
SELECT test_set_auth('fdb01111-0000-0000-0000-00000000000b');
SELECT throws_ok(
  $$SELECT * FROM public.ultra_admin_listar_retencao()$$,
  '42501', NULL,
  'admin comum não pode listar retenção'
);

-- =============================================
-- 2. ultra_admin lista só quem está em leitura, com os dados certos.
-- =============================================
SELECT test_set_auth('fdb01111-0000-0000-0000-00000000000c');

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.ultra_admin_listar_retencao()
    WHERE empresa_id = (SELECT id FROM public.empresas WHERE owner_id = 'fdb01111-0000-0000-0000-00000000000b')
  ),
  'empresa trialing normal (sem leitura_desde) não aparece na lista'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.ultra_admin_listar_retencao()
    WHERE empresa_id = (SELECT id FROM public.empresas WHERE owner_id = 'fdb01111-0000-0000-0000-00000000000a')
  ),
  'empresa em leitura aparece na lista'
);

SELECT is(
  (SELECT dias_em_leitura FROM public.ultra_admin_listar_retencao()
     WHERE empresa_id = (SELECT id FROM public.empresas WHERE owner_id = 'fdb01111-0000-0000-0000-00000000000a')),
  65,
  'dias_em_leitura calculado a partir de leitura_desde'
);

SELECT is(
  (SELECT aviso_60d_enviado FROM public.ultra_admin_listar_retencao()
     WHERE empresa_id = (SELECT id FROM public.empresas WHERE owner_id = 'fdb01111-0000-0000-0000-00000000000a')),
  TRUE,
  'aviso_60d_enviado reflete retencao_aviso_60d_sent_at'
);

SELECT is(
  (SELECT aviso_85d_enviado FROM public.ultra_admin_listar_retencao()
     WHERE empresa_id = (SELECT id FROM public.empresas WHERE owner_id = 'fdb01111-0000-0000-0000-00000000000a')),
  FALSE,
  'aviso_85d_enviado é falso quando ainda não foi enviado'
);

-- =============================================
-- 3. Empresa já excluída (soft-deleted) some da lista.
-- =============================================
SELECT test_set_service();
SELECT public.excluir_empresa_retencao(
  (SELECT id FROM public.empresas WHERE owner_id = 'fdb01111-0000-0000-0000-00000000000a'),
  'teste de exclusão via pgTAP'
);

SELECT test_set_auth('fdb01111-0000-0000-0000-00000000000c');
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.ultra_admin_listar_retencao()
    WHERE empresa_id = (SELECT id FROM public.empresas WHERE owner_id = 'fdb01111-0000-0000-0000-00000000000a')
  ),
  'empresa já excluída (deleted_at setado) some da lista de retenção'
);

SELECT * FROM finish();
ROLLBACK;
