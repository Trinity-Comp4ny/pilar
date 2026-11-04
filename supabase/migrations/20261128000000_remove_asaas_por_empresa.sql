-- Remove o Asaas por empresa (cada cliente do Pilar trazer a própria conta Asaas).
--
-- A integração foi abandonada em 2026-09-03 (DECISOES.md) e o backend sai agora:
-- as edge functions asaas-config, asaas-criar-cobranca e asaas-webhook foram removidas
-- do repo. Aqui saem as tabelas e as RPCs que só elas usavam.
--
-- NÃO mexe no Asaas da plataforma (assinatura e pacote de tokens): pilar_subscriptions,
-- pilar_pending_signups, pilar_checkout_webhook_logs e pilar_token_pack_purchases ficam.
-- As colunas asaas_* de receitas/lancamentos e clientes.asaas_customer_id também ficam,
-- porque a view lancamentos, get_lancamentos_pagina e o portal leem delas; saem num
-- passo próprio.

-- A chave de cada empresa mora no Vault; sem isto o segredo fica órfão quando a
-- tabela cai. O Vault não existe em todo ambiente, então a limpeza é condicional.
DO $$
DECLARE
  v_removidos integer := 0;
BEGIN
  IF to_regclass('public.asaas_config') IS NULL
     OR NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'supabase_vault') THEN
    RETURN;
  END IF;

  DELETE FROM vault.secrets
  WHERE id IN (
    SELECT api_key_secret_id FROM public.asaas_config WHERE api_key_secret_id IS NOT NULL
  );
  GET DIAGNOSTICS v_removidos = ROW_COUNT;
  RAISE NOTICE 'asaas_config: % segredo(s) removido(s) do Vault', v_removidos;
END $$;

DROP FUNCTION IF EXISTS public.set_asaas_api_key(uuid, text);
DROP FUNCTION IF EXISTS public.get_asaas_api_key(uuid);

DROP VIEW IF EXISTS public.asaas_config_safe;
DROP TABLE IF EXISTS public.asaas_webhook_logs;
DROP TABLE IF EXISTS public.asaas_config;
