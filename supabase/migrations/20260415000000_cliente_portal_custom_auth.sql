-- ==============================================================================
-- PORTAL DO CLIENTE — REFATORAÇÃO: AUTH PRÓPRIO (sem Supabase Auth)
-- Remove dependência de auth.users, implementa login com email+senha próprio
-- ==============================================================================

-- 1. Remove policies que dependem de auth_user_id ANTES de dropar a coluna
DROP POLICY IF EXISTS "ClientePortal Self Read" ON public.cliente_portal_accounts;
DROP POLICY IF EXISTS "Receitas ClientePortal Read" ON public.receitas;
DROP POLICY IF EXISTS "PortalEntregas ClientePortal Read" ON public.portal_entregas;
DROP POLICY IF EXISTS "PortalEntregas ClientePortal Update" ON public.portal_entregas;

-- 2. Limpa dados e remove coluna auth_user_id
ALTER TABLE public.cliente_portal_accounts DROP CONSTRAINT IF EXISTS cliente_portal_accounts_auth_user_id_fkey;
ALTER TABLE public.cliente_portal_accounts DROP CONSTRAINT IF EXISTS cliente_portal_accounts_auth_user_id_key;
DROP INDEX IF EXISTS idx_cliente_portal_accounts_auth;
ALTER TABLE public.cliente_portal_accounts DROP COLUMN IF EXISTS auth_user_id;

-- 3. Adiciona campos de auth próprio
ALTER TABLE public.cliente_portal_accounts ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.cliente_portal_accounts ADD COLUMN IF NOT EXISTS senha_hash TEXT;
ALTER TABLE public.cliente_portal_accounts ADD COLUMN IF NOT EXISTS token_sessao TEXT;
ALTER TABLE public.cliente_portal_accounts ADD COLUMN IF NOT EXISTS token_expira_em TIMESTAMPTZ;

-- Unique constraints
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cliente_portal_accounts_email_key') THEN
    ALTER TABLE public.cliente_portal_accounts ADD CONSTRAINT cliente_portal_accounts_email_key UNIQUE(email);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cliente_portal_accounts_email ON public.cliente_portal_accounts(email);
CREATE INDEX IF NOT EXISTS idx_cliente_portal_accounts_token ON public.cliente_portal_accounts(token_sessao);

-- 5. RPC: Login do portal
CREATE OR REPLACE FUNCTION public.portal_login(p_email TEXT, p_senha TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- 5. RPC: Verificar sessão
CREATE OR REPLACE FUNCTION public.portal_verify_session(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account RECORD;
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RETURN NULL;
  END IF;

  SELECT id, cliente_id, empresa_id, nome, email
  INTO v_account
  FROM cliente_portal_accounts
  WHERE token_sessao = p_token
    AND token_expira_em > NOW()
    AND ativo = true;

  IF v_account IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN json_build_object(
    'id', v_account.id,
    'cliente_id', v_account.cliente_id,
    'empresa_id', v_account.empresa_id,
    'nome', v_account.nome,
    'email', v_account.email
  );
END;
$$;

-- 6. Reescreve get_cliente_projetos com token
CREATE OR REPLACE FUNCTION public.get_cliente_projetos(p_token TEXT DEFAULT NULL)
RETURNS SETOF JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id UUID;
  v_empresa_id UUID;
BEGIN
  -- Valida sessão via token
  SELECT cpa.cliente_id, cpa.empresa_id
  INTO v_cliente_id, v_empresa_id
  FROM cliente_portal_accounts cpa
  WHERE cpa.token_sessao = p_token
    AND cpa.token_expira_em > NOW()
    AND cpa.ativo = true;

  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida';
  END IF;

  RETURN QUERY
  SELECT json_build_object(
    'projeto_id', p.id,
    'projeto_nome', p.nome,
    'projeto_codigo', p.codigo_projeto,
    'projeto_status', p.status,
    'data_inicio', p.data_inicio,
    'data_previsao', p.data_previsao,
    'valor_contrato', p.valor_contrato,
    'disciplinas', p.disciplinas,
    'empresa_nome', e.nome
  )
  FROM projetos p
  JOIN empresas e ON e.id = p.empresa_id
  WHERE p.cliente_id = v_cliente_id
    AND p.empresa_id = v_empresa_id
    AND p.deleted_at IS NULL
  ORDER BY
    CASE p.status
      WHEN 'Em andamento' THEN 1
      WHEN 'Revisão' THEN 2
      WHEN 'Planejamento' THEN 3
      WHEN 'Paralisado' THEN 4
      WHEN 'Concluído' THEN 5
      WHEN 'Cancelado' THEN 6
    END,
    p.created_at DESC;
END;
$$;

-- 7. Reescreve get_cliente_projeto_detail com token
CREATE OR REPLACE FUNCTION public.get_cliente_projeto_detail(p_projeto_id UUID, p_token TEXT DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id UUID;
  v_empresa_id UUID;
  result JSON;
BEGIN
  SELECT cpa.cliente_id, cpa.empresa_id
  INTO v_cliente_id, v_empresa_id
  FROM cliente_portal_accounts cpa
  WHERE cpa.token_sessao = p_token
    AND cpa.token_expira_em > NOW()
    AND cpa.ativo = true;

  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida';
  END IF;

  SELECT json_build_object(
    'projeto_id', p.id,
    'cliente_id', p.cliente_id,
    'empresa_id', p.empresa_id,
    'projeto_nome', p.nome,
    'projeto_status', p.status,
    'projeto_codigo', p.codigo_projeto,
    'data_inicio', p.data_inicio,
    'data_previsao', p.data_previsao,
    'data_final', p.data_final,
    'valor_contrato', p.valor_contrato,
    'disciplinas', p.disciplinas,
    'cliente_nome', c.nome,
    'empresa_nome', e.nome
  ) INTO result
  FROM projetos p
  JOIN clientes c ON c.id = p.cliente_id
  JOIN empresas e ON e.id = p.empresa_id
  WHERE p.id = p_projeto_id
    AND p.cliente_id = v_cliente_id
    AND p.empresa_id = v_empresa_id
    AND p.deleted_at IS NULL;

  IF result IS NULL THEN
    RAISE EXCEPTION 'Projeto não encontrado';
  END IF;

  RETURN result;
END;
$$;

-- 8. RPC helper para insert com hash (usada pela edge function)
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
SET search_path = public
AS $$
BEGIN
  INSERT INTO cliente_portal_accounts (cliente_id, empresa_id, nome, email, senha_hash, created_by)
  VALUES (p_cliente_id, p_empresa_id, p_nome, p_email, crypt(p_senha, gen_salt('bf')), p_created_by);
END;
$$;
