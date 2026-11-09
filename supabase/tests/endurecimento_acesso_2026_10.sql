-- pgTAP: endurecimento de acesso (auditoria de segurança de 2026-10).
--
-- Cada bloco afirma uma regra de acesso que precisa valer para usuário comum.
-- Complementa cross_tenant_matrix.sql (isolamento entre empresas) e
-- definer_exposta_sem_checagem.sql (catraca de funções).
--
--   1. empresas: colunas de plataforma (plano, trial, limites, retenção) só mudam por
--      service role ou ultra_admin; as colunas que a tela de Configurações grava seguem
--      graváveis pelo admin da empresa.
--   2. login do portal e do campo: tentativa errada conta no limite.
--   3. agent_runs / agent_actions: o chat com os agentes é individual. Rascunho é de quem
--      criou, nem o admin lê o de outra pessoa; só o rascunho do sistema (sem autor) fica
--      com quem vê dinheiro.
--   4. profiles.email não é gravável pelo usuário e o vínculo pessoa/perfil respeita a
--      empresa.
--   5. ai_usage_logs e agent_actions não aceitam escrita anônima ou sem dono.
--   6. insert_audit_log não é executável por usuário.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(30);

-- =============================================================================
-- Setup: duas empresas, usuário comum, coordenador e admin em A, admin em B.
-- =============================================================================
SET LOCAL session_replication_role = 'replica';

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES
  ('ee000000-0000-0000-0000-0000000000a0', 'Empresa A', NULL, TRUE,
   '{"financeiro":true,"projetos":true,"clientes":true,"pessoas":true}'::jsonb),
  ('ee000000-0000-0000-0000-0000000000b0', 'Empresa B', NULL, TRUE,
   '{"financeiro":true,"projetos":true,"clientes":true,"pessoas":true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features, onboarding_completed = TRUE;

INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES
  ('ee000000-0000-0000-0000-00000000a001', 'user_a@endur.com',  '{}'::jsonb, 'authenticated', 'authenticated'),
  ('ee000000-0000-0000-0000-00000000a002', 'coord_a@endur.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('ee000000-0000-0000-0000-00000000a003', 'admin_a@endur.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('ee000000-0000-0000-0000-00000000b003', 'admin_b@endur.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed)
VALUES
  ('ee000000-0000-0000-0000-00000000a001', 'ee000000-0000-0000-0000-0000000000a0', 'User',  'A', 'user_a@endur.com',  'user',        TRUE),
  ('ee000000-0000-0000-0000-00000000a002', 'ee000000-0000-0000-0000-0000000000a0', 'Coord', 'A', 'coord_a@endur.com', 'coordenador', TRUE),
  ('ee000000-0000-0000-0000-00000000a003', 'ee000000-0000-0000-0000-0000000000a0', 'Admin', 'A', 'admin_a@endur.com', 'admin',       TRUE),
  ('ee000000-0000-0000-0000-00000000b003', 'ee000000-0000-0000-0000-0000000000b0', 'Admin', 'B', 'admin_b@endur.com', 'admin',       TRUE)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, empresa_id = EXCLUDED.empresa_id;

-- Pessoa de B sem conta vinculada (profile_id nulo), com e-mail que existe só em B.
INSERT INTO public.pessoas (id, empresa_id, nome, email, primeiro_nome, sobrenome, profile_id)
VALUES ('eeced000-0000-0000-0000-0000000000b4', 'ee000000-0000-0000-0000-0000000000b0',
        'Pessoa B', 'pessoa.b@endur.com', 'Pessoa', 'B', NULL)
ON CONFLICT (id) DO UPDATE SET profile_id = NULL;

-- Rascunho de agente criado pelo admin de A, com valores sensíveis no resultado.
INSERT INTO public.agent_runs (id, empresa_id, agent_type, status, entity_type, result, created_by)
VALUES ('eeced000-0000-0000-0000-0000000000c1', 'ee000000-0000-0000-0000-0000000000a0',
        'fechar_folha', 'pending_review', 'folha',
        '{"mes":9,"ano":2026,"linhas":[{"salario_fixo":12345.67}]}'::jsonb,
        'ee000000-0000-0000-0000-00000000a003')
ON CONFLICT (id) DO NOTHING;

-- Rascunho do sistema (sem autor), como o do guardião de margem.
INSERT INTO public.agent_runs (id, empresa_id, agent_type, status, entity_type, result, created_by)
VALUES ('eeced000-0000-0000-0000-0000000000c3', 'ee000000-0000-0000-0000-0000000000a0',
        'criar_aditivo', 'pending_review', 'aditivo', '{"valor":1000}'::jsonb, NULL)
ON CONFLICT (id) DO NOTHING;

-- Rascunho do próprio usuário comum de A (ele sempre enxerga o que criou).
INSERT INTO public.agent_runs (id, empresa_id, agent_type, status, entity_type, result, created_by)
VALUES ('eeced000-0000-0000-0000-0000000000c2', 'ee000000-0000-0000-0000-0000000000a0',
        'criar_lead', 'pending_review', 'lead', '{"nome":"Lead do user"}'::jsonb,
        'ee000000-0000-0000-0000-00000000a001')
ON CONFLICT (id) DO NOTHING;

SET LOCAL session_replication_role = 'origin';

CREATE OR REPLACE FUNCTION test_set_auth(p_user_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

-- =============================================================================
-- 1. empresas: colunas de plataforma não são graváveis pelo admin da empresa
-- =============================================================================
SELECT test_set_auth('ee000000-0000-0000-0000-00000000a003'); -- admin A

SELECT throws_ok(
  $$UPDATE public.empresas SET nivel_override = 'ouro' WHERE id = 'ee000000-0000-0000-0000-0000000000a0'$$,
  '42501', NULL, 'admin da empresa não grava nivel_override');
SELECT throws_ok(
  $$UPDATE public.empresas SET leitura_desde = NULL WHERE id = 'ee000000-0000-0000-0000-0000000000a0'$$,
  '42501', NULL, 'admin da empresa não grava leitura_desde');
SELECT throws_ok(
  $$UPDATE public.empresas SET max_projetos_override = 9999 WHERE id = 'ee000000-0000-0000-0000-0000000000a0'$$,
  '42501', NULL, 'admin da empresa não grava max_projetos_override');
SELECT throws_ok(
  $$UPDATE public.empresas SET documento_verificacao = 'verificado' WHERE id = 'ee000000-0000-0000-0000-0000000000a0'$$,
  '42501', NULL, 'admin da empresa não grava documento_verificacao');
SELECT throws_ok(
  $$UPDATE public.empresas SET preservar_dados = TRUE WHERE id = 'ee000000-0000-0000-0000-0000000000a0'$$,
  '42501', NULL, 'admin da empresa não grava preservar_dados');

-- O que a tela de Configurações grava continua funcionando.
SELECT lives_ok(
  $$UPDATE public.empresas SET nome = 'Empresa A renomeada', email = 'contato@a.com', cidade = 'Marília',
                               cnpj = '11222333000181'
     WHERE id = 'ee000000-0000-0000-0000-0000000000a0'$$,
  'admin da empresa ainda grava nome, e-mail, cidade e cnpj');
RESET ROLE;

SELECT is((SELECT nivel_override FROM public.empresas WHERE id = 'ee000000-0000-0000-0000-0000000000a0'), NULL,
  'nivel_override da empresa A segue nulo');

-- =============================================================================
-- 2. login do portal e do campo: tentativa errada conta no limite (5 por e-mail)
-- =============================================================================
SELECT set_config('role', 'anon', true);

SELECT lives_ok(
  $$SELECT public.portal_login('limite.portal@endur.com', 'senha-errada-1')$$,
  'portal_login: tentativa errada 1 não levanta erro');
SELECT lives_ok($$SELECT public.portal_login('limite.portal@endur.com', 'senha-errada-2')$$, 'portal_login: tentativa 2');
SELECT lives_ok($$SELECT public.portal_login('limite.portal@endur.com', 'senha-errada-3')$$, 'portal_login: tentativa 3');
SELECT lives_ok($$SELECT public.portal_login('limite.portal@endur.com', 'senha-errada-4')$$, 'portal_login: tentativa 4');
SELECT lives_ok($$SELECT public.portal_login('limite.portal@endur.com', 'senha-errada-5')$$, 'portal_login: tentativa 5');
SELECT throws_ok(
  $$SELECT public.portal_login('limite.portal@endur.com', 'senha-errada-6')$$,
  NULL, 'Muitas tentativas. Aguarde 15 minutos e tente novamente.',
  'portal_login: a 6ª tentativa errada é barrada');

SELECT public.campo_login('limite.campo@endur.com', 'senha-errada-1');
SELECT public.campo_login('limite.campo@endur.com', 'senha-errada-2');
SELECT public.campo_login('limite.campo@endur.com', 'senha-errada-3');
SELECT public.campo_login('limite.campo@endur.com', 'senha-errada-4');
SELECT public.campo_login('limite.campo@endur.com', 'senha-errada-5');
SELECT is(
  (SELECT (public.campo_login('limite.campo@endur.com', 'senha-errada-6')::jsonb)->>'erro'),
  'Muitas tentativas. Aguarde 15 minutos e tente novamente.',
  'campo_login: a 6ª tentativa errada é barrada');
RESET ROLE;

-- =============================================================================
-- 3. agent_runs: o chat com os agentes é individual
-- =============================================================================
SELECT test_set_auth('ee000000-0000-0000-0000-00000000a001'); -- usuário comum de A
SELECT is((SELECT count(*)::int FROM public.agent_runs WHERE id = 'eeced000-0000-0000-0000-0000000000c1'), 0,
  'usuário comum não lê rascunho criado por outra pessoa');
SELECT is((SELECT count(*)::int FROM public.agent_runs WHERE id = 'eeced000-0000-0000-0000-0000000000c2'), 1,
  'usuário comum lê o próprio rascunho');
UPDATE public.agent_runs SET status = 'rejected' WHERE id = 'eeced000-0000-0000-0000-0000000000c1';
SELECT is((SELECT count(*)::int FROM public.agent_runs WHERE id = 'eeced000-0000-0000-0000-0000000000c3'), 0,
  'usuário comum não lê rascunho do sistema');
RESET ROLE;
SELECT is((SELECT status FROM public.agent_runs WHERE id = 'eeced000-0000-0000-0000-0000000000c1'), 'pending_review',
  'usuário comum não altera rascunho de outra pessoa');

SELECT test_set_auth('ee000000-0000-0000-0000-00000000a003'); -- admin A
SELECT is((SELECT count(*)::int FROM public.agent_runs WHERE id = 'eeced000-0000-0000-0000-0000000000c1'), 1,
  'admin lê o próprio rascunho');
SELECT is((SELECT count(*)::int FROM public.agent_runs WHERE id = 'eeced000-0000-0000-0000-0000000000c2'), 0,
  'admin não lê o rascunho de outra pessoa');
UPDATE public.agent_runs SET status = 'rejected' WHERE id = 'eeced000-0000-0000-0000-0000000000c2';
SELECT is((SELECT count(*)::int FROM public.agent_runs WHERE id = 'eeced000-0000-0000-0000-0000000000c3'), 1,
  'admin lê o rascunho do sistema (sem autor)');
RESET ROLE;
SELECT is((SELECT status FROM public.agent_runs WHERE id = 'eeced000-0000-0000-0000-0000000000c2'), 'pending_review',
  'admin não altera o rascunho de outra pessoa');

-- =============================================================================
-- 4. profiles.email e vínculo pessoa/perfil
-- =============================================================================
SELECT test_set_auth('ee000000-0000-0000-0000-00000000a001'); -- usuário comum de A
SELECT throws_ok(
  $$UPDATE public.profiles SET email = 'pessoa.b@endur.com' WHERE id = 'ee000000-0000-0000-0000-00000000a001'$$,
  '42501', NULL, 'usuário não grava o próprio profiles.email');
RESET ROLE;

-- Mesmo que o e-mail do perfil coincida (alteração feita por service role), a pessoa de
-- outra empresa não é vinculada.
UPDATE public.profiles SET email = 'pessoa.b@endur.com' WHERE id = 'ee000000-0000-0000-0000-00000000a001';
SELECT is((SELECT profile_id FROM public.pessoas WHERE id = 'eeced000-0000-0000-0000-0000000000b4'), NULL,
  'pessoa de outra empresa não é vinculada pelo e-mail do perfil');

-- =============================================================================
-- 5. escrita sem dono
-- =============================================================================
SELECT set_config('role', 'anon', true);
SELECT throws_ok(
  $$INSERT INTO public.ai_usage_logs (empresa_id, feature_key, tokens_input, tokens_output)
    VALUES ('ee000000-0000-0000-0000-0000000000a0', 'teste', 1, 1)$$,
  NULL, NULL, 'anon não insere em ai_usage_logs');
SELECT throws_ok(
  $$INSERT INTO public.agent_actions (run_id, tool_name) VALUES ('eeced000-0000-0000-0000-0000000000c1', 'x')$$,
  NULL, NULL, 'anon não insere em agent_actions');
RESET ROLE;

SELECT test_set_auth('ee000000-0000-0000-0000-00000000b003'); -- admin B
SELECT throws_ok(
  $$INSERT INTO public.agent_actions (run_id, tool_name) VALUES ('eeced000-0000-0000-0000-0000000000c1', 'x')$$,
  NULL, NULL, 'admin de outra empresa não registra ação em rascunho alheio');
RESET ROLE;

SELECT test_set_auth('ee000000-0000-0000-0000-00000000a001'); -- criador do run c2
SELECT lives_ok(
  $$INSERT INTO public.agent_actions (run_id, tool_name) VALUES ('eeced000-0000-0000-0000-0000000000c2', 'extrair_lead')$$,
  'criador registra ação no próprio rascunho');
RESET ROLE;

-- =============================================================================
-- 6. insert_audit_log não é executável por usuário
-- =============================================================================
SELECT ok(
  NOT has_function_privilege('authenticated',
    'public.insert_audit_log(text, text, uuid, jsonb, uuid, text, jsonb)', 'EXECUTE'),
  'authenticated não executa insert_audit_log');
SELECT ok(
  NOT has_function_privilege('anon',
    'public.insert_audit_log(text, text, uuid, jsonb, uuid, text, jsonb)', 'EXECUTE'),
  'anon não executa insert_audit_log');

SELECT * FROM finish();
ROLLBACK;
