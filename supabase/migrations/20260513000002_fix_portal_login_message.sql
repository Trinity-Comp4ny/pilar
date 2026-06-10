-- BUG-A9-03: unifica mensagem de erro do portal_login.
-- 'Acesso desativado' expõe que o email existe e está revogado (user enumeration).
-- Tanto conta inexistente quanto revogada devem retornar a mesma mensagem genérica.

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
BEGIN
  SELECT id, cliente_id, empresa_id, nome, email, senha_hash, ativo
  INTO v_account
  FROM cliente_portal_accounts
  WHERE email = lower(trim(p_email));

  IF v_account IS NULL THEN
    RAISE EXCEPTION 'Email ou senha inválidos';
  END IF;

  -- Mesma mensagem genérica para conta desativada (evita user enumeration)
  IF NOT v_account.ativo THEN
    RAISE EXCEPTION 'Email ou senha inválidos';
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
