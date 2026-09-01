-- Spec 081: agenda o cron do guardiao-margem-cron via pg_cron + pg_net.
--
-- Mesmo padrão de 20260514300002 (trial-expiry-cron): reusa as configurações de
-- runtime já existentes (app.supabase_url, app.service_role_key) — nada novo a
-- configurar. Roda 15 minutos depois de gerar-notificacoes-ambient (06:00 UTC),
-- tempo de sobra para a notificação de 'orcamento_excedido' ter sido gravada
-- (o cron do agente não depende dela, mas mantém a ordem intuitiva pro usuário:
-- primeiro o aviso, depois o rascunho pronto).
--
-- Pré-requisito: Edge Function guardiao-margem-cron deployada com --no-verify-jwt.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron não disponível — agendar via Supabase Dashboard → Edge Functions → Schedule. Ver docs/DEPLOY_CHECKLIST.md.';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'guardiao-margem-daily') THEN
    PERFORM cron.unschedule('guardiao-margem-daily');
  END IF;

  PERFORM cron.schedule(
    'guardiao-margem-daily',
    '15 6 * * *',
    $cron$
    SELECT net.http_post(
      url        := current_setting('app.supabase_url') || '/functions/v1/guardiao-margem-cron',
      headers    := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body       := '{}'::jsonb
    );
    $cron$
  );

  RAISE NOTICE 'Cron job guardiao-margem-daily agendado: 06:15 UTC / 03:15 BRT';
END;
$$;
