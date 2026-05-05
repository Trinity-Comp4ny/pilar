-- Lote: módulo financeiro — todas as policies viram feature-based.
-- Tabelas: receitas, despesas, contas, cartoes, fornecedores, categorias_financeiras, marcos_faturamento.
--
-- Convenção:
--   SELECT (read-only) → user_has_feature('financeiro', 'viewer')
--   INSERT/UPDATE/DELETE (write) → user_has_feature('financeiro', 'editor')
--
-- Soft-delete (deleted_at IS NULL) preservado em todas as tabelas que têm.

-- =============================================
-- RECEITAS
-- =============================================
DROP POLICY IF EXISTS "Receitas Read Only" ON public.receitas;
DROP POLICY IF EXISTS "Receitas Full Access" ON public.receitas;

CREATE POLICY "receitas_select" ON public.receitas
  FOR SELECT
  USING (
    empresa_id = public.get_user_empresa_id()
    AND deleted_at IS NULL
    AND public.user_has_feature('financeiro', 'viewer')
  );

CREATE POLICY "receitas_write" ON public.receitas
  FOR ALL
  USING (
    empresa_id = public.get_user_empresa_id()
    AND deleted_at IS NULL
    AND public.user_has_feature('financeiro', 'editor')
  )
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('financeiro', 'editor')
  );

-- =============================================
-- DESPESAS
-- =============================================
DROP POLICY IF EXISTS "Despesas Read Only" ON public.despesas;
DROP POLICY IF EXISTS "Despesas Full Access" ON public.despesas;

CREATE POLICY "despesas_select" ON public.despesas
  FOR SELECT
  USING (
    empresa_id = public.get_user_empresa_id()
    AND deleted_at IS NULL
    AND public.user_has_feature('financeiro', 'viewer')
  );

CREATE POLICY "despesas_write" ON public.despesas
  FOR ALL
  USING (
    empresa_id = public.get_user_empresa_id()
    AND deleted_at IS NULL
    AND public.user_has_feature('financeiro', 'editor')
  )
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('financeiro', 'editor')
  );

-- =============================================
-- CONTAS
-- =============================================
DROP POLICY IF EXISTS "Contas Read Only" ON public.contas;
DROP POLICY IF EXISTS "Contas Full Access" ON public.contas;

CREATE POLICY "contas_select" ON public.contas
  FOR SELECT
  USING (
    empresa_id = public.get_user_empresa_id()
    AND deleted_at IS NULL
    AND public.user_has_feature('financeiro', 'viewer')
  );

CREATE POLICY "contas_write" ON public.contas
  FOR ALL
  USING (
    empresa_id = public.get_user_empresa_id()
    AND deleted_at IS NULL
    AND public.user_has_feature('financeiro', 'editor')
  )
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('financeiro', 'editor')
  );

-- =============================================
-- CARTOES (cartoes_credito legacy alias)
-- =============================================
DROP POLICY IF EXISTS "Cartoes Read Only" ON public.cartoes;
DROP POLICY IF EXISTS "Cartoes Full Access" ON public.cartoes;

CREATE POLICY "cartoes_select" ON public.cartoes
  FOR SELECT
  USING (
    empresa_id = public.get_user_empresa_id()
    AND deleted_at IS NULL
    AND public.user_has_feature('financeiro', 'viewer')
  );

CREATE POLICY "cartoes_write" ON public.cartoes
  FOR ALL
  USING (
    empresa_id = public.get_user_empresa_id()
    AND deleted_at IS NULL
    AND public.user_has_feature('financeiro', 'editor')
  )
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('financeiro', 'editor')
  );

-- =============================================
-- FORNECEDORES
-- =============================================
DROP POLICY IF EXISTS "Fornecedores Read Only" ON public.fornecedores;
DROP POLICY IF EXISTS "Fornecedores Full Access" ON public.fornecedores;

CREATE POLICY "fornecedores_select" ON public.fornecedores
  FOR SELECT
  USING (
    empresa_id = public.get_user_empresa_id()
    AND deleted_at IS NULL
    AND public.user_has_feature('financeiro', 'viewer')
  );

CREATE POLICY "fornecedores_write" ON public.fornecedores
  FOR ALL
  USING (
    empresa_id = public.get_user_empresa_id()
    AND deleted_at IS NULL
    AND public.user_has_feature('financeiro', 'editor')
  )
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('financeiro', 'editor')
  );

-- =============================================
-- CATEGORIAS_FINANCEIRAS
-- =============================================
DROP POLICY IF EXISTS "Categorias Read Only" ON public.categorias_financeiras;
DROP POLICY IF EXISTS "Categorias Full Access" ON public.categorias_financeiras;
-- Policy duplicada legada (sem role check) também removida — substituída pela feature-based
DROP POLICY IF EXISTS "categorias_financeiras_empresa" ON public.categorias_financeiras;

CREATE POLICY "categorias_financeiras_select" ON public.categorias_financeiras
  FOR SELECT
  USING (
    empresa_id = public.get_user_empresa_id()
    AND deleted_at IS NULL
    AND public.user_has_feature('financeiro', 'viewer')
  );

CREATE POLICY "categorias_financeiras_write" ON public.categorias_financeiras
  FOR ALL
  USING (
    empresa_id = public.get_user_empresa_id()
    AND deleted_at IS NULL
    AND public.user_has_feature('financeiro', 'editor')
  )
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('financeiro', 'editor')
  );

-- =============================================
-- MARCOS_FATURAMENTO
-- =============================================
-- Marcos são parte de projetos mas o controle de faturamento é financeiro.
-- Mantém o gate em 'financeiro' (quem fatura, marca recebido, etc).
DROP POLICY IF EXISTS "Marcos Read Op" ON public.marcos_faturamento;
DROP POLICY IF EXISTS "Marcos Full Admin/Fin" ON public.marcos_faturamento;

CREATE POLICY "marcos_faturamento_select" ON public.marcos_faturamento
  FOR SELECT
  USING (
    empresa_id = public.get_user_empresa_id()
    AND deleted_at IS NULL
    AND public.user_has_feature('financeiro', 'viewer')
  );

CREATE POLICY "marcos_faturamento_write" ON public.marcos_faturamento
  FOR ALL
  USING (
    empresa_id = public.get_user_empresa_id()
    AND deleted_at IS NULL
    AND public.user_has_feature('financeiro', 'editor')
  )
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('financeiro', 'editor')
  );
