-- pgTAP: matriz de acesso a dinheiro (ADR 0046, aplica a ADR 0034).
--
-- Duas partes:
--   A. Travas estruturais. Coluna de dinheiro legível por authenticated em tabela
--      cuja policy de leitura não passa por can_view_financeiro()/can_view_folha(),
--      e função SECURITY DEFINER que toca tabela de dinheiro sem checar papel, só
--      passam se estiverem nas allowlists abaixo, com o motivo. Tabela ou função nova
--      que esquecer o gate reprova o PR.
--   B. Comportamento por papel, com o banco rodando como authenticated e o JWT de
--      cada usuário: admin, financeiro delegado, coordenador, user comum e admin de
--      outra empresa. A matriz legível está em docs/security/MATRIZ_DE_ACESSO.md.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(41);

-- =====================================================================
-- A. Travas estruturais
-- =====================================================================

-- A1. Colunas de dinheiro legíveis sem gate de financeiro na policy.
WITH permitido(coluna, motivo) AS (
  VALUES
    -- Catálogo público do Pilar, não é dado de cliente.
    ('ai_model_precos.preco_input_por_milhao', 'catálogo'),
    ('ai_model_precos.preco_output_por_milhao', 'catálogo'),
    ('pilar_subscription_plans.preco_anual', 'catálogo'),
    ('pilar_subscription_plans.preco_mensal', 'catálogo'),
    ('trial_niveis.tokens_total', 'catálogo'),
    -- Consumo e compra de IA do próprio Pilar (Configurações > Uso), visível à empresa.
    ('ai_token_ledger.custo_estimado', 'consumo de IA'),
    ('ai_token_saldo.saldo_comprado', 'consumo de IA'),
    ('ai_token_saldo.saldo_plano', 'consumo de IA'),
    ('ai_usage.custo_estimado_total', 'consumo de IA'),
    ('ai_usage.total_requests', 'consumo de IA'),
    ('ai_usage.total_tokens_entrada', 'consumo de IA'),
    ('ai_usage.total_tokens_saida', 'consumo de IA'),
    ('pilar_token_pack_purchases.valor_centavos', 'consumo de IA'),
    ('consentimentos_cobranca.valor', 'cobrança do plano Pilar'),
    -- Operação de compra da obra (cotação, material, etapa). Fora da ADR 0034:
    -- quem toca a obra compara cotação. Ver MATRIZ_DE_ACESSO.md, decisões abertas.
    ('obra_cotacao_proposta.valor', 'operação da obra'),
    ('obra_cotacao_proposta.valor_parcelado', 'operação da obra'),
    ('obra_cotacao_proposta_item.preco_unitario', 'operação da obra'),
    ('obra_cotacao_proposta_item.valor_total', 'operação da obra'),
    ('obra_material_mov.valor_unitario', 'operação da obra'),
    ('obra_orcamento_etapa.valor_previsto', 'operação da obra'),
    ('obras.taxa_administracao_pct', 'operação da obra'),
    -- Comercial: preço da proposta é o que o comercial negocia. Custo e margem
    -- estimados e custo/hora por disciplina estão em decisão aberta (MATRIZ_DE_ACESSO.md).
    ('propostas.valor_proposto', 'comercial'),
    ('propostas.custo_estimado', 'decisão aberta'),
    ('propostas.margem_estimada_pct', 'decisão aberta'),
    ('proposta_disciplinas.custo_hora', 'decisão aberta'),
    ('proposta_disciplinas.valor_venda', 'comercial'),
    ('projeto_disciplinas.custo_hora', 'decisão aberta')
),
colunas AS (
  SELECT c.table_name || '.' || c.column_name AS coluna
  FROM information_schema.columns c
  JOIN pg_class t ON t.relname = c.table_name
   AND t.relnamespace = 'public'::regnamespace AND t.relkind = 'r'
  WHERE c.table_schema = 'public'
    AND c.column_name ~ '(valor|salario|custo|preco|margem|receita|despesa|saldo|total|lucro|fatura|honorario|orcamento|taxa|recebido|pago|contrato|aditivo|comissao|desconto|juros|multa)'
    AND c.data_type IN ('numeric', 'integer', 'bigint', 'double precision', 'real', 'money', 'jsonb')
    -- t.oid, não 'public.' || nome::regclass: o planner pode avaliar a função antes do
    -- filtro de schema, e o cast quebra em tabela de outro schema com o mesmo nome.
    AND has_column_privilege('authenticated', t.oid, c.column_name, 'SELECT')
    AND NOT EXISTS (
      SELECT 1 FROM pg_policies pol
      WHERE pol.schemaname = 'public' AND pol.tablename = c.table_name
        AND pol.cmd IN ('SELECT', 'ALL')
        AND pol.qual ~ '(can_view_financeiro|can_view_folha)'
    )
)
SELECT is(
  (SELECT COALESCE(array_agg(coluna ORDER BY coluna), '{}'::text[])
   FROM colunas WHERE coluna NOT IN (SELECT coluna FROM permitido)),
  '{}'::text[],
  'coluna de dinheiro legível sem can_view_financeiro()/can_view_folha() só com motivo na allowlist'
);

-- A2. Funções SECURITY DEFINER que tocam tabela de dinheiro sem checar papel.
WITH permitido(sig, motivo) AS (
  VALUES
    ('fases_do_projeto(uuid)', 'devolve só id e disciplina'),
    ('get_cliente_obra_detail(text, uuid)', 'portal do cliente, sessão por token'),
    ('get_cliente_projeto_detail(uuid)', 'portal do cliente, conta ligada ao auth.uid()'),
    ('get_cliente_projeto_detail(uuid, text)', 'portal do cliente, sessão por token'),
    ('portal_get_projeto_full(uuid, text)', 'portal do cliente, sessão por token'),
    ('rpc_calcular_wip(integer, integer)', 'só grava snapshot (leitura gated), devolve contagem'),
    ('rpc_converter_proposta_projeto(uuid)', 'grava orçamento a partir da proposta, devolve id'),
    ('rpc_gerar_alertas()', 'só grava alertas (leitura gated), devolve contagem')
),
funcoes AS (
  SELECT p.proname || '(' || oidvectortypes(p.proargtypes) || ')' AS sig
  FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace AND p.prokind = 'f' AND p.prosecdef
    AND pg_get_function_result(p.oid) <> 'trigger'
    AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
    AND pg_get_functiondef(p.oid) ~* '\m(public\.)?(receitas|despesas|lancamentos|faturas|cartoes|contas_bancarias|grupos_parcela|folha_[a-z_]+|obra_conta_lancamento|projeto_orcamento_fases|alertas)\M'
    AND pg_get_functiondef(p.oid) !~* '(can_view_financeiro|can_view_folha|is_ultra_admin|auth\.role\(\))'
)
SELECT is(
  (SELECT COALESCE(array_agg(sig ORDER BY sig), '{}'::text[])
   FROM funcoes WHERE sig NOT IN (SELECT sig FROM permitido)),
  '{}'::text[],
  'função DEFINER que toca dinheiro checa papel ou está na allowlist com motivo'
);

-- A3. Leitura coluna a coluna: as colunas de dinheiro fechadas, e TODAS as outras
-- abertas. Coluna nova em escopos/escopo_itens/leads só fica legível se entrar no
-- GRANT da migration; este teste aponta o esquecimento.
SELECT is(
  (SELECT array_agg(column_name::text ORDER BY column_name) FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'escopos'
     AND NOT has_column_privilege('authenticated', 'public.escopos', column_name, 'SELECT')),
  ARRAY['custo_estimado', 'valor_aditivo'],
  'escopos: só valor_aditivo e custo_estimado fechados para leitura direta'
);

SELECT is(
  (SELECT array_agg(column_name::text ORDER BY column_name) FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'escopo_itens'
     AND NOT has_column_privilege('authenticated', 'public.escopo_itens', column_name, 'SELECT')),
  ARRAY['custo'],
  'escopo_itens: só custo fechado para leitura direta'
);

SELECT is(
  (SELECT array_agg(column_name::text ORDER BY column_name) FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'leads'
     AND NOT has_column_privilege('authenticated', 'public.leads', column_name, 'SELECT')),
  ARRAY['valor_estimado'],
  'leads: só valor_estimado fechado para leitura direta'
);

SELECT ok(
  NOT has_column_privilege('authenticated', 'public.escopos', 'valor_aditivo', 'UPDATE')
  AND NOT has_column_privilege('authenticated', 'public.escopos', 'valor_aditivo', 'INSERT'),
  'escopos.valor_aditivo não é gravável pela API'
);

-- =====================================================================
-- B. Fixture: empresa A com cinco papéis, empresa B com um admin
-- =====================================================================

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'Empresa A pgtap', NULL, TRUE,
   '{"financeiro": true, "leads": true, "projetos": true, "obras": true, "pessoas": true, "propostas": true}'::jsonb),
  ('00000000-0000-0000-0000-0000000000b1', 'Empresa B pgtap', NULL, TRUE,
   '{"financeiro": true, "leads": true, "projetos": true, "obras": true, "pessoas": true, "propostas": true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

SET LOCAL session_replication_role = 'replica';
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role, email_confirmed_at)
VALUES
  ('66666666-0000-0000-0000-000000000001', 'a_admin@pgtap.test', '{}'::jsonb, 'authenticated', 'authenticated', now()),
  ('66666666-0000-0000-0000-000000000002', 'a_fin@pgtap.test', '{}'::jsonb, 'authenticated', 'authenticated', now()),
  ('66666666-0000-0000-0000-000000000003', 'a_coord@pgtap.test', '{}'::jsonb, 'authenticated', 'authenticated', now()),
  ('66666666-0000-0000-0000-000000000004', 'a_user@pgtap.test', '{}'::jsonb, 'authenticated', 'authenticated', now()),
  ('66666666-0000-0000-0000-000000000005', 'b_admin@pgtap.test', '{}'::jsonb, 'authenticated', 'authenticated', now())
ON CONFLICT (id) DO NOTHING;
SET LOCAL session_replication_role = 'origin';

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, financeiro_delegado, onboarding_completed)
VALUES
  ('66666666-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'A', 'Admin', 'a_admin@pgtap.test', 'admin', FALSE, TRUE),
  ('66666666-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000a1', 'A', 'Fin', 'a_fin@pgtap.test', 'user', TRUE, TRUE),
  ('66666666-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000a1', 'A', 'Coord', 'a_coord@pgtap.test', 'coordenador', FALSE, TRUE),
  ('66666666-0000-0000-0000-000000000004', '00000000-0000-0000-0000-0000000000a1', 'A', 'User', 'a_user@pgtap.test', 'user', FALSE, TRUE),
  ('66666666-0000-0000-0000-000000000005', '00000000-0000-0000-0000-0000000000b1', 'B', 'Admin', 'b_admin@pgtap.test', 'admin', FALSE, TRUE)
ON CONFLICT (id) DO UPDATE SET empresa_id = EXCLUDED.empresa_id, role = EXCLUDED.role,
  financeiro_delegado = EXCLUDED.financeiro_delegado;

-- Dados da empresa A, gravados como postgres (sem RLS). O claim do admin só preenche
-- os created_by que têm auth.uid() como default.
DO $$ BEGIN
  PERFORM set_config('request.jwt.claims',
    '{"sub": "66666666-0000-0000-0000-000000000001", "role": "authenticated"}', true);
END $$;
INSERT INTO public.projetos (id, empresa_id, nome, valor_contrato)
VALUES ('77777777-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'Projeto pgtap', 100000);

INSERT INTO public.escopos (id, empresa_id, projeto_id, descricao, tipo, status, valor_aditivo, custo_estimado)
VALUES ('77777777-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000a1',
        '77777777-0000-0000-0000-000000000001', 'Aditivo pgtap', 'aditivo', 'pendente_aprovacao', 12000, 8000),
       ('77777777-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000a1',
        '77777777-0000-0000-0000-000000000001', 'Aditivo pgtap 2', 'aditivo', 'pendente_aprovacao', 5000, 3000);

INSERT INTO public.escopo_itens (escopo_id, descricao, disciplina, horas, custo)
VALUES ('77777777-0000-0000-0000-000000000002', 'Item pgtap', 'Estrutural', 40, 8000);

INSERT INTO public.projeto_orcamento_fases (empresa_id, projeto_id, disciplina)
VALUES ('00000000-0000-0000-0000-0000000000a1', '77777777-0000-0000-0000-000000000001', 'Estrutural');

INSERT INTO public.obras (id, empresa_id, nome, created_by)
VALUES ('77777777-0000-0000-0000-000000000004', '00000000-0000-0000-0000-0000000000a1', 'Obra pgtap', '66666666-0000-0000-0000-000000000001');

INSERT INTO public.obra_conta_lancamento (empresa_id, obra_id, tipo, data, descricao, valor)
VALUES ('00000000-0000-0000-0000-0000000000a1', '77777777-0000-0000-0000-000000000004', 'despesa', CURRENT_DATE, 'Despesa obra pgtap', 900);

INSERT INTO public.grupos_parcela (empresa_id, tipo_lancamento, num_parcelas)
VALUES ('00000000-0000-0000-0000-0000000000a1', 'receita', 3);

INSERT INTO public.leads (id, empresa_id, nome, valor_estimado)
VALUES ('77777777-0000-0000-0000-000000000005', '00000000-0000-0000-0000-0000000000a1', 'Lead pgtap', 45000);

INSERT INTO public.receitas (empresa_id, descricao, valor, data_vencimento, status)
VALUES ('00000000-0000-0000-0000-0000000000a1', 'Receita pgtap', 1000, CURRENT_DATE, 'Pendente');

INSERT INTO public.pessoas (empresa_id, nome, email, primeiro_nome, sobrenome, salario_fixo)
VALUES ('00000000-0000-0000-0000-0000000000a1', 'Pessoa pgtap', 'pessoa@pgtap.test', 'Pessoa', 'Pgtap', 7000);

INSERT INTO public.notificacoes (empresa_id, destinatario_id, tipo, categoria, titulo)
VALUES
  ('00000000-0000-0000-0000-0000000000a1', '66666666-0000-0000-0000-000000000001', 'pgtap', 'financeiro', 'Para o admin'),
  ('00000000-0000-0000-0000-0000000000a1', '66666666-0000-0000-0000-000000000004', 'pgtap', 'sistema', 'Para o user');

CREATE OR REPLACE FUNCTION pg_temp.como(p_user uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

-- =====================================================================
-- B1. User comum (sem delegação)
-- =====================================================================
SELECT pg_temp.como('66666666-0000-0000-0000-000000000004');

SELECT is(public.can_view_financeiro(), false, 'user: can_view_financeiro() é falso');
SELECT is((SELECT count(*)::int FROM public.receitas), 0, 'user: não lê receitas');
SELECT is((SELECT count(*)::int FROM public.projeto_orcamento_fases), 0, 'user: não lê orçamento por fase');
SELECT is((SELECT count(*)::int FROM public.fases_do_projeto('77777777-0000-0000-0000-000000000001')), 1,
  'user: fases_do_projeto() devolve a fase para lançar horas');
SELECT is((SELECT count(*)::int FROM public.obra_conta_lancamento), 0, 'user: não lê a conta da obra');
SELECT is((SELECT count(*)::int FROM public.grupos_parcela), 0, 'user: não lê parcelamentos');
SELECT is(
  (SELECT valor_aditivo FROM public.escopos_safe WHERE id = '77777777-0000-0000-0000-000000000002'),
  NULL::numeric, 'user: escopos_safe mascara o valor do aditivo');
SELECT is(
  (SELECT (escopo_itens->0->>'custo') FROM public.escopos_safe WHERE id = '77777777-0000-0000-0000-000000000002'),
  NULL, 'user: escopos_safe mascara o custo do item');
SELECT is(
  (SELECT pode_ver_valor FROM public.escopos_safe WHERE id = '77777777-0000-0000-0000-000000000002'),
  false, 'user: escopos_safe avisa que não pode ver valor');
SELECT throws_ok(
  $$ SELECT valor_aditivo FROM public.escopos $$,
  '42501', NULL, 'user: ler valor_aditivo direto na tabela é negado');
SELECT throws_ok(
  $$ SELECT valor_estimado FROM public.leads $$,
  '42501', NULL, 'user: ler valor_estimado direto na tabela é negado');
SELECT is(
  (SELECT valor_estimado FROM public.leads_safe WHERE id = '77777777-0000-0000-0000-000000000005'),
  NULL::numeric, 'user: leads_safe mascara o valor do lead');
SELECT is(
  (SELECT salario_fixo FROM public.pessoas_safe WHERE email = 'pessoa@pgtap.test'),
  NULL::numeric, 'user: pessoas_safe mascara salário');
SELECT throws_ok(
  $$ SELECT public.get_financial_chart_data('00000000-0000-0000-0000-0000000000a1', CURRENT_DATE - 30, CURRENT_DATE) $$,
  '42501', NULL, 'user: gráfico financeiro é negado');
SELECT throws_ok(
  $$ SELECT public.rpc_custo_real_projeto('77777777-0000-0000-0000-000000000001') $$,
  '42501', NULL, 'user: custo real do projeto é negado');
SELECT throws_ok(
  $$ UPDATE public.escopos SET status = 'aprovado' WHERE id = '77777777-0000-0000-0000-000000000002' $$,
  '42501', NULL, 'user: aprovar aditivo é negado');
SELECT throws_ok(
  $$ UPDATE public.escopos SET status = 'rejeitado' WHERE id = '77777777-0000-0000-0000-000000000002' $$,
  '42501', NULL, 'user: rejeitar aditivo é negado');
SELECT lives_ok(
  $$ UPDATE public.escopos SET adiado_ate = CURRENT_DATE + 7 WHERE id = '77777777-0000-0000-0000-000000000002' $$,
  'user: adiar aditivo continua permitido');
SELECT is(
  (SELECT array_agg(titulo ORDER BY titulo) FROM public.notificacoes),
  ARRAY['Para o user'], 'user: só vê a própria notificação');

-- =====================================================================
-- B2. Coordenador sem delegação: mesmo recorte de dinheiro do user
-- =====================================================================
SELECT pg_temp.como('66666666-0000-0000-0000-000000000003');

SELECT is(public.can_view_financeiro(), false, 'coordenador: can_view_financeiro() é falso');
SELECT is((SELECT count(*)::int FROM public.receitas), 0, 'coordenador: não lê receitas');
SELECT is(
  (SELECT valor_aditivo FROM public.escopos_safe WHERE id = '77777777-0000-0000-0000-000000000002'),
  NULL::numeric, 'coordenador: escopos_safe mascara o valor do aditivo');
SELECT is((SELECT count(*)::int FROM public.notificacoes), 0, 'coordenador: não vê notificação de outro');

-- =====================================================================
-- B3. Financeiro delegado: vê e decide dinheiro, não vê folha
-- =====================================================================
SELECT pg_temp.como('66666666-0000-0000-0000-000000000002');

SELECT is((SELECT count(*)::int FROM public.receitas), 1, 'delegado: lê receitas');
SELECT is((SELECT count(*)::int FROM public.projeto_orcamento_fases), 1, 'delegado: lê orçamento por fase');
SELECT is((SELECT count(*)::int FROM public.obra_conta_lancamento), 1, 'delegado: lê a conta da obra');
SELECT is(
  (SELECT valor_aditivo FROM public.escopos_safe WHERE id = '77777777-0000-0000-0000-000000000002'),
  12000::numeric, 'delegado: vê o valor do aditivo');
SELECT is(
  (SELECT valor_estimado FROM public.leads_safe WHERE id = '77777777-0000-0000-0000-000000000005'),
  45000::numeric, 'delegado: vê o valor do lead');
SELECT is(
  (SELECT salario_fixo FROM public.pessoas_safe WHERE email = 'pessoa@pgtap.test'),
  NULL::numeric, 'delegado: salário continua só para admin');
SELECT lives_ok(
  $$ UPDATE public.escopos SET status = 'rejeitado' WHERE id = '77777777-0000-0000-0000-000000000003' $$,
  'delegado: decide aditivo');

-- =====================================================================
-- B4. Admin: tudo dentro da empresa, inclusive folha
-- =====================================================================
SELECT pg_temp.como('66666666-0000-0000-0000-000000000001');

SELECT is(
  (SELECT salario_fixo FROM public.pessoas_safe WHERE email = 'pessoa@pgtap.test'),
  7000::numeric, 'admin: vê salário');
SELECT lives_ok(
  $$ UPDATE public.escopos SET status = 'aprovado' WHERE id = '77777777-0000-0000-0000-000000000002' $$,
  'admin: aprova aditivo');

-- =====================================================================
-- B5. Admin de outra empresa: nada da empresa A
-- =====================================================================
SELECT pg_temp.como('66666666-0000-0000-0000-000000000005');

SELECT is(
  (SELECT count(*)::int FROM public.receitas WHERE empresa_id = '00000000-0000-0000-0000-0000000000a1')
  + (SELECT count(*)::int FROM public.escopos_safe WHERE empresa_id = '00000000-0000-0000-0000-0000000000a1')
  + (SELECT count(*)::int FROM public.leads_safe WHERE empresa_id = '00000000-0000-0000-0000-0000000000a1')
  + (SELECT count(*)::int FROM public.projeto_orcamento_fases WHERE empresa_id = '00000000-0000-0000-0000-0000000000a1')
  + (SELECT count(*)::int FROM public.obra_conta_lancamento WHERE empresa_id = '00000000-0000-0000-0000-0000000000a1')
  + (SELECT count(*)::int FROM public.pessoas_safe WHERE empresa_id = '00000000-0000-0000-0000-0000000000a1')
  + (SELECT count(*)::int FROM public.notificacoes),
  0, 'outra empresa: admin não lê nada da empresa A');
SELECT is((SELECT count(*)::int FROM public.fases_do_projeto('77777777-0000-0000-0000-000000000001')), 0,
  'outra empresa: fases_do_projeto() não vaza fase da empresa A');
SELECT throws_ok(
  $$ SELECT public.get_financial_chart_data('00000000-0000-0000-0000-0000000000a1', CURRENT_DATE - 30, CURRENT_DATE) $$,
  NULL, 'Acesso negado', 'outra empresa: gráfico financeiro da empresa A é negado');

SELECT * FROM finish();

ROLLBACK;
