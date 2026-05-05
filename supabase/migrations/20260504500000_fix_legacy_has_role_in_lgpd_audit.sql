-- Fix: as migrations 20260504320000 (audit_logs_retention) e 20260504400000
-- (data_deletion_requests) usaram has_role() legado. Trocar por current_effective_role().

-- =============================================
-- audit_logs_archive (administrativo: admin lê archive da empresa)
-- =============================================
DROP POLICY IF EXISTS "audit_logs_archive_admin_read" ON public.audit_logs_archive;

CREATE POLICY "audit_logs_archive_admin_read" ON public.audit_logs_archive
  FOR SELECT
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.current_effective_role() IN ('admin', 'ultra_admin')
  );

-- =============================================
-- data_deletion_requests (administrativo: admin gere pedidos da empresa)
-- =============================================
DROP POLICY IF EXISTS "ddr_admin_read" ON public.data_deletion_requests;

CREATE POLICY "ddr_admin_read" ON public.data_deletion_requests
  FOR SELECT
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.current_effective_role() IN ('admin', 'ultra_admin')
  );

DROP POLICY IF EXISTS "ddr_admin_update" ON public.data_deletion_requests;

CREATE POLICY "ddr_admin_update" ON public.data_deletion_requests
  FOR UPDATE
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.current_effective_role() IN ('admin', 'ultra_admin')
  )
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.current_effective_role() IN ('admin', 'ultra_admin')
  );
