-- pgTAP: MFA obrigatório só para o ultra admin, no servidor (ADR 0031).
--
-- Regra do produto: MFA é opcional para todo usuário e obrigatório apenas no acesso entre
-- empresas do ultra_admin. Este arquivo afirma os dois lados:
--
--   1. ultra_admin sem segundo fator (aal1) não tem poder entre empresas: nem pelas
--      policies (is_ultra_admin) nem pelas funções de plataforma.
--   2. ultra_admin com segundo fator (aal2) tem.
--   3. admin e usuário comum seguem funcionando em aal1: nada de MFA obrigatório para eles.
--   4. a exigência pode ser desligada por configuração (dev local e E2E).

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(18);

-- =============================================================================
-- Setup: ultra_admin e admin na empresa A, usuário comum na empresa B com saldo no ledger.
-- =============================================================================
SET LOCAL session_replication_role = 'replica';

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES
  ('fa000000-0000-0000-0000-0000000000a0', 'Empresa A', NULL, TRUE, '{"financeiro":true}'::jsonb),
  ('fb000000-0000-0000-0000-0000000000b0', 'Empresa B', NULL, TRUE, '{"financeiro":true}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES
  ('fa000000-0000-0000-0000-00000000a001', 'ultra@mfa.com',  '{}'::jsonb, 'authenticated', 'authenticated'),
  ('fa000000-0000-0000-0000-00000000a002', 'admin@mfa.com',  '{}'::jsonb, 'authenticated', 'authenticated'),
  ('fb000000-0000-0000-0000-00000000b001', 'user_b@mfa.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed)
VALUES
  ('fa000000-0000-0000-0000-00000000a001', 'fa000000-0000-0000-0000-0000000000a0', 'Ultra', 'A', 'ultra@mfa.com',  'ultra_admin', TRUE),
  ('fa000000-0000-0000-0000-00000000a002', 'fa000000-0000-0000-0000-0000000000a0', 'Admin', 'A', 'admin@mfa.com',  'admin',       TRUE),
  ('fb000000-0000-0000-0000-00000000b001', 'fb000000-0000-0000-0000-0000000000b0', 'User',  'B', 'user_b@mfa.com', 'user',        TRUE)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, empresa_id = EXCLUDED.empresa_id;

INSERT INTO public.ai_token_ledger (empresa_id, agent_key, source, tokens_delta, reference_id)
VALUES ('fb000000-0000-0000-0000-0000000000b0', 'ciclo', 'plan_grant', 1000, 'mfa-teste-ledger-b');

SET LOCAL session_replication_role = 'origin';

-- Sessão do usuário com o nível de autenticação pedido (aal1 = só senha, aal2 = com fator).
CREATE OR REPLACE FUNCTION test_set_auth(p_user_id uuid, p_aal text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated', 'aal', p_aal)::text, true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

-- A exigência vem ligada de fábrica (é o que roda em staging e produção).
SELECT is((SELECT exigir_mfa_ultra_admin FROM public.platform_settings WHERE id = 'default'), TRUE,
  'a exigência de MFA do ultra admin vem ligada por padrão');

-- =============================================================================
-- 1. ultra_admin sem segundo fator (aal1)
-- =============================================================================
SELECT test_set_auth('fa000000-0000-0000-0000-00000000a001', 'aal1');

SELECT is(public.is_ultra_admin(), FALSE, 'ultra admin em aal1 não é ultra admin para o banco');
SELECT is((SELECT count(*)::int FROM public.ai_token_ledger WHERE empresa_id = 'fb000000-0000-0000-0000-0000000000b0'), 0,
  'ultra admin em aal1 não lê dado de outra empresa');
SELECT throws_ok($$SELECT public.start_impersonation('user')$$, '42501', NULL,
  'ultra admin em aal1 não impersona');
SELECT throws_ok($$SELECT public.pilar_set_ultra_admin_scope(TRUE)$$, '42501', NULL,
  'ultra admin em aal1 não muda o modo de escopo');
SELECT throws_ok(
  $$SELECT public.set_access_profile('fb000000-0000-0000-0000-00000000b001', 'coordenador')$$,
  '42501', NULL, 'ultra admin em aal1 não altera perfil de usuário de outra empresa');
UPDATE public.platform_settings SET exigir_mfa_ultra_admin = FALSE WHERE id = 'default';
RESET ROLE;
SELECT is((SELECT exigir_mfa_ultra_admin FROM public.platform_settings WHERE id = 'default'), TRUE,
  'ultra admin em aal1 não consegue desligar a exigência');

-- =============================================================================
-- 2. ultra_admin com segundo fator (aal2)
-- =============================================================================
SELECT test_set_auth('fa000000-0000-0000-0000-00000000a001', 'aal2');

SELECT is(public.is_ultra_admin(), TRUE, 'ultra admin em aal2 é ultra admin');
SELECT is((SELECT count(*)::int FROM public.ai_token_ledger WHERE empresa_id = 'fb000000-0000-0000-0000-0000000000b0'), 1,
  'ultra admin em aal2 lê dado de outra empresa');
SELECT lives_ok($$SELECT public.start_impersonation('user')$$, 'ultra admin em aal2 impersona');
SELECT lives_ok($$SELECT public.pilar_set_ultra_admin_scope(FALSE)$$, 'ultra admin em aal2 muda o modo de escopo');
SELECT lives_ok(
  $$SELECT public.set_access_profile('fb000000-0000-0000-0000-00000000b001', 'coordenador')$$,
  'ultra admin em aal2 altera perfil de usuário de outra empresa');
RESET ROLE;
SELECT is((SELECT role::text FROM public.profiles WHERE id = 'fb000000-0000-0000-0000-00000000b001'), 'coordenador',
  'o perfil da outra empresa mudou de fato');

-- =============================================================================
-- 3. admin e usuário comum seguem funcionando em aal1: MFA é opcional para eles
-- =============================================================================
SELECT test_set_auth('fa000000-0000-0000-0000-00000000a002', 'aal1'); -- admin A
SELECT is(public.can_view_financeiro(), TRUE, 'admin em aal1 enxerga o financeiro da própria empresa');
SELECT is(public.is_ultra_admin(), FALSE, 'admin não é ultra admin, com ou sem MFA');
SELECT is((SELECT count(*)::int FROM public.ai_token_ledger WHERE empresa_id = 'fb000000-0000-0000-0000-0000000000b0'), 0,
  'admin em aal1 segue sem ler outra empresa (isolamento não depende de MFA)');
RESET ROLE;

-- =============================================================================
-- 4. a exigência pode ser desligada por configuração (dev local e E2E)
-- =============================================================================
UPDATE public.platform_settings SET exigir_mfa_ultra_admin = FALSE WHERE id = 'default';
SELECT test_set_auth('fa000000-0000-0000-0000-00000000a001', 'aal1');
SELECT is(public.is_ultra_admin(), TRUE, 'com a exigência desligada, ultra admin em aal1 passa');
RESET ROLE;

-- A função interna não é executável por usuário.
SELECT ok(NOT has_function_privilege('authenticated', 'public._ultra_admin_mfa_ok()', 'EXECUTE'),
  '_ultra_admin_mfa_ok não é executável por authenticated');

SELECT * FROM finish();
ROLLBACK;
