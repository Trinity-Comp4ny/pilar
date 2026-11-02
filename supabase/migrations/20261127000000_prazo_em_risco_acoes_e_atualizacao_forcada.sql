-- SPEC 148 (fase 3): ações do plano de prazo em risco e atualização forçada da fila.
--
-- 1. agente_pendencias_atualizar(p_forcar): depois de uma ação que muda o dado de origem (salvar
--    orçamento, criar aditivo), a tela pede a varredura sem esperar os 5 minutos de intervalo.
--    A versão sem argumento sai: duas versões da mesma função confundem o PostgREST.
-- 2. projeto_prazo_avisar: notifica os responsáveis das disciplinas do projeto (ou a gestão, se não
--    houver responsável com conta) que a entrega está em risco.
-- 3. projeto_aditivo_prazo_criar: rascunho de aditivo só de prazo (valor zero). Aprovar na aba Escopo
--    move a data de entrega pelo gatilho que já existe (aditivo_aprovado_handler).

-- ---------------------------------------------------------------------------
-- 1. Atualização da fila, com opção de forçar
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.agente_pendencias_atualizar();

CREATE FUNCTION public.agente_pendencias_atualizar(p_forcar boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_empresa uuid := public.get_user_empresa_id();
BEGIN
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'usuário sem empresa' USING ERRCODE = '42501';
  END IF;

  IF NOT p_forcar AND EXISTS (
    SELECT 1 FROM public.agente_pendencias
    WHERE empresa_id = v_empresa AND ultima_deteccao > now() - interval '5 minutes'
  ) THEN
    RETURN jsonb_build_object('pulada', true);
  END IF;

  RETURN public.agente_pendencias_varrer(v_empresa);
END;
$$;

REVOKE ALL ON FUNCTION public.agente_pendencias_atualizar(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agente_pendencias_atualizar(boolean) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Avisar os responsáveis
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.projeto_prazo_avisar(p_projeto uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_projeto record;
  v_abertas integer;
  v_dest    uuid[];
BEGIN
  IF NOT public.user_has_feature('projetos', 'editor') THEN
    RAISE EXCEPTION 'sem permissão para avisar a equipe' USING ERRCODE = '42501';
  END IF;

  SELECT id, empresa_id, nome, data_previsao INTO v_projeto
  FROM public.projetos
  WHERE id = p_projeto AND deleted_at IS NULL AND empresa_id = public.get_user_empresa_id();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'projeto não encontrado' USING ERRCODE = 'P0002';
  END IF;

  SELECT count(*) INTO v_abertas
  FROM public.projeto_disciplinas d
  WHERE d.projeto_id = p_projeto
    AND lower(coalesce(d.status, '')) NOT IN ('concluído', 'concluido', 'pausada');

  v_dest := public._notif_resp_projeto(p_projeto);
  IF coalesce(array_length(v_dest, 1), 0) = 0 THEN
    v_dest := public._notif_gestao(v_projeto.empresa_id);
  END IF;

  RETURN public.notificar(
    v_projeto.empresa_id, v_dest, 'prazo_em_risco', 'projeto', 'high',
    'Prazo em risco: ' || v_projeto.nome,
    coalesce('Entrega em ' || to_char(v_projeto.data_previsao, 'DD/MM/YYYY') || '. ', '')
      || v_abertas || ' disciplina(s) ainda aberta(s). Confirme uma data realista de entrega.',
    'projeto', v_projeto.id, '/projetos/' || v_projeto.id);
END;
$$;

REVOKE ALL ON FUNCTION public.projeto_prazo_avisar(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.projeto_prazo_avisar(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Rascunho de aditivo de prazo
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.projeto_aditivo_prazo_criar(p_projeto uuid, p_dias integer, p_justificativa text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_empresa uuid := public.get_user_empresa_id();
  v_id      uuid;
BEGIN
  IF NOT public.user_has_feature('projetos', 'editor') THEN
    RAISE EXCEPTION 'sem permissão para criar aditivo' USING ERRCODE = '42501';
  END IF;
  IF p_dias IS NULL OR p_dias < 1 OR p_dias > 365 THEN
    RAISE EXCEPTION 'p_dias deve ficar entre 1 e 365' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.projetos WHERE id = p_projeto AND deleted_at IS NULL AND empresa_id = v_empresa
  ) THEN
    RAISE EXCEPTION 'projeto não encontrado' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.escopos (
    empresa_id, projeto_id, descricao, tipo, status, impacto_prazo_dias, valor_aditivo, custo_estimado,
    justificativa, created_by, updated_by
  ) VALUES (
    v_empresa, p_projeto, 'Aditivo de prazo: +' || p_dias || ' dia(s)', 'aditivo', 'rascunho', p_dias, 0, 0,
    nullif(trim(p_justificativa), ''), auth.uid(), auth.uid()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.projeto_aditivo_prazo_criar(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.projeto_aditivo_prazo_criar(uuid, integer, text) TO authenticated;
