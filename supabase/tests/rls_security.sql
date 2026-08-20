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

-- 20, não 16: o arquivo foi ganhando asserts sem atualizar o plano, e como o job de
-- pgTAP estava desligado desde f5a86ea ninguém viu. Plano errado faz o pg_prove
-- reportar "Bad plan" e marcar os asserts extras como falha.
SELECT plan(31);

-- =============================================
-- Setup: duas empresas e usuários de cada
-- =============================================

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES
  ('00000000-0000-0000-0000-00000000000a', 'Empresa A', NULL, TRUE,
   '{"financeiro": true, "leads": true, "projetos": true, "clientes": true, "propostas": true}'::jsonb),
  ('00000000-0000-0000-0000-00000000000b', 'Empresa B', NULL, TRUE,
   '{"financeiro": true, "leads": true, "projetos": true, "clientes": true, "propostas": true}'::jsonb)
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

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed)
VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'Admin', 'A', 'admin_a@test.com', 'admin', TRUE),
  ('aaaaaaaa-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', 'User', 'A', 'user_a@test.com', 'user', TRUE),
  ('bbbbbbbb-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'Admin', 'B', 'admin_b@test.com', 'admin', TRUE)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

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
-- Teste 9b: RPC rpc_converter_proposta_projeto bloqueia cross-empresa
-- =============================================
-- Fechado em 20260835000000, seguindo o mesmo furo de update_projeto_completo/
-- rpc_faturar_marco/rpc_converter_lead_cliente acima: SECURITY DEFINER sem comparar
-- a empresa do registro com a de quem chama.

RESET ROLE;
INSERT INTO public.propostas (id, empresa_id, titulo)
VALUES ('90aaaaaa-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'Proposta B')
ON CONFLICT (id) DO NOTHING;
SELECT test_set_auth('aaaaaaaa-0000-0000-0000-000000000001'); -- admin A

SELECT throws_ok(
  $$ SELECT public.rpc_converter_proposta_projeto('90aaaaaa-0000-0000-0000-00000000000b'::uuid) $$,
  'Acesso negado',
  'rpc_converter_proposta_projeto bloqueia cross-empresa'
);

-- =============================================
-- Teste 9c: RPC rpc_gerar_parcelas_projeto bloqueia cross-empresa
-- =============================================
-- Projeto B ('90000000-...000b') já existe do setup acima, sem valor_contrato: o
-- tenant check roda ANTES do check de valor_contrato, então a exceção esperada é
-- sempre 'Acesso negado', não 'Projeto sem valor de contrato'.
SELECT throws_ok(
  $$ SELECT public.rpc_gerar_parcelas_projeto('90000000-0000-0000-0000-00000000000b'::uuid) $$,
  'Acesso negado',
  'rpc_gerar_parcelas_projeto bloqueia cross-empresa'
);

-- =============================================
-- Teste 9d: rpc_gerar_alertas tem uma única assinatura (overload uuid removido)
-- =============================================
RESET ROLE;
SELECT is(
  (SELECT count(*)::int FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'rpc_gerar_alertas'),
  1,
  'rpc_gerar_alertas tem uma única assinatura (overload uuid vulnerável dropado)'
);

-- =============================================
-- Teste 10: Convites sem token — signup rejeitado
-- =============================================
-- (handle_new_user é chamado por trigger em auth.users; testamos que sem token dá exception)
--
-- RESET ROLE é obrigatório aqui: o assert anterior deixou o role em `authenticated`,
-- que não tem INSERT em auth.users, então o teste morria com "permission denied for
-- table users" antes de chegar no trigger. O que se quer provar é o comportamento do
-- handle_new_user, não a permissão de tabela.
RESET ROLE;

-- Spec 039: signup SEM token deixou de ser rejeitado — agora é self-serve legítimo,
-- que cria uma empresa NOVA + admin + trial (Cenário 3 do handle_new_user). O que ESTE
-- teste prova é que a brecha SEC-11 NÃO reabre: mesmo com metadata forjado (empresa_id de
-- outra empresa, role ultra_admin), o cadastro cai numa empresa nova como admin, nunca no
-- tenant forjado nem com privilégio escolhido pelo cliente.
SELECT lives_ok(
  $$ INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
     VALUES ('cccccccc-0000-0000-0000-000000000001', 'selfserve@example.com',
             jsonb_build_object('company_name', 'Empresa Nova',
                                'empresa_id_convite', '11111111-1111-1111-1111-111111111111',
                                'role', 'ultra_admin'),
             'authenticated', 'authenticated') $$,
  'Self-serve: signup sem token cria conta (spec 039)'
);

SELECT is(
  (SELECT role::text FROM public.profiles WHERE id = 'cccccccc-0000-0000-0000-000000000001'),
  'admin',
  'Self-serve: role fixo admin, role forjado no metadata ignorado'
);

SELECT isnt(
  (SELECT empresa_id::text FROM public.profiles WHERE id = 'cccccccc-0000-0000-0000-000000000001'),
  '11111111-1111-1111-1111-111111111111',
  'Self-serve: empresa_id forjado ignorado (cai numa empresa nova)'
);

-- =============================================
-- Convite com token FORJADO (não-vazio) — continua rejeitado (Cenário 1/2 → RAISE)
-- =============================================
SELECT throws_ok(
  $$ INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
     VALUES ('cccccccc-0000-0000-0000-000000000002', 'badtoken@evil.com',
             '{"invite_token":"token_fake_12345"}'::jsonb, 'authenticated', 'authenticated') $$,
  'Token de convite inválido ou expirado',
  'Signup com token inválido é rejeitado'
);

-- Testes 12-13 (audit_logs INSERT/mask) removidos — tabela public.audit_logs
-- foi removida no remote (migration 028) e arquitetura migrou para
-- admin_audit_logs com escopo diferente.

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

-- =============================================
-- RPC SECURITY DEFINER não é executável por anon
-- =============================================
-- A anon key é pública (vai no bundle do front), então EXECUTE para `anon` numa função
-- SECURITY DEFINER significa que qualquer pessoa na internet pode chamá-la. As três
-- abaixo tinham exatamente isso até 20260725000000, junto com a ausência de check de
-- empresa. Nenhuma é chamada de contexto anônimo: useProjetoForm.ts,
-- BillingMilestonesTab.tsx e useLeads.ts rodam autenticados, ai-chat usa service_role.
RESET ROLE;

SELECT ok(
  NOT has_function_privilege('anon', 'public.rpc_faturar_marco(uuid)', 'EXECUTE'),
  'anon NÃO executa rpc_faturar_marco'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.rpc_converter_lead_cliente(uuid, boolean)', 'EXECUTE'),
  'anon NÃO executa rpc_converter_lead_cliente'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.rpc_converter_proposta_projeto(uuid)', 'EXECUTE'),
  'anon NÃO executa rpc_converter_proposta_projeto'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.rpc_gerar_parcelas_projeto(uuid, integer, integer)', 'EXECUTE'),
  'anon NÃO executa rpc_gerar_parcelas_projeto'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.update_projeto_completo(uuid, text, text, uuid, date, date, date, numeric, text, text, text, numeric, jsonb, text, text)',
    'EXECUTE'
  ),
  'anon NÃO executa update_projeto_completo'
);

-- E o overload de 14 args, que era órfão e também estava sem check, não existe mais.
SELECT is(
  (SELECT count(*)::int FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'update_projeto_completo'),
  1,
  'update_projeto_completo tem uma única assinatura (sem overload sem check)'
);

SELECT * FROM finish();

ROLLBACK;
