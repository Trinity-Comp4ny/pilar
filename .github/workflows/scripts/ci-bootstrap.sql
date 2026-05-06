-- Bootstrap para CI: cria tabelas/colunas que normalmente vêm do stack Supabase
-- (GoTrue auth, Storage) mas estão ausentes na imagem `supabase/postgres` crua.
-- Idempotente — usa IF NOT EXISTS em tudo.

-- auth.uid()/auth.role(): vêm do GoTrue. Sem elas, RLS policies nunca matcham
-- e get_user_empresa_id() retorna NULL, fazendo o setup falhar silenciosamente.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(
    COALESCE(
      current_setting('request.jwt.claim.sub', true),
      (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')
    ), ''
  )::UUID
$$;

CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(
    COALESCE(
      current_setting('request.jwt.claim.role', true),
      (current_setting('request.jwt.claims', true)::jsonb ->> 'role')
    ), ''
  )
$$;

-- auth.mfa_factors: criada pelo GoTrue. Necessária para views de segurança
-- (view_admins_sem_mfa, view_security_status).
CREATE TABLE IF NOT EXISTS auth.mfa_factors (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friendly_name TEXT,
  factor_type TEXT NOT NULL DEFAULT 'totp',
  status      TEXT NOT NULL DEFAULT 'unverified',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  secret      TEXT
);

-- storage.buckets: a imagem antiga não tem `public`, `file_size_limit`,
-- `allowed_mime_types`. Adiciona as colunas idempotentemente.
ALTER TABLE storage.buckets
  ADD COLUMN IF NOT EXISTS public BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS file_size_limit BIGINT,
  ADD COLUMN IF NOT EXISTS allowed_mime_types TEXT[];

-- tg_audit_profile_changes: função auxiliar referenciada por trigger em
-- 20260504700000_cleanup_user_role_enum.sql, mas cuja definição vive no DB
-- remoto e não nas migrations. Stub no-op só pra trigger CREATE não falhar.
CREATE SCHEMA IF NOT EXISTS public;
CREATE OR REPLACE FUNCTION public.tg_audit_profile_changes()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RETURN NEW;
END;
$$;
