-- Foundation de impersonation server-side.
--
-- Hoje: impersonation existe APENAS em localStorage do cliente. Não há registro
-- autoritativo no servidor. Um XSS pode escalar privilégios manipulando localStorage.
--
-- Esta migration cria a infraestrutura para validação server-side:
--   - Tabela impersonation_sessions (autoritativa)
--   - Helpers SECURITY DEFINER para checar sessão ativa
--   - Auto-expiração em 30min
--
-- IMPORTANTE: esta migration NÃO altera RLS policies existentes (escopo grande).
-- Próximo passo: trocar `has_role()` por `current_effective_role()` nas policies
-- que devem respeitar impersonation. Documentado abaixo.

-- =============================================
-- 1. Tabela impersonation_sessions
-- =============================================

CREATE TABLE IF NOT EXISTS public.impersonation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_role TEXT NOT NULL,
  target_role TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 minutes'),
  ended_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_admin_active
  ON public.impersonation_sessions (admin_id, ended_at, expires_at)
  WHERE ended_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_started
  ON public.impersonation_sessions (started_at DESC);

ALTER TABLE public.impersonation_sessions ENABLE ROW LEVEL SECURITY;

-- Apenas service_role escreve (Edge Function). Admins do mesmo escopo leem o histórico.
DROP POLICY IF EXISTS "impersonation_sessions_admin_read" ON public.impersonation_sessions;
CREATE POLICY "impersonation_sessions_admin_read" ON public.impersonation_sessions
  FOR SELECT
  USING (
    public.has_role('admin')
    AND admin_id = auth.uid()
  );

-- =============================================
-- 2. Helpers
-- =============================================

-- Retorna a sessão ativa do usuário corrente (NULL se nenhuma).
CREATE OR REPLACE FUNCTION public.current_impersonation()
RETURNS public.impersonation_sessions
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.impersonation_sessions
  WHERE admin_id = auth.uid()
    AND ended_at IS NULL
    AND expires_at > NOW()
  ORDER BY started_at DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.current_impersonation() TO authenticated;

-- Retorna TRUE se o usuário corrente está impersonando.
CREATE OR REPLACE FUNCTION public.is_impersonating()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.impersonation_sessions
    WHERE admin_id = auth.uid()
      AND ended_at IS NULL
      AND expires_at > NOW()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_impersonating() TO authenticated;

-- Retorna o role efetivo do usuário corrente:
--   - target_role da sessão ativa, se impersonando
--   - role real do profile, caso contrário
CREATE OR REPLACE FUNCTION public.current_effective_role()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target TEXT;
  v_real TEXT;
BEGIN
  SELECT target_role INTO v_target
  FROM public.impersonation_sessions
  WHERE admin_id = auth.uid()
    AND ended_at IS NULL
    AND expires_at > NOW()
  ORDER BY started_at DESC
  LIMIT 1;

  IF v_target IS NOT NULL THEN
    RETURN v_target;
  END IF;

  SELECT role::TEXT INTO v_real FROM public.profiles WHERE id = auth.uid();
  RETURN v_real;
END;
$$;

GRANT EXECUTE ON FUNCTION public.current_effective_role() TO authenticated;

-- =============================================
-- 3. RPCs para Edge Function gerenciar sessões
-- =============================================

-- Inicia uma sessão. Validação:
--   - Caller deve ser admin ou ultra_admin
--   - target_role não pode ser admin nem ultra_admin (ninguém escala privilégio)
--   - Encerra qualquer sessão prévia ativa do mesmo admin
CREATE OR REPLACE FUNCTION public.start_impersonation(
  p_target_role TEXT,
  p_ip TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_session_id UUID;
BEGIN
  SELECT role::TEXT INTO v_role FROM public.profiles WHERE id = auth.uid();

  -- v_role NULL acontece quando profile não existe (auth.uid() inválido).
  -- `NULL NOT IN (...)` é NULL (não TRUE), então sem este check explícito o IF abaixo
  -- não dispara e o caller passaria com role NULL.
  IF v_role IS NULL OR v_role NOT IN ('admin', 'ultra_admin') THEN
    RAISE EXCEPTION 'Apenas admin ou ultra_admin podem impersonar' USING ERRCODE = '42501';
  END IF;

  IF p_target_role IN ('admin', 'ultra_admin') THEN
    RAISE EXCEPTION 'Impersonation de admin/ultra_admin não permitido' USING ERRCODE = '42501';
  END IF;

  IF p_target_role NOT IN ('user', 'viewer', 'editor', 'operacional', 'financeiro', 'marketing') THEN
    RAISE EXCEPTION 'target_role inválido: %', p_target_role USING ERRCODE = '22023';
  END IF;

  -- Encerra sessões prévias ativas (uma por admin)
  UPDATE public.impersonation_sessions
  SET ended_at = NOW()
  WHERE admin_id = auth.uid()
    AND ended_at IS NULL;

  INSERT INTO public.impersonation_sessions (admin_id, admin_role, target_role, ip_address, user_agent)
  VALUES (auth.uid(), v_role, p_target_role, p_ip, p_user_agent)
  RETURNING id INTO v_session_id;

  RETURN v_session_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_impersonation(TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.stop_impersonation()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.impersonation_sessions
  SET ended_at = NOW()
  WHERE admin_id = auth.uid()
    AND ended_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.stop_impersonation() TO authenticated;

-- =============================================
-- 4. Cleanup automático (housekeeping)
-- =============================================

CREATE OR REPLACE FUNCTION public.impersonation_sessions_cleanup()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Encerra sessões expiradas que ainda não foram explicitamente fechadas
  UPDATE public.impersonation_sessions
  SET ended_at = expires_at
  WHERE ended_at IS NULL
    AND expires_at < NOW();
  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Apaga registros > 90 dias
  DELETE FROM public.impersonation_sessions
  WHERE started_at < NOW() - INTERVAL '90 days';

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.impersonation_sessions_cleanup() FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.impersonation_sessions IS
  'Registro server-side autoritativo de sessões de impersonation. Próximo passo: trocar has_role() por current_effective_role() nas RLS policies que devem respeitar o role efetivo.';
