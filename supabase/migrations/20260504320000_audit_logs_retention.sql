-- Audit logs retention LGPD-aligned (5 anos).
--
-- Contexto: 019_audit_log.sql definia retenção de 365 dias e deletava o resto.
-- LGPD recomenda guardar trilha de auditoria por até 5 anos. Para manter
-- a tabela hot (audit_logs) leve, movemos registros > 1 ano para audit_logs_archive,
-- onde ficam queryable mas fora do hot path. audit_log_cleanup() agora deleta
-- apenas o que passou de 5 anos (1825 dias) — somando hot + archive.

-- =============================================
-- 1. Tabela archive (mesmo schema da hot)
-- =============================================

CREATE TABLE IF NOT EXISTS public.audit_logs_archive (
  id UUID PRIMARY KEY,
  empresa_id UUID,
  actor_id UUID,
  actor_email TEXT,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  target_table TEXT NOT NULL,
  target_id UUID,
  old_data JSONB,
  new_data JSONB,
  diff JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_empresa_created
  ON public.audit_logs_archive (empresa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_actor
  ON public.audit_logs_archive (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_target
  ON public.audit_logs_archive (target_table, target_id);

ALTER TABLE public.audit_logs_archive ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_archive_admin_read" ON public.audit_logs_archive;
CREATE POLICY "audit_logs_archive_admin_read" ON public.audit_logs_archive
  FOR SELECT
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.has_role('admin')
  );

-- =============================================
-- 2. Cleanup: deleta apenas > 5 anos (LGPD ceiling)
-- =============================================

CREATE OR REPLACE FUNCTION public.audit_log_cleanup()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  v_archive_count INTEGER := 0;
BEGIN
  -- Hot tier: > 5 anos sai pra sempre
  DELETE FROM public.audit_logs
  WHERE created_at < NOW() - INTERVAL '1825 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Archive tier: > 5 anos sai pra sempre (caso tenha sobrado)
  DELETE FROM public.audit_logs_archive
  WHERE created_at < NOW() - INTERVAL '1825 days';
  GET DIAGNOSTICS v_archive_count = ROW_COUNT;

  RETURN v_count + v_archive_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.audit_log_cleanup() FROM PUBLIC, anon, authenticated;

-- =============================================
-- 3. Archive: move > 1 ano de hot pra archive
-- =============================================

CREATE OR REPLACE FUNCTION public.audit_logs_archive_old()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH moved AS (
    DELETE FROM public.audit_logs
    WHERE created_at < NOW() - INTERVAL '365 days'
    RETURNING id, empresa_id, actor_id, actor_email, action,
              target_table, target_id, old_data, new_data, diff,
              ip_address, created_at
  )
  INSERT INTO public.audit_logs_archive (
    id, empresa_id, actor_id, actor_email, action,
    target_table, target_id, old_data, new_data, diff,
    ip_address, created_at
  )
  SELECT id, empresa_id, actor_id, actor_email, action,
         target_table, target_id, old_data, new_data, diff,
         ip_address, created_at
  FROM moved
  ON CONFLICT (id) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.audit_logs_archive_old() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.audit_log_cleanup() IS
  'LGPD: remove audit_logs (hot e archive) com mais de 5 anos.';
COMMENT ON FUNCTION public.audit_logs_archive_old() IS
  'LGPD: move audit_logs com mais de 1 ano para audit_logs_archive (mantém queryable).';
COMMENT ON TABLE public.audit_logs_archive IS
  'Cold storage de audit_logs entre 1 e 5 anos. Mesmo schema, RLS admin-only.';
