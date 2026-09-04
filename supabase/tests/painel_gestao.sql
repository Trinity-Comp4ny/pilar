-- pgTAP: get_painel_gestao (SPEC 092, migration 20260905000000).
--
-- Cobre os critérios de aceite da spec que vivem no banco:
--   1. nenhuma coluna monetária no corpo da função (o requisito central do ADR 0037)
--   2. proposta vencida com status aberto conta como "expirada", igual à tela
--   3. pontualidade separa entregue no prazo de atrasado
--   4. atraso por disciplina desconta pausa documentada (spec 084)
--   5. projeto sem data_previsao fica fora do cálculo de prazo, e é contado na cobertura
--   6. horas viram desvio percentual, nunca custo
--   7. o painel só agrega a própria empresa (a RPC é SECURITY INVOKER: quem
--      restringe o tenant é o RLS, então o teste roda como usuário autenticado
--      e NÃO como superuser, senão veria as linhas de todas as empresas)

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(10);

-- ── 1. A regra dura: sem dinheiro no corpo da função ────────────────────────
SELECT is(
  (
    SELECT count(*)::int
    FROM pg_proc p
    WHERE p.proname = 'get_painel_gestao'
      AND p.pronamespace = 'public'::regnamespace
      AND (
        p.prosrc ~* '\m(valor_proposto|valor_contrato|valor_aditivo|salario_fixo|valor_m2)\M'
        OR p.prosrc ~* '\mcusto_(estimado|hora|indireto_pct)\M'
        OR p.prosrc ~* '\mFROM\s+public\.(receitas|despesas|faturas|contas|folha_pagamento|marcos_faturamento)\M'
      )
  ),
  0,
  'get_painel_gestao nao toca em nenhuma coluna ou tabela monetaria'
);

-- ── Cenário ────────────────────────────────────────────────────────────────
INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES ('00000000-0000-0000-0000-0000000ba001'::uuid, 'Empresa Painel', NULL, TRUE,
        '{"projetos": true, "propostas": true, "leads": true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES ('dddddddd-0000-0000-0000-0000000ba001'::uuid, 'socio_painel@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed)
VALUES ('dddddddd-0000-0000-0000-0000000ba001'::uuid, '00000000-0000-0000-0000-0000000ba001'::uuid,
        'Socio', 'Painel', 'socio_painel@test.com', 'admin', TRUE)
ON CONFLICT (id) DO UPDATE SET empresa_id = EXCLUDED.empresa_id, role = EXCLUDED.role;

-- Empresa vizinha, com dado que o painel NUNCA deve somar.
INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES ('00000000-0000-0000-0000-0000000ba0ff'::uuid, 'Empresa Vizinha', NULL, TRUE, '{"projetos": true}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.propostas (empresa_id, titulo, status, created_at)
SELECT '00000000-0000-0000-0000-0000000ba0ff'::uuid, 'Proposta da vizinha ' || i, 'aceita', now() - interval '5 days'
FROM generate_series(1, 30) i;

CREATE OR REPLACE FUNCTION test_set_auth(p_user_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

-- Proposta enviada com validade no passado: a tela mostra "Expirada" e o painel
-- tem que concordar (a coluna status continua 'enviada').
INSERT INTO public.propostas (id, empresa_id, titulo, status, validade, created_at, updated_at)
VALUES ('aaaaaaaa-0000-0000-0000-0000000ba001'::uuid, '00000000-0000-0000-0000-0000000ba001'::uuid,
        'Proposta vencida', 'enviada', current_date - 5, now() - interval '20 days', now() - interval '20 days');

-- Proposta aceita e proposta recusada, para a conversão dar 1 de 3.
INSERT INTO public.propostas (id, empresa_id, titulo, status, created_at, updated_at)
VALUES ('aaaaaaaa-0000-0000-0000-0000000ba002'::uuid, '00000000-0000-0000-0000-0000000ba001'::uuid,
        'Proposta aceita', 'aceita', now() - interval '10 days', now() - interval '9 days'),
       ('aaaaaaaa-0000-0000-0000-0000000ba003'::uuid, '00000000-0000-0000-0000-0000000ba001'::uuid,
        'Proposta recusada', 'recusada', now() - interval '8 days', now() - interval '7 days');

-- Proposta enviada dentro da validade: fica "na mão do cliente".
INSERT INTO public.propostas (id, empresa_id, titulo, status, validade, created_at, updated_at)
VALUES ('aaaaaaaa-0000-0000-0000-0000000ba004'::uuid, '00000000-0000-0000-0000-0000000ba001'::uuid,
        'Proposta em analise', 'enviada', current_date + 20, now() - interval '40 days', now() - interval '40 days');

-- Projeto entregue no prazo, projeto entregue atrasado, e ativo sem previsão.
INSERT INTO public.projetos (id, empresa_id, nome, status, data_previsao, data_final)
VALUES ('bbbbbbbb-0000-0000-0000-0000000ba001'::uuid, '00000000-0000-0000-0000-0000000ba001'::uuid,
        'Entregue no prazo', 'Concluído', current_date - 40, current_date - 45),
       ('bbbbbbbb-0000-0000-0000-0000000ba002'::uuid, '00000000-0000-0000-0000-0000000ba001'::uuid,
        'Entregue atrasado', 'Concluído', current_date - 40, current_date - 20);

INSERT INTO public.projetos (id, empresa_id, nome, status, data_previsao)
VALUES ('bbbbbbbb-0000-0000-0000-0000000ba003'::uuid, '00000000-0000-0000-0000-0000000ba001'::uuid,
        'Ativo sem previsao', 'Em andamento', NULL);

-- Disciplina concluída 20 dias após o previsto, com 15 dias de pausa documentada:
-- o atraso da equipe é 5, não 20 (spec 084).
INSERT INTO public.projeto_disciplinas (id, projeto_id, nome, status, data_fim, data_fim_real, horas_estimadas, horas_realizadas)
VALUES ('cccccccc-0000-0000-0000-0000000ba001'::uuid, 'bbbbbbbb-0000-0000-0000-0000000ba002'::uuid,
        'Eletrica', 'concluida', current_date - 40, current_date - 20, 100, 150);

INSERT INTO public.projeto_disciplina_pausas (projeto_disciplina_id, motivo, pausado_em, retomado_em)
VALUES ('cccccccc-0000-0000-0000-0000000ba001'::uuid, 'Aguardando cliente',
        (current_date - 40)::timestamptz, (current_date - 25)::timestamptz);

-- Disciplina do projeto ativo, com horas estouradas: alimenta o desvio.
INSERT INTO public.projeto_disciplinas (id, projeto_id, nome, status, horas_estimadas, horas_realizadas)
VALUES ('cccccccc-0000-0000-0000-0000000ba002'::uuid, 'bbbbbbbb-0000-0000-0000-0000000ba003'::uuid,
        'Estrutural', 'em_andamento', 200, 250);

-- ── O retorno, lido como o sócio da empresa (RLS ativo) ────────────────────
SELECT test_set_auth('dddddddd-0000-0000-0000-0000000ba001'::uuid);

CREATE TEMP TABLE painel AS SELECT public.get_painel_gestao() AS j;

SELECT is(
  (SELECT (j #>> '{ancoras,conversao,decididas}')::int FROM painel),
  3,
  'painel soma so a propria empresa: as 30 propostas da vizinha ficam de fora'
);

SELECT is(
  (SELECT (j -> 'comercial' -> 'funil') @> '[{"etapa": "expirada", "n": 1}]'::jsonb FROM painel),
  true,
  'proposta enviada com validade no passado conta como expirada'
);

SELECT is(
  (SELECT (j #>> '{ancoras,conversao,valor}')::int FROM painel),
  33,
  'conversao = 1 aceita de 3 decididas (aceita + recusada + expirada)'
);

SELECT is(
  (SELECT (j #>> '{ancoras,aguardandoCliente,valor}')::int FROM painel),
  1,
  'so a proposta enviada dentro da validade conta como na mao do cliente'
);

SELECT is(
  (SELECT (j #>> '{ancoras,aguardandoCliente,parados}')::int FROM painel),
  1,
  'proposta enviada ha 40 dias entra na contagem de parados'
);

SELECT is(
  (SELECT (j #>> '{ancoras,prazo,valor}')::int FROM painel),
  50,
  'pontualidade = 1 no prazo de 2 concluidos com previsao'
);

SELECT is(
  (SELECT (j -> 'entrega' -> 'atrasoPorDisciplina') @> '[{"disciplina": "Eletrica", "diasMedio": 5}]'::jsonb FROM painel),
  true,
  'atraso por disciplina desconta os 15 dias de pausa documentada'
);

SELECT is(
  (SELECT (j #>> '{entrega,semaforo,semPrazo}')::int FROM painel),
  1,
  'projeto ativo sem data_previsao entra em semPrazo, nao em no prazo'
);

SELECT is(
  (SELECT (j -> 'produtividade' -> 'horasPorProjeto') @> '[{"desvioPct": 25}]'::jsonb FROM painel),
  true,
  'desvio de horas do projeto ativo = 250 realizadas sobre 200 estimadas'
);

-- Volta ao superuser antes do rollback, senão o DROP da função de teste falha.
SELECT set_config('role', 'postgres', true);

SELECT * FROM finish();
ROLLBACK;
