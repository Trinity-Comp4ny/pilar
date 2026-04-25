-- Migration 011: Segurança do Portal do Cliente
-- Remove senha plain text, corrige CHECK de alertas, adiciona RPC de reset de senha

-- ==============================================================================
-- 1. REMOVER COLUNA senha (texto plano) de cliente_portal_accounts
-- ==============================================================================

ALTER TABLE public.cliente_portal_accounts DROP COLUMN IF EXISTS senha;

-- ==============================================================================
-- 2. ATUALIZAR _portal_create_account — não salva mais senha em texto plano
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
  INSERT INTO cliente_portal_accounts (cliente_id, empresa_id, nome, email, senha_hash, created_by)
  VALUES (p_cliente_id, p_empresa_id, p_nome, p_email, crypt(p_senha, gen_salt('bf')), p_created_by);
END;
$$;

-- ==============================================================================
-- 3. NOVA RPC: _portal_reset_password — atualiza hash sem expor senha
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
      token_sessao = NULL,
      token_expira_em = NULL,
      updated_at = NOW()
  WHERE id = p_account_id;
END;
$$;

-- ==============================================================================
-- 4. CORRIGIR CHECK CONSTRAINT de alertas.tipo
--    Adiciona tipos usados em rpc_gerar_alertas mas ausentes no constraint
-- ==============================================================================

ALTER TABLE public.alertas DROP CONSTRAINT IF EXISTS alertas_tipo_check;

ALTER TABLE public.alertas ADD CONSTRAINT alertas_tipo_check
  CHECK (tipo IN (
    'horas_excedidas',
    'pagamento_atrasado',
    'superalocacao',
    'margem_baixa',
    'marco_proximo',
    'orcamento_excedido',
    'vencimento_proximo',
    'recebimento_baixo'
  ));
