-- Policy-piloto: migrar audit_logs_admin_read para current_effective_role().
--
-- Por que: hoje a policy usa has_role('admin') que ignora sessões de impersonation
-- (sessão é client-only no Pilar legado). Após 20260504220000 (foundation server-side),
-- queremos que admin impersonando user PERCA acesso a tabelas admin-only.
--
-- Comportamento esperado:
--   - admin sem impersonation        → current_effective_role()='admin'        → permite
--   - ultra_admin sem impersonation  → current_effective_role()='ultra_admin'  → permite
--   - admin impersonando user        → current_effective_role()='user'         → BLOQUEIA (novo)
--   - ultra_admin impersonando viewer → current_effective_role()='viewer'      → BLOQUEIA (novo)
--   - user comum                     → current_effective_role()='user'         → bloqueia
--
-- Esta é a primeira policy migrada. Demais policies serão migradas individualmente
-- conforme cobertas por pgTAP.

DROP POLICY IF EXISTS "audit_logs_admin_read" ON public.audit_logs;

CREATE POLICY "audit_logs_admin_read" ON public.audit_logs
  FOR SELECT
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.current_effective_role() IN ('admin', 'ultra_admin')
  );

COMMENT ON POLICY "audit_logs_admin_read" ON public.audit_logs IS
  'Lê audit logs da empresa apenas se role efetivo (considerando impersonation) for admin/ultra_admin.';
