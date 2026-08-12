-- Spec 033 / ADR 0017 — Lançamentos com fonte única.
--
-- (1) View `lancamentos` recriada expondo os NOMES (categoria, projeto, contraparte,
--     conta) e `is_fatura_payment`. Hoje a view traz só IDs e o front zera os nomes
--     (useLancamentosPaginados enrichment), então colunas e busca por nome ficam quebradas.
--     Resolver na fonte beneficia todos os consumidores. Mantém security_invoker (RLS).
--
-- (2) RPC `get_lancamentos_resumo` — totais/KPIs/contagem do conjunto FILTRADO, para KPI
--     e rodapé virem de uma fonte só e sempre baterem com o filtro. Espelha a lógica
--     canônica de get_lancamentos_kpis: exclui 'Cancelado' e is_fatura_payment (senão
--     cartão conta em dobro). SECURITY INVOKER: RLS da view filtra por empresa.
--
-- (3) RPC `get_grupos_parcela_resumo` — resumo do PLANO inteiro de cada grupo (total,
--     pago, saldo, k/N pagas, próxima parcela), independente do período exibido, para a
--     linha-grupo parar de mostrar fragmento como total.

-- get_lancamentos_pagina retorna SETOF public.lancamentos, então depende do tipo da
-- view. Precisa cair antes do DROP VIEW para a migration ser re-executável.
DROP FUNCTION IF EXISTS public.get_lancamentos_pagina(text,text,text,text,uuid[],uuid[],uuid[],uuid[],text[],numeric,numeric,text,text,text,int,int);

-- =====================================================================
-- (1) View lancamentos com nomes + is_fatura_payment
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
  -- Novos: nomes resolvidos + flag de pagamento de fatura
  cat.nome AS categoria_nome,
  pj.codigo_projeto AS projeto_codigo,
  cl.nome AS contraparte_nome,
  co.nome AS conta_nome,
  false AS is_fatura_payment
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
  COALESCE(d.is_fatura_payment, false) AS is_fatura_payment
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
  false AS is_fatura_payment
FROM public.transferencias t
JOIN public.contas cd ON cd.id = t.conta_destino_id
LEFT JOIN public.contas co ON co.id = t.conta_origem_id
WHERE t.deleted_at IS NULL;

GRANT SELECT ON public.lancamentos TO authenticated;

-- =====================================================================
-- (2) Resumo agregado do conjunto filtrado (KPIs + rodapé, fonte única)
-- =====================================================================
-- Filtros opcionais: NULL/array vazio = sem restrição. Espelha os filtros da lista.
CREATE OR REPLACE FUNCTION public.get_lancamentos_resumo(
  p_from          text        DEFAULT NULL,
  p_to            text        DEFAULT NULL,
  p_tipo          text        DEFAULT NULL,   -- 'receita' | 'despesa' | NULL(todos)
  p_status        text        DEFAULT NULL,   -- 'pagos' | 'pendentes' | 'atrasados' | NULL
  p_categorias    uuid[]      DEFAULT NULL,
  p_projetos      uuid[]      DEFAULT NULL,
  p_clientes      uuid[]      DEFAULT NULL,
  p_fornecedores  uuid[]      DEFAULT NULL,
  p_formas        text[]      DEFAULT NULL,
  p_valor_min     numeric     DEFAULT NULL,
  p_valor_max     numeric     DEFAULT NULL,
  p_search        text        DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
AS $fn$
DECLARE
  v json;
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_pagos constant text[] := ARRAY['Recebido','Recebida','Pago','Concluída'];
BEGIN
  WITH base AS (
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
  )
  SELECT json_build_object(
    'total_count', COUNT(*),
    'recebido',  COALESCE(SUM(valor) FILTER (WHERE tipo='receita' AND status = ANY(v_pagos)), 0),
    'a_receber', COALESCE(SUM(valor) FILTER (WHERE tipo='receita' AND NOT (status = ANY(v_pagos))), 0),
    'pago',      COALESCE(SUM(valor) FILTER (WHERE tipo='despesa' AND status = ANY(v_pagos)), 0),
    'a_pagar',   COALESCE(SUM(valor) FILTER (WHERE tipo='despesa' AND NOT (status = ANY(v_pagos))), 0),
    'receitas',  COALESCE(SUM(valor) FILTER (WHERE tipo='receita'), 0),
    'despesas',  COALESCE(SUM(valor) FILTER (WHERE tipo='despesa'), 0),
    'atrasados_count', COUNT(*) FILTER (WHERE NOT (status = ANY(v_pagos)) AND data_vencimento < v_hoje AND tipo <> 'transferencia')
  ) INTO v
  FROM base;

  RETURN v;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.get_lancamentos_resumo(text,text,text,text,uuid[],uuid[],uuid[],uuid[],text[],numeric,numeric,text) TO authenticated;

-- =====================================================================
-- (3) Resumo do plano de cada grupo de parcela (independe do período)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_grupos_parcela_resumo(
  p_grupo_ids uuid[]
)
RETURNS TABLE (
  grupo_parcela   uuid,
  total_original  numeric,
  total_pago      numeric,
  saldo           numeric,
  pagas           int,
  total_parcelas  int,
  proxima_venc    date,
  proxima_valor   numeric,
  status          text
)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $fn$
  WITH parcelas AS (
    SELECT
      l.grupo_parcela,
      l.valor,
      l.data_vencimento,
      l.status,
      (l.status IN ('Recebido','Recebida','Pago','Concluída')) AS paga
    FROM public.lancamentos l
    WHERE l.grupo_parcela = ANY(p_grupo_ids)
      AND l.deleted_at IS NULL
      AND l.status <> 'Cancelado'
  ),
  agg AS (
    SELECT
      p.grupo_parcela,
      SUM(p.valor)                                   AS total_original,
      COALESCE(SUM(p.valor) FILTER (WHERE p.paga), 0) AS total_pago,
      COUNT(*) FILTER (WHERE p.paga)                 AS pagas,
      COUNT(*)                                       AS total_parcelas
    FROM parcelas p
    GROUP BY p.grupo_parcela
  ),
  prox AS (
    SELECT DISTINCT ON (p.grupo_parcela)
      p.grupo_parcela, p.data_vencimento AS proxima_venc, p.valor AS proxima_valor
    FROM parcelas p
    WHERE NOT p.paga
    ORDER BY p.grupo_parcela, p.data_vencimento ASC NULLS LAST
  )
  SELECT
    a.grupo_parcela,
    a.total_original,
    a.total_pago,
    a.total_original - a.total_pago AS saldo,
    a.pagas::int,
    a.total_parcelas::int,
    x.proxima_venc,
    x.proxima_valor,
    CASE
      WHEN a.pagas = 0 THEN 'aberto'
      WHEN a.pagas < a.total_parcelas THEN 'parcial'
      ELSE 'quitado'
    END AS status
  FROM agg a
  LEFT JOIN prox x ON x.grupo_parcela = a.grupo_parcela;
$fn$;

GRANT EXECUTE ON FUNCTION public.get_grupos_parcela_resumo(uuid[]) TO authenticated;

-- =====================================================================
-- (4) Página da lista: mesma cláusula WHERE do resumo (não pode divergir),
--     ordenação server-side e paginação por offset. RETURNS SETOF da view.
-- =====================================================================
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
