-- Migration 008: Portal do Cliente
-- Consolidação de: fase3_vertical_features (portal), cliente_portal_auth, cliente_portal_custom_auth, fix_portal_pgcrypto, portal_reset_password

-- ==============================================================================
-- 0. EXTENSÃO pgcrypto
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ==============================================================================
-- 1. TABELA: portal_tokens
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.portal_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  email_cliente TEXT,
  ativo BOOLEAN DEFAULT true,
  ultimo_acesso TIMESTAMP WITH TIME ZONE,
  expira_em TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portal_tokens_token ON public.portal_tokens(token);
CREATE INDEX IF NOT EXISTS idx_portal_tokens_projeto ON public.portal_tokens(projeto_id);

ALTER TABLE public.portal_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "PortalTokens Full Admin" ON public.portal_tokens;
CREATE POLICY "PortalTokens Full Admin" ON public.portal_tokens
  FOR ALL USING (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'operacional'))
  WITH CHECK (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'operacional'));

-- ==============================================================================
-- 2. TABELA: portal_entregas
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.portal_entregas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT CHECK (tipo IN ('documento', 'aprovacao', 'informacao')),
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'revisao_solicitada')),
  resposta_cliente TEXT,
  respondido_em TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portal_entregas_projeto ON public.portal_entregas(projeto_id);

ALTER TABLE public.portal_entregas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "PortalEntregas Full Admin/Op" ON public.portal_entregas;
CREATE POLICY "PortalEntregas Full Admin/Op" ON public.portal_entregas
  FOR ALL USING (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'operacional'))
  WITH CHECK (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'operacional'));

-- ==============================================================================
-- 3. TABELA: cliente_portal_accounts (auth próprio, sem auth.users)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.cliente_portal_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT,
  senha_hash TEXT,
  senha TEXT,
  token_sessao TEXT,
  token_expira_em TIMESTAMPTZ,
  ativo BOOLEAN DEFAULT true,
  ultimo_acesso TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(cliente_id, empresa_id)
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cliente_portal_accounts_email_key') THEN
    ALTER TABLE public.cliente_portal_accounts ADD CONSTRAINT cliente_portal_accounts_email_key UNIQUE(email);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cliente_portal_accounts_email ON public.cliente_portal_accounts(email);
CREATE INDEX IF NOT EXISTS idx_cliente_portal_accounts_token ON public.cliente_portal_accounts(token_sessao);
CREATE INDEX IF NOT EXISTS idx_cliente_portal_accounts_cliente ON public.cliente_portal_accounts(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cliente_portal_accounts_empresa ON public.cliente_portal_accounts(empresa_id);

ALTER TABLE public.cliente_portal_accounts ENABLE ROW LEVEL SECURITY;

-- RLS: Admin/operacional gerencia contas de portal
DROP POLICY IF EXISTS "ClientePortal Admin/Op" ON public.cliente_portal_accounts;
CREATE POLICY "ClientePortal Admin/Op" ON public.cliente_portal_accounts
  FOR ALL USING (
    empresa_id = public.get_user_empresa_id()
    AND public.has_role('admin', 'operacional')
  )
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.has_role('admin', 'operacional')
  );

-- ==============================================================================
-- 4. RPC: verify_portal_token (fase3)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.verify_portal_token(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'projeto_id', pt.projeto_id,
    'cliente_id', pt.cliente_id,
    'empresa_id', pt.empresa_id,
    'projeto_nome', p.nome,
    'projeto_status', p.status,
    'projeto_codigo', p.codigo_projeto,
    'cliente_nome', c.nome,
    'empresa_nome', e.nome
  ) INTO result
  FROM portal_tokens pt
  JOIN projetos p ON p.id = pt.projeto_id
  JOIN clientes c ON c.id = pt.cliente_id
  JOIN empresas e ON e.id = pt.empresa_id
  WHERE pt.token = p_token
    AND pt.ativo = true
    AND (pt.expira_em IS NULL OR pt.expira_em > NOW());

  IF result IS NULL THEN
    RAISE EXCEPTION 'Token inválido ou expirado';
  END IF;

  -- Atualiza último acesso
  UPDATE portal_tokens SET ultimo_acesso = NOW() WHERE token = p_token;

  RETURN result;
END;
$$;

-- ==============================================================================
-- 5. RPC: portal_login (fix_portal_pgcrypto — search_path = public, extensions)
-- ==============================================================================
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

-- ==============================================================================
-- 6. RPC: portal_verify_session (custom auth)
-- ==============================================================================
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

-- ==============================================================================
-- 7. RPC: _portal_create_account (portal_reset_password — com senha plain text)
-- ==============================================================================
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
  INSERT INTO cliente_portal_accounts (cliente_id, empresa_id, nome, email, senha_hash, senha, created_by)
  VALUES (p_cliente_id, p_empresa_id, p_nome, p_email, crypt(p_senha, gen_salt('bf')), p_senha, p_created_by);
END;
$$;

-- ==============================================================================
-- 8. RPC: get_cliente_projetos (token-based, custom auth)
-- ==============================================================================
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

-- ==============================================================================
-- 9. RPC: get_cliente_projeto_detail (token-based, custom auth)
-- ==============================================================================
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
