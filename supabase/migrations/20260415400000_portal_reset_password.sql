-- ==============================================================================
-- Adiciona coluna senha (texto puro) na tabela cliente_portal_accounts
-- para permitir que o admin visualize as credenciais a qualquer momento.
-- ==============================================================================

-- 1. Adiciona coluna senha (plain text)
ALTER TABLE public.cliente_portal_accounts ADD COLUMN IF NOT EXISTS senha TEXT;

-- 2. Atualiza RPC para salvar a senha em plain text junto com o hash
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
