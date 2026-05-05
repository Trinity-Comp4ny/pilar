-- LGPD: notificação automática de pedidos de exclusão
--
-- Adiciona coluna `notified_at` (idempotência da edge function) e dispara
-- a edge function `send-data-deletion-notification` via pg_net.http_post
-- em AFTER INSERT na tabela data_deletion_requests.
--
-- =============================================
-- SETUP NECESSÁRIO (rodar uma vez por projeto)
-- =============================================
-- 1) Habilitar a extensão pg_net (já é habilitada por padrão em projetos
--    Supabase recentes; em projetos antigos rode manualmente):
--      CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
--
-- 2) Configurar GUCs com URL do projeto e service role key (privados):
--      ALTER DATABASE postgres SET app.settings.supabase_url
--        = 'https://<project-ref>.supabase.co';
--      ALTER DATABASE postgres SET app.settings.service_role_key
--        = '<service-role-jwt>';
--    (Reconectar para os valores valerem.)
--
-- 3) Variáveis necessárias na edge function (Supabase Dashboard → Edge Functions → Secrets):
--      RESEND_API_KEY            — chave do Resend
--      RESEND_FROM               — opcional, default 'Pilar <no-reply@pilarsoft.com.br>'
--      APP_URL                   — opcional, default https://app.pilarsoft.com.br
--      LGPD_DPO_EMAIL            — opcional, default privacidade@trnty.com.br
--      DATA_DELETION_NOTIFY_SECRET — opcional shared secret (header x-pilar-secret).
--                                    Caso não informado, o trigger usa Authorization
--                                    Bearer com a service role key configurada na GUC.
-- =============================================

-- 1) Coluna notified_at (idempotência)
ALTER TABLE public.data_deletion_requests
  ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_ddr_notified_at_null
  ON public.data_deletion_requests (requested_at DESC)
  WHERE notified_at IS NULL;

COMMENT ON COLUMN public.data_deletion_requests.notified_at IS
  'Timestamp em que a edge function send-data-deletion-notification enviou o email ao admin. NULL = ainda não notificado.';

-- 2) Função de trigger
CREATE OR REPLACE FUNCTION public.notify_data_deletion_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_url TEXT;
  v_key TEXT;
  v_endpoint TEXT;
  v_pg_net_available BOOLEAN;
BEGIN
  -- Verifica se pg_net está disponível
  SELECT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_net'
  ) INTO v_pg_net_available;

  IF NOT v_pg_net_available THEN
    RAISE NOTICE 'pg_net não está habilitado — pulando notificação automática para request %. Habilite com CREATE EXTENSION pg_net;', NEW.id;
    -- Mantém o pg_notify legado para workers externos
    PERFORM pg_notify(
      'data_deletion_request',
      json_build_object('request_id', NEW.id, 'user_id', NEW.user_id, 'empresa_id', NEW.empresa_id)::text
    );
    RETURN NEW;
  END IF;

  -- Lê settings (configurados via ALTER DATABASE ... SET app.settings.*)
  BEGIN
    v_url := current_setting('app.settings.supabase_url', true);
    v_key := current_setting('app.settings.service_role_key', true);
  EXCEPTION WHEN OTHERS THEN
    v_url := NULL;
    v_key := NULL;
  END;

  IF v_url IS NULL OR v_url = '' OR v_key IS NULL OR v_key = '' THEN
    RAISE NOTICE 'app.settings.supabase_url ou service_role_key não configurados — pulando notificação para request %.', NEW.id;
    RETURN NEW;
  END IF;

  v_endpoint := rtrim(v_url, '/') || '/functions/v1/send-data-deletion-notification';

  -- pg_net.http_post é fire-and-forget (assíncrono via worker pg_net)
  PERFORM net.http_post(
    url := v_endpoint,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := jsonb_build_object('request_id', NEW.id),
    timeout_milliseconds := 10000
  );

  -- Mantém pg_notify por compatibilidade
  PERFORM pg_notify(
    'data_deletion_request',
    json_build_object('request_id', NEW.id, 'user_id', NEW.user_id, 'empresa_id', NEW.empresa_id)::text
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Nunca falha o INSERT — apenas loga
  RAISE WARNING 'notify_data_deletion_request falhou para request %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_data_deletion_request() FROM PUBLIC;

-- 3) Trigger AFTER INSERT
DROP TRIGGER IF EXISTS trg_notify_data_deletion_request ON public.data_deletion_requests;
CREATE TRIGGER trg_notify_data_deletion_request
  AFTER INSERT ON public.data_deletion_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_data_deletion_request();

COMMENT ON FUNCTION public.notify_data_deletion_request() IS
  'AFTER INSERT em data_deletion_requests: chama edge function send-data-deletion-notification via pg_net.';
