-- Spec 089: notificação ao mencionar alguém com @ num comentário de projeto, disciplina de
-- projeto ou tarefa. Comentários vivem em coluna jsonb (`comentarios`) de cada tabela, não numa
-- tabela própria, então não dá pra disparar por trigger de INSERT por comentário individual: a
-- RPC é chamada pelo front logo após salvar o comentário (mesmo padrão de
-- rpc_notificar_projeto_status em 20260848000000_notificacao_projeto_disciplina.sql).
--
-- Dedup (mesma pessoa mencionada 2x, ou mencionada de novo antes de ler a primeira) já vem de
-- graça do public.notificar() central: ele ignora nova notificação se já existir uma não lida
-- com mesmo destinatario_id + tipo + referencia_id.

BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_notificar_mencao(
  p_entidade_tipo text,
  p_entidade_id uuid,
  p_mencionados uuid[],
  p_preview text
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_empresa_id     uuid;
  v_entidade_empresa uuid;
  v_contexto       text;
  v_link           text;
  v_autor_nome     text;
  v_destinatarios  uuid[];
BEGIN
  v_empresa_id := public.get_user_empresa_id();
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa';
  END IF;

  IF p_entidade_tipo NOT IN ('projeto', 'disciplina', 'tarefa') THEN
    RAISE EXCEPTION 'Tipo de entidade inválido: %', p_entidade_tipo;
  END IF;

  IF p_mencionados IS NULL OR array_length(p_mencionados, 1) IS NULL THEN
    RETURN 0;
  END IF;

  SELECT nome INTO v_autor_nome FROM public.pessoas WHERE profile_id = auth.uid() LIMIT 1;

  IF p_entidade_tipo = 'projeto' THEN
    SELECT p.empresa_id, p.nome, '/projetos/' || p.id
    INTO v_entidade_empresa, v_contexto, v_link
    FROM public.projetos p
    WHERE p.id = p_entidade_id;

  ELSIF p_entidade_tipo = 'disciplina' THEN
    SELECT proj.empresa_id, pd.nome || ' (' || proj.nome || ')', '/projetos/' || proj.id
    INTO v_entidade_empresa, v_contexto, v_link
    FROM public.projeto_disciplinas pd
    JOIN public.projetos proj ON proj.id = pd.projeto_id
    WHERE pd.id = p_entidade_id;

  ELSE -- tarefa
    SELECT t.empresa_id, t.titulo, '/meu-trabalho'
    INTO v_entidade_empresa, v_contexto, v_link
    FROM public.tarefas t
    WHERE t.id = p_entidade_id;
  END IF;

  IF v_entidade_empresa IS NULL OR v_entidade_empresa <> v_empresa_id THEN
    RAISE EXCEPTION 'Item não encontrado ou fora da empresa';
  END IF;

  SELECT ARRAY_AGG(DISTINCT pe.profile_id) INTO v_destinatarios
  FROM public.pessoas pe
  WHERE pe.id = ANY(p_mencionados)
    AND pe.profile_id IS NOT NULL
    AND pe.profile_id <> auth.uid();

  RETURN COALESCE(public.notificar(
    v_empresa_id,
    v_destinatarios,
    'mencao_comentario',
    p_entidade_tipo,
    'medium',
    COALESCE(v_autor_nome, 'Alguém') || ' marcou você em "' || COALESCE(v_contexto, p_entidade_tipo) || '"',
    p_preview,
    p_entidade_tipo,
    p_entidade_id,
    v_link
  ), 0);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_notificar_mencao(text, uuid, uuid[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_notificar_mencao(text, uuid, uuid[], text) TO authenticated;

COMMIT;
