-- Migration 021: Cifrar asaas_config.api_key com pgsodium
-- Impede vazamento de API key em dumps/backups/replicas.
-- Leitura ainda restrita a admin/financeiro com MFA (policy existente).
--
-- Nota: pgsodium é feature beta do Supabase. Se não habilitado, migration faz
-- fallback para leitura direta (mantém coluna api_key em plain text mas com
-- policy de RLS como fallback).

-- =============================================
-- 1. Tentar habilitar pgsodium; se falhar, pular cifração
-- =============================================

DO $$
DECLARE
  v_has_pgsodium BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_available_extensions WHERE name = 'pgsodium'
  ) INTO v_has_pgsodium;

  IF v_has_pgsodium THEN
    CREATE EXTENSION IF NOT EXISTS pgsodium;
    RAISE NOTICE 'pgsodium habilitado — cifração ativa';
  ELSE
    RAISE NOTICE 'pgsodium indisponível — mantendo api_key em plain text (RLS ainda protege)';
  END IF;
END $$;

-- =============================================
-- 2. Adicionar coluna cifrada (se pgsodium disponível)
-- =============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgsodium') THEN
    -- Coluna bytea pra guardar cifragem
    ALTER TABLE public.asaas_config ADD COLUMN IF NOT EXISTS api_key_encrypted BYTEA;
    ALTER TABLE public.asaas_config ADD COLUMN IF NOT EXISTS api_key_nonce BYTEA;

    -- Backfill: cifra valores existentes
    UPDATE public.asaas_config
    SET api_key_nonce = pgsodium.crypto_aead_det_noncegen(),
        api_key_encrypted = pgsodium.crypto_aead_det_encrypt(
          convert_to(api_key, 'utf8'),
          convert_to(id::text, 'utf8'),
          (SELECT id FROM pgsodium.valid_key WHERE name = 'default' LIMIT 1),
          api_key_nonce
        )
    WHERE api_key IS NOT NULL
      AND api_key_encrypted IS NULL;
  END IF;
END $$;

-- =============================================
-- 3. RPC: set_asaas_api_key (cifra antes de salvar)
-- =============================================

CREATE OR REPLACE FUNCTION public.set_asaas_api_key(
  p_empresa_id UUID,
  p_api_key TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_empresa_id UUID;
  v_nonce BYTEA;
  v_encrypted BYTEA;
BEGIN
  v_caller_empresa_id := public.get_user_empresa_id();

  IF v_caller_empresa_id IS NULL OR v_caller_empresa_id != p_empresa_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF NOT public.has_role('admin', 'financeiro') THEN
    RAISE EXCEPTION 'Apenas admin/financeiro pode configurar api_key';
  END IF;

  IF NOT public.admin_mfa_required() THEN
    RAISE EXCEPTION 'MFA obrigatório para configurar api_key';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgsodium') THEN
    v_nonce := pgsodium.crypto_aead_det_noncegen();
    v_encrypted := pgsodium.crypto_aead_det_encrypt(
      convert_to(p_api_key, 'utf8'),
      convert_to(p_empresa_id::text, 'utf8'),
      (SELECT id FROM pgsodium.valid_key WHERE name = 'default' LIMIT 1),
      v_nonce
    );

    INSERT INTO public.asaas_config (empresa_id, api_key, api_key_encrypted, api_key_nonce, ambiente)
    VALUES (p_empresa_id, '***ENCRYPTED***', v_encrypted, v_nonce, 'sandbox')
    ON CONFLICT (empresa_id) DO UPDATE
    SET api_key = '***ENCRYPTED***',
        api_key_encrypted = EXCLUDED.api_key_encrypted,
        api_key_nonce = EXCLUDED.api_key_nonce,
        updated_at = NOW();
  ELSE
    -- Fallback sem pgsodium
    INSERT INTO public.asaas_config (empresa_id, api_key, ambiente)
    VALUES (p_empresa_id, p_api_key, 'sandbox')
    ON CONFLICT (empresa_id) DO UPDATE
    SET api_key = EXCLUDED.api_key, updated_at = NOW();
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_asaas_api_key(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_asaas_api_key(UUID, TEXT) TO authenticated;

-- =============================================
-- 4. RPC: get_asaas_api_key (descifra apenas quando edge function pede)
-- Usada pela edge function asaas-criar-cobranca via service_role
-- =============================================

CREATE OR REPLACE FUNCTION public.get_asaas_api_key(p_empresa_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_config RECORD;
  v_caller_role TEXT;
BEGIN
  v_caller_role := auth.jwt() ->> 'role';

  -- Apenas service_role pode chamar (edge functions)
  IF v_caller_role IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Acesso negado: requer service_role';
  END IF;

  SELECT api_key, api_key_encrypted, api_key_nonce
  INTO v_config
  FROM asaas_config
  WHERE empresa_id = p_empresa_id;

  IF v_config IS NULL THEN
    RAISE EXCEPTION 'Configuração Asaas não encontrada';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgsodium')
     AND v_config.api_key_encrypted IS NOT NULL THEN
    RETURN convert_from(
      pgsodium.crypto_aead_det_decrypt(
        v_config.api_key_encrypted,
        convert_to(p_empresa_id::text, 'utf8'),
        (SELECT id FROM pgsodium.valid_key WHERE name = 'default' LIMIT 1),
        v_config.api_key_nonce
      ),
      'utf8'
    );
  ELSE
    RETURN v_config.api_key;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_asaas_api_key(UUID) FROM PUBLIC, anon, authenticated;
-- Apenas service_role via edge function chama

-- =============================================
-- 5. Remove api_key da query de SELECT normal (substitui por mascarado)
-- Front vê '***ENCRYPTED***' ou últimos 4 chars
-- =============================================

CREATE OR REPLACE VIEW public.asaas_config_safe AS
SELECT
  id,
  empresa_id,
  CASE
    WHEN api_key IS NULL THEN NULL
    WHEN length(api_key) > 4 THEN '***' || right(api_key, 4)
    ELSE '***'
  END AS api_key_masked,
  ambiente,
  webhook_token,
  created_at,
  updated_at
FROM public.asaas_config
WHERE empresa_id = public.get_user_empresa_id()
  AND public.has_role('admin', 'financeiro');

GRANT SELECT ON public.asaas_config_safe TO authenticated;

-- =============================================
-- Password policy — config manual no Supabase Dashboard
-- =============================================
-- Dashboard → Authentication → Providers → Email → Password Requirements:
--   Minimum length: 12
--   Require: uppercase, lowercase, digit, special character
--
-- Hibp (Have I Been Pwned) check: habilitar também
-- Dashboard → Authentication → Security:
--   Password strength: Strong
--   Rate limiting: enabled (já vem default)
-- =============================================
