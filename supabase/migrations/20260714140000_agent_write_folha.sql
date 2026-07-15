-- Fechamento de folha pelo Agente Financeiro (lote por competência).
--
-- Fluxo: o chat extrai mês/ano; o card busca o preview (get_folha_preview), o humano revisa/edita
-- a tabela e aprova → este RPC insere as N linhas a partir de result.linhas.
--
-- Guardrails:
--  • Gate server-side user_has_feature('financeiro','editor') — ENDURECE a RLS da folha_pagamento,
--    que hoje só checa empresa_id (qualquer membro insere). Aqui exige nível editor.
--  • Idempotência: RAISE se a folha do mês/ano já existir (respeita UNIQUE(pessoa,mes,ano)).
--  • empresa_id vem de get_user_empresa_id(), nunca do cliente.

DROP FUNCTION IF EXISTS public.fechar_folha_agente(uuid);

CREATE OR REPLACE FUNCTION public.fechar_folha_agente(p_run_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run public.agent_runs;
  v_empresa uuid;
  v_mes int;
  v_ano int;
  v_count int;
BEGIN
  IF NOT public.user_has_feature('financeiro', 'editor') THEN
    RAISE EXCEPTION 'Sem permissão para fechar folha';
  END IF;
  v_empresa := public.get_user_empresa_id();

  SELECT * INTO v_run FROM public.agent_runs WHERE id = p_run_id;
  IF v_run.id IS NULL THEN RAISE EXCEPTION 'Run não encontrado'; END IF;
  IF v_run.empresa_id != v_empresa THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF v_run.status != 'pending_review' THEN
    RAISE EXCEPTION 'Run não está aguardando revisão (status atual: %)', v_run.status;
  END IF;
  IF v_run.agent_type != 'fechar_folha' THEN
    RAISE EXCEPTION 'Tipo de agente não suportado: %', v_run.agent_type;
  END IF;

  v_mes := NULLIF(v_run.result->>'mes', '')::int;
  v_ano := NULLIF(v_run.result->>'ano', '')::int;
  IF v_mes IS NULL OR v_mes < 1 OR v_mes > 12 OR v_ano IS NULL THEN
    RAISE EXCEPTION 'Mês/ano inválidos';
  END IF;

  IF EXISTS (SELECT 1 FROM public.folha_pagamento WHERE empresa_id = v_empresa AND mes = v_mes AND ano = v_ano) THEN
    RAISE EXCEPTION 'A folha de %/% já foi fechada', v_mes, v_ano;
  END IF;

  INSERT INTO public.folha_pagamento
    (empresa_id, pessoa_id, mes, ano, salario_fixo, total_area_projetada, valor_m2, adicional_variavel, total_receber, status)
  SELECT
    v_empresa, l.pessoa_id, v_mes, v_ano,
    COALESCE(l.salario_fixo, 0), COALESCE(l.total_area_projetada, 0), COALESCE(l.valor_m2, 0),
    COALESCE(l.adicional_variavel, 0), COALESCE(l.total_receber, 0), 'pendente'
  FROM jsonb_to_recordset(v_run.result->'linhas') AS l(
    pessoa_id uuid,
    salario_fixo numeric,
    total_area_projetada numeric,
    valor_m2 numeric,
    adicional_variavel numeric,
    total_receber numeric
  )
  WHERE l.pessoa_id IS NOT NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN RAISE EXCEPTION 'Nenhuma linha de folha para inserir'; END IF;

  UPDATE public.agent_runs
    SET status = 'executed', entity_type = 'folha', reviewed_by = auth.uid(), reviewed_at = now()
    WHERE id = p_run_id;

  RETURN jsonb_build_object('ok', true, 'linhas', v_count, 'mes', v_mes, 'ano', v_ano);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fechar_folha_agente(uuid) TO authenticated;
