-- pgTAP: registro de acesso do Marco Civil (migration 20261211000000).
--
-- 1. Login no app (linha nova em auth.sessions) grava IP, navegador e empresa.
-- 2. Renovação do token no mesmo IP dentro de 24 h não duplica; IP novo grava.
-- 3. Login do portal do cliente pela RPC grava o IP do cabeçalho; senha errada não grava.
-- 4. Pilar Campo tem o mesmo gatilho.
-- 5. Usuário comum não lê nem escreve; a limpeza apaga o que passou de 6 meses.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(11);

CREATE OR REPLACE FUNCTION test_set_auth(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

CREATE OR REPLACE FUNCTION test_set_postgres()
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('role', 'postgres', true);
END; $$;

SELECT test_set_postgres();

INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role, email_confirmed_at)
VALUES ('ac355000-0000-0000-0000-00000000000a', 'acesso_admin@empresareal.com.br',
        jsonb_build_object('company_name', 'Acesso Empresa'), 'authenticated', 'authenticated', now());

-- ---------------------------------------------------------------------------
-- 1 e 2. App: auth.sessions
-- ---------------------------------------------------------------------------
INSERT INTO auth.sessions (id, user_id, created_at, updated_at, ip, user_agent)
VALUES ('ac355000-0000-0000-0000-0000000000a1', 'ac355000-0000-0000-0000-00000000000a',
        now(), now(), '203.0.113.7', 'Mozilla/5.0 teste');

SELECT is(
  (SELECT count(*)::int FROM public.registros_acesso
   WHERE user_id = 'ac355000-0000-0000-0000-00000000000a' AND origem = 'app' AND ip = '203.0.113.7'
     AND user_agent = 'Mozilla/5.0 teste'
     AND empresa_id = (SELECT empresa_id FROM public.profiles WHERE id = 'ac355000-0000-0000-0000-00000000000a')),
  1,
  'login no app grava IP, navegador e empresa'
);

UPDATE auth.sessions SET refreshed_at = now() + interval '1 hour'
WHERE id = 'ac355000-0000-0000-0000-0000000000a1';

SELECT is(
  (SELECT count(*)::int FROM public.registros_acesso WHERE sessao_id = 'ac355000-0000-0000-0000-0000000000a1'),
  1,
  'renovação no mesmo IP dentro de 24 h não duplica o registro'
);

UPDATE auth.sessions SET refreshed_at = now() + interval '2 hours', ip = '203.0.113.99'
WHERE id = 'ac355000-0000-0000-0000-0000000000a1';

SELECT is(
  (SELECT count(*)::int FROM public.registros_acesso
   WHERE sessao_id = 'ac355000-0000-0000-0000-0000000000a1' AND ip = '203.0.113.99'),
  1,
  'renovação vinda de outro IP grava um registro novo'
);

-- ---------------------------------------------------------------------------
-- 3. Portal do cliente: login pela RPC com o IP no cabeçalho
-- ---------------------------------------------------------------------------
INSERT INTO public.clientes (id, empresa_id, nome)
VALUES ('ac355000-0000-0000-0000-0000000000c1',
        (SELECT empresa_id FROM public.profiles WHERE id = 'ac355000-0000-0000-0000-00000000000a'),
        'Cliente Acesso');

INSERT INTO public.cliente_portal_accounts (id, cliente_id, empresa_id, nome, email, senha_hash, ativo)
VALUES ('ac355000-0000-0000-0000-0000000000b1', 'ac355000-0000-0000-0000-0000000000c1',
        (SELECT empresa_id FROM public.profiles WHERE id = 'ac355000-0000-0000-0000-00000000000a'),
        'Portal Acesso', 'portal.acesso@test.com', crypt('senhacorreta123', gen_salt('bf')), true);

SELECT set_config('request.headers',
  json_build_object('x-forwarded-for', '198.51.100.9, 10.0.0.1', 'user-agent', 'Navegador do cliente')::text, true);

SELECT ok(
  public.portal_login('portal.acesso@test.com', 'senhacorreta123') IS NOT NULL,
  'login do portal com a senha certa funciona com o gatilho ligado'
);

SELECT is(
  (SELECT count(*)::int FROM public.registros_acesso
   WHERE conta_id = 'ac355000-0000-0000-0000-0000000000b1' AND origem = 'portal'
     AND ip = '198.51.100.9' AND user_agent = 'Navegador do cliente'),
  1,
  'login do portal grava o primeiro IP do x-forwarded-for e o navegador'
);

SELECT ok(
  public.portal_login('portal.acesso@test.com', 'senhaerrada0000') IS NULL,
  'senha errada no portal continua recusada'
);

SELECT is(
  (SELECT count(*)::int FROM public.registros_acesso WHERE conta_id = 'ac355000-0000-0000-0000-0000000000b1'),
  1,
  'tentativa com senha errada não vira registro de acesso'
);

-- ---------------------------------------------------------------------------
-- 4. Pilar Campo
-- ---------------------------------------------------------------------------
SELECT has_trigger('public', 'campo_accounts', 'registrar_acesso_campo',
  'campo_accounts registra o acesso a cada login');

-- ---------------------------------------------------------------------------
-- 5. Acesso pela API e retenção
-- ---------------------------------------------------------------------------
SELECT test_set_auth('ac355000-0000-0000-0000-00000000000a');

SELECT is(
  (SELECT count(*)::int FROM public.registros_acesso),
  0,
  'usuário comum não lê registro de acesso, nem o próprio'
);

SELECT throws_ok(
  $$INSERT INTO public.registros_acesso (origem, ip) VALUES ('app', '1.2.3.4')$$,
  '42501',
  NULL,
  'usuário comum não grava registro de acesso'
);

SELECT test_set_postgres();

INSERT INTO public.registros_acesso (origem, ip, created_at)
VALUES ('app', '192.0.2.1', now() - interval '7 months');

SELECT public.limpar_registros_acesso();

SELECT is(
  (SELECT count(*)::int FROM public.registros_acesso WHERE ip = '192.0.2.1'),
  0,
  'limpeza apaga o registro com mais de 6 meses'
);

SELECT * FROM finish();
ROLLBACK;
