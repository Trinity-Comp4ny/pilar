-- Conector MCP (SPEC 151): app externo (ChatGPT, Claude) é somente leitura no banco.
--
-- O servidor OAuth 2.1 do Supabase Auth entrega ao app externo um JWT do usuário com a claim
-- `client_id`. A sessão do próprio app não tem essa claim. O token vale como o usuário em
-- qualquer API do projeto, não só na função `mcp`: sem esta migration, quem autorizasse o
-- ChatGPT daria a ele o poder de escrever tudo o que o usuário escreve, direto pela API REST.
--
-- Duas travas, uma por porta de entrada de escrita:
--   1. Data API (PostgREST, inclui RPC e GraphQL): pre-request que recusa com 403 todo método
--      que não seja leitura quando o token é de app externo. GET/HEAD seguem (é por onde a
--      função `mcp` lê, sempre com o token e a RLS do usuário).
--   2. Storage: o pre-request não vale lá (docs do Supabase), então políticas RESTRICTIVE em
--      storage.objects barram upload, troca e exclusão de arquivo pelo app externo.
-- As Edge Functions têm a trava delas no código (recusarAppExterno, cors.ts).
--
-- Schema próprio e fora da API: a função não aparece no types.ts nem vira RPC. Ela é
-- SECURITY INVOKER e só lê configurações da requisição; USAGE/EXECUTE para PUBLIC porque o
-- pre-request roda no papel de quem chamou (anon, authenticated, service_role) e uma falta de
-- permissão aqui derrubaria todas as requisições da Data API.

CREATE SCHEMA IF NOT EXISTS seguranca;
COMMENT ON SCHEMA seguranca IS
  'Travas transversais de segurança (fora da Data API). SPEC 151: app externo somente leitura.';
GRANT USAGE ON SCHEMA seguranca TO PUBLIC;

-- 1. O token da requisição é de app externo? -----------------------------------------------
CREATE OR REPLACE FUNCTION seguranca.eh_app_externo()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'client_id',
    ''
  ) <> '';
$$;

COMMENT ON FUNCTION seguranca.eh_app_externo() IS
  'true quando o JWT da requisição tem client_id (token OAuth de app externo: ChatGPT, Claude). SPEC 151.';

GRANT EXECUTE ON FUNCTION seguranca.eh_app_externo() TO PUBLIC;

-- 2. Pre-request da Data API: app externo só lê ---------------------------------------------
CREATE OR REPLACE FUNCTION seguranca.pre_request_app_externo()
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
BEGIN
  IF seguranca.eh_app_externo()
     AND coalesce(current_setting('request.method', true), '') NOT IN ('GET', 'HEAD') THEN
    RAISE SQLSTATE 'PGRST' USING
      message = json_build_object(
        'code', 'PILAR_APP_EXTERNO',
        'message', 'Apps conectados à Pilar têm acesso somente leitura, pelo conector.'
      )::text,
      detail = json_build_object('status', 403)::text;
  END IF;
END;
$$;

COMMENT ON FUNCTION seguranca.pre_request_app_externo() IS
  'Pre-request do PostgREST: recusa (403) escrita quando o token é de app externo. SPEC 151.';

GRANT EXECUTE ON FUNCTION seguranca.pre_request_app_externo() TO PUBLIC;

ALTER ROLE authenticator SET pgrst.db_pre_request = 'seguranca.pre_request_app_externo';
NOTIFY pgrst, 'reload config';

-- 3. Storage: app externo não sobe, troca nem apaga arquivo --------------------------------
DROP POLICY IF EXISTS "app_externo_nao_insere" ON storage.objects;
CREATE POLICY "app_externo_nao_insere" ON storage.objects
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (NOT (SELECT seguranca.eh_app_externo()));

DROP POLICY IF EXISTS "app_externo_nao_altera" ON storage.objects;
CREATE POLICY "app_externo_nao_altera" ON storage.objects
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (NOT (SELECT seguranca.eh_app_externo()))
  WITH CHECK (NOT (SELECT seguranca.eh_app_externo()));

DROP POLICY IF EXISTS "app_externo_nao_apaga" ON storage.objects;
CREATE POLICY "app_externo_nao_apaga" ON storage.objects
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (NOT (SELECT seguranca.eh_app_externo()));
