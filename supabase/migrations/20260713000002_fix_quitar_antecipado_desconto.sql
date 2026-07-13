-- Onda 0 — Financeiro: "Quitar antecipado" agora ABATE o desconto.
-- Antes: p_desconto_total só entrava na observação; as parcelas eram baixadas pelo valor cheio
-- (Recebido/Pago somava o total sem desconto). Fix: rateio proporcional do desconto sobre as
-- parcelas quitadas; a última parcela absorve o arredondamento pra a soma fechar exatamente
-- (soma - desconto). Guard: desconto não pode ser >= saldo em aberto.

CREATE OR REPLACE FUNCTION public.rpc_grupo_parcela_quitar_antecipado(
  p_grupo_id uuid,
  p_data_pagamento date DEFAULT CURRENT_DATE,
  p_quantidade integer DEFAULT NULL,
  p_desconto_total numeric DEFAULT 0
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_empresa_id uuid;
  v_tipo text;
  v_afetadas integer := 0;
  v_ids uuid[];
  v_soma numeric;
  v_ultimo uuid;
  v_alvo numeric;
  v_atual numeric;
BEGIN
  v_empresa_id := public.get_user_empresa_id();

  SELECT tipo_lancamento INTO v_tipo
  FROM grupos_parcela WHERE id = p_grupo_id AND empresa_id = v_empresa_id;

  IF v_tipo IS NULL THEN RAISE EXCEPTION 'Grupo não encontrado'; END IF;
  IF p_desconto_total IS NULL THEN p_desconto_total := 0; END IF;
  IF p_desconto_total < 0 THEN RAISE EXCEPTION 'Desconto não pode ser negativo'; END IF;

  IF v_tipo = 'receita' THEN
    SELECT array_agg(id ORDER BY parcela_numero) INTO v_ids FROM (
      SELECT id, parcela_numero FROM receitas
      WHERE grupo_parcela = p_grupo_id AND status::text IN ('Pendente','Atrasado') AND deleted_at IS NULL
      ORDER BY parcela_numero NULLS LAST LIMIT COALESCE(p_quantidade, 9999)
    ) sub;
    IF v_ids IS NULL OR array_length(v_ids,1) = 0 THEN RETURN 0; END IF;

    SELECT COALESCE(SUM(valor),0) INTO v_soma FROM receitas WHERE id = ANY(v_ids);
    IF p_desconto_total >= v_soma THEN
      RAISE EXCEPTION 'Desconto (%) maior ou igual ao saldo em aberto (%)', p_desconto_total, v_soma;
    END IF;
    SELECT id INTO v_ultimo FROM receitas WHERE id = ANY(v_ids) ORDER BY parcela_numero DESC NULLS LAST, id LIMIT 1;

    UPDATE receitas SET
      status = 'Recebido'::status_financeiro,
      data_recebimento = p_data_pagamento,
      valor = CASE WHEN p_desconto_total > 0 AND v_soma > 0
                   THEN ROUND(valor * (v_soma - p_desconto_total) / v_soma, 2) ELSE valor END,
      observacao = CASE WHEN p_desconto_total > 0
                   THEN COALESCE(observacao,'') || chr(10) || '[Quitação antecipada — desconto de R$ ' || ROUND(p_desconto_total,2)::text || ' rateado]'
                   ELSE observacao END,
      updated_by = auth.uid(), updated_at = now()
    WHERE id = ANY(v_ids);
    GET DIAGNOSTICS v_afetadas = ROW_COUNT;

    IF p_desconto_total > 0 AND v_soma > 0 THEN
      v_alvo := ROUND(v_soma - p_desconto_total, 2);
      SELECT COALESCE(SUM(valor),0) INTO v_atual FROM receitas WHERE id = ANY(v_ids);
      IF v_atual <> v_alvo THEN UPDATE receitas SET valor = valor + (v_alvo - v_atual) WHERE id = v_ultimo; END IF;
    END IF;
  ELSE
    SELECT array_agg(id ORDER BY parcela_numero) INTO v_ids FROM (
      SELECT id, parcela_numero FROM despesas
      WHERE grupo_parcela = p_grupo_id AND status::text IN ('Pendente','Atrasado') AND deleted_at IS NULL
      ORDER BY parcela_numero NULLS LAST LIMIT COALESCE(p_quantidade, 9999)
    ) sub;
    IF v_ids IS NULL OR array_length(v_ids,1) = 0 THEN RETURN 0; END IF;

    SELECT COALESCE(SUM(valor),0) INTO v_soma FROM despesas WHERE id = ANY(v_ids);
    IF p_desconto_total >= v_soma THEN
      RAISE EXCEPTION 'Desconto (%) maior ou igual ao saldo em aberto (%)', p_desconto_total, v_soma;
    END IF;
    SELECT id INTO v_ultimo FROM despesas WHERE id = ANY(v_ids) ORDER BY parcela_numero DESC NULLS LAST, id LIMIT 1;

    UPDATE despesas SET
      status = 'Pago'::status_financeiro,
      data_pagamento = p_data_pagamento,
      valor = CASE WHEN p_desconto_total > 0 AND v_soma > 0
                   THEN ROUND(valor * (v_soma - p_desconto_total) / v_soma, 2) ELSE valor END,
      observacao = CASE WHEN p_desconto_total > 0
                   THEN COALESCE(observacao,'') || chr(10) || '[Quitação antecipada — desconto de R$ ' || ROUND(p_desconto_total,2)::text || ' rateado]'
                   ELSE observacao END,
      updated_by = auth.uid(), updated_at = now()
    WHERE id = ANY(v_ids);
    GET DIAGNOSTICS v_afetadas = ROW_COUNT;

    IF p_desconto_total > 0 AND v_soma > 0 THEN
      v_alvo := ROUND(v_soma - p_desconto_total, 2);
      SELECT COALESCE(SUM(valor),0) INTO v_atual FROM despesas WHERE id = ANY(v_ids);
      IF v_atual <> v_alvo THEN UPDATE despesas SET valor = valor + (v_alvo - v_atual) WHERE id = v_ultimo; END IF;
    END IF;
  END IF;

  RETURN v_afetadas;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.rpc_grupo_parcela_quitar_antecipado(uuid, date, integer, numeric) TO authenticated;
