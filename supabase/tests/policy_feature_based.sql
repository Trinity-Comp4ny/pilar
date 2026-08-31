-- pgTAP: valida o modelo de acesso do ADR 0029 (acesso é role + módulo da empresa).
--
-- O eixo por usuário (profiles.features, viewer|editor por chave) foi removido:
-- era ele que deixava um admin recém-convidado sem acesso a nada em produção,
-- porque os caminhos de convite gravavam '{}' e user_has_feature exigia nível
-- explícito. Estes testes fixam o comportamento novo, incluindo o caso do
-- incidente (admin sem nenhum grant escrevendo numa tabela real).
--
-- Verifica:
--  1. ultra_admin passa em tudo, inclusive no que a empresa não habilitou
--  2. admin recém-criado (sem grant nenhum) passa em feature universal
--  3. user idem, e viewer/editor não diferenciam mais nada
--  4. feature dormant continua exigindo o early access da empresa
--  5. dormant com toggle ligado libera
--  6. sem profile (ou chave fora do catálogo) continua negando
--  7. escrita real em tabela com policy de feature funciona para admin; user
--     comum é bloqueado em alertas desde SPEC 073 (exige can_view_financeiro())

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(13);

-- =============================================
-- Setup: 2 empresas, uma com early access de 'templates'
-- =============================================

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES (
  '00000000-0000-0000-0000-0000000000dd',
  'Empresa Sem Early Access',
  NULL,
  TRUE,
  '{}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES (
  '00000000-0000-0000-0000-0000000000ee',
  'Empresa Com Early Access',
  NULL,
  TRUE,
  '{"templates": true}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

SET LOCAL session_replication_role = 'replica';

INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES
  ('44444444-0000-0000-0000-000000000001', 'admin_novo@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('44444444-0000-0000-0000-000000000002', 'user_novo@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('44444444-0000-0000-0000-000000000003', 'ultra_test@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('44444444-0000-0000-0000-000000000004', 'admin_early@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

SET LOCAL session_replication_role = 'origin';

-- Admin recém-convidado: nenhum grant, é o cenário do incidente de 20/08.
INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed)
VALUES (
  '44444444-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-0000000000dd',
  'Admin', 'Novo', 'admin_novo@test.com', 'admin', TRUE
)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, empresa_id = EXCLUDED.empresa_id;

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed)
VALUES (
  '44444444-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-0000000000dd',
  'User', 'Novo', 'user_novo@test.com', 'user', TRUE
)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, empresa_id = EXCLUDED.empresa_id;

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed)
VALUES (
  '44444444-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-0000000000dd',
  'Ultra', 'Admin', 'ultra_test@test.com', 'ultra_admin', TRUE
)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed)
VALUES (
  '44444444-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-0000000000ee',
  'Admin', 'Early', 'admin_early@test.com', 'admin', TRUE
)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, empresa_id = EXCLUDED.empresa_id;

CREATE OR REPLACE FUNCTION test_set_auth(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated', 'aal', 'aal2')::text,
    true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

-- =============================================
-- 1. ultra_admin: bypass total
-- =============================================
SELECT test_set_auth('44444444-0000-0000-0000-000000000003');

SELECT ok(
  public.user_has_feature('financeiro', 'editor'),
  'ultra_admin: passa em feature universal'
);

SELECT ok(
  public.user_has_feature('templates', 'editor'),
  'ultra_admin: passa até em dormant que a empresa não habilitou'
);

-- =============================================
-- 2. Admin sem grant nenhum: o caso do incidente
-- =============================================
SELECT test_set_auth('44444444-0000-0000-0000-000000000001');

SELECT ok(
  public.user_has_feature('projetos', 'editor'),
  'admin recém-convidado escreve em projetos sem nenhum grant (ADR 0029)'
);

SELECT ok(
  public.user_has_feature('financeiro', 'editor'),
  'admin recém-convidado escreve no financeiro'
);

-- =============================================
-- 3. User comum: mesma régua, viewer e editor não diferenciam
-- =============================================
SELECT test_set_auth('44444444-0000-0000-0000-000000000002');

SELECT ok(
  public.user_has_feature('projetos', 'viewer'),
  'user: lê projetos'
);

SELECT ok(
  public.user_has_feature('projetos', 'editor'),
  'user: escreve em projetos (todo membro é editor no que a empresa tem)'
);

-- =============================================
-- 4. Dormant sem early access: continua bloqueada
-- =============================================
SELECT ok(
  NOT public.user_has_feature('templates', 'viewer'),
  'user: dormant sem early access da empresa segue bloqueada'
);

SELECT test_set_auth('44444444-0000-0000-0000-000000000001');

SELECT ok(
  NOT public.user_has_feature('templates', 'editor'),
  'admin: dormant sem early access da empresa segue bloqueada (nem admin bypassa)'
);

-- =============================================
-- 5. Dormant com early access ligado: libera
-- =============================================
SELECT test_set_auth('44444444-0000-0000-0000-000000000004');

SELECT ok(
  public.user_has_feature('templates', 'editor'),
  'empresa com templates ligado: admin passa'
);

-- =============================================
-- 6. Sem profile e chave inválida: negam
-- =============================================
SELECT test_set_auth('44444444-0000-0000-0000-000000009999');

SELECT ok(
  NOT public.user_has_feature('projetos', 'viewer'),
  'uid sem profile: negado'
);

SELECT test_set_auth('44444444-0000-0000-0000-000000000001');

SELECT ok(
  NOT public.user_has_feature('feature_que_nao_existe', 'viewer'),
  'chave fora do catálogo: negada'
);

-- =============================================
-- 7. Escrita real em tabela com policy de feature
-- =============================================
SELECT lives_ok(
  $$ INSERT INTO public.alertas (empresa_id, tipo, titulo, mensagem)
     VALUES ('00000000-0000-0000-0000-0000000000dd', 'pagamento_atrasado', 'pgtap-admin', 'msg') $$,
  'admin sem grant: INSERT em alertas funciona'
);

SELECT test_set_auth('44444444-0000-0000-0000-000000000002');

-- SPEC 073/ADR 0034: alertas passou a exigir can_view_financeiro() (admin ou
-- financeiro_delegado), não mais só a feature 'financeiro' da empresa. User
-- comum sem delegação não escreve mais aqui — era exatamente esse o ponto.
SELECT throws_ok(
  $$ INSERT INTO public.alertas (empresa_id, tipo, titulo, mensagem)
     VALUES ('00000000-0000-0000-0000-0000000000dd', 'pagamento_atrasado', 'pgtap-user', 'msg') $$,
  '42501',
  NULL,
  'user comum sem financeiro_delegado: INSERT em alertas é bloqueado'
);

SELECT * FROM finish();

ROLLBACK;
