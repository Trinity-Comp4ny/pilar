-- Menção sai por e-mail na hora, junto com o sino (DECISOES 2026-11-09).
--
-- A migration 20261207000000 (vínculo pessoa ↔ conta) já pôs a menção no ciclo imediato, que
-- espera 5 minutos sem leitura. Aqui o e-mail sai no instante da menção; o ciclo de 5 minutos
-- fica como rede de segurança.
--
-- 1. notificacoes_pendentes_email ganha o modo 'mencao' e o filtro p_ids. O modo pega só
--    menção, sem a janela de 5 minutos do 'imediato'. Menção ignora o padrão da categoria
--    (tarefa vem desligada por padrão), mas respeita quem desligou o e-mail explicitamente.
--    O 'imediato' segue varrendo menção (20261207000000): é a rede de segurança se o disparo falhar.
-- 2. notificacoes_email_mencao_disparar(ids): chama a edge function por pg_net com os ids.
-- 3. rpc_notificar_mencao dispara o e-mail logo depois de criar as notificações.

BEGIN;

-- =============================================
-- 1. Seleção do que vai por e-mail
-- =============================================

DROP FUNCTION IF EXISTS public.notificacoes_pendentes_email(text);

CREATE FUNCTION public.notificacoes_pendentes_email(p_modo text, p_ids uuid[] DEFAULT NULL)
RETURNS TABLE (
  destinatario_id uuid,
  email           text,
  nome            text,
  empresa_id      uuid,
  notificacao_id  uuid,
  categoria       text,
  severidade      text,
  titulo          text,
  mensagem        text,
  link            text,
  created_at      timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_modo NOT IN ('imediato', 'semanal', 'mencao') THEN
    RAISE EXCEPTION 'modo inválido: % (use imediato, semanal ou mencao)', p_modo;
  END IF;

  RETURN QUERY
  SELECT
    n.destinatario_id,
    COALESCE(p.email, u.email)::text AS email,
    COALESCE(NULLIF(btrim(p.nome), ''), NULLIF(btrim(p.first_name), ''))::text AS nome,
    n.empresa_id,
    n.id AS notificacao_id,
    n.categoria,
    n.severidade,
    n.titulo,
    n.mensagem,
    n.link,
    n.created_at
  FROM public.notificacoes n
  JOIN public.profiles p ON p.id = n.destinatario_id
  LEFT JOIN auth.users u ON u.id = n.destinatario_id
  LEFT JOIN public.notificacao_preferencias np
         ON np.user_id = n.destinatario_id AND np.categoria = n.categoria
  WHERE n.email_enviado_em IS NULL
    AND n.lido_em IS NULL
    AND n.arquivada_em IS NULL
    AND (n.expires_at IS NULL OR n.expires_at > now())
    AND (p_ids IS NULL OR n.id = ANY(p_ids))
    -- o destinatário ainda pertence à empresa da notificação
    AND p.empresa_id = n.empresa_id
    -- preferência explícita manda; sem linha, menção sempre sai e o resto segue o padrão
    AND COALESCE(np.email, n.tipo = 'mencao_comentario' OR public.notificacao_email_padrao(n.categoria))
    AND COALESCE(p.email, u.email) IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.email_supressoes s
       WHERE s.email = lower(COALESCE(p.email, u.email))
    )
    AND CASE p_modo
      WHEN 'mencao' THEN
        n.tipo = 'mencao_comentario'
        AND n.created_at >= now() - interval '48 hours'
      WHEN 'imediato' THEN
        (n.severidade IN ('high', 'critical') OR n.tipo = 'mencao_comentario')
        AND n.created_at <= now() - interval '5 minutes'
        -- SPEC 104: alerta com mais de 48h não é mais "imediato".
        AND n.created_at >= now() - interval '48 hours'
      ELSE
        n.created_at >= now() - interval '7 days'
    END
  ORDER BY n.destinatario_id, n.categoria, n.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.notificacoes_pendentes_email(text, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notificacoes_pendentes_email(text, uuid[]) TO service_role;

COMMENT ON FUNCTION public.notificacoes_pendentes_email(text, uuid[]) IS
  'SPEC 096: notificações que devem sair por e-mail no modo dado (imediato, semanal ou mencao), opcionalmente só os ids dados. Só service role executa.';

-- =============================================
-- 2. Disparo da menção (mesmo padrão de notificacoes_email_disparar)
-- =============================================

CREATE OR REPLACE FUNCTION public.notificacoes_email_mencao_disparar(p_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'vault'
AS $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  v_url := public._cron_secret('app_supabase_url');
  v_key := public._cron_secret('app_cron_secret');

  -- Dev local sem secrets: no-op silencioso, igual aos crons.
  IF v_url IS NULL OR v_url = '' OR v_key IS NULL OR v_key = '' THEN
    RAISE NOTICE 'notificacoes_email_mencao_disparar: vault secrets app_supabase_url/app_cron_secret ausentes, disparo pulado';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := v_url || '/functions/v1/notificacoes-email-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := jsonb_build_object('modo', 'mencao', 'ids', to_jsonb(p_ids)),
    timeout_milliseconds := 60000
  );
END;
$$;

REVOKE ALL ON FUNCTION public.notificacoes_email_mencao_disparar(uuid[]) FROM PUBLIC, anon, authenticated;

-- =============================================
-- 3. rpc_notificar_mencao dispara o e-mail na hora
-- =============================================

CREATE OR REPLACE FUNCTION public.rpc_notificar_mencao(
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
  v_total            integer;
  v_ids              uuid[];
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
  v_total := COALESCE(public.notificar(
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

  -- E-mail na hora (DECISOES 2026-11-09): só as linhas que esta chamada criou (created_at = now()
  -- é o instante da transação). O pg_net enfileira e só envia depois do commit, então a
  -- edge function já encontra as linhas. Falha aqui nunca derruba a menção: o sino já foi
  -- avisado e a varredura de 5 em 5 minutos reenvia o que não saiu.
  IF v_total > 0 THEN
    SELECT ARRAY_AGG(n.id) INTO v_ids
    FROM public.notificacoes n
    WHERE n.tipo = 'mencao_comentario'
      AND n.referencia_id = COALESCE(p_comentario_id, p_entidade_id)
      AND n.created_at = now()
      AND n.email_enviado_em IS NULL;

    BEGIN
      PERFORM public.notificacoes_email_mencao_disparar(v_ids);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'rpc_notificar_mencao: disparo do e-mail falhou (%), fica para a varredura', SQLERRM;
    END;
  END IF;

  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_notificar_mencao(text, uuid, uuid[], text, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_notificar_mencao(text, uuid, uuid[], text, uuid, boolean) TO authenticated;

COMMIT;
