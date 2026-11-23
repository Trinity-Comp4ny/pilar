-- Resumo de lançamentos: atrasados separados por tipo.
-- O KPI "A pagar" mostrava "N atrasado(s)" contando também receitas atrasadas, então
-- aparecia R$ 0,00 a pagar com "4 atrasados". Agora o JSON traz atrasados_pagar e
-- atrasados_receber; atrasados_count segue igual (compatibilidade).

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
    'atrasados_count', COUNT(*) FILTER (WHERE NOT (status = ANY(v_pagos)) AND data_vencimento < v_hoje AND tipo <> 'transferencia'),
    'atrasados_pagar', COUNT(*) FILTER (WHERE tipo='despesa' AND NOT (status = ANY(v_pagos)) AND data_vencimento < v_hoje),
    'atrasados_receber', COUNT(*) FILTER (WHERE tipo='receita' AND NOT (status = ANY(v_pagos)) AND data_vencimento < v_hoje)
  ) INTO v
  FROM base;

  RETURN v;
END;
$fn$;

ALTER FUNCTION public.get_lancamentos_resumo(text, text, text, text, uuid[], uuid[], uuid[], uuid[], text[], numeric, numeric, text) SET search_path = public, pg_temp;
