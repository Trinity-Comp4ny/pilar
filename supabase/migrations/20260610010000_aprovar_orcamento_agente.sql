-- RPC de aprovação do draft de orçamento gerado por agente.
--
-- Transforma um agent_run (orcamento_honorarios, pending_review) em linhas reais
-- de projeto_orcamento_fases e marca o run como executed — atomicamente.
-- É o passo "humano aprova → vira domínio" do cockpit.

DROP FUNCTION IF EXISTS public.aprovar_orcamento_agente(uuid);

CREATE OR REPLACE FUNCTION public.aprovar_orcamento_agente(p_run_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run public.agent_runs;
  v_empresa uuid;
  v_projeto uuid;
  v_count int;
BEGIN
  v_empresa := public.get_user_empresa_id();

  SELECT * INTO v_run FROM public.agent_runs WHERE id = p_run_id;
  IF v_run.id IS NULL THEN
    RAISE EXCEPTION 'Run não encontrado';
  END IF;
  IF v_run.empresa_id != v_empresa THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF v_run.status != 'pending_review' THEN
    RAISE EXCEPTION 'Run não está aguardando revisão (status atual: %)', v_run.status;
  END IF;
  IF v_run.agent_type != 'orcamento_honorarios' THEN
    RAISE EXCEPTION 'Tipo de agente não suportado nesta aprovação: %', v_run.agent_type;
  END IF;

  v_projeto := v_run.entity_id;
  IF v_projeto IS NULL THEN
    RAISE EXCEPTION 'Run sem projeto associado — associe um projeto antes de aprovar';
  END IF;

  -- Materializa cada fase do orçamento como linha de domínio.
  -- valor_venda = custo (horas × custo_hora) com a margem alvo aplicada.
  INSERT INTO public.projeto_orcamento_fases
    (empresa_id, projeto_id, disciplina, horas_estimadas, custo_hora, margem_alvo_pct, valor_venda, observacao, created_by)
  SELECT
    v_empresa,
    v_projeto,
    f.disciplina,
    f.horas_estimadas,
    f.custo_hora,
    f.margem_alvo_pct,
    round(f.horas_estimadas * f.custo_hora * (1 + f.margem_alvo_pct / 100), 2),
    f.observacao,
    auth.uid()
  FROM jsonb_to_recordset(v_run.result->'fases')
    AS f(disciplina text, horas_estimadas numeric, custo_hora numeric, margem_alvo_pct numeric, observacao text);

  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.agent_runs
    SET status = 'executed', reviewed_by = auth.uid(), reviewed_at = now()
    WHERE id = p_run_id;

  RETURN jsonb_build_object('ok', true, 'fases_criadas', v_count, 'projeto_id', v_projeto);
END;
$$;

GRANT EXECUTE ON FUNCTION public.aprovar_orcamento_agente(uuid) TO authenticated;
