-- Fix RLS Policies for Receitas and Despesas
-- Current policies are too restrictive - only admin/financeiro can see data
-- This migration allows:
-- - Admin/Financeiro: Full access (read, write, update, delete)
-- - Other roles: Read-only access to their company's financial data

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Financeiro Full Receitas" ON public.receitas;
DROP POLICY IF EXISTS "Financeiro Full Despesas" ON public.despesas;
DROP POLICY IF EXISTS "Financeiro Full Contas" ON public.contas;
DROP POLICY IF EXISTS "Financeiro Full Cartoes" ON public.cartoes_credito;
DROP POLICY IF EXISTS "Financeiro Full Fornecedores" ON public.fornecedores;
DROP POLICY IF EXISTS "Financeiro Full Categorias" ON public.categorias_financeiras;

-- RECEITAS: Admin/Financeiro full access
CREATE POLICY "Receitas Full Access" ON public.receitas
  FOR ALL 
  USING (
    empresa_id = public.get_user_empresa_id() 
    AND public.has_role('admin', 'financeiro') 
    AND deleted_at IS NULL
  ) 
  WITH CHECK (
    empresa_id = public.get_user_empresa_id() 
    AND public.has_role('admin', 'financeiro') 
    AND deleted_at IS NULL
  );

-- RECEITAS: Read-only for other authenticated users
CREATE POLICY "Receitas Read Only" ON public.receitas
  FOR SELECT 
  USING (
    empresa_id = public.get_user_empresa_id() 
    AND deleted_at IS NULL
  );

-- DESPESAS: Admin/Financeiro full access
CREATE POLICY "Despesas Full Access" ON public.despesas
  FOR ALL 
  USING (
    empresa_id = public.get_user_empresa_id() 
    AND public.has_role('admin', 'financeiro') 
    AND deleted_at IS NULL
  ) 
  WITH CHECK (
    empresa_id = public.get_user_empresa_id() 
    AND public.has_role('admin', 'financeiro') 
    AND deleted_at IS NULL
  );

-- DESPESAS: Read-only for other authenticated users
CREATE POLICY "Despesas Read Only" ON public.despesas
  FOR SELECT 
  USING (
    empresa_id = public.get_user_empresa_id() 
    AND deleted_at IS NULL
  );

-- CONTAS: Admin/Financeiro full access
CREATE POLICY "Contas Full Access" ON public.contas
  FOR ALL 
  USING (
    empresa_id = public.get_user_empresa_id() 
    AND public.has_role('admin', 'financeiro') 
    AND deleted_at IS NULL
  ) 
  WITH CHECK (
    empresa_id = public.get_user_empresa_id() 
    AND public.has_role('admin', 'financeiro') 
    AND deleted_at IS NULL
  );

-- CONTAS: Read-only for other authenticated users
CREATE POLICY "Contas Read Only" ON public.contas
  FOR SELECT 
  USING (
    empresa_id = public.get_user_empresa_id() 
    AND deleted_at IS NULL
  );

-- CARTOES: Admin/Financeiro full access
CREATE POLICY "Cartoes Full Access" ON public.cartoes_credito
  FOR ALL 
  USING (
    empresa_id = public.get_user_empresa_id() 
    AND public.has_role('admin', 'financeiro') 
    AND deleted_at IS NULL
  ) 
  WITH CHECK (
    empresa_id = public.get_user_empresa_id() 
    AND public.has_role('admin', 'financeiro') 
    AND deleted_at IS NULL
  );

-- CARTOES: Read-only for other authenticated users
CREATE POLICY "Cartoes Read Only" ON public.cartoes_credito
  FOR SELECT 
  USING (
    empresa_id = public.get_user_empresa_id() 
    AND deleted_at IS NULL
  );

-- FORNECEDORES: Admin/Financeiro full access
CREATE POLICY "Fornecedores Full Access" ON public.fornecedores
  FOR ALL 
  USING (
    empresa_id = public.get_user_empresa_id() 
    AND public.has_role('admin', 'financeiro') 
    AND deleted_at IS NULL
  ) 
  WITH CHECK (
    empresa_id = public.get_user_empresa_id() 
    AND public.has_role('admin', 'financeiro') 
    AND deleted_at IS NULL
  );

-- FORNECEDORES: Read-only for other authenticated users
CREATE POLICY "Fornecedores Read Only" ON public.fornecedores
  FOR SELECT 
  USING (
    empresa_id = public.get_user_empresa_id() 
    AND deleted_at IS NULL
  );

-- CATEGORIAS: Admin/Financeiro full access
CREATE POLICY "Categorias Full Access" ON public.categorias_financeiras
  FOR ALL 
  USING (
    empresa_id = public.get_user_empresa_id() 
    AND public.has_role('admin', 'financeiro')
  ) 
  WITH CHECK (
    empresa_id = public.get_user_empresa_id() 
    AND public.has_role('admin', 'financeiro')
  );

-- CATEGORIAS: Read-only for other authenticated users
CREATE POLICY "Categorias Read Only" ON public.categorias_financeiras
  FOR SELECT 
  USING (
    empresa_id = public.get_user_empresa_id()
  );
