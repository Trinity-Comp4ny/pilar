-- Onda 3: ações do Agente sobre entidades EXISTENTES (não criam, operam).
--
-- Dispatcher único gated. O card do chat escolhe o alvo (uuid) e grava em agent_runs.result,
-- depois chama executar_acao_agente(p_run_id). Cada ramo replica o gate adequado e delega às
-- RPCs já existentes (converter/quitar/pagar) ou faz o UPDATE (marcar recebido/pago) com checagem
-- de empresa (SECURITY DEFINER bypassa RLS).
--
-- Ações: converter_lead, converter_proposta, marcar_recebido, marcar_pago, quitar_parcela, pagar_fatura.
-- (Convite ao portal é edge function com gate de role e envio de e-mail — tratado no front.)

DROP FUNCTION IF EXISTS public.executar_acao_agente(uuid);

CREATE OR REPLACE FUNCTION public.executar_acao_agente(p_run_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_run public.agent_runs;
  v_empresa uuid;
  v_acao text;
  v_out jsonb := jsonb_build_object('ok', true);
  v_uuid uuid;
  v_n int;
  v_data date;
BEGIN
  v_empresa := public.get_user_empresa_id();
  SELECT * INTO v_run FROM public.agent_runs WHERE id = p_run_id;
  IF v_run.id IS NULL THEN RAISE EXCEPTION 'Run não encontrado'; END IF;
  IF v_run.empresa_id != v_empresa THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF v_run.status != 'pending_review' THEN RAISE EXCEPTION 'Run não está aguardando revisão'; END IF;
  IF v_run.agent_type != 'acao' THEN RAISE EXCEPTION 'Run não é uma ação'; END IF;

  v_acao := v_run.result->>'acao';
  v_data := COALESCE(NULLIF(v_run.result->>'data','')::date, CURRENT_DATE);

  IF v_acao = 'converter_lead' THEN
    IF NOT public.user_has_feature('clientes','editor') THEN RAISE EXCEPTION 'Sem permissão'; END IF;
    v_uuid := public.rpc_converter_lead_cliente((v_run.result->>'lead_id')::uuid);
    v_out := jsonb_build_object('ok', true, 'cliente_id', v_uuid);

  ELSIF v_acao = 'converter_proposta' THEN
    IF NOT public.user_has_feature('projetos','editor') THEN RAISE EXCEPTION 'Sem permissão'; END IF;
    v_uuid := public.rpc_converter_proposta_projeto((v_run.result->>'proposta_id')::uuid);
    v_out := jsonb_build_object('ok', true, 'projeto_id', v_uuid);

  ELSIF v_acao = 'marcar_recebido' THEN
    IF NOT public.user_has_feature('financeiro','editor') THEN RAISE EXCEPTION 'Sem permissão'; END IF;
    UPDATE public.receitas SET status='Recebido', data_recebimento=v_data, updated_at=now()
      WHERE id=(v_run.result->>'receita_id')::uuid AND empresa_id=v_empresa AND deleted_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n = 0 THEN RAISE EXCEPTION 'Receita não encontrada'; END IF;

  ELSIF v_acao = 'marcar_pago' THEN
    IF NOT public.user_has_feature('financeiro','editor') THEN RAISE EXCEPTION 'Sem permissão'; END IF;
    UPDATE public.despesas SET status='Pago', data_pagamento=v_data, updated_at=now()
      WHERE id=(v_run.result->>'despesa_id')::uuid AND empresa_id=v_empresa AND deleted_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n = 0 THEN RAISE EXCEPTION 'Despesa não encontrada'; END IF;

  ELSIF v_acao = 'quitar_parcela' THEN
    IF NOT public.user_has_feature('financeiro','editor') THEN RAISE EXCEPTION 'Sem permissão'; END IF;
    v_n := public.rpc_grupo_parcela_quitar_antecipado(
      (v_run.result->>'grupo_id')::uuid, v_data,
      NULLIF(v_run.result->>'quantidade','')::int,
      COALESCE(NULLIF(v_run.result->>'desconto','')::numeric, 0));
    v_out := jsonb_build_object('ok', true, 'parcelas_quitadas', v_n);

  ELSIF v_acao = 'pagar_fatura' THEN
    IF NOT public.user_has_feature('financeiro','editor') THEN RAISE EXCEPTION 'Sem permissão'; END IF;
    PERFORM public.pagar_fatura(
      (v_run.result->>'fatura_id')::uuid, (v_run.result->>'conta_id')::uuid,
      NULLIF(v_run.result->>'valor','')::numeric, v_data, p_run_id::text);
    v_out := jsonb_build_object('ok', true, 'fatura_id', v_run.result->>'fatura_id');

  ELSE
    RAISE EXCEPTION 'Ação desconhecida: %', v_acao;
  END IF;

  UPDATE public.agent_runs
    SET status='executed', entity_type=v_acao, reviewed_by=auth.uid(), reviewed_at=now()
    WHERE id=p_run_id;

  RETURN v_out;
END; $$;
GRANT EXECUTE ON FUNCTION public.executar_acao_agente(uuid) TO authenticated;
