-- SPEC 115: o pedido de exportação de dados passa a ser atendido sozinho.
--
-- 1. Bucket privado lgpd-exportacoes. Sem policy de propósito: ninguém além da
--    service role lê ou escreve; o titular baixa por link assinado de 7 dias que a
--    edge exportar-dados-titular gera.
-- 2. O trigger do pedido (20261023000000) passa a chamar exportar-dados-titular, que
--    monta a cópia, guarda, manda o link e marca o pedido. Na falha, a edge avisa o
--    encarregado. Mesmos segredos do Vault e mesmo comportamento sem eles: o pedido
--    fica gravado e o aviso é pulado com NOTICE.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('lgpd-exportacoes', 'lgpd-exportacoes', false, 52428800, ARRAY['application/json'])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

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
    RAISE NOTICE 'pg_net não habilitado: pulando a exportação automática do pedido %.', NEW.id;
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
    RAISE NOTICE 'Segredos do Vault ausentes: pulando a exportação automática do pedido %.', NEW.id;
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := rtrim(v_url, '/') || '/functions/v1/exportar-dados-titular',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-pilar-secret', v_secret),
    body    := jsonb_build_object('request_id', NEW.id),
    timeout_milliseconds := 60000
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_data_export_request falhou para o pedido %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_data_export_request() FROM PUBLIC, anon, authenticated;
