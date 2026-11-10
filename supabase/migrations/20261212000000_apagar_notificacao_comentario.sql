-- Comentário apagado leva junto a notificação de menção (feedback 7a4802e8).
--
-- A menção grava uma notificação por destinatário com referencia_tipo = 'comentario' e
-- referencia_id = id do comentário (20261208000000). Quando o comentário sai das Atividades,
-- o sino de quem foi marcado não pode continuar apontando para um comentário que não existe.
--
-- A notificação é de outra pessoa (RLS só deixa o destinatário mexer), então a limpeza é uma
-- RPC SECURITY DEFINER. A autorização é o próprio estado: só apaga se o comentário já NÃO está
-- mais no jsonb `comentarios` do item, dentro da empresa de quem chama. Quem conseguiu tirar o
-- comentário (UPDATE sob RLS + regra de autoria da tela) é quem pode limpar o rastro; ninguém
-- apaga a notificação de um comentário que segue de pé.
--
-- E-mail que já saiu não volta: isso só limpa o sino.

BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_apagar_notificacoes_comentario(
  p_entidade_tipo text,
  p_entidade_id uuid,
  p_comentario_id uuid
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_empresa_id       uuid;
  v_entidade_empresa uuid;
  v_comentarios      jsonb;
  v_total            integer;
BEGIN
  v_empresa_id := public.get_user_empresa_id();
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa';
  END IF;

  IF p_entidade_tipo NOT IN ('projeto', 'disciplina', 'tarefa') THEN
    RAISE EXCEPTION 'Tipo de entidade inválido: %', p_entidade_tipo;
  END IF;

  IF p_comentario_id IS NULL THEN
    RETURN 0;
  END IF;

  IF p_entidade_tipo = 'projeto' THEN
    SELECT p.empresa_id, p.comentarios INTO v_entidade_empresa, v_comentarios
    FROM public.projetos p WHERE p.id = p_entidade_id;
  ELSIF p_entidade_tipo = 'disciplina' THEN
    SELECT proj.empresa_id, pd.comentarios INTO v_entidade_empresa, v_comentarios
    FROM public.projeto_disciplinas pd
    JOIN public.projetos proj ON proj.id = pd.projeto_id
    WHERE pd.id = p_entidade_id;
  ELSE -- tarefa
    SELECT t.empresa_id, t.comentarios INTO v_entidade_empresa, v_comentarios
    FROM public.tarefas t WHERE t.id = p_entidade_id;
  END IF;

  IF v_entidade_empresa IS NULL OR v_entidade_empresa <> v_empresa_id THEN
    RAISE EXCEPTION 'Item não encontrado ou fora da empresa';
  END IF;

  IF COALESCE(v_comentarios, '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('id', p_comentario_id::text)) THEN
    RAISE EXCEPTION 'O comentário ainda existe: apague o comentário antes da notificação';
  END IF;

  DELETE FROM public.notificacoes n
  WHERE n.empresa_id = v_empresa_id
    AND n.tipo = 'mencao_comentario'
    AND n.referencia_tipo = 'comentario'
    AND n.referencia_id = p_comentario_id;
  GET DIAGNOSTICS v_total = ROW_COUNT;

  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_apagar_notificacoes_comentario(text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_apagar_notificacoes_comentario(text, uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.rpc_apagar_notificacoes_comentario(text, uuid, uuid) IS
  'Apaga as notificações de menção de um comentário que já saiu das Atividades do item (projeto, disciplina ou tarefa) da empresa de quem chama.';

COMMIT;
