-- Onda 2: Aditivo de escopo pelo Agente (o "aditivo que vaza").
--
-- Cria um escopo tipo='aditivo' como RASCUNHO + N itens + registro de histórico, em uma transação.
-- A APROVAÇÃO (que altera valor_contrato do projeto via trigger) fica FORA do agente — humano aprova na tela.
-- Gate: user_has_feature('projetos','editor') (a RLS de escopos é feature-based por 'projetos').

DROP FUNCTION IF EXISTS public.criar_aditivo_agente(uuid);

CREATE OR REPLACE FUNCTION public.criar_aditivo_agente(p_run_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_run public.agent_runs;
  v_empresa uuid;
  v_projeto uuid;
  v_desc text;
  v_id uuid;
  v_horas numeric;
  v_custo numeric;
  v_n int;
BEGIN
  IF NOT public.user_has_feature('projetos','editor') THEN
    RAISE EXCEPTION 'Sem permissão para criar aditivo';
  END IF;
  v_empresa := public.get_user_empresa_id();

  SELECT * INTO v_run FROM public.agent_runs WHERE id = p_run_id;
  IF v_run.id IS NULL THEN RAISE EXCEPTION 'Run não encontrado'; END IF;
  IF v_run.empresa_id != v_empresa THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF v_run.status != 'pending_review' THEN RAISE EXCEPTION 'Run não está aguardando revisão'; END IF;
  IF v_run.agent_type != 'criar_aditivo' THEN RAISE EXCEPTION 'Tipo não suportado: %', v_run.agent_type; END IF;

  v_projeto := NULLIF(v_run.result->>'projeto_id','')::uuid;
  IF v_projeto IS NULL THEN RAISE EXCEPTION 'Aditivo precisa de um projeto'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.projetos WHERE id=v_projeto AND empresa_id=v_empresa AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Projeto inválido'; END IF;
  v_desc := NULLIF(trim(v_run.result->>'descricao'),'');
  IF v_desc IS NULL THEN RAISE EXCEPTION 'Aditivo sem descrição'; END IF;

  -- Soma horas/custo dos itens.
  SELECT COALESCE(SUM(horas),0), COALESCE(SUM(custo),0)
    INTO v_horas, v_custo
  FROM jsonb_to_recordset(COALESCE(v_run.result->'itens','[]'::jsonb))
    AS i(descricao text, disciplina text, horas numeric, custo numeric);

  INSERT INTO public.escopos
    (empresa_id, projeto_id, descricao, tipo, status, horas_estimadas, custo_estimado, valor_aditivo, justificativa, created_by, updated_by)
  VALUES (
    v_empresa, v_projeto, v_desc, 'aditivo', 'rascunho',
    v_horas, v_custo, round(v_custo * 1.3, 2),
    NULLIF(trim(v_run.result->>'justificativa'),''), auth.uid(), auth.uid()
  )
  RETURNING id INTO v_id;

  INSERT INTO public.escopo_itens (escopo_id, descricao, disciplina, horas, custo)
  SELECT v_id, i.descricao, NULLIF(trim(i.disciplina),''), COALESCE(i.horas,0), COALESCE(i.custo,0)
  FROM jsonb_to_recordset(COALESCE(v_run.result->'itens','[]'::jsonb))
    AS i(descricao text, disciplina text, horas numeric, custo numeric)
  WHERE NULLIF(trim(i.descricao),'') IS NOT NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  INSERT INTO public.escopo_historico (escopo_id, acao, usuario_id, detalhes)
  VALUES (v_id, 'criado_via_agente', auth.uid(), jsonb_build_object('itens', v_n));

  UPDATE public.agent_runs
    SET status='executed', entity_type='aditivo', entity_id=v_id, reviewed_by=auth.uid(), reviewed_at=now()
    WHERE id=p_run_id;

  RETURN jsonb_build_object('ok', true, 'aditivo_id', v_id, 'itens', v_n, 'valor_aditivo', round(v_custo*1.3,2));
END; $$;
GRANT EXECUTE ON FUNCTION public.criar_aditivo_agente(uuid) TO authenticated;
