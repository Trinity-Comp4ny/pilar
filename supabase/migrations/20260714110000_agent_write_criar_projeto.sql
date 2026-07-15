-- Modo de ação dos agentes: criar Projeto a partir de um agent_run.
--
-- Mesmo padrão de criar_lead_agente: o chat extrai um rascunho, o humano revisa/edita no card
-- e aprova → este RPC materializa o projeto e marca o run como executed.
--
-- Guardrails (docs/security/ACHADOS_SEGURANCA_AGENTES_2026-07-13.md):
--  • A1: gate server-side. SECURITY DEFINER bypassa RLS, então replica o gate da policy projetos_write
--    (user_has_feature('projetos','editor')).
--  • Idempotência: guard de status (só executa run em pending_review).
--  • Reversibilidade: projetos tem soft-delete (deleted_at).
--
-- Escopo: cria os campos escalares do projeto (paridade com os passos 1-2 do wizard). Disciplinas
-- (passo 3, sub-entidade relacional opcional) NÃO são criadas aqui — adicionadas na tela do projeto.

DROP FUNCTION IF EXISTS public.criar_projeto_agente(uuid);

CREATE OR REPLACE FUNCTION public.criar_projeto_agente(p_run_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run public.agent_runs;
  v_empresa uuid;
  v_projeto_id uuid;
  v_nome text;
  v_codigo text;
  v_seq int;
BEGIN
  -- Gate server-side (fix A1): sem isto, um viewer poderia gravar via RPC.
  IF NOT public.user_has_feature('projetos', 'editor') THEN
    RAISE EXCEPTION 'Sem permissão para criar projeto';
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
  IF v_run.agent_type != 'criar_projeto' THEN
    RAISE EXCEPTION 'Tipo de agente não suportado nesta aprovação: %', v_run.agent_type;
  END IF;

  v_nome := NULLIF(trim(v_run.result->>'nome'), '');
  IF v_nome IS NULL THEN
    RAISE EXCEPTION 'Projeto sem nome — preencha o nome antes de criar';
  END IF;

  -- Código: usa o informado; se vazio, gera sequencial PRJ-XXXX por empresa (igual ao converter).
  v_codigo := NULLIF(trim(v_run.result->>'codigo_projeto'), '');
  IF v_codigo IS NULL THEN
    SELECT COALESCE(MAX(
      CASE WHEN codigo_projeto ~ '^PRJ-\d+$' THEN CAST(SUBSTRING(codigo_projeto FROM 5) AS INT) ELSE 0 END
    ), 0) + 1
    INTO v_seq
    FROM public.projetos
    WHERE empresa_id = v_empresa;
    v_codigo := 'PRJ-' || LPAD(v_seq::text, 4, '0');
  END IF;

  INSERT INTO public.projetos
    (empresa_id, cliente_id, codigo_projeto, nome, localizacao, status,
     data_inicio, data_previsao, data_final, valor_contrato, observacao, parcelas, area_m2, prioridade,
     created_by, updated_by)
  VALUES (
    v_empresa,
    NULLIF(v_run.result->>'cliente_id', '')::uuid,
    v_codigo,
    v_nome,
    NULLIF(trim(v_run.result->>'localizacao'), ''),
    'Planejamento',
    NULLIF(v_run.result->>'data_inicio', '')::date,
    NULLIF(v_run.result->>'data_previsao', '')::date,
    NULLIF(v_run.result->>'data_final', '')::date,
    NULLIF(v_run.result->>'valor_contrato', '')::numeric,
    NULLIF(trim(v_run.result->>'observacao'), ''),
    NULLIF(trim(v_run.result->>'parcelas'), ''),
    COALESCE(NULLIF(v_run.result->>'area_m2', '')::numeric, 0),
    COALESCE(NULLIF(trim(v_run.result->>'prioridade'), ''), 'Media'),
    auth.uid(),
    auth.uid()
  )
  RETURNING id INTO v_projeto_id;

  UPDATE public.agent_runs
    SET status = 'executed',
        entity_type = 'projeto',
        entity_id = v_projeto_id,
        reviewed_by = auth.uid(),
        reviewed_at = now()
    WHERE id = p_run_id;

  RETURN jsonb_build_object('ok', true, 'projeto_id', v_projeto_id, 'codigo_projeto', v_codigo);
END;
$$;

GRANT EXECUTE ON FUNCTION public.criar_projeto_agente(uuid) TO authenticated;
