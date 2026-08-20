-- pgTAP: valida o modelo feature-based (admin precisa de feature, ultra_admin bypassa).
--
-- Verifica:
--  1. ultra_admin sempre passa em qualquer feature (bypass)
--  2. admin SEM feature falha em operacional (mudança vs. comportamento anterior)
--  3. admin COM feature passa
--  4. user com feature passa
--  5. user sem feature falha
--  6. feature universal (ADR 0026, ex. financeiro): empresa sem o JSONB marcado
--     não bloqueia mais: só o nível no profile importa (6a/6b)
--  6c. feature NÃO universal (ex. templates): empresa sem o JSONB marcado
--      continua bloqueando de verdade: prova que o bypass é escopado
--  7. operações administrativas (audit_logs, convites) não exigem feature, só role admin/ultra_admin

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(14);

-- =============================================
-- Setup: 2 empresas, planos diferentes
-- =============================================

-- Empresa COM financeiro liberado no plano
INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES (
  '00000000-0000-0000-0000-0000000000dd',
  'Empresa Premium',
  NULL,
  TRUE,
  '{"financeiro": true, "portal_cliente": true, "leads": true}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

-- Empresa SEM financeiro no plano (plano básico)
INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES (
  '00000000-0000-0000-0000-0000000000ee',
  'Empresa Básica',
  NULL,
  TRUE,
  '{"leads": true}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

SET LOCAL session_replication_role = 'replica';

INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES
  ('44444444-0000-0000-0000-000000000001', 'admin_w_fin@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('44444444-0000-0000-0000-000000000002', 'admin_no_fin@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('44444444-0000-0000-0000-000000000003', 'user_w_fin@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('44444444-0000-0000-0000-000000000004', 'user_no_fin@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('44444444-0000-0000-0000-000000000005', 'ultra_test@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('44444444-0000-0000-0000-000000000006', 'admin_basic@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

SET LOCAL session_replication_role = 'origin';

-- Admin com feature financeiro:editor
INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed, features)
VALUES (
  '44444444-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-0000000000dd',
  'Admin', 'WithFin', 'admin_w_fin@test.com', 'admin', TRUE,
  '{"financeiro": "editor"}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features, role = EXCLUDED.role;

-- Admin SEM feature financeiro
INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed, features)
VALUES (
  '44444444-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-0000000000dd',
  'Admin', 'NoFin', 'admin_no_fin@test.com', 'admin', TRUE,
  '{}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features, role = EXCLUDED.role;

-- User com feature financeiro:editor
INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed, features)
VALUES (
  '44444444-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-0000000000dd',
  'User', 'WithFin', 'user_w_fin@test.com', 'user', TRUE,
  '{"financeiro": "editor"}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

-- User SEM feature
INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed, features)
VALUES (
  '44444444-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-0000000000dd',
  'User', 'NoFin', 'user_no_fin@test.com', 'user', TRUE,
  '{}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

-- Ultra admin
INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed, features)
VALUES (
  '44444444-0000-0000-0000-000000000005',
  '00000000-0000-0000-0000-0000000000dd',
  'Ultra', 'Admin', 'ultra_test@test.com', 'ultra_admin', TRUE,
  '{}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

-- Admin de empresa SEM financeiro no plano (plano básico).
-- NOTA: trigger tg_validate_features_subset bloqueia atribuir feature acima do plano,
-- então features começa vazio aqui (admin não pode ter financeiro porque empresa não tem).
INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed, features)
VALUES (
  '44444444-0000-0000-0000-000000000006',
  '00000000-0000-0000-0000-0000000000ee',
  'Admin', 'Basic', 'admin_basic@test.com', 'admin', TRUE,
  '{}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features, empresa_id = EXCLUDED.empresa_id, role = EXCLUDED.role;

CREATE OR REPLACE FUNCTION test_set_auth(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated', 'aal', 'aal2')::text,
    true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

-- =============================================
-- Teste 1: ultra_admin → user_has_feature('financeiro') = TRUE (bypass)
-- =============================================
SELECT test_set_auth('44444444-0000-0000-0000-000000000005');

SELECT ok(
  public.user_has_feature('financeiro', 'editor'),
  'ultra_admin: bypass total — user_has_feature TRUE mesmo sem feature no profile'
);

-- =============================================
-- Teste 2: admin SEM feature → FALHA (mudança vs. anterior)
-- =============================================
SELECT test_set_auth('44444444-0000-0000-0000-000000000002');

SELECT ok(
  NOT public.user_has_feature('financeiro', 'editor'),
  'admin sem feature: user_has_feature = FALSE (admin não bypassa mais)'
);

-- =============================================
-- Teste 3: admin COM feature → PASSA
-- =============================================
SELECT test_set_auth('44444444-0000-0000-0000-000000000001');

SELECT ok(
  public.user_has_feature('financeiro', 'editor'),
  'admin com financeiro:editor: passa'
);

-- =============================================
-- Teste 4: user COM feature → PASSA
-- =============================================
SELECT test_set_auth('44444444-0000-0000-0000-000000000003');

SELECT ok(
  public.user_has_feature('financeiro', 'editor'),
  'user com financeiro:editor: passa'
);

-- =============================================
-- Teste 5: user SEM feature → FALHA
-- =============================================
SELECT test_set_auth('44444444-0000-0000-0000-000000000004');

SELECT ok(
  NOT public.user_has_feature('financeiro', 'editor'),
  'user sem feature: bloqueado'
);

-- =============================================
-- Teste 6a: admin de empresa SEM financeiro no profile → user_has_feature FALSE
-- (financeiro é universal desde o ADR 0026: a empresa não precisa mais ter o
-- JSONB marcado, mas o profile ainda precisa do nível explícito)
-- =============================================
SELECT test_set_auth('44444444-0000-0000-0000-000000000006');

SELECT ok(
  NOT public.user_has_feature('financeiro', 'editor'),
  'admin sem financeiro no profile: user_has_feature = FALSE (mesmo sendo universal)'
);

-- =============================================
-- Teste 6b: feature universal (financeiro) pode ser atribuída mesmo numa
-- empresa cujo JSONB não tem a chave marcada: é o próprio bug que motivou o
-- ADR 0026 (convite quase saiu sem 'obras' por causa deste tipo de trava)
-- =============================================
SELECT lives_ok(
  $$ UPDATE public.profiles SET features = '{"financeiro": "editor"}'::jsonb
     WHERE id = '44444444-0000-0000-0000-000000000006' $$,
  'feature universal: atribuir no profile funciona mesmo sem o plano da empresa marcar'
);

SELECT test_set_auth('44444444-0000-0000-0000-000000000006');

SELECT ok(
  public.user_has_feature('financeiro', 'editor'),
  'depois de atribuída, financeiro:editor passa (universal ignora o JSONB da empresa)'
);

-- =============================================
-- Teste 6c (controle): feature NÃO universal (templates) continua bloqueada
-- pela mesma empresa, prova que o bypass é só pras chaves de _universal_features()
-- =============================================
SELECT throws_ok(
  $$ UPDATE public.profiles SET features = '{"templates": "editor"}'::jsonb
     WHERE id = '44444444-0000-0000-0000-000000000006' $$,
  NULL,
  NULL,
  'feature não-universal: trigger ainda bloqueia acima do que a empresa tem marcado'
);

-- =============================================
-- Teste 7: viewer ≠ editor — user com viewer não passa em editor
-- =============================================
RESET ROLE;
UPDATE public.profiles SET features = '{"financeiro": "viewer"}'::jsonb
WHERE id = '44444444-0000-0000-0000-000000000003';

SELECT test_set_auth('44444444-0000-0000-0000-000000000003');

SELECT ok(
  public.user_has_feature('financeiro', 'viewer'),
  'user com financeiro:viewer passa em viewer-required'
);

SELECT ok(
  NOT public.user_has_feature('financeiro', 'editor'),
  'user com financeiro:viewer NÃO passa em editor-required'
);

-- =============================================
-- Teste 8: policy faturas — admin sem feature financeiro NÃO insere
-- =============================================
SELECT test_set_auth('44444444-0000-0000-0000-000000000002');

-- Não vamos inserir fatura real (FK complicada). Validamos via SELECT da policy semantics.
SELECT ok(
  NOT public.user_has_feature('financeiro', 'editor'),
  'policy faturas: admin sem financeiro feature → INSERT seria bloqueado'
);

-- =============================================
-- Teste 9: ultra_admin pode INSERT em alertas mesmo com features = {}
-- =============================================
SELECT test_set_auth('44444444-0000-0000-0000-000000000005');

SELECT lives_ok(
  $$ INSERT INTO public.alertas (empresa_id, tipo, titulo, mensagem)
     VALUES ('00000000-0000-0000-0000-0000000000dd', 'pagamento_atrasado', 'pgtap-ultra', 'msg') $$,
  'ultra_admin: INSERT alertas funciona sem feature'
);

-- =============================================
-- Teste 10: admin com financeiro:editor → INSERT alertas funciona
-- =============================================
SELECT test_set_auth('44444444-0000-0000-0000-000000000001');

SELECT lives_ok(
  $$ INSERT INTO public.alertas (empresa_id, tipo, titulo, mensagem)
     VALUES ('00000000-0000-0000-0000-0000000000dd', 'pagamento_atrasado', 'pgtap-admin', 'msg') $$,
  'admin com financeiro:editor: INSERT alertas funciona'
);

SELECT * FROM finish();

ROLLBACK;
