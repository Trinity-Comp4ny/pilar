-- pgTAP: ordem de prioridade dos projetos (SPEC 143, BEZ-350).
--
-- Roda como authenticated com o JWT do admin (RLS ligada: como superuser a RLS não se aplica).
-- A ordem é uma só por empresa: o admin da empresa B não reordena projeto da A.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(14);

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES
  ('00000000-0000-0000-0000-0000000143a1', 'Empresa A ordem pgtap', NULL, TRUE, '{"projetos": true}'::jsonb),
  ('00000000-0000-0000-0000-0000000143b1', 'Empresa B ordem pgtap', NULL, TRUE, '{"projetos": true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

SET LOCAL session_replication_role = 'replica';
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role, email_confirmed_at)
VALUES
  ('66666666-0000-0000-0000-000000143001', 'ordem_a_admin@pgtap.test', '{}'::jsonb, 'authenticated', 'authenticated', now()),
  ('66666666-0000-0000-0000-000000143002', 'ordem_b_admin@pgtap.test', '{}'::jsonb, 'authenticated', 'authenticated', now())
ON CONFLICT (id) DO NOTHING;
SET LOCAL session_replication_role = 'origin';

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed)
VALUES
  ('66666666-0000-0000-0000-000000143001', '00000000-0000-0000-0000-0000000143a1', 'A', 'Admin', 'ordem_a_admin@pgtap.test', 'admin', TRUE),
  ('66666666-0000-0000-0000-000000143002', '00000000-0000-0000-0000-0000000143b1', 'B', 'Admin', 'ordem_b_admin@pgtap.test', 'admin', TRUE)
ON CONFLICT (id) DO UPDATE SET empresa_id = EXCLUDED.empresa_id, role = EXCLUDED.role;

DO $$ BEGIN
  PERFORM set_config('request.jwt.claims',
    '{"sub": "66666666-0000-0000-0000-000000143001", "role": "authenticated"}', true);
END $$;

-- O gate de capacidade por nível barra a fixture: desligado só para montar os projetos.
SET LOCAL session_replication_role = 'replica';
INSERT INTO public.projetos (id, empresa_id, nome, status, data_previsao)
VALUES
  ('77777777-0000-0000-0000-000000143001', '00000000-0000-0000-0000-0000000143a1', 'P1 ordem pgtap', 'Em andamento', CURRENT_DATE + 30),
  ('77777777-0000-0000-0000-000000143002', '00000000-0000-0000-0000-0000000143a1', 'P2 ordem pgtap', 'Em andamento', CURRENT_DATE + 30),
  ('77777777-0000-0000-0000-000000143003', '00000000-0000-0000-0000-0000000143a1', 'P3 ordem pgtap', 'Em andamento', CURRENT_DATE + 30);
SET LOCAL session_replication_role = 'origin';

DO $$ BEGIN
  PERFORM set_config('request.jwt.claims',
    '{"sub": "66666666-0000-0000-0000-000000143002", "role": "authenticated"}', true);
END $$;

SET LOCAL session_replication_role = 'replica';
INSERT INTO public.projetos (id, empresa_id, nome, status, data_previsao)
VALUES ('77777777-0000-0000-0000-000000143009', '00000000-0000-0000-0000-0000000143b1', 'PB ordem pgtap', 'Em andamento', CURRENT_DATE + 30);
SET LOCAL session_replication_role = 'origin';

CREATE OR REPLACE FUNCTION pg_temp.como(p_user uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

-- Projeto novo nasce sem ordem
SELECT is((SELECT ordem_prioridade FROM public.projetos WHERE id = '77777777-0000-0000-0000-000000143001'), NULL,
  'projeto novo nasce sem ordem de prioridade');

-- =====================================================================
-- A. Admin da empresa A reordena
-- =====================================================================
SELECT pg_temp.como('66666666-0000-0000-0000-000000143001');

SELECT lives_ok(
  $$SELECT public.rpc_reordenar_projetos(ARRAY[
      '77777777-0000-0000-0000-000000143003',
      '77777777-0000-0000-0000-000000143001',
      '77777777-0000-0000-0000-000000143002']::uuid[])$$,
  'admin reordena os projetos da própria empresa');

RESET ROLE;
SELECT results_eq(
  $$SELECT nome, ordem_prioridade FROM public.projetos
    WHERE empresa_id = '00000000-0000-0000-0000-0000000143a1' ORDER BY ordem_prioridade$$,
  $$VALUES ('P3 ordem pgtap'::text, 1), ('P1 ordem pgtap'::text, 2), ('P2 ordem pgtap'::text, 3)$$,
  'a ordem vira 1..N na sequência recebida');

SELECT pg_temp.como('66666666-0000-0000-0000-000000143001');
SELECT lives_ok(
  $$SELECT public.rpc_reordenar_projetos(ARRAY[
      '77777777-0000-0000-0000-000000143003',
      '77777777-0000-0000-0000-000000143001',
      '77777777-0000-0000-0000-000000143002']::uuid[])$$,
  'repetir a mesma ordem não falha');

SELECT lives_ok($$SELECT public.rpc_reordenar_projetos(ARRAY[]::uuid[])$$, 'lista vazia não faz nada');
SELECT lives_ok($$SELECT public.rpc_reordenar_projetos(NULL)$$, 'lista nula não faz nada');

SELECT throws_ok(
  $$SELECT public.rpc_reordenar_projetos(ARRAY[
      '77777777-0000-0000-0000-000000143001',
      '77777777-0000-0000-0000-000000143001']::uuid[])$$,
  'P0001', 'A lista de projetos tem repetidos',
  'id repetido na lista é recusado');

-- um id de outra empresa derruba a chamada inteira: nada é gravado
SELECT throws_ok(
  $$SELECT public.rpc_reordenar_projetos(ARRAY[
      '77777777-0000-0000-0000-000000143002',
      '77777777-0000-0000-0000-000000143009']::uuid[])$$,
  'P0001', 'Projeto não encontrado ou sem permissão',
  'projeto de outra empresa na lista derruba a chamada');

RESET ROLE;
SELECT is((SELECT ordem_prioridade FROM public.projetos WHERE id = '77777777-0000-0000-0000-000000143002'), 3,
  'a chamada recusada não gravou nada (P2 segue na posição 3)');

-- o front lê por projetos_safe: a ordem precisa chegar por ela
SELECT pg_temp.como('66666666-0000-0000-0000-000000143001');
SELECT is((SELECT ordem_prioridade FROM public.projetos_safe WHERE id = '77777777-0000-0000-0000-000000143003'), 1,
  'projetos_safe expõe a ordem de prioridade');

-- =====================================================================
-- B. Admin da empresa B não mexe na ordem da A
-- =====================================================================
SELECT pg_temp.como('66666666-0000-0000-0000-000000143002');

SELECT throws_ok(
  $$SELECT public.rpc_reordenar_projetos(ARRAY['77777777-0000-0000-0000-000000143001']::uuid[])$$,
  'P0001', 'Projeto não encontrado ou sem permissão',
  'admin de outra empresa não reordena projeto alheio');

-- =====================================================================
-- C. Grants
-- =====================================================================
RESET ROLE;

SELECT is(has_function_privilege('anon', 'public.rpc_reordenar_projetos(uuid[])', 'EXECUTE'), FALSE,
  'anon não executa a RPC');
SELECT is(has_function_privilege('authenticated', 'public.rpc_reordenar_projetos(uuid[])', 'EXECUTE'), TRUE,
  'authenticated executa a RPC');

SELECT is((SELECT ordem_prioridade FROM public.projetos WHERE id = '77777777-0000-0000-0000-000000143009'), NULL,
  'o projeto da empresa B segue sem ordem');

SELECT * FROM finish();
ROLLBACK;
