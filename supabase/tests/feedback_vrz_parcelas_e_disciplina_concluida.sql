-- pgTAP: feedback da VRZ (16/10), migration 20261109000000.
--
--   1. o painel do /inicio não conta disciplina 'Concluído' como vencida (o filtro
--      comparava com 'concluida', valor que a coluna nunca guarda)
--   2. o resumo semanal usa o mesmo critério
--   3. a parcela gerada leva o nome do projeto e o cliente dele, nunca o código
--      gerado pelo sistema (PRJ-0034)
--
-- O painel é SECURITY INVOKER: o teste lê como usuário autenticado, não como
-- superuser, para o RLS filtrar a empresa.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(6);

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES ('00000000-0000-0000-0000-0000000fe001'::uuid, 'Empresa Feedback', NULL, TRUE,
        '{"projetos": true, "financeiro": true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES ('dddddddd-0000-0000-0000-0000000fe001'::uuid, 'socio_feedback@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed)
VALUES ('dddddddd-0000-0000-0000-0000000fe001'::uuid, '00000000-0000-0000-0000-0000000fe001'::uuid,
        'Socio', 'Feedback', 'socio_feedback@test.com', 'admin', TRUE)
ON CONFLICT (id) DO UPDATE SET empresa_id = EXCLUDED.empresa_id, role = EXCLUDED.role;

CREATE OR REPLACE FUNCTION test_set_auth(p_user_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

INSERT INTO public.clientes (id, empresa_id, nome)
VALUES ('eeeeeeee-0000-0000-0000-0000000fe001'::uuid, '00000000-0000-0000-0000-0000000fe001'::uuid, 'Cliente Feedback');

-- Projeto concluído e projeto ativo, cada um com disciplina 'Concluído' de data_fim
-- vencida (NÃO é atraso). O projeto ativo ainda tem uma 'Não Iniciado' vencida (É atraso).
INSERT INTO public.projetos (id, empresa_id, nome, status, data_previsao, cliente_id, valor_contrato)
VALUES ('bbbbbbbb-0000-0000-0000-0000000fe001'::uuid, '00000000-0000-0000-0000-0000000fe001'::uuid,
        '300 - Projeto concluido', 'Concluído', current_date - 30, NULL, NULL),
       ('bbbbbbbb-0000-0000-0000-0000000fe002'::uuid, '00000000-0000-0000-0000-0000000fe001'::uuid,
        '421 - Projeto ativo', 'Em andamento', current_date + 30, 'eeeeeeee-0000-0000-0000-0000000fe001'::uuid, 12000);

INSERT INTO public.projeto_disciplinas (id, projeto_id, nome, status, data_fim)
VALUES ('cccccccc-0000-0000-0000-0000000fe001'::uuid, 'bbbbbbbb-0000-0000-0000-0000000fe001'::uuid,
        'Disciplina entregue', 'Concluído', current_date - 20),
       ('cccccccc-0000-0000-0000-0000000fe002'::uuid, 'bbbbbbbb-0000-0000-0000-0000000fe002'::uuid,
        'Disciplina aberta', 'Não Iniciado', current_date - 3),
       ('cccccccc-0000-0000-0000-0000000fe003'::uuid, 'bbbbbbbb-0000-0000-0000-0000000fe002'::uuid,
        'Disciplina entregue no projeto ativo', 'Concluído', current_date - 5);

SELECT test_set_auth('dddddddd-0000-0000-0000-0000000fe001'::uuid);

CREATE TEMP TABLE painel AS SELECT public.get_painel_gestao() AS j;
CREATE TEMP TABLE resumo AS SELECT public.get_resumo_semanal_fatos() AS j;

SELECT is(
  (SELECT jsonb_array_length(j -> 'projetos' -> 'prazos15Dias') FROM painel),
  1,
  'prazos15Dias lista só a disciplina aberta, não a concluída com data_fim vencida'
);

SELECT is(
  (SELECT j #>> '{projetos,prazos15Dias,0,disciplina}' FROM painel),
  'Disciplina aberta',
  'a disciplina listada como vencendo é a não concluída'
);

SELECT is(
  (SELECT (j #>> '{disciplinas,atrasadas}')::int FROM resumo),
  1,
  'resumo semanal: disciplinas atrasadas não inclui as concluídas'
);

-- ── Parcelas ───────────────────────────────────────────────────────────────
SELECT is(
  public.rpc_gerar_parcelas_dia_fixo('bbbbbbbb-0000-0000-0000-0000000fe002'::uuid, 2, 10),
  2,
  'rpc_gerar_parcelas_dia_fixo cria as 2 parcelas'
);

SELECT is(
  (SELECT count(*)::int FROM public.receitas
    WHERE projeto_id = 'bbbbbbbb-0000-0000-0000-0000000fe002'::uuid
      AND descricao IN ('421 - Projeto ativo - Parcela 1/2', '421 - Projeto ativo - Parcela 2/2')),
  2,
  'a descrição da parcela usa o nome do projeto, nunca o código gerado'
);

SELECT is(
  (SELECT count(*)::int FROM public.receitas
    WHERE projeto_id = 'bbbbbbbb-0000-0000-0000-0000000fe002'::uuid
      AND cliente_id = 'eeeeeeee-0000-0000-0000-0000000fe001'::uuid),
  2,
  'as parcelas herdam o cliente do projeto'
);

-- Volta ao superuser antes do rollback, senão o DROP da função de teste falha.
SELECT set_config('role', 'postgres', true);

SELECT * FROM finish();
ROLLBACK;
