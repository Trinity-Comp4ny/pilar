-- pgTAP: create_projeto_completo / update_projeto_completo (migration 20260905000000).
--
-- Cobre os dois bugs de produção de 03/09 relatados pela VRZ:
--   1. código PRJ-XXXX gerado no client ignorava soft-deletado e colidia com o
--      unique (que é total), travando a criação de projeto para sempre;
--   2. quem não tem can_view_financeiro() não conseguia salvar edição nenhuma
--      num projeto com valor, porque o form mandava o 0 do valor mascarado.
--
-- Convenções deste arquivo: criar sempre autenticado (a RPC lê auth.uid()) e
-- verificar sempre com RESET ROLE + claim zerado, senão a policy de SELECT de
-- projetos esconde a linha do próprio teste e o trigger de valor confunde
-- fixture com escrita de usuário.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(8);

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES ('00000000-0000-0000-0000-00000000c0d1', 'Empresa Codigo', NULL, TRUE, '{"projetos": true, "financeiro": true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

SET LOCAL session_replication_role = 'replica';

INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES
  ('88888888-0000-0000-0000-00000000c001', 'cod_user@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('88888888-0000-0000-0000-00000000c002', 'cod_admin@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

-- Fixture do projeto que já tem valor: entra com os triggers desligados de
-- propósito. Com eles ligados, tg_projetos_protege_valor barraria o próprio
-- setup (auth.uid() ainda é NULL aqui, logo can_view_financeiro() é falso).
INSERT INTO public.projetos (id, empresa_id, nome, status, valor_contrato)
VALUES ('cccccccc-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000c0d1', 'Projeto Com Valor', 'Planejamento', 200000);

SET LOCAL session_replication_role = 'origin';

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed)
VALUES
  ('88888888-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000c0d1', 'Cod', 'User', 'cod_user@test.com', 'user', TRUE),
  ('88888888-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-00000000c0d1', 'Cod', 'Admin', 'cod_admin@test.com', 'admin', TRUE)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

CREATE OR REPLACE FUNCTION test_set_auth(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated', 'aal', 'aal2')::text,
    true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

-- JSON vazio, não string vazia: auth.uid() faz cast pra json e '' quebraria.
CREATE OR REPLACE FUNCTION test_clear_auth()
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{}', true);
END; $$;

-- ── Caso A: primeira criação da empresa gera PRJ-0001 ──
SELECT test_set_auth('88888888-0000-0000-0000-00000000c001');
SELECT public.create_projeto_completo('', 'Projeto Um', NULL);
RESET ROLE;
SELECT test_clear_auth();

SELECT is(
  (SELECT codigo_projeto FROM public.projetos WHERE nome = 'Projeto Um'),
  'PRJ-0001',
  'Caso A: empresa sem projeto PRJ- gera PRJ-0001'
);

-- ── Caso B: o fix. Maior código soft-deletado não é reusado ──
UPDATE public.projetos SET deleted_at = now() WHERE nome = 'Projeto Um';

SELECT test_set_auth('88888888-0000-0000-0000-00000000c001');
SELECT public.create_projeto_completo('', 'Projeto Dois', NULL);
RESET ROLE;
SELECT test_clear_auth();

SELECT is(
  (SELECT codigo_projeto FROM public.projetos WHERE nome = 'Projeto Dois'),
  'PRJ-0002',
  'Caso B: PRJ-0001 soft-deletado não é reusado, gera PRJ-0002 (era o travamento da VRZ)'
);

-- ── Caso C: código informado à mão continua respeitado (QuickAddCard) ──
SELECT test_set_auth('88888888-0000-0000-0000-00000000c001');
SELECT public.create_projeto_completo('OBRA-42', 'Projeto Manual', NULL);
RESET ROLE;
SELECT test_clear_auth();

SELECT is(
  (SELECT codigo_projeto FROM public.projetos WHERE nome = 'Projeto Manual'),
  'OBRA-42',
  'Caso C: p_codigo informado é respeitado, servidor não sobrescreve'
);

-- ── Caso D: código fora do padrão PRJ- não desloca a sequência ──
SELECT test_set_auth('88888888-0000-0000-0000-00000000c001');
SELECT public.create_projeto_completo('', 'Projeto Tres', NULL);
RESET ROLE;
SELECT test_clear_auth();

SELECT is(
  (SELECT codigo_projeto FROM public.projetos WHERE nome = 'Projeto Tres'),
  'PRJ-0003',
  'Caso D: código fora do padrão PRJ- é ignorado no cálculo da sequência'
);

-- ── Caso E: user sem financeiro cria projeto sem valor (o fluxo da Liz) ──
SELECT test_set_auth('88888888-0000-0000-0000-00000000c001');

SELECT lives_ok(
  $$ SELECT public.create_projeto_completo('', 'Projeto Sem Valor', NULL, NULL, NULL, NULL, NULL) $$,
  'Caso E: user sem financeiro cria projeto com valor NULL sem ser barrado'
);

-- ── Caso F: user sem financeiro edita campo não-financeiro de projeto com valor ──
SELECT lives_ok(
  $$ SELECT public.update_projeto_completo(
       'cccccccc-0000-0000-0000-00000000c001', 'PRJ-9001', 'Nome Novo', NULL,
       NULL, NULL, NULL, NULL, '', '', NULL, 0, '[]'::jsonb, 'Planejamento', 'Media') $$,
  'Caso F: user sem financeiro edita nome mandando valor NULL, sem ser barrado'
);

-- ── Caso G: user sem financeiro tentando mudar o valor continua barrado ──
SELECT throws_ok(
  $$ SELECT public.update_projeto_completo(
       'cccccccc-0000-0000-0000-00000000c001', 'PRJ-9001', 'Nome Novo', NULL,
       NULL, NULL, NULL, 1, '', '', NULL, 0, '[]'::jsonb, 'Planejamento', 'Media') $$,
  '42501',
  'Sem permissão para alterar valor de contrato',
  'Caso G: user sem financeiro mandando valor diferente segue barrado'
);

RESET ROLE;
SELECT test_clear_auth();

SELECT is(
  (SELECT valor_contrato FROM public.projetos WHERE id = 'cccccccc-0000-0000-0000-00000000c001'),
  200000::numeric,
  'Caso F/G: valor de contrato permanece intacto depois das duas tentativas'
);

SELECT * FROM finish();
ROLLBACK;
