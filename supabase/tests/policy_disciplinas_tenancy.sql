-- pgTAP: `disciplinas` isolada por empresa (SPEC 058, follow-up).
--
-- Antes desta migration a tabela não tinha empresa_id: o catálogo era global e
-- compartilhado, então disciplina cadastrada por um cliente aparecia para todos
-- os outros, e qualquer membro com o módulo Projetos escrevia nele.
--
-- Modelo: empresa_id NULL = semente padrão do produto (todos veem);
-- preenchido = da empresa, invisível para as outras.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(9);

-- Duas empresas, um membro em cada.
INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES
  ('dddddddd-0000-0000-0000-0000000000a1', 'Empresa Disc A', NULL, TRUE, '{}'::jsonb),
  ('dddddddd-0000-0000-0000-0000000000b2', 'Empresa Disc B', NULL, TRUE, '{}'::jsonb)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

SET LOCAL session_replication_role = 'replica';
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES
  ('dddddddd-1111-0000-0000-0000000000a1', 'disc_a@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('dddddddd-1111-0000-0000-0000000000b2', 'disc_b@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
SET LOCAL session_replication_role = 'origin';

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed)
VALUES
  ('dddddddd-1111-0000-0000-0000000000a1', 'dddddddd-0000-0000-0000-0000000000a1', 'Disc', 'A', 'disc_a@test.com', 'user', TRUE),
  ('dddddddd-1111-0000-0000-0000000000b2', 'dddddddd-0000-0000-0000-0000000000b2', 'Disc', 'B', 'disc_b@test.com', 'user', TRUE)
ON CONFLICT (id) DO UPDATE SET empresa_id = EXCLUDED.empresa_id, role = EXCLUDED.role;

-- Semente global (o que o produto entrega pronto) e uma disciplina só da B.
INSERT INTO public.disciplinas (id, nome, empresa_id)
VALUES
  ('dddddddd-2222-0000-0000-00000000005e', 'Semente pgtap', NULL),
  ('dddddddd-2222-0000-0000-0000000000b2', 'Só da B pgtap', 'dddddddd-0000-0000-0000-0000000000b2')
ON CONFLICT (id) DO UPDATE SET empresa_id = EXCLUDED.empresa_id;

CREATE OR REPLACE FUNCTION test_set_auth(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated', 'aal', 'aal2')::text,
    true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

-- =============================================
-- 1. A vê a semente global
-- =============================================
SELECT test_set_auth('dddddddd-1111-0000-0000-0000000000a1');

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.disciplinas WHERE id = 'dddddddd-2222-0000-0000-00000000005e'),
  1,
  'empresa A vê a semente global (empresa_id NULL)'
);

-- =============================================
-- 2. A NÃO vê a disciplina da B: era exatamente o vazamento
-- =============================================
SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.disciplinas WHERE id = 'dddddddd-2222-0000-0000-0000000000b2'),
  0,
  'empresa A NÃO vê disciplina da empresa B'
);

-- =============================================
-- 3. Insert nasce com a empresa do autor, sem o cliente informar
-- =============================================
SELECT lives_ok(
  $$ INSERT INTO public.disciplinas (nome) VALUES ('Criada pela A pgtap') $$,
  'membro da A cria disciplina (front insere só o nome)'
);

SELECT is(
  (SELECT empresa_id FROM public.disciplinas WHERE nome = 'Criada pela A pgtap'),
  'dddddddd-0000-0000-0000-0000000000a1'::uuid,
  'a disciplina criada nasce com empresa_id do autor (DEFAULT), não global'
);

-- =============================================
-- 4. Cliente não consegue escrever no catálogo global
-- =============================================
SELECT throws_ok(
  $$ INSERT INTO public.disciplinas (nome, empresa_id) VALUES ('Tentativa global pgtap', NULL) $$,
  '42501',
  NULL,
  'cliente NÃO insere na semente global (empresa_id NULL)'
);

SELECT throws_ok(
  $$ INSERT INTO public.disciplinas (nome, empresa_id)
     VALUES ('Tentativa cross pgtap', 'dddddddd-0000-0000-0000-0000000000b2') $$,
  '42501',
  NULL,
  'cliente NÃO insere disciplina em nome de outra empresa'
);

-- =============================================
-- 5. Cliente não apaga a semente global nem o dado da outra empresa
-- =============================================
WITH d AS (
  DELETE FROM public.disciplinas WHERE id = 'dddddddd-2222-0000-0000-00000000005e' RETURNING 1
)
SELECT is(
  (SELECT COUNT(*)::INTEGER FROM d),
  0,
  'cliente NÃO apaga disciplina da semente global'
);

WITH d AS (
  DELETE FROM public.disciplinas WHERE id = 'dddddddd-2222-0000-0000-0000000000b2' RETURNING 1
)
SELECT is(
  (SELECT COUNT(*)::INTEGER FROM d),
  0,
  'cliente NÃO apaga disciplina de outra empresa'
);

-- =============================================
-- 6. B enxerga a sua e a semente, mas não a que a A acabou de criar
-- =============================================
SELECT test_set_auth('dddddddd-1111-0000-0000-0000000000b2');

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.disciplinas WHERE nome = 'Criada pela A pgtap'),
  0,
  'empresa B NÃO vê a disciplina criada pela A'
);

SELECT * FROM finish();

ROLLBACK;
