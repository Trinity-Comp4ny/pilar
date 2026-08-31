-- pgTAP: rentabilidade reconectada a horas reais (20260869000000)
--
-- Antes desta migration, rpc_dashboard_rentabilidade/rpc_projeto_rentabilidade/
-- get_projeto_rentabilidade_detalhe zeravam horas_consumidas/custo_mao_de_obra/
-- custo_mo (timesheet dormente). Este teste prova que a nova fonte
-- (projeto_disciplinas.horas_realizadas + custo_hora) chega correta nas 3 saídas,
-- que uma disciplina sem custo_hora conta a hora mas custa R$ 0, e que uma
-- disciplina sem hora realizada nenhuma some do drill-down (custo_mo).
--
-- Persona é admin (não 'user' comum): SPEC 073/ADR 0034 (20260870000000+) pôs
-- can_view_financeiro() nas 3 RPCs — este teste é sobre a conta de horas
-- reais, não sobre controle de acesso, então usa a persona que sempre passa.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(8);

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES ('eeeeeeee-0000-0000-0000-0000000000f1', 'Empresa Rentabilidade pgtap', NULL, TRUE, '{}'::jsonb)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

SET LOCAL session_replication_role = 'replica';
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES ('eeeeeeee-1111-0000-0000-0000000000f1', 'rentab_a@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
SET LOCAL session_replication_role = 'origin';

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed)
VALUES ('eeeeeeee-1111-0000-0000-0000000000f1', 'eeeeeeee-0000-0000-0000-0000000000f1', 'Rentab', 'A', 'rentab_a@test.com', 'admin', TRUE)
ON CONFLICT (id) DO UPDATE SET empresa_id = EXCLUDED.empresa_id, role = EXCLUDED.role;

INSERT INTO public.projetos (id, empresa_id, nome, status)
VALUES ('eeeeeeee-2222-0000-0000-0000000000f1', 'eeeeeeee-0000-0000-0000-0000000000f1', 'Projeto Rentabilidade pgtap', 'Em andamento');

-- 10h a R$100/h = R$1000; 5h sem custo_hora = conta a hora, custa R$0;
-- 3h a R$50/h mas SEM hora realizada nenhuma (0h) some do drill-down.
INSERT INTO public.projeto_disciplinas (projeto_id, nome, horas_estimadas, horas_realizadas, custo_hora)
VALUES
  ('eeeeeeee-2222-0000-0000-0000000000f1', 'Estrutural pgtap', 20, 10, 100),
  ('eeeeeeee-2222-0000-0000-0000000000f1', 'Elétrica pgtap', 8, 5, NULL),
  ('eeeeeeee-2222-0000-0000-0000000000f1', 'Hidráulica pgtap', 3, 0, 50);

CREATE OR REPLACE FUNCTION test_set_auth(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated', 'aal', 'aal2')::text,
    true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

SELECT test_set_auth('eeeeeeee-1111-0000-0000-0000000000f1');

-- =============================================
-- rpc_dashboard_rentabilidade: soma as 3 disciplinas do projeto
-- =============================================
SELECT is(
  (SELECT (elem->>'horas_consumidas')::numeric
   FROM json_array_elements(rpc_dashboard_rentabilidade()) elem
   WHERE elem->>'projeto_id' = 'eeeeeeee-2222-0000-0000-0000000000f1'),
  15::numeric,
  'dashboard: horas_consumidas soma as 3 disciplinas (10+5+0)'
);

SELECT is(
  (SELECT (elem->>'custo_mao_de_obra')::numeric
   FROM json_array_elements(rpc_dashboard_rentabilidade()) elem
   WHERE elem->>'projeto_id' = 'eeeeeeee-2222-0000-0000-0000000000f1'),
  1000::numeric,
  'dashboard: custo_mao_de_obra só conta a disciplina com custo_hora (10*100), a sem taxa custa R$0'
);

-- =============================================
-- rpc_projeto_rentabilidade: mesma conta, no nível do projeto
-- =============================================
SELECT is(
  (rpc_projeto_rentabilidade('eeeeeeee-2222-0000-0000-0000000000f1')->>'horas_consumidas')::numeric,
  15::numeric,
  'projeto: horas_consumidas bate com o dashboard'
);

SELECT is(
  (rpc_projeto_rentabilidade('eeeeeeee-2222-0000-0000-0000000000f1')->>'custo_mao_de_obra')::numeric,
  1000::numeric,
  'projeto: custo_mao_de_obra bate com o dashboard'
);

-- =============================================
-- get_projeto_rentabilidade_detalhe: drill-down por disciplina
-- =============================================
SELECT is(
  jsonb_array_length(get_projeto_rentabilidade_detalhe('eeeeeeee-2222-0000-0000-0000000000f1')->'custo_mo'),
  2,
  'detalhe: só as 2 disciplinas com hora realizada > 0 aparecem no drill-down'
);

SELECT is(
  (SELECT (linha->>'valor')::numeric
   FROM jsonb_array_elements(get_projeto_rentabilidade_detalhe('eeeeeeee-2222-0000-0000-0000000000f1')->'custo_mo') linha
   WHERE linha->>'descricao' = 'Estrutural pgtap'),
  1000::numeric,
  'detalhe: linha da Estrutural mostra 10h * R$100 = R$1000'
);

SELECT is(
  (SELECT (linha->>'valor')::numeric
   FROM jsonb_array_elements(get_projeto_rentabilidade_detalhe('eeeeeeee-2222-0000-0000-0000000000f1')->'custo_mo') linha
   WHERE linha->>'descricao' = 'Elétrica pgtap'),
  0::numeric,
  'detalhe: Elétrica sem custo_hora conta as 5h mas custa R$0 (não distorce o total)'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(get_projeto_rentabilidade_detalhe('eeeeeeee-2222-0000-0000-0000000000f1')->'custo_mo') linha
    WHERE linha->>'descricao' = 'Hidráulica pgtap'
  ),
  'detalhe: Hidráulica com 0h realizada NÃO aparece no drill-down'
);

SELECT * FROM finish();

ROLLBACK;
