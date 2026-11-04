-- Remove as colunas do Asaas por empresa (segue a 20261128000000, que tirou as functions e as tabelas).
--
-- Colunas: receitas.asaas_billing_type/asaas_payment_id/asaas_payment_status/asaas_payment_url e
-- clientes.asaas_customer_id. Em produção só a Bez Company tinha dado (1 receita pendente e 1 cliente, de
-- um teste em sandbox de 16/04/2026), então não se perde dado de cliente. O Asaas da plataforma
-- (pilar_subscriptions, pilar_pending_signups, pilar_token_pack_purchases) não muda.
--
-- Quem lia as colunas, conferido nos corpos em produção (hash igual ao do repo):
--   1. get_cliente_projeto_detail, as duas sobrecargas: o JSON de receitas perde asaas_payment_url e
--      asaas_billing_type. Função PL/pgSQL não acusa coluna removida ao dropar: só quebraria na chamada.
--   2. view lancamentos: perde as 4 colunas asaas_*. get_lancamentos_pagina devolve SETOF lancamentos,
--      então cai antes da view e volta depois, com o mesmo corpo. O search_path fixo (public, pg_temp) dela
--      não está na definição original: veio de um ALTER posterior. DROP + CREATE o perderia, então é
--      reposto aqui (o pgTAP fk_indices_e_search_path pega isso).

-- 1. Portal: o JSON de receitas deixa de trazer o link e o tipo de cobrança.
CREATE OR REPLACE FUNCTION public.get_cliente_projeto_detail(p_projeto_id uuid, p_token text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cliente_id uuid;
  v_empresa_id uuid;
  result       json;
BEGIN
  SELECT cpa.cliente_id, cpa.empresa_id
  INTO v_cliente_id, v_empresa_id
  FROM cliente_portal_accounts cpa
  WHERE cpa.token_sessao = encode(extensions.digest(p_token, 'sha256'), 'hex')
    AND cpa.token_expira_em > NOW()
    AND cpa.ativo = true;

  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida';
  END IF;

  SELECT json_build_object(
    'projeto_id',              p.id,
    'cliente_id',              p.cliente_id,
    'empresa_id',              p.empresa_id,
    'projeto_nome',            p.nome,
    'projeto_status',          p.status,
    'projeto_codigo',          p.codigo_projeto,
    'data_inicio',             p.data_inicio,
    'data_previsao',           p.data_previsao,
    'data_final',              p.data_final,
    'valor_contrato',          p.valor_contrato,
    'cliente_nome',            c.nome,
    'empresa_nome',            e.nome,
    'proposta_aguardando_aprovacao', EXISTS (
      SELECT 1 FROM propostas pr
      WHERE pr.projeto_id = p.id
        AND pr.empresa_id = p.empresa_id
        AND pr.status = 'enviada'
        AND pr.deleted_at IS NULL
    ),
    'disciplinas',             COALESCE(
      (SELECT json_agg(
         json_build_object(
           'disciplina',       pd.nome,
           'status',           pd.status,
           'data_inicio',      pd.data_inicio,
           'data_previsao',    pd.data_fim,
           'data_final',       pd.data_fim_real,
           'responsavel_nome', (
             SELECT string_agg(ps.nome, ', ')
             FROM projeto_disciplina_responsaveis pdr
             JOIN pessoas ps ON ps.id = pdr.pessoa_id
             WHERE pdr.projeto_disciplina_id = pd.id
           )
         ) ORDER BY pd.created_at
       )
       FROM projeto_disciplinas pd
       WHERE pd.projeto_id = p.id),
      '[]'::json
    ),
    'receitas',                COALESCE(
      (SELECT json_agg(
         json_build_object(
           'id',                  r.id,
           'descricao',           r.descricao,
           'valor',               r.valor,
           'data_vencimento',     r.data_vencimento,
           'data_recebimento',    r.data_recebimento,
           'status',              r.status
         ) ORDER BY r.data_vencimento ASC NULLS LAST
       )
       FROM receitas r
       WHERE r.projeto_id = p.id
         AND r.deleted_at IS NULL),
      '[]'::json
    ),
    'portal_entregas_pendentes', (
      SELECT COUNT(*)::int
      FROM portal_entregas pent
      WHERE pent.projeto_id = p.id
        AND pent.status = 'pendente'
    )
  ) INTO result
  FROM projetos p
  JOIN clientes c ON c.id = p.cliente_id
  JOIN empresas e ON e.id = p.empresa_id
  WHERE p.id = p_projeto_id
    AND p.cliente_id = v_cliente_id
    AND p.empresa_id = v_empresa_id
    AND p.deleted_at IS NULL;

  IF result IS NULL THEN
    RAISE EXCEPTION 'Projeto não encontrado';
  END IF;

  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION "public"."get_cliente_projeto_detail"("p_projeto_id" uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cliente_id uuid;
  v_empresa_id uuid;
  result       json;
BEGIN
  SELECT cpa.cliente_id, cpa.empresa_id
  INTO v_cliente_id, v_empresa_id
  FROM cliente_portal_accounts cpa
  WHERE cpa.auth_user_id = auth.uid() AND cpa.ativo = true;

  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT json_build_object(
    'projeto_id',              p.id,
    'cliente_id',              p.cliente_id,
    'empresa_id',              p.empresa_id,
    'projeto_nome',            p.nome,
    'projeto_status',          p.status,
    'projeto_codigo',          p.codigo_projeto,
    'data_inicio',             p.data_inicio,
    'data_previsao',           p.data_previsao,
    'data_final',              p.data_final,
    'valor_contrato',          p.valor_contrato,
    'cliente_nome',            c.nome,
    'empresa_nome',            e.nome,
    'disciplinas',             COALESCE(
      (SELECT json_agg(
         json_build_object(
           'disciplina',       pd.nome,
           'status',           pd.status,
           'data_inicio',      pd.data_inicio,
           'data_previsao',    pd.data_fim,
           'data_final',       pd.data_fim_real,
           'responsavel_nome', (
             SELECT string_agg(ps.nome, ', ')
             FROM projeto_disciplina_responsaveis pdr
             JOIN pessoas ps ON ps.id = pdr.pessoa_id
             WHERE pdr.projeto_disciplina_id = pd.id
           )
         ) ORDER BY pd.created_at
       )
       FROM projeto_disciplinas pd
       WHERE pd.projeto_id = p.id),
      '[]'::json
    ),
    'receitas',                COALESCE(
      (SELECT json_agg(
         json_build_object(
           'id',                  r.id,
           'descricao',           r.descricao,
           'valor',               r.valor,
           'data_vencimento',     r.data_vencimento,
           'data_recebimento',    r.data_recebimento,
           'status',              r.status
         ) ORDER BY r.data_vencimento ASC NULLS LAST
       )
       FROM receitas r
       WHERE r.projeto_id = p.id
         AND r.deleted_at IS NULL),
      '[]'::json
    ),
    'portal_entregas_pendentes', (
      SELECT COUNT(*)::int
      FROM portal_entregas pent
      WHERE pent.projeto_id = p.id
        AND pent.status = 'pendente'
    )
  ) INTO result
  FROM projetos p
  JOIN clientes c ON c.id = p.cliente_id
  JOIN empresas e ON e.id = p.empresa_id
  WHERE p.id = p_projeto_id
    AND p.cliente_id = v_cliente_id
    AND p.empresa_id = v_empresa_id
    AND p.deleted_at IS NULL;

  IF result IS NULL THEN
    RAISE EXCEPTION 'Projeto não encontrado ou acesso negado';
  END IF;

  RETURN result;
END;
$$;

-- 2. A view e a função que devolve o tipo dela caem antes das colunas.
DROP FUNCTION IF EXISTS public.get_lancamentos_pagina(text,text,text,text,uuid[],uuid[],uuid[],uuid[],text[],numeric,numeric,text,text,text,int,int);
DROP VIEW IF EXISTS public.lancamentos;

-- 3. Colunas.
ALTER TABLE public.receitas
  DROP COLUMN IF EXISTS asaas_billing_type,
  DROP COLUMN IF EXISTS asaas_payment_id,
  DROP COLUMN IF EXISTS asaas_payment_status,
  DROP COLUMN IF EXISTS asaas_payment_url;
ALTER TABLE public.clientes DROP COLUMN IF EXISTS asaas_customer_id;

-- 4. View e função de volta, sem as colunas.
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
  -- Novos: recorrente/periodicidade (só despesa)
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
SET search_path = public, pg_temp
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
