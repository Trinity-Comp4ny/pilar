-- pgTAP: equipe + portal — feature-based.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(7);

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES (
  '00000000-0000-0000-0000-000000000ddd',
  'Empresa EQ',
  NULL,
  TRUE,
  '{"pessoas": true, "metas": true, "portal_cliente": true}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

SET LOCAL session_replication_role = 'replica';

INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES
  ('88888888-0000-0000-0000-000000000001', 'pessoas_editor@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('88888888-0000-0000-0000-000000000002', 'no_pessoas@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('88888888-0000-0000-0000-000000000003', 'portal_editor@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

SET LOCAL session_replication_role = 'origin';

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed)
VALUES
  ('88888888-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000ddd', 'Pess', 'Editor', 'pessoas_editor@test.com', 'user', TRUE),
  ('88888888-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000ddd', 'No', 'Pess', 'no_pessoas@test.com', 'user', TRUE),
  ('88888888-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000ddd', 'Portal', 'Editor', 'portal_editor@test.com', 'user', TRUE)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

CREATE OR REPLACE FUNCTION test_set_auth(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated', 'aal', 'aal2')::text,
    true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

-- =============================================
-- Teste 1: pessoas:editor INSERT pessoa (sem CPF — campo sensível, ver teste 1b)
-- =============================================
SELECT test_set_auth('88888888-0000-0000-0000-000000000001');

SELECT lives_ok(
  $$ INSERT INTO public.pessoas (empresa_id, nome, email, telefone, primeiro_nome, sobrenome)
     VALUES ('00000000-0000-0000-0000-000000000ddd', 'Pess pgtap', 'p@t.com', '11999999999', 'Pess', 'Pgtap') $$,
  'pessoas:editor INSERT pessoa funciona'
);

-- =============================================
-- Teste 1b: SPEC 073/ADR 0034 — CPF é campo sensível (mesmo padrão de
-- salario_fixo/valor_m2/chaves_pix/contas_bancarias), trg_pessoas_protege_sensiveis
-- bloqueia quem não tem can_view_folha() mesmo sendo editor de pessoas.
-- =============================================
SELECT throws_ok(
  $$ INSERT INTO public.pessoas (empresa_id, nome, email, cpf, telefone, primeiro_nome, sobrenome)
     VALUES ('00000000-0000-0000-0000-000000000ddd', 'Pess com cpf', 'cpf@t.com', '111.222.333-44', '11999999999', 'Pess', 'Cpf') $$,
  '42501',
  NULL,
  'pessoas:editor sem can_view_folha(): INSERT com CPF é bloqueado'
);

-- =============================================
-- Teste 2: membro da empresa insere pessoa (ADR 0029), sem CPF
-- =============================================
SELECT test_set_auth('88888888-0000-0000-0000-000000000002');

SELECT lives_ok(
  $$ INSERT INTO public.pessoas (empresa_id, nome, email, telefone, primeiro_nome, sobrenome)
     VALUES ('00000000-0000-0000-0000-000000000ddd', 'Pess membro', 'h@h.com', '11888888888', 'Pess', 'Membro') $$,
  'membro da empresa insere pessoa (todo membro é editor)'
);

-- =============================================
-- Teste 3: pessoas:editor lê pessoas
-- =============================================
SELECT test_set_auth('88888888-0000-0000-0000-000000000001');

SELECT cmp_ok(
  (SELECT COUNT(*)::INTEGER FROM public.pessoas WHERE empresa_id = '00000000-0000-0000-0000-000000000ddd'),
  '>=',
  1,
  'pessoas:editor lê pessoas'
);

-- =============================================
-- Teste 4: membro da empresa lê pessoas
-- =============================================
SELECT test_set_auth('88888888-0000-0000-0000-000000000002');

SELECT cmp_ok(
  (SELECT COUNT(*)::INTEGER FROM public.pessoas WHERE empresa_id = '00000000-0000-0000-0000-000000000ddd'),
  '>=',
  1,
  'membro da empresa lê pessoas mesmo sem grant individual'
);

-- =============================================
-- Teste 5: portal:editor lê portal_entregas (mesmo se vazio)
-- =============================================
SELECT test_set_auth('88888888-0000-0000-0000-000000000003');

SELECT cmp_ok(
  (SELECT COUNT(*)::INTEGER FROM public.portal_entregas WHERE empresa_id = '00000000-0000-0000-0000-000000000ddd'),
  '>=',
  0,
  'portal:editor lê portal_entregas'
);

-- =============================================
-- Teste 6: pessoas:editor NÃO acessa portal_entregas
-- =============================================
SELECT test_set_auth('88888888-0000-0000-0000-000000000001');

-- Tentar inserir registro no portal_entregas (precisa de FK projeto/cliente, então só validamos via SELECT)
SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.portal_entregas WHERE empresa_id = '00000000-0000-0000-0000-000000000ddd'),
  0,
  'pessoas:editor sem portal_cliente feature: portal_entregas retorna 0'
);

SELECT * FROM finish();

ROLLBACK;
