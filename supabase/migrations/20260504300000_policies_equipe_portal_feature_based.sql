-- Lote: equipe + portal.
-- Tabelas: pessoas, metas, portal_entregas.
-- Convenção: SELECT → user_has_feature(<feature>,'viewer'); WRITE → 'editor'.

-- =============================================
-- PESSOAS → feature 'pessoas'
-- =============================================
DROP POLICY IF EXISTS "Pessoas Read" ON public.pessoas;
DROP POLICY IF EXISTS "Pessoas Full" ON public.pessoas;
DROP POLICY IF EXISTS "pessoas_select" ON public.pessoas;
DROP POLICY IF EXISTS "pessoas_write" ON public.pessoas;

CREATE POLICY "pessoas_select" ON public.pessoas
  FOR SELECT
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('pessoas', 'viewer')
  );

CREATE POLICY "pessoas_write" ON public.pessoas
  FOR ALL
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('pessoas', 'editor')
  )
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('pessoas', 'editor')
  );

-- =============================================
-- METAS → feature 'metas'
-- =============================================
DROP POLICY IF EXISTS "metas_empresa" ON public.metas;
DROP POLICY IF EXISTS "Metas read by company" ON public.metas;
DROP POLICY IF EXISTS "Enable write access for admin users" ON public.metas;
DROP POLICY IF EXISTS "Enable update access for admin users" ON public.metas;
DROP POLICY IF EXISTS "Enable delete access for admin users" ON public.metas;
DROP POLICY IF EXISTS "metas_select" ON public.metas;
DROP POLICY IF EXISTS "metas_write" ON public.metas;

CREATE POLICY "metas_select" ON public.metas
  FOR SELECT
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('metas', 'viewer')
  );

CREATE POLICY "metas_write" ON public.metas
  FOR ALL
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('metas', 'editor')
  )
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('metas', 'editor')
  );

-- =============================================
-- PORTAL_ENTREGAS → feature 'portal_cliente' (admin gere arquivos do portal)
-- =============================================
DROP POLICY IF EXISTS "PortalEntregas Full Admin/Op" ON public.portal_entregas;
DROP POLICY IF EXISTS "portal_entregas_manage" ON public.portal_entregas;

CREATE POLICY "portal_entregas_manage" ON public.portal_entregas
  FOR ALL
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('portal_cliente', 'editor')
  )
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('portal_cliente', 'editor')
  );
