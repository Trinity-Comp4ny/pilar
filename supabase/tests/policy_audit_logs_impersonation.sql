-- pgTAP: valida que audit_logs_admin_read respeita impersonation.
-- Premissa: admin impersonando user perde acesso à tabela admin-only.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(6);

-- =============================================
-- Setup
-- =============================================

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed)
VALUES ('00000000-0000-0000-0000-0000000000bb', 'Empresa Audit', NULL, TRUE)
ON CONFLICT (id) DO NOTHING;

SET LOCAL session_replication_role = 'replica';

INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES
  ('22222222-0000-0000-0000-000000000001', 'admin_aud@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('22222222-0000-0000-0000-000000000002', 'user_aud@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

SET LOCAL session_replication_role = 'origin';

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed)
VALUES
  ('22222222-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000bb', 'Admin', 'Aud', 'admin_aud@test.com', 'admin', TRUE),
  ('22222222-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000bb', 'User', 'Aud', 'user_aud@test.com', 'user', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Insert um audit log marcado para esta suite (via service_role).
-- Filtramos pelo target_id único para não conflitar com triggers que escrevem em audit_logs
-- por causa do INSERT prévio em profiles (profiles está em sensitive_tables).
INSERT INTO public.audit_logs (empresa_id, actor_id, action, target_table, target_id, new_data)
VALUES (
  '00000000-0000-0000-0000-0000000000bb',
  '22222222-0000-0000-0000-000000000001',
  'INSERT', 'pgtap_marker',
  '00000000-0000-0000-0000-000000000fff',
  '{"test": true}'::jsonb
);

CREATE OR REPLACE FUNCTION test_set_auth(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated', 'aal', 'aal2')::text,
    true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

-- =============================================
-- Teste 1: admin sem impersonation → vê audit_logs
-- =============================================
SELECT test_set_auth('22222222-0000-0000-0000-000000000001');

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.audit_logs
   WHERE empresa_id = '00000000-0000-0000-0000-0000000000bb' AND target_table = 'pgtap_marker'),
  1,
  'admin sem impersonation lê audit_logs da empresa'
);

-- =============================================
-- Teste 2: user comum → NÃO vê audit_logs
-- =============================================
SELECT test_set_auth('22222222-0000-0000-0000-000000000002');

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.audit_logs
   WHERE empresa_id = '00000000-0000-0000-0000-0000000000bb' AND target_table = 'pgtap_marker'),
  0,
  'user comum não lê audit_logs (RLS bloqueia)'
);

-- =============================================
-- Teste 3: admin impersonando user → NÃO vê audit_logs (NOVO comportamento)
-- =============================================
SELECT test_set_auth('22222222-0000-0000-0000-000000000001');
SELECT public.start_impersonation('user', NULL, 'pgtap');

SELECT is(
  public.current_effective_role(),
  'user',
  'current_effective_role = user durante impersonation'
);

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.audit_logs
   WHERE empresa_id = '00000000-0000-0000-0000-0000000000bb' AND target_table = 'pgtap_marker'),
  0,
  'admin impersonando user NÃO lê audit_logs (policy respeita role efetivo)'
);

-- =============================================
-- Teste 4: stop_impersonation → admin recupera acesso
-- =============================================
SELECT public.stop_impersonation();

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.audit_logs
   WHERE empresa_id = '00000000-0000-0000-0000-0000000000bb' AND target_table = 'pgtap_marker'),
  1,
  'admin recupera acesso após stop_impersonation'
);

-- =============================================
-- Teste 5: admin impersonando viewer → NÃO vê
-- =============================================
SELECT public.start_impersonation('viewer', NULL, 'pgtap');

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.audit_logs
   WHERE empresa_id = '00000000-0000-0000-0000-0000000000bb' AND target_table = 'pgtap_marker'),
  0,
  'admin impersonando viewer também é bloqueado'
);

SELECT public.stop_impersonation();

SELECT * FROM finish();

ROLLBACK;
