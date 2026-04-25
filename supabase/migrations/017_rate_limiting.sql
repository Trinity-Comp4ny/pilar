-- Migration 017: Rate limiting em RPCs sensíveis
-- portal_login: 5 tentativas / 15 min por email
-- create_convite: 20 convites / hora por empresa
-- portal reset: 3 resets / hora por cliente
-- Implementação: tabela rate_limit_attempts com janela deslizante.

-- =============================================
-- 1. Tabela de tentativas
-- =============================================

CREATE TABLE IF NOT EXISTS public.rate_limit_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  key TEXT NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_lookup
  ON public.rate_limit_attempts (action, key, attempted_at);

ALTER TABLE public.rate_limit_attempts ENABLE ROW LEVEL SECURITY;

-- Sem policies: apenas service_role / SECURITY DEFINER manipulam

-- =============================================
-- 2. Helper: check_rate_limit
-- =============================================

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_action TEXT,
  p_key TEXT,
  p_max_attempts INTEGER,
  p_window_seconds INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Limpa entradas antigas (housekeeping oportunista)
  DELETE FROM public.rate_limit_attempts
  WHERE attempted_at < NOW() - (p_window_seconds * INTERVAL '1 second' * 10);

  SELECT COUNT(*) INTO v_count
  FROM public.rate_limit_attempts
  WHERE action = p_action
    AND key = p_key
    AND attempted_at > NOW() - (p_window_seconds * INTERVAL '1 second');

  IF v_count >= p_max_attempts THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.rate_limit_attempts (action, key)
  VALUES (p_action, p_key);

  RETURN TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_rate_limit(TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;

-- =============================================
-- 3. portal_login com rate limit (5 / 15 min por email)
-- =============================================

CREATE OR REPLACE FUNCTION public.portal_login(p_email TEXT, p_senha TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_account RECORD;
  v_token_plain TEXT;
  v_token_hash TEXT;
  v_email_norm TEXT;
  v_allowed BOOLEAN;
BEGIN
  v_email_norm := lower(trim(p_email));

  v_allowed := public.check_rate_limit('portal_login', v_email_norm, 5, 900);
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Muitas tentativas. Aguarde 15 minutos e tente novamente.';
  END IF;

  SELECT id, cliente_id, empresa_id, nome, email, senha_hash, ativo
  INTO v_account
  FROM cliente_portal_accounts
  WHERE email = v_email_norm;

  IF v_account IS NULL THEN
    RAISE EXCEPTION 'Email ou senha inválidos';
  END IF;

  IF NOT v_account.ativo THEN
    RAISE EXCEPTION 'Acesso desativado';
  END IF;

  IF v_account.senha_hash IS NULL OR crypt(p_senha, v_account.senha_hash) != v_account.senha_hash THEN
    RAISE EXCEPTION 'Email ou senha inválidos';
  END IF;

  v_token_plain := encode(gen_random_bytes(32), 'hex');
  v_token_hash := encode(digest(v_token_plain, 'sha256'), 'hex');

  UPDATE cliente_portal_accounts
  SET token_sessao = v_token_hash,
      token_expira_em = NOW() + INTERVAL '7 days',
      ultimo_acesso = NOW()
  WHERE id = v_account.id;

  RETURN json_build_object(
    'token', v_token_plain,
    'id', v_account.id,
    'cliente_id', v_account.cliente_id,
    'empresa_id', v_account.empresa_id,
    'nome', v_account.nome,
    'email', v_account.email
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.portal_login(TEXT, TEXT) TO anon, authenticated;

-- =============================================
-- 4. create_convite com rate limit (20 / hora por empresa)
-- =============================================

CREATE OR REPLACE FUNCTION public.create_convite(
  p_email TEXT,
  p_cargo TEXT,
  p_nome TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id UUID;
  v_cargo public.user_role;
  v_token TEXT;
  v_allowed BOOLEAN;
BEGIN
  v_empresa_id := public.get_user_empresa_id();

  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem criar convites';
  END IF;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa';
  END IF;

  v_allowed := public.check_rate_limit('create_convite', v_empresa_id::TEXT, 20, 3600);
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Limite de convites por hora excedido (20). Aguarde.';
  END IF;

  BEGIN
    v_cargo := p_cargo::public.user_role;
  EXCEPTION WHEN OTHERS THEN
    v_cargo := 'user';
  END;

  UPDATE public.convites
  SET usado_em = NOW()
  WHERE email = lower(trim(p_email))
    AND empresa_id = v_empresa_id
    AND usado_em IS NULL;

  INSERT INTO public.convites (empresa_id, email, cargo, nome, criado_por)
  VALUES (v_empresa_id, lower(trim(p_email)), v_cargo, p_nome, auth.uid())
  RETURNING token INTO v_token;

  RETURN v_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_convite(TEXT, TEXT, TEXT) TO authenticated;

-- =============================================
-- 5. _portal_reset_password com rate limit (3 / hora por account)
-- =============================================

CREATE OR REPLACE FUNCTION public._portal_reset_password(
  p_account_id UUID,
  p_nova_senha TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_allowed BOOLEAN;
BEGIN
  v_allowed := public.check_rate_limit('portal_reset', p_account_id::TEXT, 3, 3600);
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Limite de resets de senha excedido. Aguarde 1 hora.';
  END IF;

  UPDATE cliente_portal_accounts
  SET senha_hash = crypt(p_nova_senha, gen_salt('bf')),
      token_sessao = NULL,
      token_expira_em = NULL,
      updated_at = NOW()
  WHERE id = p_account_id;
END;
$$;
