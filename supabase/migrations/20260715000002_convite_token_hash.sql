-- =====================================================================
-- Convite de funcionário: guardar SÓ o hash do token (não o plaintext).
--
-- Bug de fundo (mesma classe do portal, já corrigido em 20260713000000):
-- convites.token era gerado e ARMAZENADO em plaintext e comparado em
-- plaintext no handle_new_user. Um vazamento da tabela = aceitar convites
-- de terceiros (account takeover). Padrão dos repos internos: gera token
-- aleatório, ENVIA por e-mail, guarda apenas hash + TTL + status.
--
-- Fix (in-place, reversível):
--   1. coluna token_hash + backfill a partir do plaintext existente
--   2. create_convite / admin_create_convite / regenerate_convite_token
--      passam a gravar SÓ o hash e RETORNAR o plaintext (para o e-mail)
--   3. handle_new_user passa a comparar por hash (patch cirúrgico, só o
--      ramo de convites — owner_pending/pending_signup ficam para follow-up)
--   4. plaintext existente é zerado; coluna token deixa de ser obrigatória
--      e perde o default (nada mais persiste plaintext)
-- =====================================================================

BEGIN;

-- 1. Coluna de hash + índice de lookup + backfill.
ALTER TABLE public.convites ADD COLUMN IF NOT EXISTS token_hash text;

UPDATE public.convites
SET token_hash = encode(extensions.digest(token, 'sha256'), 'hex')
WHERE token_hash IS NULL AND token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_convites_token_hash ON public.convites (token_hash);

-- 2a. create_convite: gera plaintext, grava hash, retorna plaintext.
--     (usado por invite-user — admin convida na própria empresa)
CREATE OR REPLACE FUNCTION public.create_convite(
  p_email text,
  p_cargo text,
  p_nome text DEFAULT NULL,
  p_features jsonb DEFAULT '{}'::jsonb
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_empresa_id UUID;
  v_cargo public.user_role;
  v_features JSONB;
  v_token_plain TEXT;
  v_token_hash TEXT;
BEGIN
  v_empresa_id := public.get_user_empresa_id();

  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem criar convites';
  END IF;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa';
  END IF;

  BEGIN
    v_cargo := p_cargo::public.user_role;
  EXCEPTION WHEN OTHERS THEN
    v_cargo := 'user';
  END;

  -- owner e ultra_admin não são concedidos via convite (escalada vertical):
  -- owner só via set_access_profile por owner/ultra_admin; ultra_admin só via SQL.
  IF v_cargo IN ('ultra_admin', 'owner') THEN
    RAISE EXCEPTION 'ultra_admin/owner não podem ser concedidos via convite';
  END IF;

  -- Admin/owner não usam features granulares.
  IF v_cargo IN ('admin', 'owner') THEN
    v_features := '{}'::jsonb;
  ELSE
    v_features := COALESCE(p_features, '{}'::jsonb);
  END IF;

  -- Invalida convites antigos não usados do mesmo e-mail.
  UPDATE public.convites
  SET usado_em = NOW()
  WHERE email = lower(trim(p_email))
    AND empresa_id = v_empresa_id
    AND usado_em IS NULL;

  v_token_plain := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash := encode(extensions.digest(v_token_plain, 'sha256'), 'hex');

  INSERT INTO public.convites (empresa_id, email, cargo, nome, features, criado_por, token, token_hash)
  VALUES (v_empresa_id, lower(trim(p_email)), v_cargo, p_nome, v_features, auth.uid(), NULL, v_token_hash);

  RETURN v_token_plain;
END;
$$;

-- 2b. admin_create_convite: idem, mas para ultra_admin criando em OUTRA
--     empresa (chamado via service_role; o gate é feito na edge function).
CREATE OR REPLACE FUNCTION public.admin_create_convite(
  p_empresa_id uuid,
  p_email text,
  p_cargo text,
  p_nome text DEFAULT NULL,
  p_features jsonb DEFAULT '{}'::jsonb
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_cargo public.user_role;
  v_features JSONB;
  v_token_plain TEXT;
  v_token_hash TEXT;
BEGIN
  IF p_empresa_id IS NULL THEN
    RAISE EXCEPTION 'empresa_id obrigatório';
  END IF;

  BEGIN
    v_cargo := p_cargo::public.user_role;
  EXCEPTION WHEN OTHERS THEN
    v_cargo := 'user';
  END;

  -- owner e ultra_admin não são concedidos via convite (escalada vertical):
  -- owner só via set_access_profile por owner/ultra_admin; ultra_admin só via SQL.
  IF v_cargo IN ('ultra_admin', 'owner') THEN
    RAISE EXCEPTION 'ultra_admin/owner não podem ser concedidos via convite';
  END IF;

  IF v_cargo IN ('admin', 'owner') THEN
    v_features := '{}'::jsonb;
  ELSE
    v_features := COALESCE(p_features, '{}'::jsonb);
  END IF;

  UPDATE public.convites
  SET usado_em = NOW()
  WHERE email = lower(trim(p_email))
    AND empresa_id = p_empresa_id
    AND usado_em IS NULL;

  v_token_plain := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash := encode(extensions.digest(v_token_plain, 'sha256'), 'hex');

  INSERT INTO public.convites (empresa_id, email, cargo, nome, features, token, token_hash)
  VALUES (p_empresa_id, lower(trim(p_email)), v_cargo, p_nome, v_features, NULL, v_token_hash);

  RETURN v_token_plain;
END;
$$;

-- 2c. regenerate_convite_token: renova validade e gera novo token para
--     reenvio (o plaintext antigo não existe mais). Retorna o novo plaintext.
CREATE OR REPLACE FUNCTION public.regenerate_convite_token(p_convite_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_token_plain TEXT;
  v_token_hash TEXT;
  v_rows INT;
BEGIN
  v_token_plain := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash := encode(extensions.digest(v_token_plain, 'sha256'), 'hex');

  UPDATE public.convites
  SET token = NULL,
      token_hash = v_token_hash,
      expira_em = NOW() + INTERVAL '7 days'
  WHERE id = p_convite_id
    AND usado_em IS NULL;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION 'Convite não encontrado ou já usado' USING ERRCODE = '22023';
  END IF;

  RETURN v_token_plain;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_convite(uuid, text, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.regenerate_convite_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_convite(text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_convite(uuid, text, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.regenerate_convite_token(uuid) TO service_role;

-- 3. handle_new_user: comparar por hash SÓ no ramo de convites.
--    Patch via pg_get_functiondef (version-agnostic, não reescreve o corpo à mão).
DO $do$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_def
  FROM pg_proc
  WHERE pronamespace = 'public'::regnamespace
    AND proname = 'handle_new_user'
  LIMIT 1;

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'handle_new_user não encontrado';
  END IF;

  IF v_def ILIKE '%token_hash = encode(extensions.digest(v_token%' THEN
    -- Idempotente: já migrado numa execução anterior.
    RAISE NOTICE 'handle_new_user: ramo de convites já usa hash; nada a fazer';
  ELSIF v_def ILIKE '%FROM public.convites%token = v_token%' THEN
    v_def := regexp_replace(
      v_def,
      '(FROM public\.convites\s+WHERE\s+)token = v_token',
      '\1token_hash = encode(extensions.digest(v_token, ''sha256''), ''hex'')'
    );
    EXECUTE v_def;
    RAISE NOTICE 'handle_new_user: ramo de convites migrado para hash';
  ELSE
    -- Abortar em vez de zerar o plaintext e quebrar a aceitação de convites.
    RAISE EXCEPTION 'handle_new_user: ramo de convites não bate o padrão esperado; migration abortada';
  END IF;
END
$do$;

-- 4. Zera o plaintext remanescente e remove a capacidade de persistir plaintext.
UPDATE public.convites SET token = NULL WHERE token IS NOT NULL;
ALTER TABLE public.convites ALTER COLUMN token DROP DEFAULT;
ALTER TABLE public.convites ALTER COLUMN token DROP NOT NULL;

COMMIT;
