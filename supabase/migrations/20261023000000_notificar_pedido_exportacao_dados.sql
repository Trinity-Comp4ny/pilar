-- Pedido de exportação de dados (LGPD art. 18, V) passa a avisar o encarregado.
--
-- Configurações → Privacidade promete "enviaremos seus dados por e-mail em até 15
-- dias" (art. 19), mas request_data_export() só gravava a linha em
-- data_export_requests: nada avisava quem precisa atender. Mesmo caminho do pedido
-- de exclusão (notify_data_deletion_request, 20260511000000): trigger AFTER INSERT
-- chama send-data-deletion-notification via pg_net, agora com tipo = 'exportacao',
-- e a função manda o e-mail para o encarregado (DPO).
--
-- Usa os mesmos segredos do Vault da exclusão (supabase_url e
-- data_deletion_notify_secret). Sem eles, ou sem pg_net, o trigger não derruba o
-- INSERT: o pedido fica gravado e o aviso é pulado com NOTICE, igual à exclusão.

CREATE OR REPLACE FUNCTION public.notify_data_export_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_url    TEXT;
  v_secret TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE NOTICE 'pg_net não habilitado: pulando aviso do pedido de exportação %.', NEW.id;
    RETURN NEW;
  END IF;

  BEGIN
    SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1;
    SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'data_deletion_notify_secret' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_url := NULL;
    v_secret := NULL;
  END;

  IF v_url IS NULL OR v_url = '' OR v_secret IS NULL OR v_secret = '' THEN
    RAISE NOTICE 'Segredos do Vault ausentes: pulando aviso do pedido de exportação %.', NEW.id;
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := rtrim(v_url, '/') || '/functions/v1/send-data-deletion-notification',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-pilar-secret', v_secret),
    body    := jsonb_build_object('request_id', NEW.id, 'tipo', 'exportacao'),
    timeout_milliseconds := 10000
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_data_export_request falhou para o pedido %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- Função de trigger não precisa de EXECUTE para ninguém (20261022000001).
REVOKE EXECUTE ON FUNCTION public.notify_data_export_request() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_data_export_request ON public.data_export_requests;
CREATE TRIGGER trg_notify_data_export_request
  AFTER INSERT ON public.data_export_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_data_export_request();
