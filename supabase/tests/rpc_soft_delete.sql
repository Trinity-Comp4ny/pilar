-- pgTAP: soft delete por RPC (migration 20260859000000).
--
-- Prova o bug e o conserto. O bug: UPDATE direto gravando deleted_at leva
-- 42501, porque um UPDATE que referencia coluna no WHERE faz o Postgres aplicar
-- a policy de SELECT à linha NOVA, e ela exige deleted_at IS NULL.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(11);

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES
  ('eeee0000-0000-0000-0000-00000000000a', 'Empresa SD A', NULL, TRUE, '{}'::jsonb),
  ('eeee0000-0000-0000-0000-00000000000b', 'Empresa SD B', NULL, TRUE, '{}'::jsonb)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

SET LOCAL session_replication_role = 'replica';
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES
  ('eeee1111-0000-0000-0000-00000000000a', 'sd_a@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('eeee1111-0000-0000-0000-00000000000b', 'sd_b@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
SET LOCAL session_replication_role = 'origin';

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed)
VALUES
  ('eeee1111-0000-0000-0000-00000000000a', 'eeee0000-0000-0000-0000-00000000000a', 'SD', 'A', 'sd_a@test.com', 'user', TRUE),
  ('eeee1111-0000-0000-0000-00000000000b', 'eeee0000-0000-0000-0000-00000000000b', 'SD', 'B', 'sd_b@test.com', 'user', TRUE)
ON CONFLICT (id) DO UPDATE SET empresa_id = EXCLUDED.empresa_id, role = EXCLUDED.role;

INSERT INTO public.clientes (id, empresa_id, nome, contato, email)
VALUES
  ('eeee2222-0000-0000-0000-00000000000a', 'eeee0000-0000-0000-0000-00000000000a', 'Cliente da A', 'a@a.com', 'a@a.com'),
  ('eeee2222-0000-0000-0000-00000000000b', 'eeee0000-0000-0000-0000-00000000000b', 'Cliente da B', 'b@b.com', 'b@b.com')
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION test_set_auth(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

SELECT test_set_auth('eeee1111-0000-0000-0000-00000000000a');

-- =============================================
-- 1. A regressão documentada: UPDATE direto ainda falha
-- =============================================
-- Se este assert começar a passar, o Postgres mudou de comportamento (ou a
-- policy mudou) e as RPCs podem sair.
SELECT throws_ok(
  $$ UPDATE public.clientes SET deleted_at = now()
     WHERE id = 'eeee2222-0000-0000-0000-00000000000a' $$,
  '42501',
  NULL,
  'UPDATE direto gravando deleted_at continua violando a RLS'
);

-- Controle: UPDATE de outra coluna, mesmo padrão, passa. Prova que o problema é
-- especificamente a linha nova ficar invisível pra policy de SELECT.
SELECT lives_ok(
  $$ UPDATE public.clientes SET contato = 'controle@a.com'
     WHERE id = 'eeee2222-0000-0000-0000-00000000000a' $$,
  'UPDATE de outra coluna no mesmo padrão passa (controle)'
);

-- =============================================
-- 2. A RPC funciona
-- =============================================
SELECT lives_ok(
  $$ SELECT public.rpc_soft_delete('clientes', 'eeee2222-0000-0000-0000-00000000000a') $$,
  'rpc_soft_delete exclui o cliente da própria empresa'
);

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.clientes WHERE id = 'eeee2222-0000-0000-0000-00000000000a'),
  0,
  'depois de excluído, o cliente sai da listagem (policy de SELECT esconde)'
);

-- =============================================
-- 3. Desfazer
-- =============================================
SELECT lives_ok(
  $$ SELECT public.rpc_restaurar('clientes', 'eeee2222-0000-0000-0000-00000000000a') $$,
  'rpc_restaurar traz o cliente de volta (o Desfazer do toast)'
);

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.clientes WHERE id = 'eeee2222-0000-0000-0000-00000000000a'),
  1,
  'depois de restaurado, volta a aparecer'
);

-- =============================================
-- 4. Tenancy: não alcança a linha da outra empresa
-- =============================================
SELECT throws_ok(
  $$ SELECT public.rpc_soft_delete('clientes', 'eeee2222-0000-0000-0000-00000000000b') $$,
  'P0002',
  NULL,
  'não exclui registro de outra empresa (mesma resposta de inexistente)'
);

SELECT throws_ok(
  $$ SELECT public.rpc_restaurar('clientes', 'eeee2222-0000-0000-0000-00000000000b') $$,
  'P0002',
  NULL,
  'não restaura registro de outra empresa'
);

-- A linha da outra empresa segue intacta.
RESET ROLE;
SELECT is(
  (SELECT deleted_at FROM public.clientes WHERE id = 'eeee2222-0000-0000-0000-00000000000b'),
  NULL,
  'a linha da empresa B não foi tocada'
);

-- =============================================
-- 5. Allowlist: tabela fora da lista é recusada
-- =============================================
SELECT test_set_auth('eeee1111-0000-0000-0000-00000000000a');

SELECT throws_ok(
  $$ SELECT public.rpc_soft_delete('profiles', 'eeee1111-0000-0000-0000-00000000000b') $$,
  '22023',
  NULL,
  'tabela fora da allowlist é recusada (fecha o SQL dinâmico)'
);

-- Nome com injeção não escapa: cai na allowlist antes de chegar ao format().
SELECT throws_ok(
  $$ SELECT public.rpc_soft_delete('clientes; DROP TABLE public.clientes', 'eeee2222-0000-0000-0000-00000000000a') $$,
  '22023',
  NULL,
  'tentativa de injeção pelo nome da tabela é recusada pela allowlist'
);

SELECT * FROM finish();

ROLLBACK;
