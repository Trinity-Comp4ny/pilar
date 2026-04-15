-- ==============================================================================
-- PORTAL DO CLIENTE — AUTENTICAÇÃO
-- Cria tabela de contas de portal, RPCs e políticas RLS para acesso autenticado
-- ==============================================================================

-- 1. Tabela de contas do portal do cliente
CREATE TABLE IF NOT EXISTS public.cliente_portal_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  ultimo_acesso TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(auth_user_id),
  UNIQUE(cliente_id, empresa_id)
);

-- Adicionar auth_user_id se não existir (tabela pode ter sido criada com schema diferente)
ALTER TABLE public.cliente_portal_accounts ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_cliente_portal_accounts_auth ON public.cliente_portal_accounts(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_cliente_portal_accounts_cliente ON public.cliente_portal_accounts(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cliente_portal_accounts_empresa ON public.cliente_portal_accounts(empresa_id);

ALTER TABLE public.cliente_portal_accounts ENABLE ROW LEVEL SECURITY;

-- 2. RLS: Admin/operacional gerencia contas de portal
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

-- 3. RLS: Cliente autenticado lê sua própria conta
DROP POLICY IF EXISTS "ClientePortal Self Read" ON public.cliente_portal_accounts;
CREATE POLICY "ClientePortal Self Read" ON public.cliente_portal_accounts
  FOR SELECT USING (auth_user_id = auth.uid());

-- 4. RLS: Clientes autenticados podem ler receitas dos seus projetos
DROP POLICY IF EXISTS "Receitas ClientePortal Read" ON public.receitas;
CREATE POLICY "Receitas ClientePortal Read" ON public.receitas
  FOR SELECT USING (
    projeto_id IN (
      SELECT p.id FROM public.projetos p
      JOIN public.cliente_portal_accounts cpa
        ON cpa.cliente_id = p.cliente_id AND cpa.empresa_id = p.empresa_id
      WHERE cpa.auth_user_id = auth.uid() AND cpa.ativo = true
    )
  );

-- 5. RLS: Clientes autenticados podem ler entregas dos seus projetos
DROP POLICY IF EXISTS "PortalEntregas ClientePortal Read" ON public.portal_entregas;
CREATE POLICY "PortalEntregas ClientePortal Read" ON public.portal_entregas
  FOR SELECT USING (
    projeto_id IN (
      SELECT p.id FROM public.projetos p
      JOIN public.cliente_portal_accounts cpa
        ON cpa.cliente_id = p.cliente_id AND cpa.empresa_id = p.empresa_id
      WHERE cpa.auth_user_id = auth.uid() AND cpa.ativo = true
    )
  );

-- 6. RLS: Clientes autenticados podem atualizar entregas (aprovar/solicitar revisão)
DROP POLICY IF EXISTS "PortalEntregas ClientePortal Update" ON public.portal_entregas;
CREATE POLICY "PortalEntregas ClientePortal Update" ON public.portal_entregas
  FOR UPDATE USING (
    projeto_id IN (
      SELECT p.id FROM public.projetos p
      JOIN public.cliente_portal_accounts cpa
        ON cpa.cliente_id = p.cliente_id AND cpa.empresa_id = p.empresa_id
      WHERE cpa.auth_user_id = auth.uid() AND cpa.ativo = true
    )
  )
  WITH CHECK (
    projeto_id IN (
      SELECT p.id FROM public.projetos p
      JOIN public.cliente_portal_accounts cpa
        ON cpa.cliente_id = p.cliente_id AND cpa.empresa_id = p.empresa_id
      WHERE cpa.auth_user_id = auth.uid() AND cpa.ativo = true
    )
  );

-- 7. RPC: Listar projetos do cliente autenticado
CREATE OR REPLACE FUNCTION public.get_cliente_projetos()
RETURNS SETOF JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id UUID;
  v_empresa_id UUID;
BEGIN
  SELECT cpa.cliente_id, cpa.empresa_id
  INTO v_cliente_id, v_empresa_id
  FROM cliente_portal_accounts cpa
  WHERE cpa.auth_user_id = auth.uid() AND cpa.ativo = true;

  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  -- Atualiza último acesso
  UPDATE cliente_portal_accounts
  SET ultimo_acesso = NOW()
  WHERE auth_user_id = auth.uid();

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

-- 8. RPC: Detalhe de um projeto do cliente autenticado
CREATE OR REPLACE FUNCTION public.get_cliente_projeto_detail(p_projeto_id UUID)
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
  WHERE cpa.auth_user_id = auth.uid() AND cpa.ativo = true;

  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Acesso negado';
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
    RAISE EXCEPTION 'Projeto não encontrado ou acesso negado';
  END IF;

  RETURN result;
END;
$$;
