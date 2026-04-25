-- Migration 019: Audit Log
-- Tabela central + trigger genérico em tabelas sensíveis.
-- Registra quem (actor_id), quando, qual ação (INSERT/UPDATE/DELETE),
-- qual registro (target_table, target_id), e diff (old_data, new_data).

-- =============================================
-- 1. Tabela audit_logs
-- =============================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_empresa_created
  ON public.audit_logs (empresa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor
  ON public.audit_logs (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target
  ON public.audit_logs (target_table, target_id);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Somente admin lê; ninguém edita (triggers usam SECURITY DEFINER)
DROP POLICY IF EXISTS "audit_logs_admin_read" ON public.audit_logs;
CREATE POLICY "audit_logs_admin_read" ON public.audit_logs
  FOR SELECT
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.has_role('admin')
  );

-- =============================================
-- 2. Helper: calcular diff entre old e new
-- =============================================

CREATE OR REPLACE FUNCTION public.jsonb_diff(old_data JSONB, new_data JSONB)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  result JSONB := '{}'::JSONB;
  key TEXT;
BEGIN
  IF old_data IS NULL THEN
    RETURN new_data;
  END IF;
  IF new_data IS NULL THEN
    RETURN old_data;
  END IF;

  FOR key IN SELECT jsonb_object_keys(new_data) UNION SELECT jsonb_object_keys(old_data) LOOP
    IF old_data->key IS DISTINCT FROM new_data->key THEN
      result := result || jsonb_build_object(
        key,
        jsonb_build_object('old', old_data->key, 'new', new_data->key)
      );
    END IF;
  END LOOP;

  RETURN result;
END;
$$;

-- =============================================
-- 3. Trigger genérico
-- =============================================

CREATE OR REPLACE FUNCTION public.audit_log_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id UUID;
  v_target_id UUID;
  v_old JSONB;
  v_new JSONB;
  v_actor_email TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
    v_new := NULL;
    v_target_id := (OLD.id)::UUID;
    v_empresa_id := CASE
      WHEN v_old ? 'empresa_id' THEN (v_old->>'empresa_id')::UUID
      ELSE NULL
    END;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_target_id := (NEW.id)::UUID;
    v_empresa_id := CASE
      WHEN v_new ? 'empresa_id' THEN (v_new->>'empresa_id')::UUID
      ELSE NULL
    END;
  ELSE -- INSERT
    v_old := NULL;
    v_new := to_jsonb(NEW);
    v_target_id := (NEW.id)::UUID;
    v_empresa_id := CASE
      WHEN v_new ? 'empresa_id' THEN (v_new->>'empresa_id')::UUID
      ELSE NULL
    END;
  END IF;

  -- Remove campos ruidosos do diff
  IF v_old IS NOT NULL THEN
    v_old := v_old - 'updated_at' - 'created_at';
  END IF;
  IF v_new IS NOT NULL THEN
    v_new := v_new - 'updated_at' - 'created_at';
  END IF;

  -- Captura email do actor (best-effort)
  BEGIN
    SELECT email INTO v_actor_email FROM public.profiles WHERE id = auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_actor_email := NULL;
  END;

  INSERT INTO public.audit_logs (
    empresa_id, actor_id, actor_email, action,
    target_table, target_id, old_data, new_data, diff
  ) VALUES (
    v_empresa_id,
    auth.uid(),
    v_actor_email,
    TG_OP,
    TG_TABLE_NAME,
    v_target_id,
    v_old,
    v_new,
    CASE WHEN TG_OP = 'UPDATE' THEN public.jsonb_diff(v_old, v_new) ELSE NULL END
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- =============================================
-- 4. Attach trigger em tabelas sensíveis
-- =============================================

DO $$
DECLARE
  sensitive_tables TEXT[] := ARRAY[
    'clientes', 'fornecedores', 'projetos',
    'receitas', 'despesas', 'contas', 'cartoes_credito',
    'marcos_faturamento', 'propostas', 'leads',
    'asaas_config', 'profiles', 'empresas',
    'cliente_portal_accounts', 'portal_tokens', 'convites'
  ];
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY sensitive_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS tr_audit_%I ON public.%I', tbl, tbl);
      EXECUTE format('CREATE TRIGGER tr_audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger()', tbl, tbl);
    END IF;
  END LOOP;
END $$;

-- =============================================
-- 5. Mask campos sensíveis no diff (PII/secrets)
-- =============================================

CREATE OR REPLACE FUNCTION public.audit_log_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id UUID;
  v_target_id UUID;
  v_old JSONB;
  v_new JSONB;
  v_actor_email TEXT;
  masked_fields TEXT[] := ARRAY['senha_hash', 'api_key', 'webhook_token', 'token', 'token_sessao', 'token_hash'];
  field TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
    v_new := NULL;
    v_target_id := (OLD.id)::UUID;
    v_empresa_id := CASE WHEN v_old ? 'empresa_id' THEN (v_old->>'empresa_id')::UUID ELSE NULL END;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_target_id := (NEW.id)::UUID;
    v_empresa_id := CASE WHEN v_new ? 'empresa_id' THEN (v_new->>'empresa_id')::UUID ELSE NULL END;
  ELSE
    v_old := NULL;
    v_new := to_jsonb(NEW);
    v_target_id := (NEW.id)::UUID;
    v_empresa_id := CASE WHEN v_new ? 'empresa_id' THEN (v_new->>'empresa_id')::UUID ELSE NULL END;
  END IF;

  IF v_old IS NOT NULL THEN
    v_old := v_old - 'updated_at' - 'created_at';
  END IF;
  IF v_new IS NOT NULL THEN
    v_new := v_new - 'updated_at' - 'created_at';
  END IF;

  -- Mascarar campos sensíveis
  FOREACH field IN ARRAY masked_fields LOOP
    IF v_old IS NOT NULL AND v_old ? field THEN
      v_old := jsonb_set(v_old, ARRAY[field], to_jsonb('***'::TEXT));
    END IF;
    IF v_new IS NOT NULL AND v_new ? field THEN
      v_new := jsonb_set(v_new, ARRAY[field], to_jsonb('***'::TEXT));
    END IF;
  END LOOP;

  BEGIN
    SELECT email INTO v_actor_email FROM public.profiles WHERE id = auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_actor_email := NULL;
  END;

  INSERT INTO public.audit_logs (
    empresa_id, actor_id, actor_email, action,
    target_table, target_id, old_data, new_data, diff
  ) VALUES (
    v_empresa_id, auth.uid(), v_actor_email, TG_OP,
    TG_TABLE_NAME, v_target_id, v_old, v_new,
    CASE WHEN TG_OP = 'UPDATE' THEN public.jsonb_diff(v_old, v_new) ELSE NULL END
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

-- =============================================
-- 6. Retention: auto-delete audit logs > 365 dias (housekeeping)
-- =============================================

CREATE OR REPLACE FUNCTION public.audit_log_cleanup()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM public.audit_logs
  WHERE created_at < NOW() - INTERVAL '365 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.audit_log_cleanup() FROM PUBLIC, anon, authenticated;
