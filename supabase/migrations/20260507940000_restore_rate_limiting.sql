-- Restaura infraestrutura de rate limiting removida em 028_sync_remote_changes
-- guard_login_attempt ainda é chamada em Login.tsx

CREATE TABLE IF NOT EXISTS public.rate_limit_attempts (
  id         BIGSERIAL PRIMARY KEY,
  key        TEXT NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_key_time
  ON public.rate_limit_attempts(key, attempted_at DESC);

-- Cleanup automático: remove registros com mais de 1 hora
CREATE OR REPLACE FUNCTION public.rate_limit_cleanup()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.rate_limit_attempts WHERE attempted_at < NOW() - INTERVAL '1 hour';
$$;

-- Registra tentativa e retorna TRUE se dentro do limite
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_bucket  TEXT,
  p_key     TEXT,
  p_max     INTEGER,
  p_window  INTEGER  -- segundos
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_composite TEXT;
  v_count     INTEGER;
BEGIN
  v_composite := p_bucket || ':' || p_key;

  -- Conta tentativas recentes
  SELECT COUNT(*) INTO v_count
  FROM public.rate_limit_attempts
  WHERE key = v_composite
    AND attempted_at > NOW() - (p_window || ' seconds')::INTERVAL;

  IF v_count >= p_max THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.rate_limit_attempts(key) VALUES (v_composite);
  RETURN TRUE;
END;
$$;

-- Guard chamado em Login.tsx antes do signInWithPassword
CREATE OR REPLACE FUNCTION public.guard_login_attempt(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email_norm    TEXT;
  v_ip            TEXT;
  v_allowed_email BOOLEAN;
  v_allowed_ip    BOOLEAN;
BEGIN
  v_email_norm := lower(trim(p_email));

  IF v_email_norm = '' OR v_email_norm !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    RETURN FALSE;
  END IF;

  v_ip := COALESCE(
    current_setting('request.headers', true)::json->>'x-real-ip',
    current_setting('request.headers', true)::json->>'x-forwarded-for',
    'unknown'
  );

  -- 10 tentativas / 15 min por email
  v_allowed_email := public.check_rate_limit('login_attempt_email', v_email_norm, 10, 900);
  -- 30 tentativas / 15 min por IP
  v_allowed_ip    := public.check_rate_limit('login_attempt_ip', v_ip, 30, 900);

  RETURN v_allowed_email AND v_allowed_ip;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_login_attempt(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.guard_login_attempt(TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
