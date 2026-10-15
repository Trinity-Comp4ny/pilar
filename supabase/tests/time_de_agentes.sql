-- pgTAP: time de agentes no Ultra, fase 0 (SPEC 126, ADR 0060).
--
-- 1. As tabelas ops_* só abrem para ultra admin com MFA; admin de empresa e anon não
--    leem nada e ninguém grava pela API.
-- 2. A nota de saúde segue os pesos do playbook (docs/operacao/agentes/clientes.md).
-- 3. ops_receita e ops_saude_empresas recusam quem não é ultra admin e contam o
--    cadastro, a ativação, o teste vencendo e a origem UTM do jeito da spec.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(21);

-- =============================================================================
-- Fixture: empresa da Pilar (ultra admin) e escritório cliente em teste
-- =============================================================================
SET LOCAL session_replication_role = 'replica';

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES
  ('a9000000-0000-0000-0000-0000000000a0', 'Pilar interna', NULL, TRUE, '{}'::jsonb),
  ('a9000000-0000-0000-0000-0000000000c0', 'Escritório Cliente', 'a9000000-0000-0000-0000-00000000c001', TRUE,
   '{"projetos": true}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role, last_sign_in_at)
VALUES
  ('a9000000-0000-0000-0000-00000000a001', 'ultra@time.test', '{}'::jsonb, 'authenticated', 'authenticated', now()),
  ('a9000000-0000-0000-0000-00000000c001', 'dono@cliente.test',
   '{"origem": {"utm_source": "linkedin", "utm_campaign": "lancamento-2027-01"}}'::jsonb,
   'authenticated', 'authenticated', now() - interval '2 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, contato, onboarding_completed)
VALUES
  ('a9000000-0000-0000-0000-00000000a001', 'a9000000-0000-0000-0000-0000000000a0', 'Ultra', 'Admin',
   'ultra@time.test', 'ultra_admin', NULL, TRUE),
  ('a9000000-0000-0000-0000-00000000c001', 'a9000000-0000-0000-0000-0000000000c0', 'Dona', 'Cliente',
   'dono@cliente.test', 'admin', '(14) 99999-0000', TRUE)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, empresa_id = EXCLUDED.empresa_id;

INSERT INTO public.pilar_subscription_plans
  (slug, nome, preco_mensal, max_usuarios, max_projetos, tokens_mensais, destaque, ativo, ordem)
VALUES ('starter', 'Essencial', 490.00, NULL, 15, 500000, FALSE, TRUE, 1)
ON CONFLICT (slug) DO UPDATE SET ativo = TRUE;

INSERT INTO public.pilar_subscriptions (empresa_id, plan_id, status, trial_ends_at)
VALUES ('a9000000-0000-0000-0000-0000000000c0',
        (SELECT id FROM public.pilar_subscription_plans WHERE slug = 'starter'),
        'trialing', now() + interval '20 hours')
ON CONFLICT (empresa_id) DO UPDATE SET status = 'trialing', trial_ends_at = EXCLUDED.trial_ends_at;

INSERT INTO public.projetos (id, empresa_id, nome, status, exemplo)
VALUES
  ('a9000000-0000-0000-0000-0000000000f1', 'a9000000-0000-0000-0000-0000000000c0', 'Projeto real', 'Em andamento', FALSE),
  ('a9000000-0000-0000-0000-0000000000f2', 'a9000000-0000-0000-0000-0000000000c0', 'Projeto exemplo', 'Em andamento', TRUE);

-- Uso em 28 dias espalhado por 5 semanas de calendário: tem que contar no máximo 4.
INSERT INTO public.audit_logs (empresa_id, action, target_table, created_at)
SELECT 'a9000000-0000-0000-0000-0000000000c0', 'update', 'projetos', now() - (d || ' hours')::interval
FROM unnest(ARRAY[1, 180, 350, 520, 660]) AS d;

INSERT INTO public.ops_acoes (agente_id, tipo, empresa_id, titulo, evidencia)
VALUES ('receita', 'whatsapp', 'a9000000-0000-0000-0000-0000000000c0', 'Teste vence amanhã',
        '{"projetos": 1}'::jsonb);

SET LOCAL session_replication_role = 'origin';

CREATE OR REPLACE FUNCTION test_time_auth(p_user_id uuid, p_aal text DEFAULT 'aal2')
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated', 'aal', p_aal)::text, true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

-- =============================================================================
-- 1. Acesso
-- =============================================================================
SELECT is(
  (SELECT count(*)::integer FROM pg_class c
   WHERE c.relnamespace = 'public'::regnamespace AND c.relname LIKE 'ops\_%' AND c.relkind = 'r'
     AND c.relrowsecurity),
  4, 'as quatro tabelas ops_* têm RLS ligada');

SELECT ok(
  NOT has_table_privilege('anon', 'public.ops_acoes', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.ops_acoes', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.ops_acoes', 'UPDATE')
  AND NOT has_table_privilege('authenticated', 'public.ops_metricas_diarias', 'INSERT'),
  'anon não lê e ninguém logado grava nas tabelas ops_* pela API');

SELECT test_time_auth('a9000000-0000-0000-0000-00000000c001'); -- admin do escritório cliente
SELECT is((SELECT count(*)::integer FROM public.ops_agentes), 0, 'admin de empresa não vê os agentes');
SELECT is((SELECT count(*)::integer FROM public.ops_acoes), 0, 'admin de empresa não vê as ações');
SELECT throws_ok($$SELECT public.ops_receita(30)$$, '42501', NULL, 'admin de empresa não chama ops_receita');
SELECT throws_ok($$SELECT * FROM public.ops_saude_empresas()$$, '42501', NULL,
  'admin de empresa não chama ops_saude_empresas');
RESET ROLE;

SELECT test_time_auth('a9000000-0000-0000-0000-00000000a001', 'aal1'); -- ultra admin sem segundo fator
SELECT is((SELECT count(*)::integer FROM public.ops_agentes), 0, 'ultra admin sem MFA não vê os agentes');
RESET ROLE;

SELECT test_time_auth('a9000000-0000-0000-0000-00000000a001'); -- ultra admin com aal2
SELECT is((SELECT count(*)::integer FROM public.ops_agentes), 7, 'ultra admin vê os sete agentes');
SELECT ok((SELECT count(*) FROM public.ops_acoes WHERE agente_id = 'receita') >= 1, 'ultra admin vê as ações');

-- =============================================================================
-- 3. Receita e saúde, como ultra admin
-- =============================================================================
SELECT ok(
  (public.ops_receita(30) -> 'testes_vencendo')
    @> '[{"empresa_id": "a9000000-0000-0000-0000-0000000000c0", "projetos": 1, "contato_telefone": "(14) 99999-0000"}]',
  'teste vencendo em 48 h aparece com projetos reais (sem o exemplo) e telefone do dono');

SELECT ok(
  (public.ops_receita(30) -> 'por_origem')
    @> '[{"fonte": "linkedin", "campanha": "lancamento-2027-01", "cadastros": 1, "ativados": 1, "pagantes": 0}]',
  'cadastro conta na campanha do UTM do dono, ativado por ter projeto real');

SELECT ok((public.ops_receita(30) ->> 'cadastros')::integer >= 1, 'cadastro do período contado');

SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.ops_saude_empresas() s WHERE s.empresa_id = 'a9000000-0000-0000-0000-0000000000a0'),
  'empresa com ultra admin (a da Pilar) fica fora da saúde');

SELECT is(
  (SELECT s.projetos_ativos FROM public.ops_saude_empresas() s WHERE s.empresa_id = 'a9000000-0000-0000-0000-0000000000c0'),
  1, 'saúde conta só projeto real ativo');

SELECT is(
  (SELECT s.semanas_ativas FROM public.ops_saude_empresas() s WHERE s.empresa_id = 'a9000000-0000-0000-0000-0000000000c0'),
  4, 'semanas com uso nunca passam de 4 em 28 dias');

SELECT is(
  (SELECT s.situacao_cobranca FROM public.ops_saude_empresas() s
   WHERE s.empresa_id = 'a9000000-0000-0000-0000-0000000000c0'),
  'em_teste', 'situação da cobrança segue a assinatura');
RESET ROLE;

-- =============================================================================
-- 2. Nota de saúde (função pura)
-- =============================================================================
SELECT is(public._ops_nota_saude(0, 4, 3, 2, 0, false), 100, 'escritório ideal: 100');
SELECT is(public._ops_nota_saude(NULL, 0, 0, 0, 0, false), 0, 'nunca acessou e sem uso: 0');
SELECT is(public._ops_nota_saude(5, 2, 1, 1, 0, false), 51, 'acesso há 5 dias, 2 semanas de uso, 1 projeto, 1 usuário');
SELECT is(public._ops_nota_saude(0, 4, 3, 2, 1, true), 70, 'feedback sem resposta (-10) e atraso (-20)');
SELECT is(public._ops_nota_saude(30, 0, 0, 0, 2, true), 0, 'nota nunca fica negativa');

SELECT * FROM finish();
ROLLBACK;
