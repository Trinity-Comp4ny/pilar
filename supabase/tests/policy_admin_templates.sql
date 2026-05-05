-- pgTAP: lote final — templates_projeto (operacional) + administrativas (empresas, profiles).

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(8);

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES (
  '00000000-0000-0000-0000-000000000eee',
  'Empresa Final',
  NULL,
  TRUE,
  '{"templates": true, "leads": true}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

SET LOCAL session_replication_role = 'replica';

INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES
  ('99999999-0000-0000-0000-000000000001', 'admin_final@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('99999999-0000-0000-0000-000000000002', 'user_tpl@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('99999999-0000-0000-0000-000000000003', 'user_no_tpl@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

SET LOCAL session_replication_role = 'origin';

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed, features)
VALUES
  ('99999999-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000eee', 'Admin', 'Final', 'admin_final@test.com', 'admin', TRUE, '{"templates": "editor"}'::jsonb),
  ('99999999-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000eee', 'User', 'Tpl', 'user_tpl@test.com', 'user', TRUE, '{"templates": "editor"}'::jsonb),
  ('99999999-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000eee', 'User', 'NoTpl', 'user_no_tpl@test.com', 'user', TRUE, '{}'::jsonb)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features, role = EXCLUDED.role;

CREATE OR REPLACE FUNCTION test_set_auth(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated', 'aal', 'aal2')::text,
    true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

-- =============================================
-- Teste 1: user com templates:editor INSERT template
-- =============================================
SELECT test_set_auth('99999999-0000-0000-0000-000000000002');

SELECT lives_ok(
  $$ INSERT INTO public.templates_projeto (empresa_id, nome, descricao, tipo_servico)
     VALUES ('00000000-0000-0000-0000-000000000eee', 'Tpl pgtap', 'Descricao', 'arquitetura') $$,
  'user com templates:editor INSERT funciona'
);

-- =============================================
-- Teste 2: user sem feature templates NÃO insere
-- =============================================
SELECT test_set_auth('99999999-0000-0000-0000-000000000003');

SELECT throws_ok(
  $$ INSERT INTO public.templates_projeto (empresa_id, nome, descricao, tipo_servico)
     VALUES ('00000000-0000-0000-0000-000000000eee', 'Tpl hack', 'd', 'arquitetura') $$,
  '42501',
  NULL,
  'user sem templates: INSERT BLOQUEADO'
);

-- =============================================
-- Teste 3: admin atualiza própria empresa
-- =============================================
SELECT test_set_auth('99999999-0000-0000-0000-000000000001');

SELECT lives_ok(
  $$ UPDATE public.empresas SET nome = 'Empresa Final v2'
     WHERE id = '00000000-0000-0000-0000-000000000eee' $$,
  'admin UPDATE própria empresa funciona'
);

-- =============================================
-- Teste 4: user comum NÃO atualiza empresa (administrativo)
-- =============================================
SELECT test_set_auth('99999999-0000-0000-0000-000000000002');

WITH updated AS (
  UPDATE public.empresas SET nome = 'hack'
  WHERE id = '00000000-0000-0000-0000-000000000eee'
  RETURNING 1
)
SELECT is(
  (SELECT COUNT(*)::INTEGER FROM updated),
  0,
  'user comum UPDATE empresas: 0 rows (RLS bloqueia administrativo)'
);

-- =============================================
-- Teste 5: admin gere profiles da empresa (admin INSERT/UPDATE em outros profiles)
-- =============================================
SELECT test_set_auth('99999999-0000-0000-0000-000000000001');

SELECT lives_ok(
  $$ UPDATE public.profiles SET features = '{}'::jsonb
     WHERE id = '99999999-0000-0000-0000-000000000003' $$,
  'admin atualiza features de outro profile da mesma empresa'
);

-- =============================================
-- Teste 6: admin impersonando user PERDE acesso administrativo a profiles
-- =============================================
SELECT public.start_impersonation('user', NULL, 'pgtap');

WITH updated AS (
  UPDATE public.profiles SET features = '{"templates": "viewer"}'::jsonb
  WHERE id = '99999999-0000-0000-0000-000000000002'
  RETURNING 1
)
SELECT is(
  (SELECT COUNT(*)::INTEGER FROM updated),
  0,
  'admin impersonando user: UPDATE profiles bloqueado (current_effective_role=user)'
);

SELECT public.stop_impersonation();

-- =============================================
-- Teste 7: usuário lê próprio profile sempre
-- =============================================
SELECT test_set_auth('99999999-0000-0000-0000-000000000003');

SELECT cmp_ok(
  (SELECT COUNT(*)::INTEGER FROM public.profiles WHERE id = '99999999-0000-0000-0000-000000000003'),
  '>=',
  1,
  'user lê próprio profile'
);

-- =============================================
-- Teste 8: user comum NÃO atualiza profile de outro
-- =============================================
WITH updated AS (
  UPDATE public.profiles SET features = '{}'::jsonb
  WHERE id = '99999999-0000-0000-0000-000000000002'
  RETURNING 1
)
SELECT is(
  (SELECT COUNT(*)::INTEGER FROM updated),
  0,
  'user comum UPDATE profile de outro: 0 rows (RLS bloqueia administrativo)'
);

SELECT * FROM finish();

ROLLBACK;
