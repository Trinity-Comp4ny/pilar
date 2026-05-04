-- pgTAP tests para foundation server-side de impersonation.
-- Cobertura:
--   1. start_impersonation rejeita callers sem privilégio
--   2. start_impersonation rejeita escalation (target=admin/ultra_admin)
--   3. start_impersonation rejeita target_role inválido
--   4. session ativa é criada com expires_at = 30min
--   5. start novo encerra sessão prévia (uma por admin)
--   6. is_impersonating reflete sessão ativa
--   7. current_effective_role retorna target_role durante sessão e role real após stop
--   8. stop_impersonation encerra a sessão
--   9. session expirada não é considerada ativa
--  10. cleanup function encerra sessões expiradas

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(22);

-- =============================================
-- Setup
-- =============================================

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed)
VALUES ('00000000-0000-0000-0000-0000000000aa', 'Empresa Imp', NULL, TRUE)
ON CONFLICT (id) DO NOTHING;

-- Desabilita triggers user-defined dentro desta transação (não requer ownership).
-- session_replication_role='replica' faz Postgres pular triggers user-level mantendo internos.
SET LOCAL session_replication_role = 'replica';

INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES
  ('11111111-0000-0000-0000-000000000001', 'admin_imp@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('11111111-0000-0000-0000-000000000002', 'user_imp@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('11111111-0000-0000-0000-000000000003', 'ultra_imp@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

SET LOCAL session_replication_role = 'origin';

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed)
VALUES
  ('11111111-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000aa', 'Admin', 'Imp', 'admin_imp@test.com', 'admin', TRUE),
  ('11111111-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000aa', 'User', 'Imp', 'user_imp@test.com', 'user', TRUE),
  ('11111111-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000aa', 'Ultra', 'Imp', 'ultra_imp@test.com', 'ultra_admin', TRUE)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION test_set_auth(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated', 'aal', 'aal2')::text,
    true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

-- Limpar qualquer sessão prévia de testes
DELETE FROM public.impersonation_sessions WHERE admin_id::TEXT LIKE '11111111-%';

-- =============================================
-- Teste 1: usuário comum NÃO pode iniciar impersonation
-- =============================================
SELECT test_set_auth('11111111-0000-0000-0000-000000000002');

SELECT throws_ok(
  $$ SELECT public.start_impersonation('viewer', NULL, NULL) $$,
  '42501',
  NULL,
  'user comum recebe 42501 ao tentar start_impersonation'
);

-- =============================================
-- Teste 2: admin tentando impersonar admin → bloqueado
-- =============================================
SELECT test_set_auth('11111111-0000-0000-0000-000000000001');

SELECT throws_ok(
  $$ SELECT public.start_impersonation('admin', NULL, NULL) $$,
  '42501',
  NULL,
  'admin não pode impersonar admin (anti-escalation)'
);

-- =============================================
-- Teste 3: admin tentando impersonar ultra_admin → bloqueado
-- =============================================
SELECT throws_ok(
  $$ SELECT public.start_impersonation('ultra_admin', NULL, NULL) $$,
  '42501',
  NULL,
  'admin não pode impersonar ultra_admin'
);

-- =============================================
-- Teste 4: target_role inválido é rejeitado
-- =============================================
SELECT throws_ok(
  $$ SELECT public.start_impersonation('hacker', NULL, NULL) $$,
  '22023',
  NULL,
  'target_role fora da whitelist é rejeitado'
);

-- =============================================
-- Teste 5: admin inicia sessão válida
-- =============================================
SELECT lives_ok(
  $$ SELECT public.start_impersonation('user', '127.0.0.1', 'pgtap') $$,
  'admin pode impersonar user'
);

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.impersonation_sessions
   WHERE admin_id = '11111111-0000-0000-0000-000000000001' AND ended_at IS NULL),
  1,
  'há exatamente 1 sessão ativa após start'
);

-- =============================================
-- Teste 6: is_impersonating reflete sessão
-- =============================================
SELECT ok(
  public.is_impersonating(),
  'is_impersonating() = TRUE durante sessão'
);

-- =============================================
-- Teste 7: current_effective_role retorna target durante sessão
-- =============================================
SELECT is(
  public.current_effective_role(),
  'user',
  'current_effective_role = target_role durante sessão'
);

-- =============================================
-- Teste 8: expires_at = NOW + 30min (margem ±2min)
-- =============================================
SELECT ok(
  (SELECT expires_at BETWEEN NOW() + INTERVAL '28 minutes' AND NOW() + INTERVAL '32 minutes'
   FROM public.impersonation_sessions
   WHERE admin_id = '11111111-0000-0000-0000-000000000001' AND ended_at IS NULL),
  'expires_at = ~30 minutos no futuro'
);

-- =============================================
-- Teste 9: start novo encerra sessão prévia
-- =============================================
SELECT lives_ok(
  $$ SELECT public.start_impersonation('viewer', NULL, NULL) $$,
  'segundo start funciona'
);

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.impersonation_sessions
   WHERE admin_id = '11111111-0000-0000-0000-000000000001' AND ended_at IS NULL),
  1,
  'apenas 1 sessão ativa por admin (segundo start encerra primeiro)'
);

SELECT is(
  public.current_effective_role(),
  'viewer',
  'current_effective_role atualiza para o novo target'
);

-- =============================================
-- Teste 10: stop_impersonation encerra
-- =============================================
SELECT lives_ok(
  $$ SELECT public.stop_impersonation() $$,
  'stop_impersonation executa sem erro'
);

SELECT ok(
  NOT public.is_impersonating(),
  'is_impersonating() = FALSE após stop'
);

SELECT is(
  public.current_effective_role(),
  'admin',
  'current_effective_role volta a role real após stop'
);

-- =============================================
-- Teste 11: session expirada NÃO é considerada ativa
-- =============================================
-- INSERT direto requer bypass de RLS (na prod isso vem da Edge Function via service_role).
RESET ROLE;
INSERT INTO public.impersonation_sessions (admin_id, admin_role, target_role, started_at, expires_at)
VALUES (
  '11111111-0000-0000-0000-000000000001',
  'admin', 'user',
  NOW() - INTERVAL '2 hours',
  NOW() - INTERVAL '90 minutes'
);

SELECT test_set_auth('11111111-0000-0000-0000-000000000001');

SELECT ok(
  NOT public.is_impersonating(),
  'session já expirada não é considerada ativa'
);

SELECT is(
  public.current_effective_role(),
  'admin',
  'session expirada não afeta current_effective_role'
);

-- =============================================
-- Teste 12: cleanup encerra expiradas
-- =============================================
SELECT ok(
  (SELECT COUNT(*)::INTEGER FROM public.impersonation_sessions
   WHERE admin_id = '11111111-0000-0000-0000-000000000001'
     AND ended_at IS NULL
     AND expires_at < NOW()) >= 1,
  'há sessão expirada não fechada antes do cleanup'
);

-- cleanup precisa de service_role; chamamos via SET LOCAL
RESET ROLE;
SELECT public.impersonation_sessions_cleanup();
SELECT test_set_auth('11111111-0000-0000-0000-000000000001');

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.impersonation_sessions
   WHERE admin_id = '11111111-0000-0000-0000-000000000001'
     AND ended_at IS NULL
     AND expires_at < NOW()),
  0,
  'cleanup encerra sessões expiradas'
);

-- =============================================
-- Teste 13: ultra_admin pode impersonar
-- =============================================
SELECT test_set_auth('11111111-0000-0000-0000-000000000003');

SELECT lives_ok(
  $$ SELECT public.start_impersonation('user', NULL, NULL) $$,
  'ultra_admin pode iniciar impersonation'
);

SELECT is(
  public.current_effective_role(),
  'user',
  'ultra_admin impersonando: current_effective_role = user'
);

SELECT public.stop_impersonation();

-- =============================================
-- Teste 14: usuário sem profile não vaza role
-- =============================================
-- (cobertura de edge case do agente: has_role vs profile NULL)
SELECT test_set_auth('99999999-9999-9999-9999-999999999999');

SELECT throws_ok(
  $$ SELECT public.start_impersonation('user', NULL, NULL) $$,
  '42501',
  NULL,
  'user sem profile recebe 42501 (não vaza estado)'
);

SELECT * FROM finish();

ROLLBACK;
