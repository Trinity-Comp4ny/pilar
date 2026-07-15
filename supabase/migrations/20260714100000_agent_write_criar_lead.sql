-- Modo de ação dos agentes (fase 1 de escrita): criar Lead a partir de um agent_run.
--
-- O chat (edge function ai-chat) extrai um rascunho de lead e cria um agent_run
-- (agent_type='criar_lead', status='pending_review', result=<campos>). O humano revisa/edita
-- no card de confirmação e aprova → este RPC materializa o lead e marca o run como executed.
--
-- Guardrails (docs/security/ACHADOS_SEGURANCA_AGENTES_2026-07-13.md):
--  • A1: gate de role/feature NO SERVIDOR. Como o RPC é SECURITY DEFINER (bypassa RLS),
--    ele replica explicitamente o gate que a policy leads_write já faz — user_has_feature('leads','editor').
--  • Idempotência: guard de status (só executa um run em pending_review).
--  • Audit/reversibilidade: entity_id aponta pro lead criado; lead tem soft-delete (deleted_at).

-- ---------------------------------------------------------------------------
-- RPC: criar_lead_agente
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.criar_lead_agente(uuid);

CREATE OR REPLACE FUNCTION public.criar_lead_agente(p_run_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run public.agent_runs;
  v_empresa uuid;
  v_lead_id uuid;
  v_nome text;
BEGIN
  -- Gate server-side (fix A1): sem esta checagem, um viewer poderia gravar via RPC.
  IF NOT public.user_has_feature('leads', 'editor') THEN
    RAISE EXCEPTION 'Sem permissão para criar lead';
  END IF;

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
  IF v_run.agent_type != 'criar_lead' THEN
    RAISE EXCEPTION 'Tipo de agente não suportado nesta aprovação: %', v_run.agent_type;
  END IF;

  v_nome := NULLIF(trim(v_run.result->>'nome'), '');
  IF v_nome IS NULL THEN
    RAISE EXCEPTION 'Lead sem nome — preencha o nome antes de criar';
  END IF;

  INSERT INTO public.leads
    (empresa_id, nome, sobrenome, email, contato, origem, valor_estimado, empresa_lead, cnpj, notas,
     responsavel_id, previsao_fechamento, status, created_by)
  VALUES (
    v_empresa,
    v_nome,
    NULLIF(trim(v_run.result->>'sobrenome'), ''),
    NULLIF(trim(v_run.result->>'email'), ''),
    NULLIF(trim(v_run.result->>'contato'), ''),
    NULLIF(trim(v_run.result->>'origem'), ''),
    NULLIF(v_run.result->>'valor_estimado', '')::numeric,
    NULLIF(trim(v_run.result->>'empresa_lead'), ''),
    NULLIF(trim(v_run.result->>'cnpj'), ''),
    NULLIF(trim(v_run.result->>'notas'), ''),
    NULLIF(v_run.result->>'responsavel_id', '')::uuid,
    NULLIF(v_run.result->>'previsao_fechamento', '')::date,
    'Novo',
    auth.uid()
  )
  RETURNING id INTO v_lead_id;

  UPDATE public.agent_runs
    SET status = 'executed',
        entity_type = 'lead',
        entity_id = v_lead_id,
        reviewed_by = auth.uid(),
        reviewed_at = now()
    WHERE id = p_run_id;

  RETURN jsonb_build_object('ok', true, 'lead_id', v_lead_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.criar_lead_agente(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Fix A1 no RPC existente: aprovar_orcamento_agente não checava role/feature.
-- Recriado idêntico + gate server-side no topo.
-- ---------------------------------------------------------------------------
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
  -- Gate server-side (fix A1): materializar orçamento mexe em dinheiro (valor_venda).
  IF NOT public.user_has_feature('financeiro', 'editor') THEN
    RAISE EXCEPTION 'Sem permissão para aprovar orçamento';
  END IF;

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
