-- Atualiza notify_data_deletion_request para ler segredos do Supabase Vault.
--
-- Motivo: GUC `app.settings.*` no nível DATABASE exige superuser, indisponível
-- no Supabase managed. Vault é o caminho oficial para armazenar secrets no DB.
--
-- Pré-requisito (rodar UMA VEZ no SQL Editor, fora desta migration):
--   SELECT vault.create_secret('<secret>', 'data_deletion_notify_secret', 'desc...');
--   SELECT vault.create_secret('https://<ref>.supabase.co', 'supabase_url', 'desc...');
--
-- Atualiza também: usa CASE para ler sem quebrar quando o vault está vazio
-- (fail-closed silencioso, igual ao comportamento anterior com GUC ausente).

CREATE OR REPLACE FUNCTION public.notify_data_deletion_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_url      TEXT;
  v_secret   TEXT;
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

  -- Lê secrets do Vault (gerenciado pelo Supabase, AES-encrypted at rest)
  BEGIN
    SELECT decrypted_secret INTO v_url
      FROM vault.decrypted_secrets
      WHERE name = 'supabase_url'
      LIMIT 1;

    SELECT decrypted_secret INTO v_secret
      FROM vault.decrypted_secrets
      WHERE name = 'data_deletion_notify_secret'
      LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_url    := NULL;
    v_secret := NULL;
  END;

  IF v_url IS NULL OR v_url = '' OR v_secret IS NULL OR v_secret = '' THEN
    RAISE NOTICE 'supabase_url ou data_deletion_notify_secret não configurados no vault — pulando notificação para request %.', NEW.id;
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

COMMENT ON FUNCTION public.notify_data_deletion_request() IS
  'AFTER INSERT em data_deletion_requests: lê secrets do vault e chama edge function via pg_net.';
