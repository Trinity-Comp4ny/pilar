-- pgTAP: rpc_excluir_projeto / rpc_restaurar_projeto (migration 20260858000000).
-- Cobre o bug da VRZ: soft delete por UPDATE direto viola RLS porque a policy
-- de SELECT esconde deletados e o Postgres re-checa a linha nova.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(7);

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES
  ('00000000-0000-0000-0000-00000000d0aa', 'Empresa Del A', NULL, TRUE, '{"projetos": true, "clientes": true}'::jsonb),
  ('00000000-0000-0000-0000-00000000d0bb', 'Empresa Del B', NULL, TRUE, '{"projetos": true, "clientes": true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

SET LOCAL session_replication_role = 'replica';

INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES
  ('77777777-0000-0000-0000-000000000001', 'del_membro@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('77777777-0000-0000-0000-000000000002', 'del_intruso@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

SET LOCAL session_replication_role = 'origin';

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed)
VALUES
  ('77777777-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000d0aa', 'Del', 'Membro', 'del_membro@test.com', 'user', TRUE),
  ('77777777-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000d0bb', 'Del', 'Intruso', 'del_intruso@test.com', 'user', TRUE)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

INSERT INTO public.clientes (id, empresa_id, nome, contato, email)
VALUES ('dddddddd-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000d0aa', 'Cli Del', 'cli@del.com', 'cli@del.com')
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION test_set_auth(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated', 'aal', 'aal2')::text,
    true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

RESET ROLE;
INSERT INTO public.projetos (id, empresa_id, nome, status, cliente_id)
VALUES (
  'eeeeeeee-0000-0000-0000-00000000d001',
  '00000000-0000-0000-0000-00000000d0aa',
  'Projeto del pgtap', 'Planejamento',
  'dddddddd-0000-0000-0000-00000000d001'
);

-- =============================================
-- Teste 1: regressão documentada — UPDATE direto de deleted_at viola RLS
-- (a razão de as RPCs existirem; se isto passar a viver, as RPCs podem sair)
-- =============================================
SELECT test_set_auth('77777777-0000-0000-0000-000000000001');

SELECT throws_ok(
  $$ UPDATE public.projetos SET deleted_at = NOW()
     WHERE id = 'eeeeeeee-0000-0000-0000-00000000d001' $$,
  '42501',
  NULL,
  'UPDATE direto de deleted_at viola a re-checagem de RLS (bug da VRZ)'
);

-- =============================================
-- Teste 2: membro de outra empresa não exclui
-- =============================================
SELECT test_set_auth('77777777-0000-0000-0000-000000000002');

SELECT throws_ok(
  $$ SELECT public.rpc_excluir_projeto('eeeeeeee-0000-0000-0000-00000000d001') $$,
  'Projeto não encontrado',
  'RPC não exclui projeto de outra empresa'
);

-- =============================================
-- Teste 3: membro da empresa exclui via RPC
-- =============================================
SELECT test_set_auth('77777777-0000-0000-0000-000000000001');

SELECT lives_ok(
  $$ SELECT public.rpc_excluir_projeto('eeeeeeee-0000-0000-0000-00000000d001') $$,
  'membro da empresa exclui projeto via RPC'
);

-- =============================================
-- Teste 4: projeto excluído some da listagem
-- =============================================
SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.projetos WHERE id = 'eeeeeeee-0000-0000-0000-00000000d001'),
  0,
  'projeto excluído fica invisível no SELECT'
);

-- =============================================
-- Teste 5: excluir de novo falha (já deletado)
-- =============================================
SELECT throws_ok(
  $$ SELECT public.rpc_excluir_projeto('eeeeeeee-0000-0000-0000-00000000d001') $$,
  'Projeto não encontrado',
  'excluir projeto já excluído falha'
);

-- =============================================
-- Teste 6: Desfazer — restaurar via RPC e voltar a enxergar
-- =============================================
SELECT lives_ok(
  $$ SELECT public.rpc_restaurar_projeto('eeeeeeee-0000-0000-0000-00000000d001') $$,
  'membro da empresa restaura projeto via RPC'
);

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.projetos WHERE id = 'eeeeeeee-0000-0000-0000-00000000d001'),
  1,
  'projeto restaurado volta à listagem'
);

SELECT * FROM finish();

ROLLBACK;
