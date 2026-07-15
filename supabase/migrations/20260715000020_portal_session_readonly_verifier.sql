-- Portal auth (crítico): verificador de sessão SEM rotação de token.
--
-- Contexto (auditoria 2026-07-14):
--   portal_verify_session ROTACIONA o token a cada chamada (gera novo, faz UPDATE
--   token_sessao e devolve new_token). Endpoints de LEITURA/DOWNLOAD que só querem
--   validar a sessão chamam essa função e descartam o new_token → o token guardado
--   no cliente fica obsoleto e a navegação seguinte desloga o cliente. A rotação a
--   cada verify também gera corrida entre verifies concorrentes (StrictMode, 2 abas,
--   refetch): uma rotação invalida a outra → logout espúrio.
--
-- Fix: um verificador read-only que valida hash + expiração e faz expiração
--   DESLIZANTE mantendo o MESMO valor de token (não rotaciona). É idempotente e
--   seguro para chamadas concorrentes. Usado por endpoints de leitura/download e
--   pela aprovação de proposta do portal (onde rotacionar não faz sentido).
--   A rotação continua existindo em portal_verify_session para o refresh de auth
--   do useClienteAuth, que já persiste o new_token corretamente.

CREATE OR REPLACE FUNCTION public.portal_verify_session_readonly(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_account RECORD;
  v_token_hash TEXT;
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RETURN NULL;
  END IF;

  v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

  SELECT id, cliente_id, empresa_id, nome, email
  INTO v_account
  FROM cliente_portal_accounts
  WHERE token_sessao = v_token_hash
    AND token_expira_em > NOW()
    AND ativo = true;

  IF v_account IS NULL THEN
    RETURN NULL;
  END IF;

  -- Expiração deslizante SEM trocar o token: seguro para chamadas concorrentes.
  UPDATE cliente_portal_accounts
  SET token_expira_em = NOW() + INTERVAL '7 days',
      ultimo_acesso = NOW()
  WHERE id = v_account.id;

  RETURN json_build_object(
    'id', v_account.id,
    'cliente_id', v_account.cliente_id,
    'empresa_id', v_account.empresa_id,
    'nome', v_account.nome,
    'email', v_account.email
  );
END;
$$;

GRANT ALL ON FUNCTION public.portal_verify_session_readonly(TEXT) TO anon;
GRANT ALL ON FUNCTION public.portal_verify_session_readonly(TEXT) TO authenticated;
GRANT ALL ON FUNCTION public.portal_verify_session_readonly(TEXT) TO service_role;
