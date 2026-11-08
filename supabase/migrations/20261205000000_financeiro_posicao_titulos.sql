-- Financeiro, fase 3 da SPEC 150: posição dos títulos para as abas A receber / A pagar.
--
-- Os chips do topo das abas (Vencidos · Vencem hoje · Próximos 7 dias · A vencer ·
-- Pagos no mês) precisam de contagem e valor do conjunto INTEIRO, não da página
-- carregada. Cada balde usa exatamente a regra do filtro que o chip aplica em
-- get_lancamentos_pagina (vencimento + pago/em aberto), para o número do chip bater
-- com a lista que aparece ao clicar. "Um número, uma regra" (SPEC 033).
CREATE OR REPLACE FUNCTION public.get_titulos_posicao(p_tipo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_ini_mes date := date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo'))::date;
  v_fim_mes date := (date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo')) + interval '1 month - 1 day')::date;
  v_pagos constant text[] := ARRAY['Recebido','Recebida','Pago','Concluída'];
  v_out jsonb;
BEGIN
  IF p_tipo NOT IN ('receita', 'despesa') THEN
    RAISE EXCEPTION 'tipo inválido: %', p_tipo;
  END IF;

  SELECT jsonb_build_object(
    'vencidos', jsonb_build_object(
      'qtd',   count(*) FILTER (WHERE NOT b.pago AND b.data_vencimento < v_hoje),
      'valor', COALESCE(sum(b.valor) FILTER (WHERE NOT b.pago AND b.data_vencimento < v_hoje), 0)),
    'hoje', jsonb_build_object(
      'qtd',   count(*) FILTER (WHERE NOT b.pago AND b.data_vencimento = v_hoje),
      'valor', COALESCE(sum(b.valor) FILTER (WHERE NOT b.pago AND b.data_vencimento = v_hoje), 0)),
    'semana', jsonb_build_object(
      'qtd',   count(*) FILTER (WHERE NOT b.pago AND b.data_vencimento BETWEEN v_hoje + 1 AND v_hoje + 7),
      'valor', COALESCE(sum(b.valor) FILTER (WHERE NOT b.pago AND b.data_vencimento BETWEEN v_hoje + 1 AND v_hoje + 7), 0)),
    'futuro', jsonb_build_object(
      'qtd',   count(*) FILTER (WHERE NOT b.pago AND b.data_vencimento > v_hoje + 7),
      'valor', COALESCE(sum(b.valor) FILTER (WHERE NOT b.pago AND b.data_vencimento > v_hoje + 7), 0)),
    'pagos_mes', jsonb_build_object(
      'qtd',   count(*) FILTER (WHERE b.pago AND b.data_vencimento BETWEEN v_ini_mes AND v_fim_mes),
      'valor', COALESCE(sum(b.valor) FILTER (WHERE b.pago AND b.data_vencimento BETWEEN v_ini_mes AND v_fim_mes), 0)),
    'hoje_data', v_hoje
  )
  INTO v_out
  FROM (
    SELECT l.valor, l.data_vencimento, (l.status = ANY(v_pagos)) AS pago
    FROM public.lancamentos l
    WHERE l.deleted_at IS NULL
      AND l.status <> 'Cancelado'
      AND l.is_fatura_payment = false
      AND l.tipo = p_tipo
  ) b;

  RETURN v_out;
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_titulos_posicao(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_titulos_posicao(text) TO authenticated;
