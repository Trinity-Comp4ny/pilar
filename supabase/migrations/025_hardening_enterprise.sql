-- Migration 025: Hardening enterprise
-- 1. audit_logs append-only com hash chaining (tamper-proof)
-- 2. Retention 5 anos (LGPD)
-- 3. MFA obrigatório pra todos os roles (não só admin)
-- 4. Rate limit por IP (não só por email)
-- 5. Logout global quando senha muda
-- 6. audit log de downloads portal
-- 7. Alertas críticos — tabela + trigger

-- =============================================
-- 1. audit_logs APPEND-ONLY + hash chaining
-- =============================================

ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS prev_hash TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS row_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_logs_row_hash
  ON public.audit_logs(row_hash);

-- Calcula hash da linha + encadeia com anterior
CREATE OR REPLACE FUNCTION public.audit_log_chain_hash()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_prev_hash TEXT;
  v_payload TEXT;
BEGIN
  SELECT row_hash INTO v_prev_hash
  FROM public.audit_logs
  WHERE created_at < NEW.created_at
  ORDER BY created_at DESC
  LIMIT 1;

  NEW.prev_hash := COALESCE(v_prev_hash, 'GENESIS');

  v_payload := concat_ws('|',
    NEW.id::text,
    COALESCE(NEW.empresa_id::text, ''),
    COALESCE(NEW.actor_id::text, ''),
    NEW.action,
    NEW.target_table,
    COALESCE(NEW.target_id::text, ''),
    COALESCE(NEW.old_data::text, ''),
    COALESCE(NEW.new_data::text, ''),
    NEW.created_at::text,
    NEW.prev_hash
  );

  NEW.row_hash := encode(digest(v_payload, 'sha256'), 'hex');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_audit_chain_hash ON public.audit_logs;
CREATE TRIGGER tr_audit_chain_hash
  BEFORE INSERT ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_chain_hash();

-- Bloqueia UPDATE/DELETE em audit_logs (append-only)
CREATE OR REPLACE FUNCTION public.audit_log_readonly()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs é append-only';
END;
$$;

DROP TRIGGER IF EXISTS tr_audit_no_update ON public.audit_logs;
CREATE TRIGGER tr_audit_no_update
  BEFORE UPDATE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_readonly();

DROP TRIGGER IF EXISTS tr_audit_no_delete ON public.audit_logs;
CREATE TRIGGER tr_audit_no_delete
  BEFORE DELETE ON public.audit_logs
  FOR EACH ROW
  WHEN (current_user NOT IN ('postgres', 'supabase_admin', 'supabase_storage_admin'))
  EXECUTE FUNCTION public.audit_log_readonly();

-- Função pra verificar integridade da cadeia
CREATE OR REPLACE FUNCTION public.audit_log_verify_chain(p_from TIMESTAMPTZ DEFAULT NULL)
RETURNS TABLE(id UUID, tampered BOOLEAN, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_prev_hash TEXT := 'GENESIS';
  r RECORD;
  v_expected TEXT;
BEGIN
  FOR r IN
    SELECT * FROM public.audit_logs
    WHERE created_at >= COALESCE(p_from, NOW() - INTERVAL '30 days')
      AND empresa_id = public.get_user_empresa_id()
    ORDER BY created_at ASC
  LOOP
    v_expected := encode(digest(concat_ws('|',
      r.id::text,
      COALESCE(r.empresa_id::text, ''),
      COALESCE(r.actor_id::text, ''),
      r.action,
      r.target_table,
      COALESCE(r.target_id::text, ''),
      COALESCE(r.old_data::text, ''),
      COALESCE(r.new_data::text, ''),
      r.created_at::text,
      v_prev_hash
    ), 'sha256'), 'hex');

    id := r.id;
    tampered := (r.row_hash != v_expected OR r.prev_hash != v_prev_hash);
    created_at := r.created_at;
    RETURN NEXT;

    v_prev_hash := r.row_hash;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.audit_log_verify_chain(TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.audit_log_verify_chain(TIMESTAMPTZ) TO authenticated;

-- =============================================
-- 2. Retention 5 anos (LGPD)
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
  -- LGPD exige retention mínima de 5 anos para dados financeiros
  DELETE FROM public.audit_logs
  WHERE created_at < NOW() - INTERVAL '5 years';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.audit_log_cleanup() FROM PUBLIC, anon, authenticated;

-- =============================================
-- 3. MFA obrigatório para TODOS os roles
-- =============================================

CREATE OR REPLACE FUNCTION public.admin_mfa_required()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.user_role;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();

  -- TODOS os usuários autenticados precisam MFA (inclui financeiro, operacional, user)
  IF v_role IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN public.has_aal2();
END;
$$;

-- Alias mais claro
CREATE OR REPLACE FUNCTION public.user_mfa_required()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.admin_mfa_required()
$$;

GRANT EXECUTE ON FUNCTION public.user_mfa_required() TO authenticated;

-- =============================================
-- 4. Rate limit por IP (além de por email)
-- =============================================

CREATE OR REPLACE FUNCTION public.guard_login_attempt(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email_norm TEXT;
  v_ip TEXT;
  v_allowed_email BOOLEAN;
  v_allowed_ip BOOLEAN;
BEGIN
  v_email_norm := lower(trim(p_email));

  IF v_email_norm = '' OR v_email_norm !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    RETURN FALSE;
  END IF;

  -- IP via header x-real-ip (Supabase Edge) ou fallback
  v_ip := COALESCE(
    current_setting('request.headers', true)::json->>'x-real-ip',
    current_setting('request.headers', true)::json->>'x-forwarded-for',
    'unknown'
  );

  -- 10 tentativas / 15 min por email
  v_allowed_email := public.check_rate_limit('login_attempt_email', v_email_norm, 10, 900);
  -- 30 tentativas / 15 min por IP (evita ataque com N emails)
  v_allowed_ip := public.check_rate_limit('login_attempt_ip', v_ip, 30, 900);

  RETURN v_allowed_email AND v_allowed_ip;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_login_attempt(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guard_login_attempt(TEXT) TO anon, authenticated;

-- =============================================
-- 5. Alertas críticos — tabela + trigger
-- =============================================

CREATE TABLE IF NOT EXISTS public.critical_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  actor_id UUID,
  actor_email TEXT,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  target_table TEXT,
  target_id UUID,
  message TEXT NOT NULL,
  metadata JSONB,
  notified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_critical_alerts_unnotified
  ON public.critical_alerts(created_at DESC) WHERE notified = FALSE;
CREATE INDEX IF NOT EXISTS idx_critical_alerts_empresa
  ON public.critical_alerts(empresa_id, created_at DESC);

ALTER TABLE public.critical_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "critical_alerts_admin_read" ON public.critical_alerts;
CREATE POLICY "critical_alerts_admin_read" ON public.critical_alerts
  FOR SELECT
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.has_role('admin')
  );

-- Trigger: gera alerta quando ação crítica acontece
CREATE OR REPLACE FUNCTION public.generate_critical_alert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_should_alert BOOLEAN := FALSE;
  v_severity TEXT := 'medium';
  v_message TEXT;
BEGIN
  -- DELETE em tabelas sensíveis
  IF NEW.action = 'DELETE' AND NEW.target_table IN (
    'clientes', 'projetos', 'receitas', 'despesas', 'profiles', 'empresas',
    'cliente_portal_accounts', 'asaas_config'
  ) THEN
    v_should_alert := TRUE;
    v_severity := 'high';
    v_message := format('DELETE em %s (id=%s)', NEW.target_table, COALESCE(NEW.target_id::text, '?'));
  END IF;

  -- UPDATE de role em profiles
  IF NEW.action = 'UPDATE'
     AND NEW.target_table = 'profiles'
     AND (NEW.diff ? 'role') THEN
    v_should_alert := TRUE;
    v_severity := 'critical';
    v_message := format('Role alterado em profile %s', NEW.target_id);
  END IF;

  -- UPDATE em asaas_config
  IF NEW.target_table = 'asaas_config' AND NEW.action IN ('UPDATE', 'INSERT') THEN
    v_should_alert := TRUE;
    v_severity := 'high';
    v_message := format('asaas_config %s', NEW.action);
  END IF;

  -- DELETE em audit_logs (tentativa de tampering — não deve acontecer)
  IF NEW.action = 'DELETE' AND NEW.target_table = 'audit_logs' THEN
    v_should_alert := TRUE;
    v_severity := 'critical';
    v_message := 'TENTATIVA DE DELETE EM AUDIT_LOGS';
  END IF;

  IF v_should_alert THEN
    INSERT INTO public.critical_alerts (
      empresa_id, actor_id, actor_email, alert_type, severity,
      target_table, target_id, message, metadata
    ) VALUES (
      NEW.empresa_id, NEW.actor_id, NEW.actor_email, NEW.action, v_severity,
      NEW.target_table, NEW.target_id, v_message,
      jsonb_build_object('audit_log_id', NEW.id)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_generate_critical_alert ON public.audit_logs;
CREATE TRIGGER tr_generate_critical_alert
  AFTER INSERT ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.generate_critical_alert();

-- =============================================
-- 6. Log de downloads do portal
-- =============================================

CREATE TABLE IF NOT EXISTS public.portal_download_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  entrega_id UUID,
  arquivo_path TEXT,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portal_download_logs_empresa
  ON public.portal_download_logs(empresa_id, created_at DESC);

ALTER TABLE public.portal_download_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "portal_download_logs_admin" ON public.portal_download_logs;
CREATE POLICY "portal_download_logs_admin" ON public.portal_download_logs
  FOR SELECT
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.has_role('admin', 'operacional')
  );

-- Atualiza get_portal_entrega_download_url para logar download
CREATE OR REPLACE FUNCTION public.get_portal_entrega_download_url(
  p_entrega_id UUID,
  p_token TEXT,
  p_expires_in_seconds INTEGER DEFAULT 300
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_account RECORD;
  v_entrega RECORD;
  v_token_hash TEXT;
  v_ip TEXT;
  v_ua TEXT;
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RAISE EXCEPTION 'Sessão inválida';
  END IF;

  v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

  SELECT cliente_id, empresa_id
  INTO v_account
  FROM cliente_portal_accounts
  WHERE token_sessao = v_token_hash
    AND token_expira_em > NOW()
    AND ativo = TRUE;

  IF v_account IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida';
  END IF;

  SELECT pe.empresa_id, pe.projeto_id, pe.arquivo_path, p.cliente_id AS projeto_cliente_id
  INTO v_entrega
  FROM portal_entregas pe
  JOIN projetos p ON p.id = pe.projeto_id
  WHERE pe.id = p_entrega_id;

  IF v_entrega IS NULL OR v_entrega.arquivo_path IS NULL THEN
    RAISE EXCEPTION 'Entrega não encontrada';
  END IF;

  IF v_entrega.projeto_cliente_id != v_account.cliente_id
     OR v_entrega.empresa_id != v_account.empresa_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  -- Log download (best-effort)
  BEGIN
    v_ip := current_setting('request.headers', true)::json->>'x-real-ip';
    v_ua := current_setting('request.headers', true)::json->>'user-agent';

    INSERT INTO public.portal_download_logs (
      empresa_id, cliente_id, entrega_id, arquivo_path, ip, user_agent
    ) VALUES (
      v_entrega.empresa_id, v_account.cliente_id, p_entrega_id, v_entrega.arquivo_path, v_ip, v_ua
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN v_entrega.arquivo_path;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_portal_entrega_download_url(UUID, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_portal_entrega_download_url(UUID, TEXT, INTEGER) TO anon, authenticated;

-- =============================================
-- 7. Logout global quando senha muda
-- Hook: Supabase Auth dispara update em auth.users quando senha muda.
-- Trigger detecta e invalida todas sessões do user.
-- =============================================

CREATE OR REPLACE FUNCTION public.revoke_all_sessions_on_password_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  IF OLD.encrypted_password IS DISTINCT FROM NEW.encrypted_password THEN
    DELETE FROM auth.sessions WHERE user_id = NEW.id;
    DELETE FROM auth.refresh_tokens WHERE user_id = NEW.id::text;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_revoke_sessions_on_pwd_change ON auth.users;
CREATE TRIGGER tr_revoke_sessions_on_pwd_change
  AFTER UPDATE OF encrypted_password ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.revoke_all_sessions_on_password_change();
