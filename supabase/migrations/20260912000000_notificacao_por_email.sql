-- ============================================================================
-- SPEC 096: a notificação da central também sai por e-mail.
--
-- Desenho: a própria tabela `notificacoes` é o outbox. Uma coluna nova
-- (`email_enviado_em`) marca o que já saiu, então não há fila paralela para
-- ficar fora de sincronia com a leitura e o arquivamento.
--
-- Dois disparos, uma edge function (`notificacoes-email-cron`):
--   imediato  a cada 5 min, só severidade high/critical que ninguém leu no app
--             nos primeiros 5 minutos (janela para quem está com o app aberto).
--   semanal   segunda 11:00 UTC (08:00 BRT), o que ficou sem leitura na semana.
--
-- A REGRA DE QUEM RECEBE não é decidida aqui: esta função só transporta o que
-- `notificar()` já roteou (ADR 0015, SPEC 091). Categoria financeiro, por
-- exemplo, nunca chega a coordenador nem colaborador porque o roteamento já
-- não criou a linha para eles. Catálogo em docs/operations/EMAILS.md.
-- ============================================================================

-- =============================================
-- 1. Coluna de outbox + índice + backfill
-- =============================================

ALTER TABLE public.notificacoes
  ADD COLUMN IF NOT EXISTS email_enviado_em timestamptz;

COMMENT ON COLUMN public.notificacoes.email_enviado_em IS
  'Quando esta notificação saiu por e-mail. NULL = ainda não saiu (SPEC 096). Escrito só por service role.';

-- Ninguém recebe histórico no primeiro envio: o que já existe entra como "já enviado".
UPDATE public.notificacoes
   SET email_enviado_em = created_at
 WHERE email_enviado_em IS NULL;

-- A varredura das 5 em 5 minutos só olha o que está pendente de e-mail e sem leitura.
CREATE INDEX IF NOT EXISTS idx_notificacoes_email_pendente
  ON public.notificacoes (created_at)
  WHERE email_enviado_em IS NULL AND lido_em IS NULL AND arquivada_em IS NULL;

-- =============================================
-- 2. Preferência de canal e-mail: o padrão quando o usuário nunca escolheu.
--    Financeiro, projeto, disciplina e obra chegam por e-mail; tarefa e sistema
--    não (ruído: tarefa muda o tempo todo e 'sistema' hoje não tem evento).
--    Decisão do CEO em 2026-09-04, registrada na SPEC 096.
-- =============================================

CREATE OR REPLACE FUNCTION public.notificacao_email_padrao(p_categoria text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT p_categoria IN ('financeiro', 'projeto', 'disciplina', 'obra');
$$;

REVOKE ALL ON FUNCTION public.notificacao_email_padrao(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notificacao_email_padrao(text) TO authenticated, service_role;

-- =============================================
-- 3. Seleção do que vai por e-mail.
--    SECURITY DEFINER porque lê profiles/auth.users de toda a base: é chamada
--    pela edge function com service role, nunca por usuário logado (sem GRANT
--    para authenticated, provado em pgTAP).
-- =============================================

CREATE OR REPLACE FUNCTION public.notificacoes_pendentes_email(p_modo text)
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
  IF p_modo NOT IN ('imediato', 'semanal') THEN
    RAISE EXCEPTION 'modo inválido: % (use imediato ou semanal)', p_modo;
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
    -- o destinatário ainda pertence à empresa da notificação
    AND p.empresa_id = n.empresa_id
    -- preferência explícita manda; sem linha, vale o padrão por categoria
    AND COALESCE(np.email, public.notificacao_email_padrao(n.categoria))
    AND COALESCE(p.email, u.email) IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.email_supressoes s
       WHERE s.email = lower(COALESCE(p.email, u.email))
    )
    AND CASE p_modo
      WHEN 'imediato' THEN
        n.severidade IN ('high', 'critical')
        AND n.created_at <= now() - interval '5 minutes'
      ELSE
        n.created_at >= now() - interval '7 days'
    END
  ORDER BY n.destinatario_id, n.categoria, n.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.notificacoes_pendentes_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notificacoes_pendentes_email(text) TO service_role;

COMMENT ON FUNCTION public.notificacoes_pendentes_email(text) IS
  'SPEC 096: notificações que devem sair por e-mail no modo dado. Só service role executa.';

-- =============================================
-- 4. Crons.
--    Chamam a edge function por pg_net, no padrão de trial-expiry-cron
--    (20260514300002). O wrapper monitorado (ADR 0036) mede o DISPARO, não o
--    envio: se a function falhar depois, quem grita é o Sentry dela e a linha
--    'falhou' em email_envios, não este check-in.
-- =============================================

CREATE OR REPLACE FUNCTION public.notificacoes_email_disparar(p_modo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  IF p_modo NOT IN ('imediato', 'semanal') THEN
    RAISE EXCEPTION 'modo inválido: %', p_modo;
  END IF;

  v_url := current_setting('app.supabase_url', true);
  v_key := current_setting('app.service_role_key', true);

  -- Dev local não tem os settings: no-op silencioso, igual ao sentry_cron_checkin.
  IF v_url IS NULL OR v_url = '' OR v_key IS NULL OR v_key = '' THEN
    RAISE NOTICE 'notificacoes_email_disparar: app.supabase_url/service_role_key ausentes, disparo pulado';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := v_url || '/functions/v1/notificacoes-email-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := jsonb_build_object('modo', p_modo)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.notificacoes_email_disparar(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.notificacoes_email_imediato_monitored()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_check_in_id uuid;
BEGIN
  v_check_in_id := public.sentry_cron_checkin('notificacoes-email-imediato', 'in_progress');
  BEGIN
    PERFORM public.notificacoes_email_disparar('imediato');
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.sentry_cron_checkin('notificacoes-email-imediato', 'error', v_check_in_id);
    RAISE;
  END;
  PERFORM public.sentry_cron_checkin('notificacoes-email-imediato', 'ok', v_check_in_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.notificacoes_email_semanal_monitored()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_check_in_id uuid;
BEGIN
  v_check_in_id := public.sentry_cron_checkin('notificacoes-email-semanal', 'in_progress');
  BEGIN
    PERFORM public.notificacoes_email_disparar('semanal');
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.sentry_cron_checkin('notificacoes-email-semanal', 'error', v_check_in_id);
    RAISE;
  END;
  PERFORM public.sentry_cron_checkin('notificacoes-email-semanal', 'ok', v_check_in_id);
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron indisponível (dev local): agendar em staging/prod pelo dashboard. Ver docs/operations/DEPLOY_CHECKLIST.md.';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notificacoes-email-imediato') THEN
    PERFORM cron.unschedule('notificacoes-email-imediato');
  END IF;
  PERFORM cron.schedule(
    'notificacoes-email-imediato', '*/5 * * * *',
    'SELECT public.notificacoes_email_imediato_monitored();'
  );

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notificacoes-email-semanal') THEN
    PERFORM cron.unschedule('notificacoes-email-semanal');
  END IF;
  -- Segunda-feira, 11:00 UTC = 08:00 America/Sao_Paulo.
  PERFORM cron.schedule(
    'notificacoes-email-semanal', '0 11 * * 1',
    'SELECT public.notificacoes_email_semanal_monitored();'
  );

  RAISE NOTICE 'Crons de e-mail de notificação agendados: imediato (5 min) e semanal (segunda 11:00 UTC).';
END;
$$;

-- =============================================
-- 5. Preferência de e-mail: NULL = "nunca escolheu", vale o padrão da categoria.
--    Antes a coluna era NOT NULL DEFAULT false, e o switch de e-mail ficava
--    desabilitado na UI: toda linha criada pelo toggle de in_app nascia com
--    email=false sem o usuário ter decidido nada. Com o canal ligado, isso
--    desligaria o e-mail em silêncio pra quem só mexeu no sino. Zera o que
--    nunca foi escolha e deixa o COALESCE da seleção aplicar o padrão.
-- =============================================

ALTER TABLE public.notificacao_preferencias
  ALTER COLUMN email DROP NOT NULL,
  ALTER COLUMN email SET DEFAULT NULL;

UPDATE public.notificacao_preferencias SET email = NULL WHERE email = false;

COMMENT ON COLUMN public.notificacao_preferencias.email IS
  'Canal e-mail por categoria. NULL = sem escolha explícita, vale notificacao_email_padrao(categoria). SPEC 096.';
