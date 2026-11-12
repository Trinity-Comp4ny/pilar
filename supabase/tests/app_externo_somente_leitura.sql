-- pgTAP: app externo (token OAuth com client_id: ChatGPT, Claude) é somente leitura (SPEC 151).
-- A sessão do app (sem client_id) continua escrevendo normalmente: se este teste quebrar
-- nesse ponto, o app inteiro parou de salvar.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(10);

-- Sessão do app: escreve.
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true);
SELECT set_config('request.method', 'POST', true);
SELECT is(seguranca.eh_app_externo(), false, 'sessão do app não é app externo');
SELECT lives_ok($$SELECT seguranca.pre_request_app_externo()$$, 'sessão do app faz POST');

-- Sem token nenhum (anon) e com client_id vazio: não é app externo.
SELECT set_config('request.jwt.claims', '', true);
SELECT is(seguranca.eh_app_externo(), false, 'sem claims não é app externo');
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","client_id":""}', true);
SELECT is(seguranca.eh_app_externo(), false, 'client_id vazio não é app externo');

-- App externo: lê, não escreve.
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","client_id":"6f1c2d3e-0000-4000-8000-000000000001"}', true);
SELECT is(seguranca.eh_app_externo(), true, 'token com client_id é app externo');
SELECT set_config('request.method', 'GET', true);
SELECT lives_ok($$SELECT seguranca.pre_request_app_externo()$$, 'app externo faz GET');
SELECT set_config('request.method', 'POST', true);
SELECT throws_ok($$SELECT seguranca.pre_request_app_externo()$$, 'PGRST', NULL, 'app externo não faz POST (insert e RPC)');
SELECT set_config('request.method', 'PATCH', true);
SELECT throws_ok($$SELECT seguranca.pre_request_app_externo()$$, 'PGRST', NULL, 'app externo não faz PATCH');

-- A trava está ligada no PostgREST e no Storage.
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_roles r, unnest(r.rolconfig) AS c
    WHERE r.rolname = 'authenticator'
      AND c = 'pgrst.db_pre_request=seguranca.pre_request_app_externo'
  ),
  'pre-request registrado no authenticator'
);
SELECT is(
  (SELECT count(*)::int FROM pg_policies
   WHERE schemaname = 'storage' AND tablename = 'objects'
     AND permissive = 'RESTRICTIVE' AND policyname LIKE 'app_externo_%'),
  3,
  'storage.objects tem as três políticas restritivas de app externo'
);

SELECT * FROM finish();
ROLLBACK;
