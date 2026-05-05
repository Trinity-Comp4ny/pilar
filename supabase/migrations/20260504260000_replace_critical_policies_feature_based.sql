-- Substitui a migration 20260504240000 (que usava roles legados 'financeiro'/'operacional').
-- Pattern correto: feature-based via user_has_feature(), com ultra_admin bypass embutido.
--
-- Convenção definitiva:
--   Operações operacionais (módulos)       → user_has_feature(feature, 'editor')
--   Operações administrativas (gerir empresa) → role IN ('admin','ultra_admin')
--   Operações de plataforma (cross-empresa)   → role = 'ultra_admin'

-- =============================================
-- alertas: alertas de financeiro → feature 'financeiro'
-- =============================================
DROP POLICY IF EXISTS "Alertas Delete Admin" ON public.alertas;
CREATE POLICY "Alertas Delete" ON public.alertas
  FOR DELETE
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('financeiro', 'editor')
  );

DROP POLICY IF EXISTS "Alertas Insert Admin" ON public.alertas;
CREATE POLICY "Alertas Insert" ON public.alertas
  FOR INSERT
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('financeiro', 'editor')
  );

-- =============================================
-- cliente_portal_accounts → feature 'portal_cliente'
-- =============================================
DROP POLICY IF EXISTS "ClientePortal Admin/Op" ON public.cliente_portal_accounts;
CREATE POLICY "ClientePortal Manage" ON public.cliente_portal_accounts
  FOR ALL
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('portal_cliente', 'editor')
  )
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('portal_cliente', 'editor')
  );

-- =============================================
-- faturas → feature 'financeiro'
-- =============================================
DROP POLICY IF EXISTS "faturas_delete" ON public.faturas;
CREATE POLICY "faturas_delete" ON public.faturas
  FOR DELETE
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('financeiro', 'editor')
  );

DROP POLICY IF EXISTS "faturas_insert" ON public.faturas;
CREATE POLICY "faturas_insert" ON public.faturas
  FOR INSERT
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('financeiro', 'editor')
  );

DROP POLICY IF EXISTS "faturas_update" ON public.faturas;
CREATE POLICY "faturas_update" ON public.faturas
  FOR UPDATE
  USING (
    empresa_id = public.get_user_empresa_id()
    AND deleted_at IS NULL
    AND public.user_has_feature('financeiro', 'editor')
  )
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('financeiro', 'editor')
  );
