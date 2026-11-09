-- SPEC 132: @all nos comentários. rpc_notificar_mencao ganha p_todos: avisa todo perfil
-- ativo da empresa do autor (menos o próprio autor), somado a quem foi marcado pelo nome.
-- A assinatura de 5 argumentos sai (mesmo padrão da SPEC 103); o bundle antigo chama por
-- nome sem p_todos e cai no default false.

DROP FUNCTION IF EXISTS public.rpc_notificar_mencao(text, uuid, uuid[], text, uuid);

CREATE FUNCTION public.rpc_notificar_mencao(
  p_entidade_tipo text,
  p_entidade_id uuid,
  p_mencionados uuid[],
  p_preview text,
  p_comentario_id uuid DEFAULT NULL,
  p_todos boolean DEFAULT false
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_empresa_id       uuid;
  v_entidade_empresa uuid;
  v_contexto         text;
  v_link             text;
  v_autor_nome       text;
  v_destinatarios    uuid[];
  v_sufixo           text := '';
BEGIN
  v_empresa_id := public.get_user_empresa_id();
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa';
  END IF;

  IF p_entidade_tipo NOT IN ('projeto', 'disciplina', 'tarefa') THEN
    RAISE EXCEPTION 'Tipo de entidade inválido: %', p_entidade_tipo;
  END IF;

  IF NOT COALESCE(p_todos, false) AND (p_mencionados IS NULL OR array_length(p_mencionados, 1) IS NULL) THEN
    RETURN 0;
  END IF;

  v_autor_nome := public._nome_do_ator(auth.uid());
  IF p_comentario_id IS NOT NULL THEN
    v_sufixo := 'comentario=' || p_comentario_id;
  END IF;

  IF p_entidade_tipo = 'projeto' THEN
    SELECT p.empresa_id, p.nome,
      '/projetos/' || p.id || CASE WHEN v_sufixo <> '' THEN '?' || v_sufixo ELSE '' END || '#atividades'
    INTO v_entidade_empresa, v_contexto, v_link
    FROM public.projetos p
    WHERE p.id = p_entidade_id;

  ELSIF p_entidade_tipo = 'disciplina' THEN
    SELECT proj.empresa_id, pd.nome || ' (' || proj.nome || ')',
      '/projetos/' || proj.id || '?disciplina=' || pd.id || CASE WHEN v_sufixo <> '' THEN '&' || v_sufixo ELSE '' END
    INTO v_entidade_empresa, v_contexto, v_link
    FROM public.projeto_disciplinas pd
    JOIN public.projetos proj ON proj.id = pd.projeto_id
    WHERE pd.id = p_entidade_id;

  ELSE -- tarefa
    SELECT t.empresa_id, t.titulo,
      '/gestao/tarefas?tarefa=' || t.id || CASE WHEN v_sufixo <> '' THEN '&' || v_sufixo ELSE '' END
    INTO v_entidade_empresa, v_contexto, v_link
    FROM public.tarefas t
    WHERE t.id = p_entidade_id;
  END IF;

  IF v_entidade_empresa IS NULL OR v_entidade_empresa <> v_empresa_id THEN
    RAISE EXCEPTION 'Item não encontrado ou fora da empresa';
  END IF;

  -- @all: todo perfil ativo da empresa do autor (inclusive quem não tem linha em pessoas).
  -- A união dedupa quem foi marcado e também está no @all: uma notificação só.
  SELECT ARRAY_AGG(DISTINCT d.profile_id) INTO v_destinatarios
  FROM (
    SELECT pe.profile_id
    FROM public.pessoas pe
    WHERE pe.id = ANY(COALESCE(p_mencionados, '{}'::uuid[]))
      AND pe.empresa_id = v_empresa_id
      AND pe.profile_id IS NOT NULL
    UNION
    SELECT pr.id
    FROM public.profiles pr
    WHERE COALESCE(p_todos, false)
      AND pr.empresa_id = v_empresa_id
      AND pr.desativado_em IS NULL
  ) d
  WHERE d.profile_id <> auth.uid();

  -- Com comentário, a referência é o comentário: cada menção é uma notificação própria
  -- (o dedup do notificar() é por referência). Sem, cai no comportamento antigo.
  RETURN COALESCE(public.notificar(
    v_empresa_id,
    v_destinatarios,
    'mencao_comentario',
    p_entidade_tipo,
    'medium',
    COALESCE(v_autor_nome, 'Alguém') || CASE WHEN COALESCE(p_todos, false) THEN ' marcou todos em "' ELSE ' marcou você em "' END || COALESCE(v_contexto, p_entidade_tipo) || '"',
    p_preview,
    CASE WHEN p_comentario_id IS NOT NULL THEN 'comentario' ELSE p_entidade_tipo END,
    COALESCE(p_comentario_id, p_entidade_id),
    v_link
  ), 0);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_notificar_mencao(text, uuid, uuid[], text, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_notificar_mencao(text, uuid, uuid[], text, uuid, boolean) TO authenticated;
