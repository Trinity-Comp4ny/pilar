-- pgTAP: metas personalizáveis (SPEC 123).
--
-- Cobre o cálculo por indicador, escopo (empresa ou pessoa) e período, o gate do
-- financeiro (ADR 0046), o isolamento entre empresas, as constraints do modelo e os
-- grants das funções (a de cálculo é interna).

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(28);

-- =====================================================================
-- Fixture: empresa A (admin, coordenador com metas, user comum) e empresa B
-- =====================================================================

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES
  ('00000000-0000-0000-0000-0000000000a2', 'Empresa A metas', NULL, TRUE,
   '{"financeiro": true, "projetos": true, "pessoas": true}'::jsonb),
  ('00000000-0000-0000-0000-0000000000b2', 'Empresa B metas', NULL, TRUE,
   '{"financeiro": true, "projetos": true, "pessoas": true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

SET LOCAL session_replication_role = 'replica';
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role, email_confirmed_at)
VALUES
  ('88888888-0000-0000-0000-000000000001', 'm_admin@pgtap.test', '{}'::jsonb, 'authenticated', 'authenticated', now()),
  ('88888888-0000-0000-0000-000000000002', 'm_coord@pgtap.test', '{}'::jsonb, 'authenticated', 'authenticated', now()),
  ('88888888-0000-0000-0000-000000000003', 'm_user@pgtap.test', '{}'::jsonb, 'authenticated', 'authenticated', now()),
  ('88888888-0000-0000-0000-000000000004', 'm_b_admin@pgtap.test', '{}'::jsonb, 'authenticated', 'authenticated', now())
ON CONFLICT (id) DO NOTHING;
SET LOCAL session_replication_role = 'origin';

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, metas_delegado, onboarding_completed)
VALUES
  ('88888888-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a2', 'M', 'Admin', 'm_admin@pgtap.test', 'admin', FALSE, TRUE),
  ('88888888-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000a2', 'M', 'Coord', 'm_coord@pgtap.test', 'coordenador', TRUE, TRUE),
  ('88888888-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000a2', 'M', 'User', 'm_user@pgtap.test', 'user', FALSE, TRUE),
  ('88888888-0000-0000-0000-000000000004', '00000000-0000-0000-0000-0000000000b2', 'MB', 'Admin', 'm_b_admin@pgtap.test', 'admin', FALSE, TRUE)
ON CONFLICT (id) DO UPDATE SET empresa_id = EXCLUDED.empresa_id, role = EXCLUDED.role,
  metas_delegado = EXCLUDED.metas_delegado;

DO $$ BEGIN
  PERFORM set_config('request.jwt.claims',
    '{"sub": "88888888-0000-0000-0000-000000000001", "role": "authenticated"}', true);
END $$;

INSERT INTO public.pessoas (id, empresa_id, nome, email, primeiro_nome, sobrenome)
VALUES
  ('99999999-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a2', 'Rafael pgtap', 'rafael@pgtap.test', 'Rafael', 'Pgtap'),
  ('99999999-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000a2', 'Ana pgtap', 'ana@pgtap.test', 'Ana', 'Pgtap');

-- Projetos concluídos: P1 e P2 neste mês, P3 no mês passado. O Rafael é responsável de
-- uma disciplina em P1 e P3; P2 não tem responsável.
INSERT INTO public.projetos (id, empresa_id, nome, status, data_final)
VALUES
  ('77777777-1000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a2', 'P1 pgtap', 'Concluído', date_trunc('month', CURRENT_DATE)::date),
  ('77777777-1000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000a2', 'P2 pgtap', 'Concluído', date_trunc('month', CURRENT_DATE)::date),
  ('77777777-1000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000a2', 'P3 pgtap', 'Concluído', (date_trunc('month', CURRENT_DATE) - interval '15 days')::date);

INSERT INTO public.projeto_disciplinas (id, projeto_id, nome, status, data_fim_real)
VALUES
  ('77777777-2000-0000-0000-000000000001', '77777777-1000-0000-0000-000000000001', 'Estrutural', 'Concluído', date_trunc('month', CURRENT_DATE)::date),
  ('77777777-2000-0000-0000-000000000002', '77777777-1000-0000-0000-000000000002', 'Hidráulico', 'Concluído', date_trunc('month', CURRENT_DATE)::date),
  ('77777777-2000-0000-0000-000000000003', '77777777-1000-0000-0000-000000000003', 'Elétrico', 'Concluído', (date_trunc('month', CURRENT_DATE) - interval '15 days')::date),
  ('77777777-2000-0000-0000-000000000004', '77777777-1000-0000-0000-000000000001', 'Arquitetura', 'Em Andamento', NULL);

INSERT INTO public.projeto_disciplina_responsaveis (projeto_disciplina_id, pessoa_id)
VALUES
  ('77777777-2000-0000-0000-000000000001', '99999999-0000-0000-0000-000000000001'),
  ('77777777-2000-0000-0000-000000000003', '99999999-0000-0000-0000-000000000001'),
  ('77777777-2000-0000-0000-000000000004', '99999999-0000-0000-0000-000000000002');

-- Receita recebida neste mês: R$ 1.000 na A e R$ 5.000 na B.
INSERT INTO public.receitas (empresa_id, descricao, valor, data_vencimento, data_recebimento, status)
VALUES
  ('00000000-0000-0000-0000-0000000000a2', 'Receita A', 1000, CURRENT_DATE, CURRENT_DATE, 'Recebido'),
  ('00000000-0000-0000-0000-0000000000b2', 'Receita B', 5000, CURRENT_DATE, CURRENT_DATE, 'Recebido');

INSERT INTO public.metas (id, empresa_id, nome, alvo, atual, unidade, indicador, pessoa_id, recorrencia, periodo_inicio, prazo)
VALUES
  -- Rafael: 5 projetos por mês.
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a2', 'Rafael 5 projetos/mês', 5, 0,
   'quantity', 'projetos_concluidos', '99999999-0000-0000-0000-000000000001', 'mensal', NULL, NULL),
  -- Empresa: projetos concluídos por mês.
  ('aaaaaaaa-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000a2', 'Empresa projetos/mês', 10, 0,
   'quantity', 'projetos_concluidos', NULL, 'mensal', NULL, NULL),
  -- Empresa: faturamento do mês.
  ('aaaaaaaa-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000a2', 'Faturamento do mês', 500000, 0,
   'currency', 'receita_recebida', NULL, 'mensal', NULL, NULL),
  -- Manual: o atual é o gravado.
  ('aaaaaaaa-0000-0000-0000-000000000004', '00000000-0000-0000-0000-0000000000a2', 'Relatórios', 12, 7,
   'quantity', NULL, NULL, 'nenhuma', NULL, NULL),
  -- Datas específicas: só o mês passado.
  ('aaaaaaaa-0000-0000-0000-000000000005', '00000000-0000-0000-0000-0000000000a2', 'Projetos do mês passado', 5, 0,
   'quantity', 'projetos_concluidos', NULL, 'nenhuma',
   (date_trunc('month', CURRENT_DATE) - interval '1 month')::date,
   (date_trunc('month', CURRENT_DATE) - interval '1 day')::date),
  -- Entregas (disciplinas concluídas) da Ana: nenhuma concluída.
  ('aaaaaaaa-0000-0000-0000-000000000006', '00000000-0000-0000-0000-0000000000a2', 'Entregas da Ana', 3, 0,
   'quantity', 'disciplinas_concluidas', '99999999-0000-0000-0000-000000000002', 'mensal', NULL, NULL),
  -- Entregas do Rafael: uma concluída neste mês.
  ('aaaaaaaa-0000-0000-0000-000000000007', '00000000-0000-0000-0000-0000000000a2', 'Entregas do Rafael', 3, 0,
   'quantity', 'disciplinas_concluidas', '99999999-0000-0000-0000-000000000001', 'mensal', NULL, NULL);

CREATE OR REPLACE FUNCTION pg_temp.como(p_user uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

CREATE OR REPLACE FUNCTION pg_temp.atual_de(p_meta uuid)
RETURNS numeric LANGUAGE sql AS $$
  SELECT atual FROM public.rpc_metas_progresso() WHERE meta_id = p_meta
$$;

-- =====================================================================
-- Constraints do modelo (como postgres)
-- =====================================================================

SELECT throws_ok(
  $$ INSERT INTO public.metas (empresa_id, nome, alvo, indicador, pessoa_id)
     VALUES ('00000000-0000-0000-0000-0000000000a2', 'x', 1, 'receita_recebida', '99999999-0000-0000-0000-000000000001') $$,
  '23514', NULL, 'indicador financeiro não aceita pessoa');

SELECT throws_ok(
  $$ INSERT INTO public.metas (empresa_id, nome, alvo, recorrencia)
     VALUES ('00000000-0000-0000-0000-0000000000a2', 'x', 1, 'mensal') $$,
  '23514', NULL, 'meta recorrente exige indicador');

SELECT throws_ok(
  $$ INSERT INTO public.metas (empresa_id, nome, alvo, indicador)
     VALUES ('00000000-0000-0000-0000-0000000000a2', 'x', 1, 'inexistente') $$,
  '23514', NULL, 'indicador fora do catálogo é recusado');

SELECT is(
  (SELECT column_default FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'metas' AND column_name = 'tipo'),
  '''livre''::text', 'meta nova nasce com tipo livre (legado)');

-- =====================================================================
-- Grants
-- =====================================================================

SELECT is(has_function_privilege('authenticated', 'public._meta_valor(uuid, text, uuid, date, date)', 'EXECUTE'),
  false, 'cálculo interno não é executável por authenticated');
SELECT is(has_function_privilege('anon', 'public._meta_valor(uuid, text, uuid, date, date)', 'EXECUTE'),
  false, 'cálculo interno não é executável por anon');
SELECT is(has_function_privilege('anon', 'public.rpc_metas_progresso(date)', 'EXECUTE'),
  false, 'rpc_metas_progresso não é executável por anon');
SELECT is(has_function_privilege('authenticated', 'public.rpc_metas_progresso(date)', 'EXECUTE'),
  true, 'rpc_metas_progresso é executável por authenticated');

-- =====================================================================
-- Admin da empresa A
-- =====================================================================
SELECT pg_temp.como('88888888-0000-0000-0000-000000000001');

SELECT is(pg_temp.atual_de('aaaaaaaa-0000-0000-0000-000000000001'), 1::numeric,
  'Rafael: 1 projeto concluído no mês (o P2 sem responsável e o P3 do mês passado não contam)');
SELECT is(pg_temp.atual_de('aaaaaaaa-0000-0000-0000-000000000002'), 2::numeric,
  'empresa: P1 e P2 concluídos no mês');
SELECT is(pg_temp.atual_de('aaaaaaaa-0000-0000-0000-000000000003'), 1000::numeric,
  'faturamento recebido no mês da empresa A, sem a receita da B');
SELECT is(pg_temp.atual_de('aaaaaaaa-0000-0000-0000-000000000004'), 7::numeric,
  'meta manual devolve o atual gravado');
SELECT is(pg_temp.atual_de('aaaaaaaa-0000-0000-0000-000000000005'), 1::numeric,
  'datas específicas: só o projeto concluído no mês passado');
SELECT is(pg_temp.atual_de('aaaaaaaa-0000-0000-0000-000000000006'), 0::numeric,
  'Ana não tem disciplina concluída (a dela está em andamento)');
SELECT is(pg_temp.atual_de('aaaaaaaa-0000-0000-0000-000000000007'), 1::numeric,
  'Rafael: 1 disciplina concluída no mês');
SELECT is(
  (SELECT restrito FROM public.rpc_metas_progresso() WHERE meta_id = 'aaaaaaaa-0000-0000-0000-000000000003'),
  false, 'admin: indicador financeiro sem restrição');

SELECT is(
  (SELECT array_agg(atual ORDER BY janela_inicio DESC)
     FROM public.rpc_meta_historico('aaaaaaaa-0000-0000-0000-000000000001', 3)),
  ARRAY[1, 1, 0]::numeric[],
  'histórico do Rafael: mês corrente, mês passado e o anterior');
SELECT is(
  (SELECT count(*)::int FROM public.rpc_meta_historico('aaaaaaaa-0000-0000-0000-000000000001')),
  6, 'histórico tem 6 períodos por padrão');
SELECT is(
  (SELECT count(*)::int FROM public.rpc_meta_historico('aaaaaaaa-0000-0000-0000-000000000004')),
  0, 'meta manual não tem histórico');
SELECT is(
  (SELECT janela_fim - janela_inicio FROM public.rpc_metas_progresso()
    WHERE meta_id = 'aaaaaaaa-0000-0000-0000-000000000001') >= 27,
  true, 'janela mensal cobre o mês inteiro');

-- =====================================================================
-- Coordenador com concessão de metas, sem acesso ao financeiro
-- =====================================================================
SELECT pg_temp.como('88888888-0000-0000-0000-000000000002');

SELECT is(pg_temp.atual_de('aaaaaaaa-0000-0000-0000-000000000002'), 2::numeric,
  'coordenador: indicador de projetos calcula sem acesso ao financeiro');
SELECT is(
  (SELECT restrito FROM public.rpc_metas_progresso() WHERE meta_id = 'aaaaaaaa-0000-0000-0000-000000000003'),
  true, 'coordenador: faturamento vem restrito');
SELECT is(pg_temp.atual_de('aaaaaaaa-0000-0000-0000-000000000003'), NULL::numeric,
  'coordenador: faturamento sem valor em vez de 0');
SELECT is(
  (SELECT atual FROM public.rpc_meta_historico('aaaaaaaa-0000-0000-0000-000000000003', 2) LIMIT 1),
  NULL::numeric, 'coordenador: histórico financeiro sem valor');

-- =====================================================================
-- User comum: o banco trata Metas como módulo da empresa (a RLS deixa qualquer membro
-- ler, e a restrição a admin/concessão é da UI). O RPC espelha a RLS e não abre o que a
-- RLS não abre: o financeiro segue restrito.
-- =====================================================================
SELECT pg_temp.como('88888888-0000-0000-0000-000000000003');

SELECT is(
  (SELECT count(*)::int FROM public.rpc_metas_progresso()),
  (SELECT count(*)::int FROM public.metas),
  'user comum: o RPC devolve as mesmas metas que a RLS deixa ler');
SELECT is(
  (SELECT restrito FROM public.rpc_metas_progresso() WHERE meta_id = 'aaaaaaaa-0000-0000-0000-000000000003'),
  true, 'user comum: faturamento vem restrito');

-- =====================================================================
-- Admin da empresa B: nada da A
-- =====================================================================
SELECT pg_temp.como('88888888-0000-0000-0000-000000000004');

SELECT is((SELECT count(*)::int FROM public.rpc_metas_progresso()), 0,
  'admin de outra empresa não recebe metas da A');
SELECT is(
  (SELECT count(*)::int FROM public.rpc_meta_historico('aaaaaaaa-0000-0000-0000-000000000001')),
  0, 'admin de outra empresa não lê histórico de meta da A');

SELECT * FROM finish();
ROLLBACK;
