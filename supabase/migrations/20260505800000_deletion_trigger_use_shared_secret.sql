-- Atualiza o trigger notify_data_deletion_request para usar
-- app.settings.data_deletion_notify_secret (shared secret de escopo limitado)
-- em vez da service_role_key.
--
-- Para ativar, rodar UMA VEZ no banco remoto (não commitar o valor):
--   ALTER DATABASE postgres
--     SET app.settings.supabase_url = 'https://<ref>.supabase.co';
--   ALTER DATABASE postgres
--     SET app.settings.data_deletion_notify_secret = '<segredo-gerado-com-openssl-rand-hex-32>';
--
-- O mesmo segredo deve ser configurado como secret DATA_DELETION_NOTIFY_SECRET
-- na edge function send-data-deletion-notification.

CREATE OR REPLACE FUNCTION public.notify_data_deletion_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_url    TEXT;
  v_secret TEXT;
  v_endpoint TEXT;
  v_pg_net_available BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_net'
  ) INTO v_pg_net_available;

  IF NOT v_pg_net_available THEN
    RAISE NOTICE 'pg_net não habilitado — pulando notificação para request %.', NEW.id;
    PERFORM pg_notify(
      'data_deletion_request',
      json_build_object('request_id', NEW.id, 'user_id', NEW.user_id, 'empresa_id', NEW.empresa_id)::text
    );
    RETURN NEW;
  END IF;

  BEGIN
    v_url    := current_setting('app.settings.supabase_url', true);
    v_secret := current_setting('app.settings.data_deletion_notify_secret', true);
  EXCEPTION WHEN OTHERS THEN
    v_url    := NULL;
    v_secret := NULL;
  END;

  IF v_url IS NULL OR v_url = '' OR v_secret IS NULL OR v_secret = '' THEN
    RAISE NOTICE 'supabase_url ou data_deletion_notify_secret não configurados — pulando notificação para request %.', NEW.id;
    RETURN NEW;
  END IF;

  v_endpoint := rtrim(v_url, '/') || '/functions/v1/send-data-deletion-notification';

  PERFORM net.http_post(
    url     := v_endpoint,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-pilar-secret', v_secret
    ),
    body    := jsonb_build_object('request_id', NEW.id),
    timeout_milliseconds := 10000
  );

  PERFORM pg_notify(
    'data_deletion_request',
    json_build_object('request_id', NEW.id, 'user_id', NEW.user_id, 'empresa_id', NEW.empresa_id)::text
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_data_deletion_request falhou para request %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;
