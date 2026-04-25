-- ==============================================================================
-- 022_rpc_calcular_wip_custo_real.sql
-- Substitui rpc_calcular_wip para calcular custo realizado usando o salário real
-- da pessoa (pessoas.salario_fixo ÷ horas mensais) como prioridade. Cai no
-- custo_hora médio do orçamento (projeto_orcamento_fases) apenas quando não há
-- pessoa vinculada ao timesheet ou ela não tem salário cadastrado.
--
-- Horas mensais = pessoas.horas_semanais × 4.33 (default 173.3h/mês se 40h/sem).
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.rpc_calcular_wip(p_mes INTEGER, p_ano INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id UUID;
  v_projeto RECORD;
  v_horas NUMERIC;
  v_custo NUMERIC;
  v_faturado NUMERIC;
  v_recebido NUMERIC;
  v_custo_hora_fallback NUMERIC;
  v_fim_mes DATE;
  v_count INTEGER := 0;
BEGIN
  v_empresa_id := public.get_user_empresa_id();
  v_fim_mes := (make_date(p_ano, p_mes, 1) + INTERVAL '1 month - 1 day')::DATE;

  FOR v_projeto IN
    SELECT p.id, p.nome
    FROM projetos p
    WHERE p.empresa_id = v_empresa_id
      AND p.deleted_at IS NULL
      AND p.status IN ('Planejamento', 'Em andamento', 'Revisão', 'Concluído')
  LOOP
    -- Fallback: custo/hora médio do orçamento (usado quando pessoa sem salário)
    SELECT COALESCE(
      CASE WHEN SUM(horas_estimadas) > 0
        THEN SUM(horas_estimadas * custo_hora) / SUM(horas_estimadas)
        ELSE 0
      END, 0)
    INTO v_custo_hora_fallback
    FROM projeto_orcamento_fases
    WHERE projeto_id = v_projeto.id AND deleted_at IS NULL;

    -- Horas realizadas (aprovadas) até o fim do mês
    SELECT COALESCE(SUM(horas), 0) INTO v_horas
    FROM timesheets
    WHERE projeto_id = v_projeto.id
      AND status = 'aprovado'
      AND deleted_at IS NULL
      AND data <= v_fim_mes;

    -- Custo realizado = Σ (horas × custo/hora da pessoa OU fallback)
    SELECT COALESCE(SUM(
      t.horas * COALESCE(
        CASE
          WHEN p.salario_fixo IS NOT NULL
            AND p.salario_fixo > 0
            AND COALESCE(p.horas_semanais, 40) > 0
          THEN p.salario_fixo / (COALESCE(p.horas_semanais, 40) * 4.33)
          ELSE NULL
        END,
        v_custo_hora_fallback
      )
    ), 0) INTO v_custo
    FROM timesheets t
    LEFT JOIN pessoas p
      ON p.id = t.pessoa_id
      AND p.empresa_id = v_empresa_id
      AND p.deleted_at IS NULL
    WHERE t.projeto_id = v_projeto.id
      AND t.empresa_id = v_empresa_id
      AND t.status = 'aprovado'
      AND t.deleted_at IS NULL
      AND t.data <= v_fim_mes;

    -- Faturado (marcos faturados/recebidos) até o fim do mês
    SELECT COALESCE(SUM(valor), 0) INTO v_faturado
    FROM marcos_faturamento
    WHERE projeto_id = v_projeto.id
      AND status IN ('faturado', 'recebido')
      AND deleted_at IS NULL
      AND data_faturada <= v_fim_mes;

    -- Recebido (receitas efetivamente recebidas)
    SELECT COALESCE(SUM(valor), 0) INTO v_recebido
    FROM receitas
    WHERE projeto_id = v_projeto.id
      AND status = 'Recebido'
      AND deleted_at IS NULL
      AND data_recebimento <= v_fim_mes;

    IF v_horas = 0 AND v_faturado = 0 AND v_recebido = 0 THEN
      CONTINUE;
    END IF;

    INSERT INTO wip_snapshots (empresa_id, projeto_id, mes, ano, horas_realizadas, custo_realizado, faturado, recebido)
    VALUES (v_empresa_id, v_projeto.id, p_mes, p_ano, v_horas, v_custo, v_faturado, v_recebido)
    ON CONFLICT (projeto_id, mes, ano) DO UPDATE SET
      horas_realizadas = EXCLUDED.horas_realizadas,
      custo_realizado = EXCLUDED.custo_realizado,
      faturado = EXCLUDED.faturado,
      recebido = EXCLUDED.recebido;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_calcular_wip(INTEGER, INTEGER) TO authenticated;

COMMENT ON FUNCTION public.rpc_calcular_wip(INTEGER, INTEGER) IS
  'Calcula WIP mensal usando custo/hora real da pessoa (salario_fixo / horas mensais) como prioridade. Fallback: custo_hora médio do orçamento.';
