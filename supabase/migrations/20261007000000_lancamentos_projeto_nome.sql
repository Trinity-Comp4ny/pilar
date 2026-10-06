-- O financeiro mostrava o código gerado pelo sistema (PRJ-0023) como "projeto" nas
-- listas e nos seletores, no lugar do nome que o usuário digitou ("409 - Neiva").
-- Relato da Liz (29/09): o lançamento "vai com o outro número". O código é uma
-- chave interna e não deve aparecer para o usuário (ver SPEC 100).
--
-- A view lancamentos ganha projeto_nome (coluna nova, no fim: CREATE OR REPLACE
-- aceita, sem derrubar get_lancamentos_pagina). A busca e a ordenação por projeto
-- passam a usar o nome, para bater com o que a tela mostra. projeto_codigo
-- continua na view (legado), sem uso no front.

CREATE OR REPLACE VIEW public.lancamentos
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
  NULL::boolean AS recorrente, NULL::text AS periodicidade,
  pj.nome AS projeto_nome
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
  d.recorrente, d.periodicidade,
  pj.nome AS projeto_nome
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
  NULL::boolean AS recorrente, NULL::text AS periodicidade,
  NULL::text AS projeto_nome
FROM public.transferencias t
JOIN public.contas cd ON cd.id = t.conta_destino_id
LEFT JOIN public.contas co ON co.id = t.conta_origem_id
WHERE t.deleted_at IS NULL;

GRANT SELECT ON public.lancamentos TO authenticated;

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
      COALESCE(l.projeto_nome,'')   ILIKE '%'||p_search||'%'
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
          WHEN 'projeto' THEN l.projeto_nome WHEN 'contraparte' THEN l.contraparte_nome
          WHEN 'status' THEN l.status END, '')) END DESC NULLS LAST,
    CASE WHEN p_sort_key IN ('descricao','categoria','projeto','contraparte','status') AND v_asc
      THEN lower(COALESCE(
        CASE p_sort_key WHEN 'descricao' THEN l.descricao WHEN 'categoria' THEN l.categoria_nome
          WHEN 'projeto' THEN l.projeto_nome WHEN 'contraparte' THEN l.contraparte_nome
          WHEN 'status' THEN l.status END, '')) END ASC NULLS LAST,
    l.data_vencimento DESC, l.id DESC
  LIMIT p_limit OFFSET p_offset;
END;
$fn$;


GRANT EXECUTE ON FUNCTION public.get_lancamentos_pagina(text,text,text,text,uuid[],uuid[],uuid[],uuid[],text[],numeric,numeric,text,text,text,int,int) TO authenticated;
