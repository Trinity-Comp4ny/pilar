-- Migration 026: MFA backup codes
-- Usuário gera 10 códigos de recuperação (uso único) ao ativar MFA.
-- Códigos são hasheados no banco (bcrypt). Só retornam plain text uma vez.

CREATE TABLE IF NOT EXISTS public.mfa_backup_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mfa_backup_codes_user
  ON public.mfa_backup_codes(user_id) WHERE used_at IS NULL;

ALTER TABLE public.mfa_backup_codes ENABLE ROW LEVEL SECURITY;

-- Sem policies: só SECURITY DEFINER RPCs acessam

-- =============================================
-- Gerar novos códigos (revoga antigos não usados)
-- =============================================

CREATE OR REPLACE FUNCTION public.mfa_generate_backup_codes()
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id UUID;
  v_codes TEXT[] := ARRAY[]::TEXT[];
  v_code TEXT;
  i INTEGER;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  -- Exige AAL2 pra gerar (previne gerar códigos sem MFA verificado)
  IF NOT public.has_aal2() THEN
    RAISE EXCEPTION 'Requer verificação MFA ativa';
  END IF;

  -- Revoga códigos antigos não usados
  DELETE FROM public.mfa_backup_codes
  WHERE user_id = v_user_id AND used_at IS NULL;

  -- Gera 10 códigos de 8 chars (formato XXXX-XXXX)
  FOR i IN 1..10 LOOP
    v_code := upper(substring(encode(gen_random_bytes(6), 'hex') from 1 for 8));
    v_code := substring(v_code from 1 for 4) || '-' || substring(v_code from 5 for 4);

    INSERT INTO public.mfa_backup_codes (user_id, code_hash)
    VALUES (v_user_id, crypt(v_code, gen_salt('bf')));

    v_codes := array_append(v_codes, v_code);
  END LOOP;

  RETURN v_codes;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mfa_generate_backup_codes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mfa_generate_backup_codes() TO authenticated;

-- =============================================
-- Consumir código (valida + marca como usado + upgrade pra AAL2)
-- =============================================

CREATE OR REPLACE FUNCTION public.mfa_consume_backup_code(p_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id UUID;
  v_code_norm TEXT;
  v_match RECORD;
  v_allowed BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  v_code_norm := upper(trim(p_code));

  -- Rate limit: 5 tentativas/15min por user (previne brute force)
  v_allowed := public.check_rate_limit('mfa_backup_code', v_user_id::TEXT, 5, 900);
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Muitas tentativas. Aguarde 15 minutos.';
  END IF;

  -- Busca códigos ainda válidos e testa um por um
  FOR v_match IN
    SELECT id, code_hash FROM public.mfa_backup_codes
    WHERE user_id = v_user_id AND used_at IS NULL
  LOOP
    IF crypt(v_code_norm, v_match.code_hash) = v_match.code_hash THEN
      UPDATE public.mfa_backup_codes SET used_at = NOW() WHERE id = v_match.id;
      RETURN TRUE;
    END IF;
  END LOOP;

  RETURN FALSE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mfa_consume_backup_code(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mfa_consume_backup_code(TEXT) TO authenticated;

-- =============================================
-- Contar códigos restantes (UI mostra "5 de 10 disponíveis")
-- =============================================

CREATE OR REPLACE FUNCTION public.mfa_backup_codes_remaining()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER FROM public.mfa_backup_codes
  WHERE user_id = auth.uid() AND used_at IS NULL
$$;

GRANT EXECUTE ON FUNCTION public.mfa_backup_codes_remaining() TO authenticated;
