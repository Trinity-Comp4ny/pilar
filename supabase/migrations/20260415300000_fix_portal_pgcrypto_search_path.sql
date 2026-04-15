-- ==============================================================================
-- FIX: Portal RPCs não encontram crypt()/gen_salt() do pgcrypto
-- O pgcrypto está instalado no schema "extensions" (padrão Supabase),
-- mas os RPCs usavam SET search_path = public, impedindo acesso às funções.
-- ==============================================================================

-- 1. Fix _portal_create_account: adiciona "extensions" ao search_path
CREATE OR REPLACE FUNCTION public._portal_create_account(
  p_cliente_id UUID,
  p_empresa_id UUID,
  p_nome TEXT,
  p_email TEXT,
  p_senha TEXT,
  p_created_by UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  INSERT INTO cliente_portal_accounts (cliente_id, empresa_id, nome, email, senha_hash, created_by)
  VALUES (p_cliente_id, p_empresa_id, p_nome, p_email, crypt(p_senha, gen_salt('bf')), p_created_by);
END;
$$;

-- 2. Fix portal_login: adiciona "extensions" ao search_path
CREATE OR REPLACE FUNCTION public.portal_login(p_email TEXT, p_senha TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_account RECORD;
  v_token TEXT;
BEGIN
  SELECT id, cliente_id, empresa_id, nome, email, senha_hash, ativo
  INTO v_account
  FROM cliente_portal_accounts
  WHERE email = lower(trim(p_email));

  IF v_account IS NULL THEN
    RAISE EXCEPTION 'Email ou senha inválidos';
  END IF;

  IF NOT v_account.ativo THEN
    RAISE EXCEPTION 'Acesso desativado';
  END IF;

  IF v_account.senha_hash IS NULL OR crypt(p_senha, v_account.senha_hash) != v_account.senha_hash THEN
    RAISE EXCEPTION 'Email ou senha inválidos';
  END IF;

  -- Gera token de sessão
  v_token := encode(gen_random_bytes(32), 'hex');

  -- Atualiza token e último acesso
  UPDATE cliente_portal_accounts
  SET token_sessao = v_token,
      token_expira_em = NOW() + INTERVAL '30 days',
      ultimo_acesso = NOW()
  WHERE id = v_account.id;

  RETURN json_build_object(
    'token', v_token,
    'id', v_account.id,
    'cliente_id', v_account.cliente_id,
    'empresa_id', v_account.empresa_id,
    'nome', v_account.nome,
    'email', v_account.email
  );
END;
$$;
