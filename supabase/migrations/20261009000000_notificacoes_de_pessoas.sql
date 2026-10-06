-- SPEC 102 (notificações de pessoas) + SPEC 103 (conversa no lugar certo).
--
-- 1. disciplina_atribuida volta (removida em 20260894000000 com leitura medida num sino
--    afogado em alerta financeiro indevido, ver 20261008000000). Agora diz se a pessoa já
--    pode começar ou se espera a etapa anterior.
-- 2. proxima_etapa_liberada sai por trigger em projeto_disciplinas, para valer em qualquer
--    tela. A RPC fica (bundle antigo chama) e delega para a mesma função.
-- 3. tarefa_atribuida também ao gravar tarefas.responsavel_id (tarefa de obra nunca passava
--    pela ponte tarefa_responsaveis).
-- 4. rpc_notificar_mencao recebe o id do comentário: link profundo e dedup por comentário.
-- 5. rpc_perfil_publico: cartão da pessoa ao clicar numa menção.

BEGIN;

-- Helpers internos e funções de trigger: REVOKE também de authenticated (o default
-- privilege de 20260836000000 só tirou anon). Chamar _notificar_proxima_etapa direto
-- permitiria disparar aviso em disciplina de outra empresa.

-- ---------------------------------------------------------------------------
-- Disciplina liberada = fora do fluxo, primeira etapa, ou etapa anterior toda concluída.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._disciplina_liberada(p_disciplina uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_projeto  uuid;
  v_ordem    integer;
  v_anterior integer;
BEGIN
  SELECT projeto_id, ordem_etapa INTO v_projeto, v_ordem
  FROM public.projeto_disciplinas WHERE id = p_disciplina;

  IF v_ordem IS NULL THEN
    RETURN true;
  END IF;

  SELECT MAX(ordem_etapa) INTO v_anterior
  FROM public.projeto_disciplinas
  WHERE projeto_id = v_projeto AND ordem_etapa < v_ordem;

  IF v_anterior IS NULL THEN
    RETURN true;
  END IF;

  RETURN COALESCE((
    SELECT bool_and(status = 'Concluído')
    FROM public.projeto_disciplinas
    WHERE projeto_id = v_projeto AND ordem_etapa = v_anterior
  ), true);
END;
$$;

REVOKE ALL ON FUNCTION public._disciplina_liberada(uuid) FROM PUBLIC, anon, authenticated;

-- Nome de quem fez a ação, para a mensagem ("Flávio concluiu...").
CREATE OR REPLACE FUNCTION public._nome_do_ator(p_profile uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT pe.nome FROM public.pessoas pe WHERE pe.profile_id = p_profile AND pe.deleted_at IS NULL LIMIT 1),
    (SELECT NULLIF(trim(concat_ws(' ', pr.first_name, pr.last_name)), '') FROM public.profiles pr WHERE pr.id = p_profile)
  );
$$;

REVOKE ALL ON FUNCTION public._nome_do_ator(uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. Responsável de disciplina.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_notificar_disciplina_atribuida()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profile    uuid;
  v_disc       RECORD;
  v_liberada   boolean;
BEGIN
  SELECT profile_id INTO v_profile FROM public.pessoas WHERE id = NEW.pessoa_id;

  -- Sem conta, ou se marcou sozinho: nada a notificar.
  IF v_profile IS NULL OR v_profile = auth.uid() THEN
    RETURN NEW;
  END IF;

  -- Uma vez por pessoa e disciplina (sync_disciplina_responsaveis só insere pares novos,
  -- mas remover e marcar de novo não deve renotificar).
  IF EXISTS (
    SELECT 1 FROM public.notificacoes
    WHERE destinatario_id = v_profile
      AND tipo = 'disciplina_atribuida'
      AND referencia_id = NEW.projeto_disciplina_id
  ) THEN
    RETURN NEW;
  END IF;

  SELECT pd.nome, pd.status, pd.projeto_id, p.nome AS projeto_nome, p.empresa_id
  INTO v_disc
  FROM public.projeto_disciplinas pd
  JOIN public.projetos p ON p.id = pd.projeto_id
  WHERE pd.id = NEW.projeto_disciplina_id;

  IF v_disc.empresa_id IS NULL OR v_disc.status = 'Concluído' THEN
    RETURN NEW;
  END IF;

  v_liberada := public._disciplina_liberada(NEW.projeto_disciplina_id);

  PERFORM public.notificar(
    v_disc.empresa_id,
    ARRAY[v_profile],
    'disciplina_atribuida',
    'disciplina',
    CASE WHEN v_liberada THEN 'medium' ELSE 'low' END,
    'Você é responsável por ' || COALESCE(v_disc.nome, 'uma disciplina'),
    '"' || v_disc.projeto_nome || '". ' ||
      CASE WHEN v_liberada THEN 'Já pode começar.' ELSE 'Começa quando a etapa anterior for concluída.' END,
    'disciplina',
    NEW.projeto_disciplina_id,
    '/projetos/' || v_disc.projeto_id || '?disciplina=' || NEW.projeto_disciplina_id
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tg_notificar_disciplina_atribuida() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notificar_disciplina_atribuida ON public.projeto_disciplina_responsaveis;
CREATE TRIGGER trg_notificar_disciplina_atribuida
  AFTER INSERT ON public.projeto_disciplina_responsaveis
  FOR EACH ROW EXECUTE FUNCTION public.tg_notificar_disciplina_atribuida();

-- ---------------------------------------------------------------------------
-- 2. Etapa liberada. Uma disciplina concluiu: se a etapa dela fechou, avisa os
--    responsáveis da etapa seguinte e a gestão operacional, menos quem concluiu.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._notificar_proxima_etapa(p_disciplina uuid, p_ator uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_disc          RECORD;
  v_proxima_ordem integer;
  v_gestao        uuid[];
  v_destinatarios uuid[];
  v_ator_nome     text;
  v_count         integer := 0;
  v_proxima       RECORD;
BEGIN
  SELECT pd.id, pd.nome, pd.ordem_etapa, pd.projeto_id, p.nome AS projeto_nome, p.empresa_id
  INTO v_disc
  FROM public.projeto_disciplinas pd
  JOIN public.projetos p ON p.id = pd.projeto_id
  WHERE pd.id = p_disciplina;

  IF v_disc.id IS NULL OR v_disc.ordem_etapa IS NULL THEN
    RETURN 0;
  END IF;

  IF NOT COALESCE((
    SELECT bool_and(status = 'Concluído')
    FROM public.projeto_disciplinas
    WHERE projeto_id = v_disc.projeto_id AND ordem_etapa = v_disc.ordem_etapa
  ), false) THEN
    RETURN 0;
  END IF;

  -- Próxima etapa = menor ordem acima desta (o fluxo pode pular números).
  SELECT MIN(ordem_etapa) INTO v_proxima_ordem
  FROM public.projeto_disciplinas
  WHERE projeto_id = v_disc.projeto_id AND ordem_etapa > v_disc.ordem_etapa;

  IF v_proxima_ordem IS NULL THEN
    RETURN 0;
  END IF;

  v_gestao := public._notif_gestao_operacional(v_disc.empresa_id);
  v_ator_nome := public._nome_do_ator(p_ator);

  FOR v_proxima IN
    SELECT id, nome FROM public.projeto_disciplinas
    WHERE projeto_id = v_disc.projeto_id AND ordem_etapa = v_proxima_ordem
      AND status IS DISTINCT FROM 'Concluído'
  LOOP
    SELECT ARRAY_AGG(DISTINCT pe.profile_id) INTO v_destinatarios
    FROM public.projeto_disciplina_responsaveis r
    JOIN public.pessoas pe ON pe.id = r.pessoa_id
    WHERE r.projeto_disciplina_id = v_proxima.id
      AND pe.profile_id IS NOT NULL;

    v_destinatarios := ARRAY(
      SELECT DISTINCT x FROM unnest(COALESCE(v_destinatarios, '{}') || v_gestao) x
      WHERE x IS DISTINCT FROM p_ator
    );

    v_count := v_count + COALESCE(public.notificar(
      v_disc.empresa_id,
      v_destinatarios,
      'proxima_etapa_liberada',
      'disciplina',
      'medium',
      'Liberada para começar: ' || v_proxima.nome,
      COALESCE(v_ator_nome, 'Alguém') || ' concluiu ' || v_disc.nome || ' em "' || v_disc.projeto_nome || '".',
      'disciplina',
      v_proxima.id,
      '/projetos/' || v_disc.projeto_id || '?disciplina=' || v_proxima.id
    ), 0);
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public._notificar_proxima_etapa(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tg_notificar_etapa_liberada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public._notificar_proxima_etapa(NEW.id, auth.uid());
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tg_notificar_etapa_liberada() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notificar_etapa_liberada ON public.projeto_disciplinas;
CREATE TRIGGER trg_notificar_etapa_liberada
  AFTER UPDATE OF status ON public.projeto_disciplinas
  FOR EACH ROW
  WHEN (NEW.status = 'Concluído' AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.tg_notificar_etapa_liberada();

-- RPC mantida para o bundle antigo: valida a empresa e delega. O dedup do notificar()
-- impede aviso duplo quando trigger e RPC rodam para o mesmo evento.
CREATE OR REPLACE FUNCTION public.rpc_notificar_proxima_etapa(p_disciplina_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_empresa_id uuid;
BEGIN
  v_empresa_id := public.get_user_empresa_id();
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.projeto_disciplinas pd
    JOIN public.projetos p ON p.id = pd.projeto_id
    WHERE pd.id = p_disciplina_id AND p.empresa_id = v_empresa_id
  ) THEN
    RAISE EXCEPTION 'Disciplina não encontrada ou fora da empresa';
  END IF;

  RETURN public._notificar_proxima_etapa(p_disciplina_id, auth.uid());
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_notificar_proxima_etapa(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_notificar_proxima_etapa(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Tarefa atribuída, pela ponte ou pela coluna responsavel_id.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._notificar_tarefa_atribuida(p_tarefa uuid, p_pessoa uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profile uuid;
  v_tarefa  RECORD;
BEGIN
  SELECT profile_id INTO v_profile FROM public.pessoas WHERE id = p_pessoa;

  IF v_profile IS NULL OR v_profile = auth.uid() THEN
    RETURN;
  END IF;

  -- Unicidade permanente: a ponte é apagada e reinserida a cada edição, e a criação pelo
  -- quadro grava a coluna e a ponte. Só a primeira vez avisa.
  IF EXISTS (
    SELECT 1 FROM public.notificacoes
    WHERE destinatario_id = v_profile
      AND tipo = 'tarefa_atribuida'
      AND referencia_id = p_tarefa
  ) THEN
    RETURN;
  END IF;

  SELECT id, titulo, empresa_id, obra_id INTO v_tarefa FROM public.tarefas WHERE id = p_tarefa;
  IF v_tarefa.id IS NULL THEN
    RETURN;
  END IF;

  PERFORM public.notificar(
    v_tarefa.empresa_id,
    ARRAY[v_profile],
    'tarefa_atribuida',
    'tarefa',
    'medium',
    'Tarefa atribuída a você',
    COALESCE(v_tarefa.titulo, 'Uma tarefa foi atribuída a você.'),
    'tarefa',
    p_tarefa,
    CASE
      WHEN v_tarefa.obra_id IS NOT NULL THEN '/obras/' || v_tarefa.obra_id
      ELSE '/gestao/tarefas?tarefa=' || p_tarefa
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public._notificar_tarefa_atribuida(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tg_notificar_tarefa_atribuida()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public._notificar_tarefa_atribuida(NEW.tarefa_id, NEW.pessoa_id);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tg_notificar_tarefa_atribuida() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tg_notificar_tarefa_responsavel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.responsavel_id IS NOT NULL THEN
    PERFORM public._notificar_tarefa_atribuida(NEW.id, NEW.responsavel_id);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tg_notificar_tarefa_responsavel() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notificar_tarefa_responsavel_ins ON public.tarefas;
CREATE TRIGGER trg_notificar_tarefa_responsavel_ins
  AFTER INSERT ON public.tarefas
  FOR EACH ROW
  WHEN (NEW.responsavel_id IS NOT NULL)
  EXECUTE FUNCTION public.tg_notificar_tarefa_responsavel();

DROP TRIGGER IF EXISTS trg_notificar_tarefa_responsavel_upd ON public.tarefas;
CREATE TRIGGER trg_notificar_tarefa_responsavel_upd
  AFTER UPDATE OF responsavel_id ON public.tarefas
  FOR EACH ROW
  WHEN (NEW.responsavel_id IS NOT NULL AND NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id)
  EXECUTE FUNCTION public.tg_notificar_tarefa_responsavel();

-- ---------------------------------------------------------------------------
-- 4. Menção com link para o comentário. Assinatura muda: DROP + CREATE.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.rpc_notificar_mencao(text, uuid, uuid[], text);

CREATE FUNCTION public.rpc_notificar_mencao(
  p_entidade_tipo text,
  p_entidade_id uuid,
  p_mencionados uuid[],
  p_preview text,
  p_comentario_id uuid DEFAULT NULL
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

  IF p_mencionados IS NULL OR array_length(p_mencionados, 1) IS NULL THEN
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

  SELECT ARRAY_AGG(DISTINCT pe.profile_id) INTO v_destinatarios
  FROM public.pessoas pe
  WHERE pe.id = ANY(p_mencionados)
    AND pe.empresa_id = v_empresa_id
    AND pe.profile_id IS NOT NULL
    AND pe.profile_id <> auth.uid();

  -- Com comentário, a referência é o comentário: cada menção é uma notificação própria
  -- (o dedup do notificar() é por referência). Sem, cai no comportamento antigo.
  RETURN COALESCE(public.notificar(
    v_empresa_id,
    v_destinatarios,
    'mencao_comentario',
    p_entidade_tipo,
    'medium',
    COALESCE(v_autor_nome, 'Alguém') || ' marcou você em "' || COALESCE(v_contexto, p_entidade_tipo) || '"',
    p_preview,
    CASE WHEN p_comentario_id IS NOT NULL THEN 'comentario' ELSE p_entidade_tipo END,
    COALESCE(p_comentario_id, p_entidade_id),
    v_link
  ), 0);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_notificar_mencao(text, uuid, uuid[], text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_notificar_mencao(text, uuid, uuid[], text, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Perfil público: o que qualquer membro da empresa pode ver de um colega.
--    Sem telefone, endereço, documento ou dado de folha (esses ficam em pessoas_safe,
--    atrás de can_view_folha()).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_perfil_publico(p_pessoa_id uuid)
RETURNS TABLE (
  id uuid,
  nome text,
  cargo text,
  email text,
  avatar_url text,
  tem_conta boolean,
  disciplinas jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    pe.id,
    pe.nome,
    pe.cargo,
    pe.email,
    pr.avatar_url,
    pe.profile_id IS NOT NULL,
    COALESCE((
      SELECT jsonb_agg(d ORDER BY d.prazo NULLS LAST)
      FROM (
        SELECT pd.id, pd.nome, pd.status, pd.data_fim AS prazo,
               proj.id AS projeto_id, proj.nome AS projeto_nome
        FROM public.projeto_disciplina_responsaveis r
        JOIN public.projeto_disciplinas pd ON pd.id = r.projeto_disciplina_id
        JOIN public.projetos proj ON proj.id = pd.projeto_id
        WHERE r.pessoa_id = pe.id
          AND proj.deleted_at IS NULL
          AND pd.status IS DISTINCT FROM 'Concluído'
          AND public._disciplina_liberada(pd.id)
        ORDER BY pd.data_fim NULLS LAST
        LIMIT 5
      ) d
    ), '[]'::jsonb)
  FROM public.pessoas pe
  LEFT JOIN public.profiles pr ON pr.id = pe.profile_id
  WHERE pe.id = p_pessoa_id
    AND pe.empresa_id = public.get_user_empresa_id()
    AND pe.deleted_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.rpc_perfil_publico(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_perfil_publico(uuid) TO authenticated;

COMMIT;
