-- Spec 044 — dashboard financeiro e listagens Despesas/Receitas server-side.
--
-- Decisão aprovada: estende a view `lancamentos` (spec 033/ADR 0017) em vez de criar
-- RPCs dedicadas por tipo. Fecha as 2 lacunas conhecidas: Asaas (só existe em
-- receitas) e os campos específicos de despesa (recorrente/periodicidade). O campo
-- `parcelas` do tipo ReceitaItem (useFinanceItems.ts) não existe em `receitas` —
-- confirmado ao aplicar (coluna inexistente); é campo morto na interface TS, nunca
-- populado em runtime. Não entra na view.
--
-- get_lancamentos_pagina já suporta p_tipo — depois desta migration ele também serve
-- as abas Despesas/Receitas (useFinanceItems), sem precisar de RPC nova pra listagem.
--
-- 4 RPCs novas pro dashboard (useFinanceData): stats, chart mensal, chart com
-- granularidade adaptativa (dia ≤45d / semana ≤365d / mês >365d, mesmos limiares de
-- processDailyChartData) e categorias. Todas SECURITY INVOKER — mesmo padrão de
-- get_lancamentos_resumo/get_lancamentos_pagina: RLS de receitas/despesas garante o
-- isolamento por empresa, não depende de ninguém lembrar de um check manual.

-- get_lancamentos_pagina retorna SETOF public.lancamentos — precisa cair antes do
-- DROP VIEW pra migration ser re-executável (mesmo motivo da 20260821000000).
DROP FUNCTION IF EXISTS public.get_lancamentos_pagina(text,text,text,text,uuid[],uuid[],uuid[],uuid[],text[],numeric,numeric,text,text,text,int,int);

-- =====================================================================
-- (1) View lancamentos: + Asaas (só receita) + recorrente/periodicidade (só despesa)
-- =====================================================================
DROP VIEW IF EXISTS public.lancamentos;

CREATE VIEW public.lancamentos
  WITH (security_invoker = true)
AS
SELECT
  r.id, r.empresa_id, 'receita'::text AS tipo, r.descricao, r.valor,
  r.data_vencimento, r.data_recebimento AS data_efetivacao, r.data_competencia,
  r.status::text AS status, r.categoria_id, r.projeto_id, r.conta_id,
  r.centro_custo_id, r.tags,
  r.cliente_id AS contraparte_id, 'cliente'::text AS contraparte_tipo,
  NULL::uuid AS cartao_id, NULL::uuid AS fatura_id,
  r.forma_pagamento,
  r.grupo_parcela, r.parcela_numero, r.parcela_total,
  gp.tipo_grupo AS grupo_tipo,
  gp.status_agregado AS grupo_status,
  gp.total_original AS grupo_total_original,
  r.nota_fiscal, r.observacao,
  r.created_by, r.updated_by, r.created_at, r.updated_at, r.deleted_at,
  NULL::uuid AS transferencia_par_id,
  cat.nome AS categoria_nome,
  pj.codigo_projeto AS projeto_codigo,
  cl.nome AS contraparte_nome,
  co.nome AS conta_nome,
  false AS is_fatura_payment,
  -- Novos: Asaas (só receita) + recorrente/periodicidade (só despesa)
  r.asaas_payment_id, r.asaas_payment_url, r.asaas_payment_status, r.asaas_billing_type,
  NULL::boolean AS recorrente, NULL::text AS periodicidade
FROM public.receitas r
LEFT JOIN public.grupos_parcela gp ON gp.id = r.grupo_parcela
LEFT JOIN public.categorias_financeiras cat ON cat.id = r.categoria_id
LEFT JOIN public.projetos pj ON pj.id = r.projeto_id
LEFT JOIN public.clientes cl ON cl.id = r.cliente_id
LEFT JOIN public.contas co ON co.id = r.conta_id
WHERE r.deleted_at IS NULL

UNION ALL

SELECT
  d.id, d.empresa_id, 'despesa'::text AS tipo, d.descricao, d.valor,
  d.data_vencimento, d.data_pagamento AS data_efetivacao, d.data_competencia,
  d.status::text AS status, d.categoria_id, d.projeto_id, d.conta_id,
  d.centro_custo_id, d.tags,
  d.fornecedor_id AS contraparte_id, 'fornecedor'::text AS contraparte_tipo,
  d.cartao_id, d.fatura_id,
  d.forma_pagamento,
  d.grupo_parcela, d.parcela_numero, d.parcela_total,
  gp.tipo_grupo AS grupo_tipo,
  gp.status_agregado AS grupo_status,
  gp.total_original AS grupo_total_original,
  d.nota_fiscal, d.observacao,
  d.created_by, d.updated_by, d.created_at, d.updated_at, d.deleted_at,
  NULL::uuid AS transferencia_par_id,
  cat.nome AS categoria_nome,
  pj.codigo_projeto AS projeto_codigo,
  fo.nome AS contraparte_nome,
  co.nome AS conta_nome,
  COALESCE(d.is_fatura_payment, false) AS is_fatura_payment,
  NULL::text AS asaas_payment_id, NULL::text AS asaas_payment_url,
  NULL::text AS asaas_payment_status, NULL::text AS asaas_billing_type,
  d.recorrente, d.periodicidade
FROM public.despesas d
LEFT JOIN public.grupos_parcela gp ON gp.id = d.grupo_parcela
LEFT JOIN public.categorias_financeiras cat ON cat.id = d.categoria_id
LEFT JOIN public.projetos pj ON pj.id = d.projeto_id
LEFT JOIN public.fornecedores fo ON fo.id = d.fornecedor_id
LEFT JOIN public.contas co ON co.id = d.conta_id
WHERE d.deleted_at IS NULL

UNION ALL

SELECT
  t.id, t.empresa_id, 'transferencia'::text AS tipo,
  COALESCE(t.descricao, 'Transferência → ' || cd.nome) AS descricao,
  t.valor,
  t.data_transferencia AS data_vencimento,
  CASE WHEN t.status = 'Concluída' THEN t.data_transferencia ELSE NULL END AS data_efetivacao,
  t.data_transferencia AS data_competencia,
  t.status,
  NULL::uuid AS categoria_id, NULL::uuid AS projeto_id,
  t.conta_origem_id AS conta_id,
  NULL::uuid AS centro_custo_id, NULL::text[] AS tags,
  t.conta_destino_id AS contraparte_id, 'conta_destino'::text AS contraparte_tipo,
  NULL::uuid AS cartao_id, NULL::uuid AS fatura_id,
  NULL::text AS forma_pagamento,
  NULL::uuid AS grupo_parcela, NULL::int AS parcela_numero, NULL::int AS parcela_total,
  NULL::text AS grupo_tipo, NULL::text AS grupo_status, NULL::numeric AS grupo_total_original,
  NULL::text AS nota_fiscal, t.observacao,
  t.created_by, t.updated_by, t.created_at, t.updated_at, t.deleted_at,
  t.conta_destino_id AS transferencia_par_id,
  NULL::text AS categoria_nome,
  NULL::text AS projeto_codigo,
  cd.nome AS contraparte_nome,
  co.nome AS conta_nome,
  false AS is_fatura_payment,
  NULL::text AS asaas_payment_id, NULL::text AS asaas_payment_url,
  NULL::text AS asaas_payment_status, NULL::text AS asaas_billing_type,
  NULL::boolean AS recorrente, NULL::text AS periodicidade
FROM public.transferencias t
JOIN public.contas cd ON cd.id = t.conta_destino_id
LEFT JOIN public.contas co ON co.id = t.conta_origem_id
WHERE t.deleted_at IS NULL;

GRANT SELECT ON public.lancamentos TO authenticated;

-- Re-cria (assinatura idêntica à 20260821000000; só o RETURNS SETOF muda de forma,
-- o corpo é o mesmo — DROP+CREATE obrigatório porque a view mudou de tipo).
CREATE OR REPLACE FUNCTION public.get_lancamentos_pagina(
  p_from          text        DEFAULT NULL,
  p_to            text        DEFAULT NULL,
  p_tipo          text        DEFAULT NULL,
  p_status        text        DEFAULT NULL,
  p_categorias    uuid[]      DEFAULT NULL,
  p_projetos      uuid[]      DEFAULT NULL,
  p_clientes      uuid[]      DEFAULT NULL,
  p_fornecedores  uuid[]      DEFAULT NULL,
  p_formas        text[]      DEFAULT NULL,
  p_valor_min     numeric     DEFAULT NULL,
  p_valor_max     numeric     DEFAULT NULL,
  p_search        text        DEFAULT NULL,
  p_sort_key      text        DEFAULT 'data',
  p_sort_dir      text        DEFAULT 'desc',
  p_limit         int         DEFAULT 100,
  p_offset        int         DEFAULT 0
)
RETURNS SETOF public.lancamentos
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
AS $fn$
DECLARE
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_pagos constant text[] := ARRAY['Recebido','Recebida','Pago','Concluída'];
  v_asc boolean := lower(p_sort_dir) = 'asc';
BEGIN
  RETURN QUERY
  SELECT l.*
  FROM public.lancamentos l
  WHERE l.deleted_at IS NULL
    AND l.status <> 'Cancelado'
    AND l.is_fatura_payment = false
    AND (p_from IS NULL OR l.data_vencimento >= p_from::date)
    AND (p_to   IS NULL OR l.data_vencimento <= p_to::date)
    AND (p_tipo IS NULL OR l.tipo = p_tipo)
    AND (p_categorias  IS NULL OR array_length(p_categorias,1)  IS NULL OR l.categoria_id  = ANY(p_categorias))
    AND (p_projetos    IS NULL OR array_length(p_projetos,1)    IS NULL OR l.projeto_id    = ANY(p_projetos))
    AND (p_clientes    IS NULL OR array_length(p_clientes,1)    IS NULL OR (l.tipo = 'receita' AND l.contraparte_id = ANY(p_clientes)))
    AND (p_fornecedores IS NULL OR array_length(p_fornecedores,1) IS NULL OR (l.tipo = 'despesa' AND l.contraparte_id = ANY(p_fornecedores)))
    AND (p_formas IS NULL OR array_length(p_formas,1) IS NULL OR l.forma_pagamento = ANY(p_formas))
    AND (p_valor_min IS NULL OR l.valor >= p_valor_min)
    AND (p_valor_max IS NULL OR l.valor <= p_valor_max)
    AND (
      p_search IS NULL OR p_search = '' OR
      l.descricao ILIKE '%'||p_search||'%' OR
      COALESCE(l.contraparte_nome,'') ILIKE '%'||p_search||'%' OR
      COALESCE(l.categoria_nome,'')   ILIKE '%'||p_search||'%' OR
      COALESCE(l.projeto_codigo,'')   ILIKE '%'||p_search||'%'
    )
    AND (
      p_status IS NULL
      OR (p_status = 'pagos'      AND l.status = ANY(v_pagos))
      OR (p_status = 'pendentes'  AND NOT (l.status = ANY(v_pagos)))
      OR (p_status = 'atrasados'  AND NOT (l.status = ANY(v_pagos)) AND l.data_vencimento < v_hoje)
    )
  ORDER BY
    CASE WHEN p_sort_key = 'data'  AND NOT v_asc THEN COALESCE(l.data_efetivacao, l.data_vencimento) END DESC NULLS LAST,
    CASE WHEN p_sort_key = 'data'  AND v_asc     THEN COALESCE(l.data_efetivacao, l.data_vencimento) END ASC  NULLS LAST,
    CASE WHEN p_sort_key = 'valor' AND NOT v_asc THEN l.valor END DESC NULLS LAST,
    CASE WHEN p_sort_key = 'valor' AND v_asc     THEN l.valor END ASC  NULLS LAST,
    CASE WHEN p_sort_key IN ('descricao','categoria','projeto','contraparte','status') AND NOT v_asc
      THEN lower(COALESCE(
        CASE p_sort_key WHEN 'descricao' THEN l.descricao WHEN 'categoria' THEN l.categoria_nome
          WHEN 'projeto' THEN l.projeto_codigo WHEN 'contraparte' THEN l.contraparte_nome
          WHEN 'status' THEN l.status END, '')) END DESC NULLS LAST,
    CASE WHEN p_sort_key IN ('descricao','categoria','projeto','contraparte','status') AND v_asc
      THEN lower(COALESCE(
        CASE p_sort_key WHEN 'descricao' THEN l.descricao WHEN 'categoria' THEN l.categoria_nome
          WHEN 'projeto' THEN l.projeto_codigo WHEN 'contraparte' THEN l.contraparte_nome
          WHEN 'status' THEN l.status END, '')) END ASC NULLS LAST,
    l.data_vencimento DESC, l.id DESC
  LIMIT p_limit OFFSET p_offset;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.get_lancamentos_pagina(text,text,text,text,uuid[],uuid[],uuid[],uuid[],text[],numeric,numeric,text,text,text,int,int) TO authenticated;

-- =====================================================================
-- Helper: mesma regra de getDisplayDate (src/lib/dateUtils.ts), em SQL.
-- NULL faz o papel do isInvalidDate do JS (coluna `date` não tem "31/12/1969" de
-- timestamp 0 — o guard só existia pro parser de string do client).
-- =====================================================================
CREATE OR REPLACE FUNCTION public._finance_display_date(
  p_efetivacao date, p_vencimento date, p_status text
) RETURNS date
LANGUAGE sql IMMUTABLE
AS $fn$
  SELECT CASE
    WHEN p_status IN ('Recebido','Recebida') THEN COALESCE(p_efetivacao, p_vencimento)
    WHEN p_status = 'Pendente' THEN COALESCE(p_vencimento, p_efetivacao)
    ELSE COALESCE(p_efetivacao, p_vencimento)
  END;
$fn$;

-- =====================================================================
-- (2) get_finance_stats — totais, crescimento %, a receber/pagar, top 5.
-- Espelha useFinanceData: receitas exclui só 'Cancelado'; despesas exclui
-- 'Cancelado' E is_fatura_payment. "TotalGeral" é sempre all-time, independe do
-- período pedido (usado só no saldoGeral). Sem p_data_inicio/p_data_fim = "todo o
-- período": sem comparação com anterior (não existe "anterior" ao início dos dados).
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_finance_stats(
  p_data_inicio date DEFAULT NULL,
  p_data_fim    date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
AS $fn$
DECLARE
  v_all_time boolean := p_data_inicio IS NULL AND p_data_fim IS NULL;
  v_start date := COALESCE(p_data_inicio, date_trunc('month', now())::date);
  v_end   date := COALESCE(p_data_fim, (date_trunc('month', now()) + interval '1 month - 1 day')::date);
  v_prev_start date := v_start - interval '1 month';
  v_result jsonb;
BEGIN
  WITH r AS (
    SELECT id, descricao, valor, status,
           public._finance_display_date(data_recebimento, data_vencimento, status::text) AS display_date
    FROM public.receitas
    WHERE status <> 'Cancelado'
  ),
  d AS (
    SELECT id, descricao, valor, status,
           public._finance_display_date(data_pagamento, data_vencimento, status::text) AS display_date
    FROM public.despesas
    WHERE status <> 'Cancelado' AND COALESCE(is_fatura_payment, false) = false
  ),
  r_main AS (SELECT * FROM r WHERE display_date IS NOT NULL AND (v_all_time OR (display_date >= v_start AND display_date <= v_end))),
  d_main AS (SELECT * FROM d WHERE display_date IS NOT NULL AND (v_all_time OR (display_date >= v_start AND display_date <= v_end))),
  r_prev AS (SELECT * FROM r WHERE NOT v_all_time AND display_date IS NOT NULL AND display_date >= v_prev_start AND display_date < v_start),
  d_prev AS (SELECT * FROM d WHERE NOT v_all_time AND display_date IS NOT NULL AND display_date >= v_prev_start AND display_date < v_start),
  top_r AS (
    SELECT jsonb_agg(x) AS items FROM (
      SELECT id, descricao, valor::float8 AS valor, display_date AS data, status
      FROM r_main ORDER BY valor DESC LIMIT 5
    ) x
  ),
  top_d AS (
    SELECT jsonb_agg(x) AS items FROM (
      SELECT id, descricao, valor::float8 AS valor, display_date AS data, status
      FROM d_main ORDER BY valor DESC LIMIT 5
    ) x
  )
  SELECT jsonb_build_object(
    'receitas_total', COALESCE((SELECT SUM(valor) FROM r_main), 0),
    'despesas_total', COALESCE((SELECT SUM(valor) FROM d_main), 0),
    'receitas_total_geral', COALESCE((SELECT SUM(valor) FROM r), 0),
    'despesas_total_geral', COALESCE((SELECT SUM(valor) FROM d), 0),
    'receitas_prev_total', COALESCE((SELECT SUM(valor) FROM r_prev), 0),
    'despesas_prev_total', COALESCE((SELECT SUM(valor) FROM d_prev), 0),
    'a_receber_total', COALESCE((SELECT SUM(valor) FROM r_main WHERE status <> 'Recebido'), 0),
    'a_receber_count', COALESCE((SELECT COUNT(*) FROM r_main WHERE status <> 'Recebido'), 0),
    'a_pagar_total', COALESCE((SELECT SUM(valor) FROM d_main WHERE status <> 'Pago'), 0),
    'a_pagar_count', COALESCE((SELECT COUNT(*) FROM d_main WHERE status <> 'Pago'), 0),
    'top_receitas', COALESCE((SELECT items FROM top_r), '[]'::jsonb),
    'top_despesas', COALESCE((SELECT items FROM top_d), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_finance_stats(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_finance_stats(date, date) TO authenticated;

-- =====================================================================
-- (3) get_finance_chart_mensal — uma linha por mês com dado, igual processChartData.
-- Rótulo em pt-BR (Jan/26, Fev/26, ...) pra não depender de locale do servidor.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_finance_chart_mensal(
  p_data_inicio date DEFAULT NULL,
  p_data_fim    date DEFAULT NULL
)
RETURNS TABLE (mes text, receitas numeric, despesas numeric, sort_key text)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $fn$
  WITH v_bounds AS (
    SELECT
      (p_data_inicio IS NULL AND p_data_fim IS NULL) AS all_time,
      COALESCE(p_data_inicio, date_trunc('month', now())::date) AS start_d,
      COALESCE(p_data_fim, (date_trunc('month', now()) + interval '1 month - 1 day')::date) AS end_d
  ),
  meses(num, abrev) AS (
    VALUES (1,'Jan'),(2,'Fev'),(3,'Mar'),(4,'Abr'),(5,'Mai'),(6,'Jun'),
           (7,'Jul'),(8,'Ago'),(9,'Set'),(10,'Out'),(11,'Nov'),(12,'Dez')
  ),
  itens AS (
    SELECT public._finance_display_date(r.data_recebimento, r.data_vencimento, r.status::text) AS d, r.valor, 'receitas'::text AS tipo
    FROM public.receitas r, v_bounds b
    WHERE r.status <> 'Cancelado'
      AND public._finance_display_date(r.data_recebimento, r.data_vencimento, r.status::text) IS NOT NULL
      AND (b.all_time OR public._finance_display_date(r.data_recebimento, r.data_vencimento, r.status::text) BETWEEN b.start_d AND b.end_d)
    UNION ALL
    SELECT public._finance_display_date(d.data_pagamento, d.data_vencimento, d.status::text) AS d, d.valor, 'despesas'::text AS tipo
    FROM public.despesas d, v_bounds b
    WHERE d.status <> 'Cancelado' AND COALESCE(d.is_fatura_payment, false) = false
      AND public._finance_display_date(d.data_pagamento, d.data_vencimento, d.status::text) IS NOT NULL
      AND (b.all_time OR public._finance_display_date(d.data_pagamento, d.data_vencimento, d.status::text) BETWEEN b.start_d AND b.end_d)
  ),
  agrupado AS (
    SELECT
      date_trunc('month', d)::date AS mes_data,
      SUM(valor) FILTER (WHERE tipo = 'receitas') AS receitas,
      SUM(valor) FILTER (WHERE tipo = 'despesas') AS despesas
    FROM itens
    GROUP BY 1
  )
  SELECT
    initcap(m.abrev) || '/' || to_char(a.mes_data, 'YY') AS mes,
    COALESCE(a.receitas, 0) AS receitas,
    COALESCE(a.despesas, 0) AS despesas,
    to_char(a.mes_data, 'YYYY-MM') AS sort_key
  FROM agrupado a
  JOIN meses m ON m.num = EXTRACT(MONTH FROM a.mes_data)::int
  ORDER BY sort_key;
$fn$;

REVOKE ALL ON FUNCTION public.get_finance_chart_mensal(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_finance_chart_mensal(date, date) TO authenticated;

-- =====================================================================
-- (4) get_finance_categorias — soma + contagem por categoria (cor fica no front,
-- igual hoje). p_tipo: 'receitas' | 'despesas'.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_finance_categorias(
  p_tipo        text,
  p_data_inicio date DEFAULT NULL,
  p_data_fim    date DEFAULT NULL
)
RETURNS TABLE (categoria_nome text, valor numeric, count bigint)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $fn$
  WITH v_bounds AS (
    SELECT
      (p_data_inicio IS NULL AND p_data_fim IS NULL) AS all_time,
      COALESCE(p_data_inicio, date_trunc('month', now())::date) AS start_d,
      COALESCE(p_data_fim, (date_trunc('month', now()) + interval '1 month - 1 day')::date) AS end_d
  ),
  itens AS (
    SELECT COALESCE(cat.nome, 'Outros') AS categoria_nome, r.valor
    FROM public.receitas r
    LEFT JOIN public.categorias_financeiras cat ON cat.id = r.categoria_id, v_bounds b
    WHERE p_tipo = 'receitas' AND r.status <> 'Cancelado'
      AND public._finance_display_date(r.data_recebimento, r.data_vencimento, r.status::text) IS NOT NULL
      AND (b.all_time OR public._finance_display_date(r.data_recebimento, r.data_vencimento, r.status::text) BETWEEN b.start_d AND b.end_d)
    UNION ALL
    SELECT COALESCE(cat.nome, 'Outros') AS categoria_nome, d.valor
    FROM public.despesas d
    LEFT JOIN public.categorias_financeiras cat ON cat.id = d.categoria_id, v_bounds b
    WHERE p_tipo = 'despesas' AND d.status <> 'Cancelado' AND COALESCE(d.is_fatura_payment, false) = false
      AND public._finance_display_date(d.data_pagamento, d.data_vencimento, d.status::text) IS NOT NULL
      AND (b.all_time OR public._finance_display_date(d.data_pagamento, d.data_vencimento, d.status::text) BETWEEN b.start_d AND b.end_d)
  )
  SELECT categoria_nome, SUM(valor) AS valor, COUNT(*) AS count
  FROM itens
  GROUP BY categoria_nome
  ORDER BY valor DESC;
$fn$;

REVOKE ALL ON FUNCTION public.get_finance_categorias(text, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_finance_categorias(text, date, date) TO authenticated;

-- =====================================================================
-- (5) get_finance_chart_periodo — granularidade adaptativa (dia ≤45d, semana ≤365d,
-- mês >365d), igual processDailyChartData. Em all-time, o intervalo vem do span real
-- dos dados (não do mês corrente) — mesma regra do hook hoje. Buckets vazios do
-- intervalo entram com 0 (pré-preenchidos), igual ao front atual.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_finance_chart_periodo(
  p_data_inicio date DEFAULT NULL,
  p_data_fim    date DEFAULT NULL
)
RETURNS TABLE (bucket_label text, receitas numeric, despesas numeric, sort_key text)
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
AS $fn$
DECLARE
  v_all_time boolean := p_data_inicio IS NULL AND p_data_fim IS NULL;
  v_start date;
  v_end date;
  v_days_diff int;
  v_granularity text;
BEGIN
  IF v_all_time THEN
    SELECT MIN(x.d), MAX(x.d) INTO v_start, v_end
    FROM (
      SELECT public._finance_display_date(r.data_recebimento, r.data_vencimento, r.status::text) AS d
      FROM public.receitas r WHERE r.status <> 'Cancelado'
      UNION ALL
      SELECT public._finance_display_date(dd.data_pagamento, dd.data_vencimento, dd.status::text) AS d
      FROM public.despesas dd WHERE dd.status <> 'Cancelado' AND COALESCE(dd.is_fatura_payment, false) = false
    ) x
    WHERE x.d IS NOT NULL;

    IF v_start IS NULL THEN
      v_start := date_trunc('month', now())::date;
      v_end := (date_trunc('month', now()) + interval '1 month - 1 day')::date;
    END IF;
  ELSE
    v_start := p_data_inicio;
    v_end := p_data_fim;
  END IF;

  v_days_diff := (v_end - v_start) + 1;
  v_granularity := CASE WHEN v_days_diff <= 45 THEN 'day' WHEN v_days_diff <= 365 THEN 'week' ELSE 'month' END;

  RETURN QUERY
  WITH buckets AS (
    SELECT gs::date AS d FROM generate_series(v_start, v_end, interval '1 day') gs
  ),
  distinct_buckets AS (
    SELECT DISTINCT
      CASE v_granularity
        WHEN 'day' THEN d
        WHEN 'month' THEN date_trunc('month', d)::date
        ELSE d - ((EXTRACT(ISODOW FROM d)::int - 1) || ' days')::interval
      END::date AS bucket_date
    FROM buckets
  ),
  itens AS (
    SELECT public._finance_display_date(r.data_recebimento, r.data_vencimento, r.status::text) AS d, r.valor, 'receitas'::text AS tipo
    FROM public.receitas r
    WHERE r.status <> 'Cancelado'
      AND public._finance_display_date(r.data_recebimento, r.data_vencimento, r.status::text) BETWEEN v_start AND v_end
    UNION ALL
    SELECT public._finance_display_date(dd.data_pagamento, dd.data_vencimento, dd.status::text) AS d, dd.valor, 'despesas'::text AS tipo
    FROM public.despesas dd
    WHERE dd.status <> 'Cancelado' AND COALESCE(dd.is_fatura_payment, false) = false
      AND public._finance_display_date(dd.data_pagamento, dd.data_vencimento, dd.status::text) BETWEEN v_start AND v_end
  ),
  itens_bucketed AS (
    SELECT
      (CASE v_granularity
        WHEN 'day' THEN i.d
        WHEN 'month' THEN date_trunc('month', i.d)::date
        ELSE i.d - ((EXTRACT(ISODOW FROM i.d)::int - 1) || ' days')::interval
      END)::date AS bucket_date,
      i.valor, i.tipo
    FROM itens i
  ),
  agg AS (
    SELECT bucket_date,
      SUM(valor) FILTER (WHERE tipo = 'receitas') AS receitas,
      SUM(valor) FILTER (WHERE tipo = 'despesas') AS despesas
    FROM itens_bucketed
    GROUP BY bucket_date
  ),
  meses(num, abrev) AS (
    VALUES (1,'jan'),(2,'fev'),(3,'mar'),(4,'abr'),(5,'mai'),(6,'jun'),
           (7,'jul'),(8,'ago'),(9,'set'),(10,'out'),(11,'nov'),(12,'dez')
  )
  SELECT
    CASE v_granularity
      WHEN 'day' THEN trim(leading '0' FROM to_char(db.bucket_date, 'DD'))
      WHEN 'month' THEN m.abrev || '/' || to_char(db.bucket_date, 'YY')
      ELSE lpad(to_char(db.bucket_date, 'DD'), 2, '0') || '/' || m.abrev
    END AS bucket_label,
    COALESCE(a.receitas, 0) AS receitas,
    COALESCE(a.despesas, 0) AS despesas,
    to_char(db.bucket_date, 'YYYY-MM-DD') AS sort_key
  FROM distinct_buckets db
  LEFT JOIN agg a ON a.bucket_date = db.bucket_date
  JOIN meses m ON m.num = EXTRACT(MONTH FROM db.bucket_date)::int
  ORDER BY sort_key;
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_finance_chart_periodo(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_finance_chart_periodo(date, date) TO authenticated;
