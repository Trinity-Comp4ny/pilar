-- Migration: admin_audit_logs
-- Tabela para ações administrativas (convites, ban, features, billing, impersonation).
-- Coexiste com audit_logs (triggers DB de mutações de dados).
-- INSERT somente via service_role (edge functions). SELECT por admin/ultra_admin.

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id     UUID    NOT NULL,
  actor_email  TEXT    NOT NULL,
  actor_role   TEXT    NOT NULL CHECK (actor_role IN ('ultra_admin', 'admin')),
  action       TEXT    NOT NULL,
  category     TEXT    NOT NULL CHECK (category IN ('user', 'empresa', 'member', 'billing', 'impersonation')),
  target_type  TEXT,
  target_id    TEXT,
  target_name  TEXT,
  empresa_id   UUID,
  metadata     JSONB   NOT NULL DEFAULT '{}'::jsonb,
  ip_address   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_empresa
  ON public.admin_audit_logs (empresa_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_actor
  ON public.admin_audit_logs (actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_category
  ON public.admin_audit_logs (category, created_at DESC);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Ultra admin: lê todos os registros cross-empresa
CREATE POLICY "admin_audit_ultra_read"
  ON public.admin_audit_logs
  FOR SELECT
  USING (public.is_ultra_admin());

-- Company admin: lê apenas da sua empresa
CREATE POLICY "admin_audit_company_read"
  ON public.admin_audit_logs
  FOR SELECT
  USING (
    public.is_company_admin()
    AND empresa_id = public.get_user_empresa_id()
  );

-- Nenhum cliente pode inserir/alterar — somente service_role (edge functions)
CREATE POLICY "admin_audit_no_client_write"
  ON public.admin_audit_logs
  FOR INSERT
  WITH CHECK (false);
