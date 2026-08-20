-- Projetos: troca aviso por e-mail por notificação nativa in-app (`notificacoes`).
--
-- Antes: mudança de status pedia confirmação e mandava email (notify-project-people);
-- conclusão de etapa mandava email automático pra próxima etapa (notify-next-stage).
-- Cliente nunca era avisado por nenhum dos dois. Agora nenhum dos dois manda email:
--   1. rpc_notificar_projeto_status  — chamada pelo front ao mudar status do projeto
--   2. rpc_notificar_proxima_etapa   — chamada pelo front ao concluir uma disciplina
--   3. trg_notificar_disciplina_atribuida — dispara sozinho ao marcar responsável
--      num card/disciplina (mesmo padrão de trg_notificar_tarefa_atribuida)
-- Nenhuma delas toca `clientes` ou dispara email: cliente segue avisado só manualmente
-- (Propostas/Clientes), fora deste fluxo.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Status do projeto mudou → notifica responsáveis das disciplinas do projeto.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_notificar_projeto_status(
  p_projeto_id uuid,
  p_novo_status text
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_empresa_id     uuid;
  v_projeto_nome   text;
  v_projeto_empresa uuid;
  v_destinatarios  uuid[];
BEGIN
  v_empresa_id := public.get_user_empresa_id();
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa';
  END IF;

  SELECT nome, empresa_id INTO v_projeto_nome, v_projeto_empresa
  FROM public.projetos
  WHERE id = p_projeto_id;

  IF v_projeto_empresa IS NULL OR v_projeto_empresa <> v_empresa_id THEN
    RAISE EXCEPTION 'Projeto não encontrado ou fora da empresa';
  END IF;

  SELECT ARRAY_AGG(DISTINCT pe.profile_id) INTO v_destinatarios
  FROM public.projeto_disciplinas pd
  JOIN public.projeto_disciplina_responsaveis r ON r.projeto_disciplina_id = pd.id
  JOIN public.pessoas pe ON pe.id = r.pessoa_id
  WHERE pd.projeto_id = p_projeto_id
    AND pe.profile_id IS NOT NULL
    AND pe.profile_id <> auth.uid();

  RETURN COALESCE(public.notificar(
    v_empresa_id,
    v_destinatarios,
    'projeto_status_alterado',
    'projeto',
    'medium',
    'Projeto "' || v_projeto_nome || '" mudou de status',
    'Novo status: ' || p_novo_status || '.',
    'projeto',
    p_projeto_id,
    '/projetos/' || p_projeto_id
  ), 0);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_notificar_projeto_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_notificar_projeto_status(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Disciplina concluída e etapa inteira fechou → notifica responsáveis da
--    próxima etapa do fluxo (mesma regra que já existia em notify-next-stage).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_notificar_proxima_etapa(
  p_disciplina_id uuid
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_empresa_id     uuid;
  v_disc           RECORD;
  v_etapa_completa boolean;
  v_destinatarios  uuid[];
  v_count          integer := 0;
  v_proxima        RECORD;
BEGIN
  v_empresa_id := public.get_user_empresa_id();
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa';
  END IF;

  SELECT pd.id, pd.nome, pd.ordem_etapa, pd.projeto_id, p.nome AS projeto_nome, p.empresa_id
  INTO v_disc
  FROM public.projeto_disciplinas pd
  JOIN public.projetos p ON p.id = pd.projeto_id
  WHERE pd.id = p_disciplina_id;

  IF v_disc IS NULL OR v_disc.empresa_id <> v_empresa_id THEN
    RAISE EXCEPTION 'Disciplina não encontrada ou fora da empresa';
  END IF;

  IF v_disc.ordem_etapa IS NULL THEN
    RETURN 0;
  END IF;

  SELECT bool_and(status = 'Concluído') INTO v_etapa_completa
  FROM public.projeto_disciplinas
  WHERE projeto_id = v_disc.projeto_id AND ordem_etapa = v_disc.ordem_etapa;

  IF NOT COALESCE(v_etapa_completa, false) THEN
    RETURN 0;
  END IF;

  FOR v_proxima IN
    SELECT id, nome FROM public.projeto_disciplinas
    WHERE projeto_id = v_disc.projeto_id AND ordem_etapa = v_disc.ordem_etapa + 1
  LOOP
    SELECT ARRAY_AGG(DISTINCT pe.profile_id) INTO v_destinatarios
    FROM public.projeto_disciplina_responsaveis r
    JOIN public.pessoas pe ON pe.id = r.pessoa_id
    WHERE r.projeto_disciplina_id = v_proxima.id
      AND pe.profile_id IS NOT NULL
      AND pe.profile_id <> auth.uid();

    v_count := v_count + COALESCE(public.notificar(
      v_empresa_id,
      v_destinatarios,
      'proxima_etapa_liberada',
      'disciplina',
      'medium',
      'Próxima etapa liberada: ' || v_proxima.nome,
      'A etapa anterior de "' || v_disc.projeto_nome || '" foi concluída.',
      'disciplina',
      v_proxima.id,
      '/projetos/' || v_disc.projeto_id
    ), 0);
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_notificar_proxima_etapa(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_notificar_proxima_etapa(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Evento pontual — "você foi marcado num card/disciplina de projeto".
--    Mesmo padrão de tg_notificar_tarefa_atribuida: guarda permanente por
--    (destinatário, disciplina), pois sync_disciplina_responsaveis já filtra
--    o INSERT só para pares genuinamente novos (não reincide em toda edição).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_notificar_disciplina_atribuida()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profile      uuid;
  v_empresa_id   uuid;
  v_disc_nome    text;
  v_projeto_id   uuid;
  v_projeto_nome text;
BEGIN
  SELECT profile_id INTO v_profile
  FROM public.pessoas
  WHERE id = NEW.pessoa_id;

  -- Sem conta, ou é auto-atribuição: nada a notificar.
  IF v_profile IS NULL OR v_profile = auth.uid() THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.notificacoes
    WHERE destinatario_id = v_profile
      AND tipo = 'disciplina_atribuida'
      AND referencia_id = NEW.projeto_disciplina_id
  ) THEN
    RETURN NEW;
  END IF;

  SELECT pd.nome, pd.projeto_id, p.nome, p.empresa_id
  INTO v_disc_nome, v_projeto_id, v_projeto_nome, v_empresa_id
  FROM public.projeto_disciplinas pd
  JOIN public.projetos p ON p.id = pd.projeto_id
  WHERE pd.id = NEW.projeto_disciplina_id;

  IF v_empresa_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.notificar(
    v_empresa_id,
    ARRAY[v_profile],
    'disciplina_atribuida',
    'disciplina',
    'medium',
    'Você foi marcado em "' || COALESCE(v_disc_nome, 'uma disciplina') || '"',
    'Projeto: ' || v_projeto_nome,
    'disciplina',
    NEW.projeto_disciplina_id,
    '/projetos/' || v_projeto_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notificar_disciplina_atribuida ON public.projeto_disciplina_responsaveis;
CREATE TRIGGER trg_notificar_disciplina_atribuida
  AFTER INSERT ON public.projeto_disciplina_responsaveis
  FOR EACH ROW EXECUTE FUNCTION public.tg_notificar_disciplina_atribuida();

COMMIT;
