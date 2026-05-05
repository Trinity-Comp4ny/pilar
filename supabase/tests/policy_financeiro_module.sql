-- pgTAP: módulo financeiro completo cobrindo o lote 20260504270000.
-- Pattern homogêneo nas 7 tabelas — testamos receitas e despesas como representativas.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(10);

-- =============================================
-- Setup
-- =============================================

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES (
  '00000000-0000-0000-0000-0000000000ff',
  'Empresa Fin',
  NULL,
  TRUE,
  '{"financeiro": true, "leads": true, "projetos": true}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

SET LOCAL session_replication_role = 'replica';

INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES
  ('55555555-0000-0000-0000-000000000001', 'fin_editor@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('55555555-0000-0000-0000-000000000002', 'fin_viewer@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('55555555-0000-0000-0000-000000000003', 'no_fin@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('55555555-0000-0000-0000-000000000004', 'ultra_fin@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

SET LOCAL session_replication_role = 'origin';

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed, features)
VALUES
  ('55555555-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000ff', 'Fin', 'Editor', 'fin_editor@test.com', 'user', TRUE, '{"financeiro": "editor"}'::jsonb),
  ('55555555-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000ff', 'Fin', 'Viewer', 'fin_viewer@test.com', 'user', TRUE, '{"financeiro": "viewer"}'::jsonb),
  ('55555555-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000ff', 'No', 'Fin', 'no_fin@test.com', 'user', TRUE, '{}'::jsonb),
  ('55555555-0000-0000-0000-000000000004', '00000000-0000-0000-0000-0000000000ff', 'Ultra', 'Fin', 'ultra_fin@test.com', 'ultra_admin', TRUE, '{}'::jsonb)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features, role = EXCLUDED.role;

CREATE OR REPLACE FUNCTION test_set_auth(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated', 'aal', 'aal2')::text,
    true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

-- Inserir uma receita base (via service_role — bypass RLS)
RESET ROLE;
INSERT INTO public.receitas (id, empresa_id, descricao, valor, data_vencimento, status)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '00000000-0000-0000-0000-0000000000ff',
  'Receita base pgtap', 1000, CURRENT_DATE, 'Pendente'
);

INSERT INTO public.despesas (id, empresa_id, descricao, valor, data_vencimento, status)
VALUES (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '00000000-0000-0000-0000-0000000000ff',
  'Despesa base pgtap', 500, CURRENT_DATE, 'Pendente'
);

-- =============================================
-- Teste 1: viewer lê receitas
-- =============================================
SELECT test_set_auth('55555555-0000-0000-0000-000000000002');

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.receitas WHERE empresa_id = '00000000-0000-0000-0000-0000000000ff'),
  1,
  'viewer lê receitas (SELECT permitido)'
);

-- =============================================
-- Teste 2: viewer NÃO escreve receitas
-- =============================================
SELECT throws_ok(
  $$ INSERT INTO public.receitas (empresa_id, descricao, valor, data_vencimento, status)
     VALUES ('00000000-0000-0000-0000-0000000000ff', 'tentativa viewer', 100, CURRENT_DATE, 'Pendente') $$,
  '42501',
  NULL,
  'viewer NÃO insere receitas'
);

-- =============================================
-- Teste 3: viewer NÃO atualiza despesas
-- =============================================
WITH updated AS (
  UPDATE public.despesas SET descricao = 'hack viewer'
  WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  RETURNING 1
)
SELECT is(
  (SELECT COUNT(*)::INTEGER FROM updated),
  0,
  'viewer UPDATE despesas: 0 rows (RLS oculta)'
);

-- =============================================
-- Teste 4: editor escreve receitas
-- =============================================
SELECT test_set_auth('55555555-0000-0000-0000-000000000001');

SELECT lives_ok(
  $$ INSERT INTO public.receitas (empresa_id, descricao, valor, data_vencimento, status)
     VALUES ('00000000-0000-0000-0000-0000000000ff', 'editor insert', 200, CURRENT_DATE, 'Pendente') $$,
  'editor INSERT receitas funciona'
);

-- =============================================
-- Teste 5: user sem feature financeiro NÃO lê receitas
-- =============================================
SELECT test_set_auth('55555555-0000-0000-0000-000000000003');

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.receitas WHERE empresa_id = '00000000-0000-0000-0000-0000000000ff'),
  0,
  'user sem feature financeiro: SELECT retorna 0 (RLS oculta)'
);

SELECT throws_ok(
  $$ INSERT INTO public.receitas (empresa_id, descricao, valor, data_vencimento, status)
     VALUES ('00000000-0000-0000-0000-0000000000ff', 'tentativa sem fin', 100, CURRENT_DATE, 'Pendente') $$,
  '42501',
  NULL,
  'user sem feature: INSERT receitas BLOQUEADO'
);

-- =============================================
-- Teste 6: ultra_admin bypassa tudo
-- =============================================
SELECT test_set_auth('55555555-0000-0000-0000-000000000004');

SELECT cmp_ok(
  (SELECT COUNT(*)::INTEGER FROM public.receitas WHERE empresa_id = '00000000-0000-0000-0000-0000000000ff'),
  '>=',
  1,
  'ultra_admin lê receitas mesmo sem feature'
);

SELECT lives_ok(
  $$ INSERT INTO public.despesas (empresa_id, descricao, valor, data_vencimento, status)
     VALUES ('00000000-0000-0000-0000-0000000000ff', 'ultra insert', 50, CURRENT_DATE, 'Pendente') $$,
  'ultra_admin INSERT despesas funciona sem feature'
);

-- =============================================
-- Teste 7: editor lê e escreve em contas/cartoes/fornecedores (smoke)
-- =============================================
SELECT test_set_auth('55555555-0000-0000-0000-000000000001');

SELECT lives_ok(
  $$ INSERT INTO public.fornecedores (empresa_id, nome, cnpj)
     VALUES ('00000000-0000-0000-0000-0000000000ff', 'Forn pgtap', '11.222.333/0001-44') $$,
  'editor INSERT fornecedores funciona'
);

-- =============================================
-- Teste 8: viewer NÃO escreve em fornecedores
-- =============================================
SELECT test_set_auth('55555555-0000-0000-0000-000000000002');

SELECT throws_ok(
  $$ INSERT INTO public.fornecedores (empresa_id, nome, cnpj)
     VALUES ('00000000-0000-0000-0000-0000000000ff', 'Forn viewer', '99.888.777/0001-66') $$,
  '42501',
  NULL,
  'viewer INSERT fornecedores BLOQUEADO'
);

SELECT * FROM finish();

ROLLBACK;
