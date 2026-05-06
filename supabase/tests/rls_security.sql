-- pgTAP security tests
-- Roda via: supabase test db (requer pgtap extension habilitada no Postgres local)
-- Ou:       psql -f supabase/tests/rls_security.sql
--
-- Cobertura:
--   1. Multi-tenant isolation — empresa A não vê dados de empresa B
--   2. Signup escalation — metadata user-controllable é bloqueada
--   3. RPCs SECURITY DEFINER validam empresa_id
--   4. Policies financeiras fechadas para roles não autorizadas
--   5. asaas_config só admin/financeiro lê
--   6. Convites — token server-side exigido

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(18);

-- =============================================
-- Setup: duas empresas e usuários de cada
-- =============================================

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES
  ('00000000-0000-0000-0000-00000000000a', 'Empresa A', NULL, TRUE,
   '{"financeiro": true, "leads": true, "projetos": true, "clientes": true, "asaas": true}'::jsonb),
  ('00000000-0000-0000-0000-00000000000b', 'Empresa B', NULL, TRUE,
   '{"financeiro": true, "leads": true, "projetos": true, "clientes": true, "asaas": true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features, onboarding_completed = TRUE;

-- Usuários simulados em auth.users (pgTAP test-only).
-- Bypass do trigger handle_new_user que exige token de convite.
SET LOCAL session_replication_role = 'replica';

INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'admin_a@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'user_a@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'admin_b@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

SET LOCAL session_replication_role = 'origin';

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed, features)
VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'Admin', 'A', 'admin_a@test.com', 'admin', TRUE,
   '{"financeiro": "editor", "leads": "editor", "projetos": "editor", "clientes": "editor", "asaas": "editor"}'::jsonb),
  ('aaaaaaaa-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', 'User', 'A', 'user_a@test.com', 'user', TRUE,
   '{"clientes": "viewer", "projetos": "viewer"}'::jsonb),
  ('bbbbbbbb-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'Admin', 'B', 'admin_b@test.com', 'admin', TRUE,
   '{"financeiro": "editor", "leads": "editor", "projetos": "editor", "clientes": "editor", "asaas": "editor"}'::jsonb)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features, role = EXCLUDED.role;

-- Cliente e projeto em cada empresa
INSERT INTO public.clientes (id, empresa_id, nome, contato, email)
VALUES
  ('c1111111-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'Cliente A', 'a@a.com', 'a@a.com'),
  ('c2222222-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'Cliente B', 'b@b.com', 'b@b.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.projetos (id, empresa_id, nome, cliente_id, codigo_projeto)
VALUES
  ('90000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'Projeto A', 'c1111111-0000-0000-0000-000000000001', 'PRJ-A'),
  ('90000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'Projeto B', 'c2222222-0000-0000-0000-000000000001', 'PRJ-B')
ON CONFLICT (id) DO NOTHING;

-- Helper: setar JWT de user autenticado
CREATE OR REPLACE FUNCTION test_set_auth(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated', 'aal', 'aal2')::text,
    true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

-- =============================================
-- Teste 1: User A NÃO vê clientes da Empresa B
-- =============================================
SELECT test_set_auth('aaaaaaaa-0000-0000-0000-000000000002');

SELECT is(
  (SELECT COUNT(*)::int FROM public.clientes WHERE id = 'c2222222-0000-0000-0000-000000000001'),
  0,
  'User A não vê cliente da Empresa B'
);

SELECT is(
  (SELECT COUNT(*)::int FROM public.clientes WHERE id = 'c1111111-0000-0000-0000-000000000001'),
  1,
  'User A vê cliente da própria Empresa A'
);

-- =============================================
-- Teste 2: User A NÃO vê projetos da Empresa B
-- =============================================
SELECT is(
  (SELECT COUNT(*)::int FROM public.projetos WHERE empresa_id = '00000000-0000-0000-0000-00000000000b'),
  0,
  'User A não vê projetos da Empresa B'
);

-- =============================================
-- Teste 3: User A não-admin NÃO vê receitas/despesas (policy Read Only removida)
-- =============================================
SELECT test_set_auth('aaaaaaaa-0000-0000-0000-000000000002'); -- role = user

SELECT is(
  (SELECT COUNT(*)::int FROM public.receitas WHERE empresa_id = '00000000-0000-0000-0000-00000000000a'),
  0,
  'User sem role admin/financeiro NÃO lê receitas'
);

SELECT is(
  (SELECT COUNT(*)::int FROM public.despesas WHERE empresa_id = '00000000-0000-0000-0000-00000000000a'),
  0,
  'User sem role admin/financeiro NÃO lê despesas'
);

-- =============================================
-- Teste 4: Admin da Empresa A VÊ receitas da própria empresa
-- =============================================
SELECT test_set_auth('aaaaaaaa-0000-0000-0000-000000000001'); -- admin A

INSERT INTO public.receitas (id, empresa_id, descricao, valor, data_vencimento, status)
VALUES ('50000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'Test', 1000, CURRENT_DATE, 'Pendente')
ON CONFLICT (id) DO NOTHING;

SELECT is(
  (SELECT COUNT(*)::int FROM public.receitas WHERE id = '50000000-0000-0000-0000-00000000000a'),
  1,
  'Admin A vê receita da própria empresa'
);

-- =============================================
-- Teste 5: Admin A NÃO vê asaas_config da Empresa B
-- =============================================
-- Setup: insere asaas_config nas duas empresas com role postgres (bypass RLS).
RESET ROLE;
INSERT INTO public.asaas_config (id, empresa_id, api_key, ambiente)
VALUES
  ('a1111111-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'secret_a', 'sandbox'),
  ('a2222222-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'secret_b', 'sandbox')
ON CONFLICT (id) DO NOTHING;
SELECT test_set_auth('aaaaaaaa-0000-0000-0000-000000000001'); -- admin A

SELECT is(
  (SELECT COUNT(*)::int FROM public.asaas_config WHERE empresa_id = '00000000-0000-0000-0000-00000000000b'),
  0,
  'Admin A não vê asaas_config da Empresa B'
);

SELECT is(
  (SELECT COUNT(*)::int FROM public.asaas_config WHERE empresa_id = '00000000-0000-0000-0000-00000000000a'),
  1,
  'Admin A vê asaas_config da própria empresa'
);

-- =============================================
-- Teste 6: User NÃO vê asaas_config (só admin/financeiro)
-- =============================================
SELECT test_set_auth('aaaaaaaa-0000-0000-0000-000000000002'); -- role=user

SELECT is(
  (SELECT COUNT(*)::int FROM public.asaas_config WHERE empresa_id = '00000000-0000-0000-0000-00000000000a'),
  0,
  'User sem role financeiro NÃO lê asaas_config (api_key protegida)'
);

-- =============================================
-- Teste 7: RPC update_projeto_completo BLOQUEIA cross-empresa
-- =============================================
SELECT test_set_auth('aaaaaaaa-0000-0000-0000-000000000001'); -- admin A

SELECT throws_ok(
  $$ SELECT public.update_projeto_completo(
    '90000000-0000-0000-0000-00000000000b'::uuid,  -- projeto da Empresa B
    'PRJ-HACK', 'Hack', 'c2222222-0000-0000-0000-000000000001'::uuid
  ) $$,
  'Acesso negado',
  'update_projeto_completo bloqueia cross-empresa'
);

-- =============================================
-- Teste 8: RPC rpc_faturar_marco bloqueia cross-empresa
-- =============================================

-- Cria marco na Empresa B (bypass RLS para setup cross-empresa)
RESET ROLE;
INSERT INTO public.marcos_faturamento (id, empresa_id, projeto_id, nome, valor, status)
VALUES ('ffff0000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', '90000000-0000-0000-0000-00000000000b', 'Marco B', 500, 'pendente')
ON CONFLICT (id) DO NOTHING;
SELECT test_set_auth('aaaaaaaa-0000-0000-0000-000000000001'); -- admin A

SELECT throws_ok(
  $$ SELECT public.rpc_faturar_marco('ffff0000-0000-0000-0000-00000000000b'::uuid) $$,
  'Acesso negado',
  'rpc_faturar_marco bloqueia cross-empresa'
);

-- =============================================
-- Teste 9: RPC rpc_converter_lead_cliente bloqueia cross-empresa
-- =============================================

RESET ROLE;
INSERT INTO public.leads (id, empresa_id, nome, status)
VALUES ('aaaa0000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'Lead B', 'Novo')
ON CONFLICT (id) DO NOTHING;
SELECT test_set_auth('aaaaaaaa-0000-0000-0000-000000000001'); -- admin A

SELECT throws_ok(
  $$ SELECT public.rpc_converter_lead_cliente('aaaa0000-0000-0000-0000-00000000000b'::uuid) $$,
  'Acesso negado',
  'rpc_converter_lead_cliente bloqueia cross-empresa'
);

-- =============================================
-- Teste 10: Convites sem token — signup rejeitado
-- =============================================
-- (handle_new_user é chamado por trigger em auth.users; testamos que sem token dá exception)

SELECT throws_ok(
  $$ INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
     VALUES ('cccccccc-0000-0000-0000-000000000001', 'hacker@evil.com', '{}'::jsonb, 'authenticated', 'authenticated') $$,
  'Cadastro não autorizado',
  'Signup sem invite_token é rejeitado'
);

-- =============================================
-- Teste 11: Convite com token FORJADO — rejeitado
-- =============================================
SELECT throws_ok(
  $$ INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
     VALUES ('cccccccc-0000-0000-0000-000000000002', 'hacker@evil.com',
             '{"invite_token":"token_fake_12345"}'::jsonb, 'authenticated', 'authenticated') $$,
  'Token de convite inválido ou expirado',
  'Signup com token inválido é rejeitado'
);

-- =============================================
-- Teste 12: audit_log — INSERT cria linha
-- =============================================
SELECT test_set_auth('aaaaaaaa-0000-0000-0000-000000000001');

INSERT INTO public.clientes (id, empresa_id, nome, contato, email)
VALUES ('d0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'Audit Test', 'audit@test.com', 'audit@test.com');

SELECT is(
  (SELECT COUNT(*)::int FROM public.audit_logs
   WHERE target_table = 'clientes'
     AND target_id = 'd0000000-0000-0000-0000-00000000000a'
     AND action = 'INSERT'),
  1,
  'audit_log registra INSERT em clientes'
);

-- =============================================
-- Teste 13: audit_log — senha_hash é mascarada
-- =============================================
INSERT INTO public.cliente_portal_accounts (cliente_id, empresa_id, nome, email, senha_hash)
VALUES ('c1111111-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a',
        'Portal Test', 'portal@test.com', 'bcrypt_hash_secret_123');

SELECT is(
  (SELECT new_data->>'senha_hash' FROM public.audit_logs
   WHERE target_table = 'cliente_portal_accounts'
     AND actor_id = 'aaaaaaaa-0000-0000-0000-000000000001'
   ORDER BY created_at DESC LIMIT 1),
  '***',
  'audit_log mascara senha_hash'
);

-- =============================================
-- Teste 14: rate_limit — bloqueia após N tentativas
-- =============================================
-- Simula 6 tentativas de login (limite = 5 em 15min)
SELECT ok(
  public.check_rate_limit('test_action', 'test_key', 5, 60),
  'rate_limit tentativa 1: permitida'
);
SELECT ok(public.check_rate_limit('test_action', 'test_key', 5, 60), 'rate_limit tentativa 2');
SELECT ok(public.check_rate_limit('test_action', 'test_key', 5, 60), 'rate_limit tentativa 3');
SELECT ok(public.check_rate_limit('test_action', 'test_key', 5, 60), 'rate_limit tentativa 4');
SELECT ok(public.check_rate_limit('test_action', 'test_key', 5, 60), 'rate_limit tentativa 5');
SELECT ok(
  NOT public.check_rate_limit('test_action', 'test_key', 5, 60),
  'rate_limit tentativa 6: BLOQUEADA'
);

SELECT * FROM finish();

ROLLBACK;
