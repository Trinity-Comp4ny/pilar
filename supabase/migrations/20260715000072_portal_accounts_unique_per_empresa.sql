-- Portal do cliente: email único POR EMPRESA (não global).
--
-- Antes (008): cliente_portal_accounts.email tinha UNIQUE(email) global, então um
-- mesmo email só podia existir em UMA empresa. Isso vaza tenancy: se a empresa A já
-- cadastrou joao@acme.com, a empresa B não conseguia dar acesso ao mesmo cliente.
--
-- Agora: UNIQUE(empresa_id, email). Como o portal_login só recebe email + senha
-- (sem seletor de empresa), ele passa a desambiguar pela senha: entre as contas com
-- o mesmo email, entra na primeira conta ativa cuja senha confere. Mensagem genérica
-- mantém a proteção contra user enumeration.

-- ==============================================================================
-- 1. Troca a UNIQUE global de email por UNIQUE(empresa_id, email)
-- ==============================================================================
-- A UNIQUE global era mais restritiva, então nenhum par (empresa_id, email)
-- duplicado existe hoje: a troca não pode violar a nova constraint.
ALTER TABLE public.cliente_portal_accounts
  DROP CONSTRAINT IF EXISTS cliente_portal_accounts_email_key;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cliente_portal_accounts_empresa_email_key'
  ) THEN
    ALTER TABLE public.cliente_portal_accounts
      ADD CONSTRAINT cliente_portal_accounts_empresa_email_key UNIQUE (empresa_id, email);
  END IF;
END $$;

-- ==============================================================================
-- 2. portal_login desambigua por senha (email pode repetir entre empresas)
-- ==============================================================================
-- Preserva o que as migrations anteriores já corrigiram: rate limit por email
-- (017), token hasheado SHA256 com TTL 7 dias (015) e mensagem genérica sem
-- user enumeration (20260513000002). Assinatura idêntica: CREATE OR REPLACE
-- mantém as grants existentes.
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
  v_id UUID;
  v_cliente_id UUID;
  v_empresa_id UUID;
  v_nome TEXT;
  v_email TEXT;
  v_token_plain TEXT;
  v_token_hash TEXT;
BEGIN
  v_email_norm := lower(trim(p_email));

  v_allowed := public.check_rate_limit('portal_login', v_email_norm, 5, 900);
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Muitas tentativas. Aguarde 15 minutos e tente novamente.';
  END IF;

  -- Email é único por empresa (não global): pode haver mais de uma conta com o
  -- mesmo email em empresas diferentes. Entra na primeira conta ativa cuja senha
  -- confere. Falha silenciosa e genérica evita enumeration de conta/empresa.
  FOR v_rec IN
    SELECT id, cliente_id, empresa_id, nome, email, senha_hash, ativo
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
    'email', v_email
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.portal_login(TEXT, TEXT) TO anon, authenticated;
