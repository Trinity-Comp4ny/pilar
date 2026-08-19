-- Cifra de verdade da api_key do Asaas com Supabase Vault.
--
-- CONTEXTO (verificado ao vivo em produção e staging, 2026-08-19, não inferido
-- do código): a migration 021_pgsodium_api_key nunca chegou a produzir efeito
-- em nenhum dos dois bancos. A tabela asaas_config hoje só tem
-- (id, empresa_id, api_key, ambiente, created_at, updated_at) — sem coluna
-- cifrada, sem função de leitura/escrita cifrada, sem view mascarada. A
-- api_key está em texto puro em produção.
--
-- PRIMEIRA VERSÃO DESTA MIGRATION usava pgsodium.crypto_aead_det_encrypt()
-- direto e foi REESCRITA depois de reproduzir localmente:
--
--   ERROR: permission denied for function crypto_aead_det_encrypt
--
-- Causa raiz (confirmada nos dois bancos, local e staging, não só suposição):
-- essa função é SECURITY DEFINER dona de pgsodium_keymaker, mas o EXECUTE pra
-- sequer CHAMAR a função (SECURITY DEFINER só troca o privilégio DENTRO do
-- corpo, não dispensa grant de invocação) é restrito às roles internas do
-- pgsodium (pgsodium_keyholder/keyiduser/keymaker) e a supabase_admin. Nem
-- `postgres` (role que aplica migration) nem `service_role` (role que as edge
-- functions usam) têm esse grant, em NENHUM dos dois ambientes — confirmado
-- por has_function_privilege() direto no catálogo de staging antes de escrever
-- esta versão. Ou seja, a versão anterior ia falhar exatamente assim se
-- tivesse chegado a staging, não era só um problema do stack local.
--
-- Esta versão usa supabase_vault (extensão `supabase_vault`, JÁ instalada em
-- staging E produção — diferente de pgsodium cru, que só estava em staging).
-- Vault é a camada oficial do Supabase pra exatamente este caso de uso
-- (segredo por linha), resolve toda a gestão de chave/role internamente, e
-- `postgres`/`service_role` já têm EXECUTE em vault.create_secret/
-- update_secret e SELECT em vault.decrypted_secrets por padrão — verificado
-- localmente antes de escrever esta versão, não assumido.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'supabase_vault') THEN
    RAISE EXCEPTION 'supabase_vault não está instalado neste ambiente. Abortando: não cifrar é '
      'melhor que cifrar com fallback silencioso pra texto puro (ver ESTEIRA-INCIDENTES.md).';
  END IF;
END $$;

-- Coluna nova: referencia o segredo no Vault, não guarda o valor cifrado
-- diretamente (Vault já guarda isso em vault.secrets). api_key (texto puro)
-- permanece só como rede de segurança de leitura transitória — esta migration
-- já zera o valor de toda linha existente assim que ela é migrada pro Vault.
ALTER TABLE public.asaas_config ADD COLUMN IF NOT EXISTS api_key_secret_id UUID;

-- api_key era NOT NULL (fazia sentido quando era o único lugar que guardava a
-- chave). Testado ao vivo: sem soltar essa constraint, o upsert que a edge
-- function faz ANTES de chamar set_asaas_api_key (grava empresa_id/ambiente
-- pra garantir que a linha existe, sem api_key) falha com "null value in
-- column api_key violates not-null constraint" na primeira configuração de
-- uma empresa nova. Daqui pra frente api_key fica NULL por design assim que a
-- chave é migrada pro Vault.
ALTER TABLE public.asaas_config ALTER COLUMN api_key DROP NOT NULL;

COMMENT ON COLUMN public.asaas_config.api_key IS
  'DEPRECATED desde 2026-08-19: mantido só como coluna vazia por segurança de schema. '
  'A chave de verdade fica no Supabase Vault, referenciada por api_key_secret_id. '
  'Nunca escrever texto puro aqui de novo. Remover a coluna numa migration futura.';
COMMENT ON COLUMN public.asaas_config.api_key_secret_id IS
  'Referência a vault.secrets.id. Escrever/ler só via set_asaas_api_key()/get_asaas_api_key(), '
  'nunca via vault.decrypted_secrets direto (mesmo tendo grant, centraliza o caminho auditável).';

-- Backfill: move o que já existe em texto puro pro Vault, e zera a coluna
-- antiga no mesmo bloco. Nome do secret é determinístico por empresa (Vault
-- exige nome único quando presente), permitindo achar o secret dessa empresa
-- sem precisar guardar nada além do id — o nome serve de auditoria legível,
-- api_key_secret_id é o que o código de fato usa pra ler.
DO $$
DECLARE
  v_row RECORD;
  v_secret_id uuid;
BEGIN
  FOR v_row IN
    SELECT id, empresa_id, api_key
    FROM public.asaas_config
    WHERE api_key IS NOT NULL AND api_key_secret_id IS NULL
  LOOP
    v_secret_id := vault.create_secret(
      v_row.api_key,
      'asaas_api_key:' || v_row.empresa_id::text,
      'Chave de API do Asaas (empresa ' || v_row.empresa_id::text || '), migrada de texto puro em 2026-08-19'
    );

    UPDATE public.asaas_config
    SET api_key_secret_id = v_secret_id,
        api_key = NULL
    WHERE id = v_row.id;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- set_asaas_api_key: único caminho de escrita da chave a partir de agora.
-- ---------------------------------------------------------------------------
-- Só service_role chama (edge function asaas-config usa createAdminClient()).
-- Atualiza o secret existente se a empresa já tem um (vault.update_secret),
-- cria um novo só na primeira vez — nunca cria um segundo secret órfão pra
-- mesma empresa a cada rotação de chave.
CREATE OR REPLACE FUNCTION public.set_asaas_api_key(p_empresa_id UUID, p_api_key TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_secret_id uuid;
  v_rows int;
BEGIN
  IF (auth.jwt() ->> 'role') IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Acesso negado: requer service_role';
  END IF;

  IF p_api_key IS NULL OR btrim(p_api_key) = '' THEN
    RAISE EXCEPTION 'api_key vazia';
  END IF;

  SELECT api_key_secret_id INTO v_secret_id
  FROM public.asaas_config
  WHERE empresa_id = p_empresa_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION 'Config do Asaas não encontrada para esta empresa (upsert de ambiente precisa rodar antes)';
  END IF;

  IF v_secret_id IS NOT NULL THEN
    PERFORM vault.update_secret(v_secret_id, btrim(p_api_key));
  ELSE
    v_secret_id := vault.create_secret(
      btrim(p_api_key),
      'asaas_api_key:' || p_empresa_id::text,
      'Chave de API do Asaas (empresa ' || p_empresa_id::text || ')'
    );
  END IF;

  UPDATE public.asaas_config
  SET api_key_secret_id = v_secret_id,
      api_key = NULL,
      updated_at = now()
  WHERE empresa_id = p_empresa_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_asaas_api_key(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_asaas_api_key(UUID, TEXT) TO service_role;

-- ---------------------------------------------------------------------------
-- get_asaas_api_key: único caminho de leitura da chave a partir de agora.
-- ---------------------------------------------------------------------------
-- Só service_role chama (edge functions asaas-config e asaas-criar-cobranca).
-- Mantém leitura de api_key em texto puro como rede de segurança só de
-- LEITURA (nunca de escrita) pra não quebrar duro numa linha que por algum
-- motivo não tenha sido pega pelo backfill — depois que o backfill roda isso
-- é sempre NULL, então este branch nunca deveria disparar na prática.
CREATE OR REPLACE FUNCTION public.get_asaas_api_key(p_empresa_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_config RECORD;
BEGIN
  IF (auth.jwt() ->> 'role') IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Acesso negado: requer service_role';
  END IF;

  SELECT api_key, api_key_secret_id INTO v_config
  FROM public.asaas_config
  WHERE empresa_id = p_empresa_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Configuração Asaas não encontrada';
  END IF;

  IF v_config.api_key_secret_id IS NOT NULL THEN
    RETURN (
      SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = v_config.api_key_secret_id
    );
  END IF;

  RETURN v_config.api_key;
END;
$$;

REVOKE ALL ON FUNCTION public.get_asaas_api_key(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_asaas_api_key(UUID) TO service_role;

-- ---------------------------------------------------------------------------
-- O QUE ESTA MIGRATION DELIBERADAMENTE NÃO FAZ
-- ---------------------------------------------------------------------------
-- NÃO mexe em asaas_config.webhook_token nem no mecanismo de resolução de
-- empresa por token de webhook em supabase/functions/asaas-webhook/index.ts.
-- Achado à parte durante esta investigação: aquela função consulta uma coluna
-- webhook_token que foi DROPADA em 028_sync_remote_changes.sql, o erro da
-- consulta é engolido, e o código cai pro fallback de token global sem
-- filtrar a busca de receita por empresa_id. Virou spec própria (057), porque
-- é decisão de desenho, não reescrita mecânica, e o arquivo processa
-- confirmação de pagamento de verdade.
