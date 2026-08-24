-- SPEC 058 / ADR 0031: MFA é opcional, e opcional só é honesto se ativar
-- funcionar de ponta a ponta, incluindo a saída de emergência.
--
-- Achado (20/08, Sentry PILAR-A): o botão "gerar códigos de backup" em
-- /mfa/setup responde PGRST202 ("Could not find the function
-- public.mfa_generate_backup_codes"). Auditado nos dois bancos: a tabela
-- mfa_backup_codes existe, as três funções da migration 026 NÃO existem, nem em
-- staging nem em produção, e has_aal2() (migration 020) também não. As duas
-- migrations estão registradas em supabase_migrations.schema_migrations, mas o
-- corpo nunca chegou aos bancos remotos: o histórico 0xx foi marcado como
-- aplicado sobre um baseline capturado que não continha esses objetos.
--
-- Esta migration é idempotente nos dois cenários: banco do zero (o CI roda a 026
-- antes desta, então aqui é CREATE OR REPLACE) e banco remoto (onde cria).

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

-- Sem policy: só as RPCs SECURITY DEFINER abaixo tocam a tabela.

-- =============================================
-- has_aal2: sessão tem segundo fator verificado
-- =============================================

CREATE OR REPLACE FUNCTION public.has_aal2()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN (auth.jwt() ->> 'aal') = 'aal2';
END;
$function$;

REVOKE ALL ON FUNCTION public.has_aal2() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_aal2() TO authenticated;

-- =============================================
-- Gerar códigos (revoga os antigos não usados)
-- =============================================

CREATE OR REPLACE FUNCTION public.mfa_generate_backup_codes()
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
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

  -- Continua exigindo aal2: gerar código de recuperação numa sessão que só tem
  -- senha daria ao invasor exatamente o que ele precisa para pular o MFA.
  IF NOT public.has_aal2() THEN
    RAISE EXCEPTION 'Confirme o código do app autenticador antes de gerar os códigos de backup';
  END IF;

  DELETE FROM public.mfa_backup_codes
  WHERE user_id = v_user_id AND used_at IS NULL;

  FOR i IN 1..10 LOOP
    v_code := upper(substring(encode(extensions.gen_random_bytes(6), 'hex') from 1 for 8));
    v_code := substring(v_code from 1 for 4) || '-' || substring(v_code from 5 for 4);

    INSERT INTO public.mfa_backup_codes (user_id, code_hash)
    VALUES (v_user_id, extensions.crypt(v_code, extensions.gen_salt('bf')));

    v_codes := array_append(v_codes, v_code);
  END LOOP;

  RETURN v_codes;
END;
$function$;

REVOKE ALL ON FUNCTION public.mfa_generate_backup_codes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mfa_generate_backup_codes() TO authenticated;

-- =============================================
-- Consumir código (uso único, com rate limit)
-- =============================================

CREATE OR REPLACE FUNCTION public.mfa_consume_backup_code(p_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
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

  -- 5 tentativas / 15 min por usuário (o código tem 32 bits de entropia).
  v_allowed := public.check_rate_limit('mfa_backup_code', v_user_id::TEXT, 5, 900);
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Muitas tentativas. Aguarde 15 minutos.';
  END IF;

  FOR v_match IN
    SELECT id, code_hash FROM public.mfa_backup_codes
    WHERE user_id = v_user_id AND used_at IS NULL
  LOOP
    IF extensions.crypt(v_code_norm, v_match.code_hash) = v_match.code_hash THEN
      UPDATE public.mfa_backup_codes SET used_at = NOW() WHERE id = v_match.id;
      RETURN TRUE;
    END IF;
  END LOOP;

  RETURN FALSE;
END;
$function$;

REVOKE ALL ON FUNCTION public.mfa_consume_backup_code(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mfa_consume_backup_code(TEXT) TO authenticated;

-- =============================================
-- Quantos códigos sobraram (a UI mostra "5 de 10")
-- =============================================

CREATE OR REPLACE FUNCTION public.mfa_backup_codes_remaining()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COUNT(*)::INTEGER FROM public.mfa_backup_codes
  WHERE user_id = auth.uid() AND used_at IS NULL
$function$;

REVOKE ALL ON FUNCTION public.mfa_backup_codes_remaining() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mfa_backup_codes_remaining() TO authenticated;
