-- RPC para gerar parcelas de projeto com dia fixo de vencimento.
-- Primeira parcela: mês atual se CURRENT_DATE < dia_fixo, senão próximo mês.
-- Se dia cai em fim de semana, pula para próxima segunda (lógica simples; feriados tratados no client).

CREATE OR REPLACE FUNCTION public.rpc_gerar_parcelas_dia_fixo(
  p_projeto_id UUID,
  p_num_parcelas INTEGER,
  p_dia_fixo INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_projeto RECORD;
  v_valor_parcela NUMERIC;
  v_caller_empresa_id UUID;
  v_data_venc DATE;
  v_ano INTEGER;
  v_mes INTEGER;
  v_dia_efetivo INTEGER;
  v_ultimo_dia INTEGER;
  v_start_mes INTEGER;
  v_start_ano INTEGER;
  i INTEGER;
  parcelas_criadas INTEGER := 0;
BEGIN
  v_caller_empresa_id := public.get_user_empresa_id();

  SELECT id, valor_contrato, cliente_id, empresa_id, nome, codigo_projeto
  INTO v_projeto
  FROM projetos
  WHERE id = p_projeto_id AND deleted_at IS NULL;

  IF v_projeto IS NULL THEN
    RAISE EXCEPTION 'Projeto não encontrado';
  END IF;

  IF v_projeto.empresa_id != v_caller_empresa_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF v_projeto.valor_contrato IS NULL OR v_projeto.valor_contrato <= 0 THEN
    RAISE EXCEPTION 'Projeto sem valor de contrato';
  END IF;

  IF p_num_parcelas < 1 OR p_num_parcelas > 60 THEN
    RAISE EXCEPTION 'Número de parcelas deve ser entre 1 e 60';
  END IF;

  IF p_dia_fixo < 1 OR p_dia_fixo > 31 THEN
    RAISE EXCEPTION 'Dia fixo deve estar entre 1 e 31';
  END IF;

  v_valor_parcela := ROUND(v_projeto.valor_contrato / p_num_parcelas, 2);

  IF EXTRACT(DAY FROM CURRENT_DATE)::INTEGER >= p_dia_fixo THEN
    v_start_mes := EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER + 1;
    v_start_ano := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
    IF v_start_mes > 12 THEN
      v_start_mes := 1;
      v_start_ano := v_start_ano + 1;
    END IF;
  ELSE
    v_start_mes := EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER;
    v_start_ano := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  END IF;

  FOR i IN 0..(p_num_parcelas - 1) LOOP
    v_mes := ((v_start_mes - 1 + i) % 12) + 1;
    v_ano := v_start_ano + ((v_start_mes - 1 + i) / 12);

    v_ultimo_dia := EXTRACT(DAY FROM (DATE_TRUNC('MONTH', MAKE_DATE(v_ano, v_mes, 1)) + INTERVAL '1 month - 1 day'))::INTEGER;
    v_dia_efetivo := LEAST(p_dia_fixo, v_ultimo_dia);
    v_data_venc := MAKE_DATE(v_ano, v_mes, v_dia_efetivo);

    -- Pula fim de semana (domingo=0, sábado=6 no PG)
    WHILE EXTRACT(DOW FROM v_data_venc) IN (0, 6) LOOP
      v_data_venc := v_data_venc + 1;
    END LOOP;

    INSERT INTO receitas (empresa_id, descricao, valor, data_vencimento, status, projeto_id, cliente_id)
    VALUES (
      v_projeto.empresa_id,
      v_projeto.codigo_projeto || ' - Parcela ' || (i + 1) || '/' || p_num_parcelas,
      v_valor_parcela,
      v_data_venc,
      'Pendente',
      p_projeto_id,
      v_projeto.cliente_id
    );
    parcelas_criadas := parcelas_criadas + 1;
  END LOOP;

  IF p_num_parcelas > 1 THEN
    UPDATE receitas
    SET valor = v_projeto.valor_contrato - (v_valor_parcela * (p_num_parcelas - 1))
    WHERE projeto_id = p_projeto_id
      AND descricao LIKE '%Parcela ' || p_num_parcelas || '/' || p_num_parcelas
      AND deleted_at IS NULL;
  END IF;

  RETURN parcelas_criadas;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_gerar_parcelas_dia_fixo(UUID, INTEGER, INTEGER) TO authenticated;
