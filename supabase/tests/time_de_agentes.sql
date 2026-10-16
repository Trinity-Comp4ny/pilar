-- pgTAP: time de agentes no Ultra, fases 0 e 1 (SPEC 126, ADR 0060), SPEC 129 e 130.
--
-- 1. As tabelas ops_* só abrem para ultra admin com MFA; admin de empresa e anon não
--    leem nada e ninguém grava pela API.
-- 2. A nota de saúde segue os pesos do playbook (docs/operacao/agentes/clientes.md).
-- 3. ops_receita e ops_saude_empresas recusam quem não é ultra admin e contam o
--    cadastro, a ativação, o teste vencendo e a origem UTM do jeito da spec.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(50);

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
   '{"origem": {"utm_source": "linkedin", "utm_campaign": "lancamento-2027-01", "utm_content": "dabc12345"}}'::jsonb,
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
-- 4. Fase 1: decisão da ação, pausa, chave da fila e executor (service role)
-- =============================================================================
SET LOCAL session_replication_role = 'replica';
INSERT INTO public.ops_acoes (id, agente_id, tipo, empresa_id, titulo, evidencia, chave, rascunho)
VALUES
  ('a9000000-0000-0000-0000-0000000000d1', 'receita', 'whatsapp', 'a9000000-0000-0000-0000-0000000000c0',
   'Teste vence', '{"projetos": 1}'::jsonb, 'teste:c0:2026-10-16', '{"texto": "Oi Dona"}'::jsonb),
  ('a9000000-0000-0000-0000-0000000000d2', 'clientes', 'whatsapp', 'a9000000-0000-0000-0000-0000000000c0',
   'Sem acesso', '{"dias": 9}'::jsonb, 'sem_acesso:c0:2026-10-06', '{"texto": "Oi"}'::jsonb);
SET LOCAL session_replication_role = 'origin';

SELECT throws_ok(
  $$INSERT INTO public.ops_acoes (agente_id, tipo, titulo, evidencia, chave)
    VALUES ('receita', 'whatsapp', 'Duplicada', '{}'::jsonb, 'teste:c0:2026-10-16')$$,
  '23505', NULL, 'mesma chave pendente do mesmo agente não entra duas vezes');

SELECT has_column('public', 'ops_execucoes', 'custo_usd', 'custo da execução em USD, como o ledger');

SELECT test_time_auth('a9000000-0000-0000-0000-00000000c001'); -- admin do escritório cliente
SELECT throws_ok($$SELECT public.ops_decidir_acao('a9000000-0000-0000-0000-0000000000d1', 'enviada')$$,
  '42501', NULL, 'admin de empresa não decide ação de agente');
SELECT throws_ok($$SELECT public.ops_definir_agente_ativo('receita', false)$$,
  '42501', NULL, 'admin de empresa não pausa agente');
RESET ROLE;

SELECT test_time_auth('a9000000-0000-0000-0000-00000000a001'); -- ultra admin
SELECT is(
  (SELECT status || ':' || editada::text || ':' || (rascunho ->> 'texto')
   FROM public.ops_decidir_acao('a9000000-0000-0000-0000-0000000000d1', 'enviada', 'Oi Dona, tudo certo?')),
  'executada:true:Oi Dona, tudo certo?',
  'enviada com texto editado grava o texto final e marca como editada');
SELECT throws_ok($$SELECT public.ops_decidir_acao('a9000000-0000-0000-0000-0000000000d1', 'descartada')$$,
  '22023', NULL, 'ação já decidida não volta a ser decidida');
SELECT is(
  (SELECT status || ':' || motivo_descarte FROM public.ops_decidir_acao('a9000000-0000-0000-0000-0000000000d2', 'descartada', NULL, 'já falei hoje')),
  'descartada:já falei hoje',
  'descartada guarda o motivo');
SELECT lives_ok($$SELECT public.ops_definir_agente_ativo('receita', false)$$, 'ultra admin pausa agente');
SELECT is((SELECT ativo FROM public.ops_agentes WHERE id = 'receita'), false, 'agente pausado fica inativo');
RESET ROLE;

-- Executor da Edge Function: service role lê os mesmos números da tela.
SELECT set_config('request.jwt.claims', '{"role": "service_role"}', true);
SELECT set_config('role', 'service_role', true);
SELECT lives_ok($$SELECT public.ops_receita(30)$$, 'service role (executor) lê ops_receita');
RESET ROLE;

-- =============================================================================
-- 5. Funil por UTM para a plataforma de marketing (SPEC 128)
-- =============================================================================
SELECT ok(
  NOT has_function_privilege('authenticated', 'public._ops_funil_por_utm(date, date)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public._ops_funil_por_utm(date, date)', 'EXECUTE'),
  'funil por UTM não é executável por anon nem por usuário logado');

SELECT is(
  (SELECT array_agg(a.attname::text ORDER BY a.attnum)
   FROM pg_proc p, unnest(p.proargnames) WITH ORDINALITY AS a(attname, attnum)
   WHERE p.proname = '_ops_funil_por_utm' AND a.attnum > 2),
  ARRAY['dia', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'cadastros', 'ativados', 'pagantes'],
  'funil por UTM só devolve dia, UTM e contagens (nenhum dado pessoal)');

SELECT set_config('request.jwt.claims', '{"role": "service_role"}', true);
SELECT set_config('role', 'service_role', true);
SELECT is(
  (SELECT cadastros || ':' || ativados || ':' || pagantes FROM public._ops_funil_por_utm(current_date - 1, current_date + 1)
   WHERE utm_content = 'dabc12345'),
  '1:1:0',
  'o cadastro do link conta pelo utm_content, ativado por ter projeto real');
RESET ROLE;

SELECT is((SELECT ativo FROM public.ops_agentes WHERE id = 'marketing'), false,
  'Marketing não roda no Pilar: vive na plataforma de marketing');

-- =============================================================================
-- 6. SPEC 129: empresa interna, tendência, profundidade de uso e resultado do contato
-- =============================================================================
SET LOCAL session_replication_role = 'replica';
-- Retrato de 7 dias atrás com nota 90 para o escritório cliente.
INSERT INTO public.ops_metricas_diarias (data, fonte, chave, dimensao, valor)
VALUES (current_date - 7, 'pilar', 'nota_saude', 'a9000000-0000-0000-0000-0000000000c0', 90);
-- Uso de projetos e financeiro nos últimos dias.
INSERT INTO public.audit_logs (empresa_id, action, target_table, created_at)
VALUES ('a9000000-0000-0000-0000-0000000000c0', 'insert', 'lancamentos', now() - interval '2 days');
-- Contato de teste vencendo enviado há 8 dias; a empresa já paga.
INSERT INTO public.ops_acoes (id, agente_id, tipo, empresa_id, titulo, evidencia, chave, status, executada_em)
VALUES ('a9000000-0000-0000-0000-0000000000e1', 'receita', 'whatsapp', 'a9000000-0000-0000-0000-0000000000c0',
        'Teste vence', '{"motivo": "teste_vencendo"}'::jsonb, 'teste:c0:antigo', 'executada', now() - interval '8 days'),
       ('a9000000-0000-0000-0000-0000000000e2', 'receita', 'whatsapp', 'a9000000-0000-0000-0000-0000000000c0',
        'Atraso', '{"motivo": "pagamento_em_atraso"}'::jsonb, 'atraso:c0:antigo', 'executada', now() - interval '2 days');
SET LOCAL session_replication_role = 'origin';

SELECT test_time_auth('a9000000-0000-0000-0000-00000000a001'); -- ultra admin
SELECT is(
  (SELECT s.nota_7d || ':' || s.modulos_usados || ':' || s.estagio FROM public.ops_saude_empresas() s
   WHERE s.empresa_id = 'a9000000-0000-0000-0000-0000000000c0'),
  '90:2:onboarding',
  'saúde traz a nota de 7 dias atrás, os módulos usados e o estágio');
SELECT lives_ok($$SELECT public.ops_marcar_empresa_interna('a9000000-0000-0000-0000-0000000000c0', true)$$,
  'ultra admin marca empresa de teste');
SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.ops_saude_empresas() s WHERE s.empresa_id = 'a9000000-0000-0000-0000-0000000000c0'),
  'empresa de teste sai da saúde');
SELECT ok(
  NOT ((public.ops_receita(30) -> 'por_origem') @> '[{"campanha": "lancamento-2027-01"}]'),
  'empresa de teste sai da receita');
SELECT lives_ok($$SELECT public.ops_marcar_empresa_interna('a9000000-0000-0000-0000-0000000000c0', false)$$,
  'ultra admin desmarca');
RESET ROLE;

SELECT test_time_auth('a9000000-0000-0000-0000-00000000c001'); -- admin do escritório
SELECT throws_ok($$SELECT public.ops_marcar_empresa_interna('a9000000-0000-0000-0000-0000000000c0', true)$$,
  '42501', NULL, 'admin de empresa não marca a própria como teste');
RESET ROLE;

-- O fixture deixou a assinatura em teste: vira pagante para o contato antigo funcionar.
UPDATE public.pilar_subscriptions SET status = 'active', asaas_subscription_id = 'sub_teste'
 WHERE empresa_id = 'a9000000-0000-0000-0000-0000000000c0';
SELECT is(public._ops_avaliar_contatos(), 1, 'avalia só o contato enviado há 7 dias ou mais');
SELECT is(
  (SELECT resultado ->> 'efeito' FROM public.ops_acoes WHERE id = 'a9000000-0000-0000-0000-0000000000e1'),
  'funcionou',
  'teste que virou pagante conta como contato que funcionou');

-- =============================================================================
-- 7. SPEC 130: agente Produto e marcos de ativação
-- =============================================================================
SET LOCAL session_replication_role = 'replica';
INSERT INTO public.feature_suggestions (empresa_id, tipo, titulo, descricao, status_interno, created_by)
VALUES ('a9000000-0000-0000-0000-0000000000c0', 'bug', 'Relatório trava', 'Ao exportar', 'novo',
        'a9000000-0000-0000-0000-00000000c001');
-- Contatos de ativação enviados há 8 e 9 dias. Lançamento no Financeiro há 2 dias (seção 6)
-- conta para "segundo módulo"; a empresa segue com uma pessoa só, então "equipe" falhou.
INSERT INTO public.ops_acoes (id, agente_id, tipo, empresa_id, titulo, evidencia, chave, status, executada_em)
VALUES ('a9000000-0000-0000-0000-0000000000e3', 'clientes', 'whatsapp', 'a9000000-0000-0000-0000-0000000000c0',
        'Equipe', '{"motivo": "ativacao", "marco": "equipe"}'::jsonb, 'ativacao:c0:equipe', 'executada',
        now() - interval '9 days'),
       ('a9000000-0000-0000-0000-0000000000e4', 'clientes', 'whatsapp', 'a9000000-0000-0000-0000-0000000000c0',
        'Segundo módulo', '{"motivo": "ativacao", "marco": "segundo_modulo"}'::jsonb, 'ativacao:c0:segundo_modulo',
        'executada', now() - interval '8 days');
SET LOCAL session_replication_role = 'origin';

SELECT test_time_auth('a9000000-0000-0000-0000-00000000a001'); -- ultra admin
SELECT is(jsonb_array_length(public.ops_produto() -> 'modulos'), 7, 'produto lista as 7 áreas, mesmo sem uso');
SELECT is(
  (SELECT (m ->> 'empresas_28d')::int FROM jsonb_array_elements(public.ops_produto() -> 'modulos') m
   WHERE m ->> 'modulo' = 'financeiro'),
  1,
  'lançamento recente conta o escritório no Financeiro');
SELECT ok((public.ops_produto() #>> '{feedback_30d,bugs_sem_triagem}')::int >= 1, 'bug novo entra como sem triagem');
RESET ROLE;

SELECT test_time_auth('a9000000-0000-0000-0000-00000000c001'); -- admin do escritório
SELECT throws_ok($$SELECT public.ops_produto()$$, '42501', NULL, 'admin de empresa não vê o uso do produto');
RESET ROLE;

SELECT is(public._ops_avaliar_contatos(), 2, 'avalia os dois contatos de ativação');
SELECT is(
  (SELECT string_agg(resultado ->> 'efeito', ',' ORDER BY id) FROM public.ops_acoes
   WHERE id IN ('a9000000-0000-0000-0000-0000000000e3', 'a9000000-0000-0000-0000-0000000000e4')),
  'nao_funcionou,funcionou',
  'ativação mede o marco: equipe segue com uma pessoa, Financeiro foi usado');
SELECT is(
  (SELECT ativo::text || ':' || cron FROM public.ops_agentes WHERE id = 'produto'),
  'true:7 10 * * 1',
  'Produto ligado, toda segunda às 7h07 de Brasília');

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
