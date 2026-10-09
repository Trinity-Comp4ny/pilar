-- Código de recuperação passa a desligar o 2FA no servidor.
--
-- Antes: mfa_consume_backup_code só marcava o código como usado, e o front
-- tentava remover o fator com supabase.auth.mfa.unenroll. Quem usa código de
-- recuperação está numa sessão aal1 (perdeu o autenticador), e o Supabase Auth
-- recusa remover fator verificado sem aal2 ("AAL2 required to unenroll verified
-- factor"). Resultado: o código era queimado e a conta continuava travada.
--
-- Agora, com o código válido, a própria função remove os fatores TOTP do
-- usuário e invalida os códigos que sobraram. A conta volta ao padrão (sem MFA,
-- ADR 0031) e o usuário pode reativar em Configurações > Segurança, o que gera
-- códigos novos. auth.mfa_challenges cai em cascata.
--
-- Mesma assinatura: CREATE OR REPLACE, sem risco de overload.

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

      DELETE FROM public.mfa_backup_codes
      WHERE user_id = v_user_id AND used_at IS NULL;

      DELETE FROM auth.mfa_factors
      WHERE user_id = v_user_id AND factor_type = 'totp';

      RETURN TRUE;
    END IF;
  END LOOP;

  RETURN FALSE;
END;
$function$;

REVOKE ALL ON FUNCTION public.mfa_consume_backup_code(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mfa_consume_backup_code(TEXT) TO authenticated;
