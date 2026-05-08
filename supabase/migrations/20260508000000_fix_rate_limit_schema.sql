-- Fix: rate_limit_attempts tinha schema antigo (action + key separados) em produção.
-- A migration 20260507940000 usou CREATE TABLE IF NOT EXISTS, que foi no-op.
-- Resultado: check_rate_limit nova tentava INSERT(key) mas action era NOT NULL → erro
-- → guard_login_attempt retornava null → todo login bloqueado com "Muitas tentativas".

-- Drop funções que dependem da tabela
DROP FUNCTION IF EXISTS public.guard_login_attempt(TEXT);
DROP FUNCTION IF EXISTS public.check_rate_limit(TEXT, TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.rate_limit_cleanup();

-- Drop tabela com schema antigo (tanto o original quanto qualquer variação)
DROP TABLE IF EXISTS public.rate_limit_attempts;

-- Recriar com schema correto (key composite = bucket:chave)
CREATE TABLE public.rate_limit_attempts (
  id         BIGSERIAL PRIMARY KEY,
  key        TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rate_limit_key_time
  ON public.rate_limit_attempts(key, created_at DESC);

ALTER TABLE public.rate_limit_attempts ENABLE ROW LEVEL SECURITY;

-- Cleanup: remove registros com mais de 1 hora
CREATE OR REPLACE FUNCTION public.rate_limit_cleanup()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.rate_limit_attempts WHERE created_at < NOW() - INTERVAL '1 hour';
$$;

-- check_rate_limit: registra tentativa e retorna TRUE se dentro do limite
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_bucket  TEXT,
  p_key     TEXT,
  p_max     INTEGER,
  p_window  INTEGER
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

  SELECT COUNT(*) INTO v_count
  FROM public.rate_limit_attempts
  WHERE key = v_composite
    AND created_at > NOW() - (p_window || ' seconds')::INTERVAL;

  IF v_count >= p_max THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.rate_limit_attempts(key) VALUES (v_composite);
  RETURN TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_rate_limit(TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC;

-- guard_login_attempt: chamado em Login.tsx antes do signInWithPassword
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
