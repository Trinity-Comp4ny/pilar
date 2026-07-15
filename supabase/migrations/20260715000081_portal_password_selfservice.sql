-- Portal do cliente: troca de senha self-service + reset forcado no 1o acesso,
-- e rate-limit por IP no login (camada extra, sem enfraquecer o limite por email).
--
-- Contexto (auditoria):
--   A) A senha gerada no convite/reset e enviada por email em texto puro, sem troca
--      forcada no 1o acesso e sem tela de trocar senha. Credenciais ficam validas na
--      caixa indefinidamente.
--   B) O rate limit do portal_login e chaveado so por email (5/900s). Um atacante
--      trava a conta de um cliente legitimo esgotando as tentativas (DoS de lockout),
--      e nao ha teto por IP: uma unica origem pode espalhar brute-force por varias
--      contas sem limite global.
--
-- Fixes:
--   A) Coluna must_change_password + RPC portal_change_password + os helpers de
--      convite/reset marcam a senha como temporaria.
--   B) portal_login ganha um teto por IP (30/900s) como camada extra. O limite por
--      email (5/900s) fica intacto. O teto por IP so entra quando o IP e conhecido:
--      se o header nao vier, a camada extra e ignorada (nunca deixa o login pior).

-- ==============================================================================
-- 1. Coluna must_change_password (senha temporaria a trocar no 1o acesso)
-- ==============================================================================
ALTER TABLE public.cliente_portal_accounts
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

-- ==============================================================================
-- 2. _portal_create_account: conta nova nasce com senha temporaria
-- ==============================================================================
-- Assinatura identica: mesma lista de parametros, so acrescenta must_change_password
-- na insercao. CREATE OR REPLACE preserva as grants existentes.
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
  INSERT INTO cliente_portal_accounts (cliente_id, empresa_id, nome, email, senha_hash, created_by, must_change_password)
  VALUES (p_cliente_id, p_empresa_id, p_nome, p_email, crypt(p_senha, gen_salt('bf')), p_created_by, true);
END;
$$;

-- ==============================================================================
-- 3. _portal_reset_password: reset admin volta a exigir troca no proximo acesso
-- ==============================================================================
CREATE OR REPLACE FUNCTION public._portal_reset_password(
  p_account_id UUID,
  p_nova_senha TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  UPDATE cliente_portal_accounts
  SET senha_hash = crypt(p_nova_senha, gen_salt('bf')),
      must_change_password = true,
      token_sessao = NULL,
      token_expira_em = NULL,
      updated_at = NOW()
  WHERE id = p_account_id;
END;
$$;

-- ==============================================================================
-- 4. portal_change_password: troca self-service (cliente logado)
-- ==============================================================================
-- Valida a sessao pelo hash do token (mesmo padrao dos verificadores), confere a
-- senha atual com crypt, exige forca minima (mesma politica do front: 12+ com
-- minuscula, maiuscula, numero e caractere especial) e grava o novo hash. Limpa
-- must_change_password. Mantem o mesmo token de sessao (o proprio cliente esta
-- logado; nao ha necessidade de deslogar). Mensagens genericas onde faz sentido.
DROP FUNCTION IF EXISTS public.portal_change_password(TEXT, TEXT, TEXT);
CREATE FUNCTION public.portal_change_password(
  p_token TEXT,
  p_senha_atual TEXT,
  p_nova_senha TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_token_hash TEXT;
  v_id UUID;
  v_hash TEXT;
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RAISE EXCEPTION 'Sessão inválida';
  END IF;

  v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

  SELECT id, senha_hash
  INTO v_id, v_hash
  FROM cliente_portal_accounts
  WHERE token_sessao = v_token_hash
    AND token_expira_em > NOW()
    AND ativo = true;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida';
  END IF;

  -- Politica de forca (espelha src/lib/passwordPolicy.ts). Caractere especial =
  -- qualquer coisa que nao seja letra nem numero.
  IF length(p_nova_senha) < 12
     OR p_nova_senha !~ '[a-z]'
     OR p_nova_senha !~ '[A-Z]'
     OR p_nova_senha !~ '[0-9]'
     OR p_nova_senha !~ '[^a-zA-Z0-9]' THEN
    RAISE EXCEPTION 'A nova senha não atende à política de segurança.';
  END IF;

  IF v_hash IS NULL OR crypt(p_senha_atual, v_hash) <> v_hash THEN
    RAISE EXCEPTION 'Senha atual incorreta';
  END IF;

  IF crypt(p_nova_senha, v_hash) = v_hash THEN
    RAISE EXCEPTION 'A nova senha deve ser diferente da atual';
  END IF;

  UPDATE cliente_portal_accounts
  SET senha_hash = crypt(p_nova_senha, gen_salt('bf')),
      must_change_password = false,
      updated_at = NOW()
  WHERE id = v_id;

  RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.portal_change_password(TEXT, TEXT, TEXT) TO anon, authenticated;

-- ==============================================================================
-- 5. portal_login: teto por IP (camada extra) + expoe must_change_password
-- ==============================================================================
-- Preserva tudo que ja existia: desambiguacao por senha entre empresas, limite por
-- email 5/900s, token hasheado SHA256 (TTL 7 dias) e mensagem generica sem user
-- enumeration. Acrescenta:
--   - teto por IP 30/900s ANTES do limite por email, so quando o IP e conhecido
--     (se o header nao vier, a camada e ignorada: nunca deixa o login pior);
--   - must_change_password no retorno.
CREATE OR REPLACE FUNCTION public.portal_login(p_email TEXT, p_senha TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_rec RECORD;
  v_email_norm TEXT;
  v_allowed BOOLEAN;
  v_ip TEXT;
  v_id UUID;
  v_cliente_id UUID;
  v_empresa_id UUID;
  v_nome TEXT;
  v_email TEXT;
  v_must_change BOOLEAN;
  v_token_plain TEXT;
  v_token_hash TEXT;
BEGIN
  v_email_norm := lower(trim(p_email));

  -- Teto por IP (camada extra, nao substitui o limite por email). x-forwarded-for
  -- pode vir "client, proxy1, proxy2": pega o primeiro salto. So aplica quando o IP
  -- e conhecido, para nao jogar todo mundo num balde 'unknown' compartilhado.
  v_ip := trim(split_part(
    COALESCE(
      current_setting('request.headers', true)::json->>'x-real-ip',
      current_setting('request.headers', true)::json->>'x-forwarded-for'
    ),
    ',', 1
  ));
  IF v_ip IS NOT NULL AND v_ip <> '' THEN
    IF NOT public.check_rate_limit('portal_login_ip', v_ip, 30, 900) THEN
      RAISE EXCEPTION 'Muitas tentativas. Aguarde 15 minutos e tente novamente.';
    END IF;
  END IF;

  v_allowed := public.check_rate_limit('portal_login', v_email_norm, 5, 900);
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Muitas tentativas. Aguarde 15 minutos e tente novamente.';
  END IF;

  -- Email e unico por empresa (nao global): pode haver mais de uma conta com o
  -- mesmo email em empresas diferentes. Entra na primeira conta ativa cuja senha
  -- confere. Falha silenciosa e generica evita enumeration de conta/empresa.
  FOR v_rec IN
    SELECT id, cliente_id, empresa_id, nome, email, senha_hash, ativo, must_change_password
    FROM cliente_portal_accounts
    WHERE email = v_email_norm
  LOOP
    IF v_rec.ativo
       AND v_rec.senha_hash IS NOT NULL
       AND crypt(p_senha, v_rec.senha_hash) = v_rec.senha_hash THEN
      v_id := v_rec.id;
      v_cliente_id := v_rec.cliente_id;
      v_empresa_id := v_rec.empresa_id;
      v_nome := v_rec.nome;
      v_email := v_rec.email;
      v_must_change := v_rec.must_change_password;
      EXIT;
    END IF;
  END LOOP;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Email ou senha inválidos';
  END IF;

  v_token_plain := encode(gen_random_bytes(32), 'hex');
  v_token_hash := encode(digest(v_token_plain, 'sha256'), 'hex');

  UPDATE cliente_portal_accounts
  SET token_sessao = v_token_hash,
      token_expira_em = NOW() + INTERVAL '7 days',
      ultimo_acesso = NOW()
  WHERE id = v_id;

  RETURN json_build_object(
    'token', v_token_plain,
    'id', v_id,
    'cliente_id', v_cliente_id,
    'empresa_id', v_empresa_id,
    'nome', v_nome,
    'email', v_email,
    'must_change_password', COALESCE(v_must_change, false)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.portal_login(TEXT, TEXT) TO anon, authenticated;

-- ==============================================================================
-- 6. Verificadores de sessao expoem must_change_password (logica de sessao intacta)
-- ==============================================================================
-- Apenas acrescenta o campo no SELECT e no retorno. Rotacao/expiracao inalteradas.
CREATE OR REPLACE FUNCTION public.portal_verify_session(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_account RECORD;
  v_token_hash TEXT;
  v_new_token_plain TEXT;
  v_new_token_hash TEXT;
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RETURN NULL;
  END IF;

  v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

  SELECT id, cliente_id, empresa_id, nome, email, must_change_password
  INTO v_account
  FROM cliente_portal_accounts
  WHERE token_sessao = v_token_hash
    AND token_expira_em > NOW()
    AND ativo = true;

  IF v_account IS NULL THEN
    RETURN NULL;
  END IF;

  -- Rotacao: gera novo token a cada verify bem-sucedido
  v_new_token_plain := encode(gen_random_bytes(32), 'hex');
  v_new_token_hash := encode(digest(v_new_token_plain, 'sha256'), 'hex');

  UPDATE cliente_portal_accounts
  SET token_sessao = v_new_token_hash,
      token_expira_em = NOW() + INTERVAL '7 days',
      ultimo_acesso = NOW()
  WHERE id = v_account.id;

  RETURN json_build_object(
    'id', v_account.id,
    'cliente_id', v_account.cliente_id,
    'empresa_id', v_account.empresa_id,
    'nome', v_account.nome,
    'email', v_account.email,
    'must_change_password', COALESCE(v_account.must_change_password, false),
    'new_token', v_new_token_plain
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.portal_verify_session(TEXT) TO anon, authenticated, service_role;

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

  SELECT id, cliente_id, empresa_id, nome, email, must_change_password
  INTO v_account
  FROM cliente_portal_accounts
  WHERE token_sessao = v_token_hash
    AND token_expira_em > NOW()
    AND ativo = true;

  IF v_account IS NULL THEN
    RETURN NULL;
  END IF;

  -- Expiracao deslizante SEM trocar o token: seguro para chamadas concorrentes.
  UPDATE cliente_portal_accounts
  SET token_expira_em = NOW() + INTERVAL '7 days',
      ultimo_acesso = NOW()
  WHERE id = v_account.id;

  RETURN json_build_object(
    'id', v_account.id,
    'cliente_id', v_account.cliente_id,
    'empresa_id', v_account.empresa_id,
    'nome', v_account.nome,
    'email', v_account.email,
    'must_change_password', COALESCE(v_account.must_change_password, false)
  );
END;
$$;

GRANT ALL ON FUNCTION public.portal_verify_session_readonly(TEXT) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
