-- pgTAP: módulo financeiro completo cobrindo o lote 20260504270000.
-- Pattern homogêneo nas 7 tabelas — testamos receitas e despesas como representativas.
--
-- SPEC 073/ADR 0034: financeiro deixou de ser gateado por
-- user_has_feature('financeiro', ...) — ADR 0029 fazia "todo membro é editor"
-- valer aqui, o que achatou financeiro pra visão geral da empresa. Agora o
-- gate é can_view_financeiro() (helper puro: admin sempre, ou
-- profiles.financeiro_delegado = true). Feature module da empresa não entra
-- mais nessa conta. Este arquivo testa o modelo novo: admin e delegado
-- passam, user comum sem delegação é bloqueado, ultra_admin bypassa tudo.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(11);

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
  ('55555555-0000-0000-0000-000000000001', 'fin_admin@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('55555555-0000-0000-0000-000000000002', 'fin_delegado@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('55555555-0000-0000-0000-000000000003', 'no_fin@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('55555555-0000-0000-0000-000000000004', 'ultra_fin@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

SET LOCAL session_replication_role = 'origin';

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, financeiro_delegado, onboarding_completed)
VALUES
  ('55555555-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000ff', 'Fin', 'Admin', 'fin_admin@test.com', 'admin', FALSE, TRUE),
  ('55555555-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000ff', 'Fin', 'Delegado', 'fin_delegado@test.com', 'user', TRUE, TRUE),
  ('55555555-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000ff', 'No', 'Fin', 'no_fin@test.com', 'user', FALSE, TRUE),
  ('55555555-0000-0000-0000-000000000004', '00000000-0000-0000-0000-0000000000ff', 'Ultra', 'Fin', 'ultra_fin@test.com', 'ultra_admin', FALSE, TRUE)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, financeiro_delegado = EXCLUDED.financeiro_delegado;

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
-- Teste 1: admin lê receitas
-- =============================================
SELECT test_set_auth('55555555-0000-0000-0000-000000000001');

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.receitas WHERE empresa_id = '00000000-0000-0000-0000-0000000000ff'),
  1,
  'admin lê receitas (SELECT permitido)'
);

-- =============================================
-- Teste 2: admin escreve receitas
-- =============================================
SELECT lives_ok(
  $$ INSERT INTO public.receitas (empresa_id, descricao, valor, data_vencimento, status)
     VALUES ('00000000-0000-0000-0000-0000000000ff', 'insert admin', 100, CURRENT_DATE, 'Pendente') $$,
  'admin insere receita'
);

-- =============================================
-- Teste 3: admin atualiza despesa da própria empresa
-- =============================================
WITH updated AS (
  UPDATE public.despesas SET descricao = 'editado por admin'
  WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  RETURNING 1
)
SELECT is(
  (SELECT COUNT(*)::INTEGER FROM updated),
  1,
  'admin: UPDATE despesas afeta a linha'
);

-- =============================================
-- Teste 4: user com financeiro_delegado=true lê e escreve receitas
-- =============================================
SELECT test_set_auth('55555555-0000-0000-0000-000000000002');

SELECT cmp_ok(
  (SELECT COUNT(*)::INTEGER FROM public.receitas WHERE empresa_id = '00000000-0000-0000-0000-0000000000ff'),
  '>=',
  1,
  'user com financeiro_delegado: lê receitas'
);

SELECT lives_ok(
  $$ INSERT INTO public.receitas (empresa_id, descricao, valor, data_vencimento, status)
     VALUES ('00000000-0000-0000-0000-0000000000ff', 'insert delegado', 200, CURRENT_DATE, 'Pendente') $$,
  'user com financeiro_delegado: INSERT receitas funciona'
);

-- =============================================
-- Teste 5: user comum sem financeiro_delegado NÃO vê nem escreve financeiro.
-- É o ponto inteiro da SPEC 073/ADR 0034: financeiro deixa de ser visão
-- padrão de todo membro e passa a exigir concessão explícita.
-- =============================================
SELECT test_set_auth('55555555-0000-0000-0000-000000000003');

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.receitas WHERE empresa_id = '00000000-0000-0000-0000-0000000000ff'),
  0,
  'user sem financeiro_delegado: SELECT receitas não retorna nada'
);

SELECT throws_ok(
  $$ INSERT INTO public.receitas (empresa_id, descricao, valor, data_vencimento, status)
     VALUES ('00000000-0000-0000-0000-0000000000ff', 'insert sem delegacao', 100, CURRENT_DATE, 'Pendente') $$,
  '42501',
  NULL,
  'user sem financeiro_delegado: INSERT receitas é bloqueado'
);

-- =============================================
-- Teste 6: ultra_admin bypassa tudo
-- =============================================
SELECT test_set_auth('55555555-0000-0000-0000-000000000004');

SELECT cmp_ok(
  (SELECT COUNT(*)::INTEGER FROM public.receitas WHERE empresa_id = '00000000-0000-0000-0000-0000000000ff'),
  '>=',
  1,
  'ultra_admin lê receitas mesmo sem financeiro_delegado'
);

SELECT lives_ok(
  $$ INSERT INTO public.despesas (empresa_id, descricao, valor, data_vencimento, status)
     VALUES ('00000000-0000-0000-0000-0000000000ff', 'ultra insert', 50, CURRENT_DATE, 'Pendente') $$,
  'ultra_admin INSERT despesas funciona sem financeiro_delegado'
);

-- =============================================
-- Teste 7: fornecedores segue o mesmo gate (smoke): admin escreve,
-- user sem delegação é bloqueado.
-- =============================================
SELECT test_set_auth('55555555-0000-0000-0000-000000000001');

SELECT lives_ok(
  $$ INSERT INTO public.fornecedores (empresa_id, nome, cnpj)
     VALUES ('00000000-0000-0000-0000-0000000000ff', 'Forn pgtap', '11.222.333/0001-44') $$,
  'admin INSERT fornecedores funciona'
);

SELECT test_set_auth('55555555-0000-0000-0000-000000000003');

SELECT throws_ok(
  $$ INSERT INTO public.fornecedores (empresa_id, nome, cnpj)
     VALUES ('00000000-0000-0000-0000-0000000000ff', 'Forn sem delegacao', '99.888.777/0001-66') $$,
  '42501',
  NULL,
  'user sem financeiro_delegado: INSERT fornecedor é bloqueado'
);

SELECT * FROM finish();

ROLLBACK;
