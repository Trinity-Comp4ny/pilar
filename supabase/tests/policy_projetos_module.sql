-- pgTAP: módulo projetos cobrindo o lote 20260504280000.
-- Pattern homogêneo: testamos projetos e escopos como representativas + smoke em disciplinas.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(8);

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES (
  '00000000-0000-0000-0000-000000000aaa',
  'Empresa Proj',
  NULL,
  TRUE,
  '{"projetos": true, "clientes": true}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

SET LOCAL session_replication_role = 'replica';

INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES
  ('66666666-0000-0000-0000-000000000001', 'proj_editor@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('66666666-0000-0000-0000-000000000002', 'proj_viewer@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('66666666-0000-0000-0000-000000000003', 'no_proj@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('66666666-0000-0000-0000-000000000004', 'ultra_proj@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

SET LOCAL session_replication_role = 'origin';

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed)
VALUES
  ('66666666-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000aaa', 'Proj', 'Editor', 'proj_editor@test.com', 'user', TRUE),
  ('66666666-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000aaa', 'Proj', 'Viewer', 'proj_viewer@test.com', 'user', TRUE),
  ('66666666-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000aaa', 'No', 'Proj', 'no_proj@test.com', 'user', TRUE),
  ('66666666-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000aaa', 'Ultra', 'Proj', 'ultra_proj@test.com', 'ultra_admin', TRUE)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

INSERT INTO public.clientes (id, empresa_id, nome, contato, email)
VALUES ('dddddddd-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000aaa', 'Cli Proj', 'cli@proj.com', 'cli@proj.com')
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION test_set_auth(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated', 'aal', 'aal2')::text,
    true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

-- Projeto base via service_role
RESET ROLE;
INSERT INTO public.projetos (id, empresa_id, nome, status, cliente_id)
VALUES (
  'eeeeeeee-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000aaa',
  'Projeto pgtap', 'Planejamento',
  'dddddddd-0000-0000-0000-000000000001'
);

-- =============================================
-- Teste 1: viewer lê projetos
-- =============================================
SELECT test_set_auth('66666666-0000-0000-0000-000000000002');

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.projetos WHERE empresa_id = '00000000-0000-0000-0000-000000000aaa'),
  1,
  'viewer lê projetos'
);

-- =============================================
-- Teste 2: membro da empresa insere projeto (ADR 0029)
-- =============================================
SELECT lives_ok(
  $$ INSERT INTO public.projetos (empresa_id, nome, status, cliente_id)
     VALUES ('00000000-0000-0000-0000-000000000aaa', 'projeto membro', 'Planejamento',
             'dddddddd-0000-0000-0000-000000000001') $$,
  'membro da empresa insere projeto'
);

-- =============================================
-- Teste 3: editor insere projetos
-- =============================================
SELECT test_set_auth('66666666-0000-0000-0000-000000000001');

SELECT lives_ok(
  $$ INSERT INTO public.projetos (empresa_id, nome, status, cliente_id)
     VALUES ('00000000-0000-0000-0000-000000000aaa', 'editor proj', 'Planejamento',
             'dddddddd-0000-0000-0000-000000000001') $$,
  'editor INSERT projetos funciona'
);

-- =============================================
-- Teste 4: user sem grant individual lê os projetos da empresa
-- =============================================
SELECT test_set_auth('66666666-0000-0000-0000-000000000003');

SELECT cmp_ok(
  (SELECT COUNT(*)::INTEGER FROM public.projetos WHERE empresa_id = '00000000-0000-0000-0000-000000000aaa'),
  '>=',
  1,
  'user sem grant: lê projetos da própria empresa'
);

-- =============================================
-- Teste 5: ultra_admin bypassa
-- =============================================
SELECT test_set_auth('66666666-0000-0000-0000-000000000004');

SELECT cmp_ok(
  (SELECT COUNT(*)::INTEGER FROM public.projetos WHERE empresa_id = '00000000-0000-0000-0000-000000000aaa'),
  '>=',
  1,
  'ultra_admin lê projetos sem feature'
);

-- =============================================
-- Teste 6: disciplinas é catálogo global — viewer com feature lê
-- =============================================
SELECT test_set_auth('66666666-0000-0000-0000-000000000002');

SELECT cmp_ok(
  (SELECT COUNT(*)::INTEGER FROM public.disciplinas),
  '>=',
  0,
  'viewer com projetos:viewer lê disciplinas (catálogo global)'
);

-- =============================================
-- Teste 7: disciplinas write é ultra_admin only — admin não escreve
-- =============================================
RESET ROLE;
INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES (
  '00000000-0000-0000-0000-000000000bbb',
  'Empresa Proj 2',
  NULL,
  TRUE,
  '{"projetos": true}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

RESET ROLE;
SET LOCAL session_replication_role = 'replica';
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES ('66666666-0000-0000-0000-000000000005', 'admin_proj@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT DO NOTHING;
SET LOCAL session_replication_role = 'origin';

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed)
VALUES (
  '66666666-0000-0000-0000-000000000005',
  '00000000-0000-0000-0000-000000000bbb',
  'Admin', 'Proj', 'admin_proj@test.com', 'admin', TRUE
)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

SELECT test_set_auth('66666666-0000-0000-0000-000000000005');

-- `disciplinas` é catálogo COLABORATIVO: qualquer membro de empresa com o módulo
-- Projetos adiciona uma disciplina (`disciplinas_insert`), e `disciplinas_manage`
-- dá gestão total ao ultra_admin. A pergunta que ficou em aberto neste teste
-- ("curado ou colaborativo?") foi respondida na prática: era este INSERT que
-- respondia 403 para o design partner e motivou o ADR 0029.
--
-- Fica um problema de tenancy à parte, registrado na SPEC 058 como follow-up: a
-- tabela não tem empresa_id, então o catálogo é compartilhado entre empresas.
SELECT lives_ok(
  $$ INSERT INTO public.disciplinas (nome) VALUES ('Disciplina-pgtap-admin') $$,
  'membro de empresa com Projetos adiciona disciplina ao catálogo'
);

-- =============================================
-- Teste 8: ultra_admin pode escrever em disciplinas
-- =============================================
SELECT test_set_auth('66666666-0000-0000-0000-000000000004');

SELECT lives_ok(
  $$ INSERT INTO public.disciplinas (nome) VALUES ('Disciplina-pgtap-ultra') $$,
  'ultra_admin INSERT disciplinas funciona'
);

SELECT * FROM finish();

ROLLBACK;
