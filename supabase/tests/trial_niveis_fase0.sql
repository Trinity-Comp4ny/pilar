-- pgTAP: SPEC 098 Fase 0 (migration 20260920000000). Prova o vetor de abuso
-- fechado: trial novo ganha teto fixo (não mensal) de tokens, circuit breaker
-- diário não afeta quem paga nem quem é legado, plano de entrada substitui o
-- destaque no signup self-serve, domínio descartável é recusado, e-mail não
-- confirmado bloqueia criar projeto (mas não bloqueia service_role/postgres).

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(24);

CREATE OR REPLACE FUNCTION test_set_auth(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

CREATE OR REPLACE FUNCTION test_set_service()
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  PERFORM set_config('role', 'service_role', true);
END; $$;

CREATE OR REPLACE FUNCTION test_set_postgres()
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('role', 'postgres', true);
END; $$;

-- =============================================
-- Setup: 3 empresas via caminho normal (sem replica bypass) pra provar o gate
-- de tokens; trigger de auth.users/handle_new_user roda de verdade nelas.
-- =============================================

SELECT test_set_postgres();

-- `supabase db reset --no-seed` (igual o CI) não carrega supabase/seed.sql: sem
-- isso, pilar_subscription_plans fica vazia e handle_new_user não acha plano
-- nenhum pra atribuir. Seed mínimo e autocontido, mesmo padrão de valores da
-- migration 027 (starter mais barato de todos, pro é o destaque).
INSERT INTO public.pilar_subscription_plans
  (slug, nome, preco_mensal, max_usuarios, max_projetos, tokens_mensais, destaque, ativo, ordem)
VALUES
  ('starter', 'Essencial', 490.00, NULL, 15, 500000, FALSE, TRUE, 1),
  ('pro', 'Profissional', 690.00, NULL, 40, 2000000, TRUE, TRUE, 2),
  ('enterprise', 'Escala', 1290.00, NULL, NULL, 8000000, FALSE, TRUE, 3)
ON CONFLICT (slug) DO UPDATE SET
  preco_mensal = EXCLUDED.preco_mensal,
  tokens_mensais = EXCLUDED.tokens_mensais,
  destaque = EXCLUDED.destaque,
  ativo = EXCLUDED.ativo;

-- Empresa TRIAL NOVA (via signup self-serve real, sem invite_token): prova
-- plano de entrada + teto fixo de tokens.
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role, email_confirmed_at)
VALUES (
  'fa5e1111-0000-0000-0000-00000000000a', 'fase0_trial_a@empresareal.com.br',
  jsonb_build_object('company_name', 'Fase0 Trial A'), 'authenticated', 'authenticated', NULL
);

-- Empresa TRIAL NOVA "B" (mesmo caminho), usada como gastadora pesada do dia
-- pra estourar o circuit breaker antes de testar a empresa C.
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role, email_confirmed_at)
VALUES (
  'fa5e1111-0000-0000-0000-00000000000b', 'fase0_trial_b@empresareal.com.br',
  jsonb_build_object('company_name', 'Fase0 Trial B'), 'authenticated', 'authenticated', now()
);

-- Empresa LEGADA: existia antes do deploy (simulado via override manual direto,
-- já que o backfill da migration só rodou sobre quem existia NELA, não sobre
-- quem este teste cria depois). Ainda assim prova o comportamento correto:
-- override presente = comportamento antigo (cota mensal do plano), sem teto.
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role, email_confirmed_at)
VALUES (
  'fa5e1111-0000-0000-0000-00000000000c', 'fase0_legado@empresareal.com.br',
  jsonb_build_object('company_name', 'Fase0 Legado'), 'authenticated', 'authenticated', now()
);
UPDATE public.empresas SET nivel_override = 'ouro', nivel_override_motivo = 'legado', nivel_override_em = now()
WHERE owner_id = 'fa5e1111-0000-0000-0000-00000000000c';

-- Empresa ATIVA (pagante): status active, sem override. Prova que o ramo trial
-- só se aplica a quem está 'trialing' de verdade.
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role, email_confirmed_at)
VALUES (
  'fa5e1111-0000-0000-0000-00000000000d', 'fase0_ativa@empresareal.com.br',
  jsonb_build_object('company_name', 'Fase0 Ativa'), 'authenticated', 'authenticated', now()
);
UPDATE public.pilar_subscriptions SET status = 'active'
WHERE empresa_id = (SELECT id FROM public.empresas WHERE owner_id = 'fa5e1111-0000-0000-0000-00000000000d');

-- =============================================
-- 1. handle_new_user: trial nasce no plano de entrada (Essencial/starter), não
--    no destaque (Profissional/pro).
-- =============================================
SELECT is(
  (SELECT s.plan_id FROM public.pilar_subscriptions s
     JOIN public.empresas e ON e.id = s.empresa_id
     WHERE e.owner_id = 'fa5e1111-0000-0000-0000-00000000000a'),
  (SELECT id FROM public.pilar_subscription_plans WHERE slug = 'starter'),
  'signup self-serve novo nasce no plano starter (menor preço ativo), não no destaque'
);

SELECT isnt(
  (SELECT s.plan_id FROM public.pilar_subscriptions s
     JOIN public.empresas e ON e.id = s.empresa_id
     WHERE e.owner_id = 'fa5e1111-0000-0000-0000-00000000000a'),
  (SELECT id FROM public.pilar_subscription_plans WHERE slug = 'pro'),
  'signup self-serve novo NÃO nasce no plano pro (destaque)'
);

-- =============================================
-- 2. Domínio descartável: recusado no self-serve; convite com o mesmo domínio
--    passa direto (token presente = fora do escopo do bloqueio).
-- =============================================
SELECT throws_ok(
  $$INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
    VALUES ('fa5e2222-0000-0000-0000-00000000000a', 'oi@mailinator.com', '{}'::jsonb, 'authenticated', 'authenticated')$$,
  'P0001',
  'Use o e-mail da sua empresa para criar a conta.',
  'domínio descartável (mailinator.com) é recusado no self-serve'
);

-- Empresa "convidadora" pra testar o bypass do bloqueio de domínio via convite.
INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES ('fa5e0000-0000-0000-0000-00000000000e', 'Fase0 Convidadora', NULL, TRUE, '{}'::jsonb);

SET LOCAL session_replication_role = 'replica';
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role, email_confirmed_at)
VALUES ('fa5e1111-0000-0000-0000-00000000000e', 'admin_convidadora@empresareal.com.br', '{}'::jsonb, 'authenticated', 'authenticated', now());
SET LOCAL session_replication_role = 'origin';
INSERT INTO public.profiles (id, empresa_id, first_name, email, role, onboarding_completed)
VALUES ('fa5e1111-0000-0000-0000-00000000000e', 'fa5e0000-0000-0000-0000-00000000000e', 'Admin', 'admin_convidadora@empresareal.com.br', 'admin', TRUE);

INSERT INTO public.convites (empresa_id, email, cargo, token_hash, expira_em)
VALUES (
  'fa5e0000-0000-0000-0000-00000000000e', 'convidado@mailinator.com', 'user',
  encode(extensions.digest('token-fase0-mailinator', 'sha256'), 'hex'),
  now() + interval '7 days'
);

SELECT lives_ok(
  $$INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
    VALUES ('fa5e2222-0000-0000-0000-00000000000b', 'convidado@mailinator.com',
      jsonb_build_object('invite_token', 'token-fase0-mailinator'), 'authenticated', 'authenticated')$$,
  'convite com e-mail de domínio descartável passa direto (token presente = fora do escopo)'
);

-- =============================================
-- 3. E-mail confirmado: bloqueia criar projeto por sessão authenticated sem
--    confirmar; libera depois de confirmar; service_role/postgres não são
--    afetados (precisam poder criar projeto de exemplo/import sem sessão).
-- =============================================
SELECT test_set_auth('fa5e1111-0000-0000-0000-00000000000a'); -- e-mail_confirmed_at NULL
SELECT throws_ok(
  $$INSERT INTO public.projetos (empresa_id, nome)
    VALUES ((SELECT empresa_id FROM public.profiles WHERE id = 'fa5e1111-0000-0000-0000-00000000000a'), 'Projeto sem confirmar')$$,
  'P0001',
  'Confirme seu e-mail para continuar.',
  'criar projeto falha pra usuário autenticado com e-mail não confirmado'
);

SELECT test_set_postgres();
UPDATE auth.users SET email_confirmed_at = now() WHERE id = 'fa5e1111-0000-0000-0000-00000000000a';
SELECT test_set_auth('fa5e1111-0000-0000-0000-00000000000a');
SELECT lives_ok(
  $$INSERT INTO public.projetos (empresa_id, nome)
    VALUES ((SELECT empresa_id FROM public.profiles WHERE id = 'fa5e1111-0000-0000-0000-00000000000a'), 'Projeto confirmado')$$,
  'criar projeto funciona depois de confirmar o e-mail'
);

SELECT test_set_service();
SELECT lives_ok(
  $$INSERT INTO public.projetos (empresa_id, nome)
    VALUES ('fa5e0000-0000-0000-0000-00000000000e', 'Projeto via service_role')$$,
  'service_role cria projeto sem passar pelo gate de e-mail confirmado'
);

SELECT test_set_postgres();

-- =============================================
-- 4. gate_tokens: trial novo ganha teto FIXO (não mensal), uma vez só.
-- =============================================
-- SPEC 098 Fase 1 substituiu o teto único (platform_settings.trial_tokens_bronze,
-- coluna dropada) por teto por nível em trial_niveis. Bronze é o nível de quem
-- ainda não informou documento nenhum (caso das empresas deste arquivo).
SELECT is(
  (SELECT t.tokens_total FROM public.trial_niveis t WHERE t.nivel = 'bronze'),
  50000::bigint,
  'trial_niveis (Fase 1): teto do trial Bronze = 50.000 tokens'
);

DO $$
DECLARE v_empresa_a uuid;
BEGIN
  SELECT id INTO v_empresa_a FROM public.empresas WHERE owner_id = 'fa5e1111-0000-0000-0000-00000000000a';
  PERFORM public.gate_tokens(v_empresa_a);
END $$;

SELECT is(
  (SELECT s.saldo_plano FROM public.ai_token_saldo s
     JOIN public.empresas e ON e.id = s.empresa_id
     WHERE e.owner_id = 'fa5e1111-0000-0000-0000-00000000000a'),
  50000::bigint,
  'trial novo recebe exatamente o teto fixo (50.000), não a cota mensal do plano starter'
);

SELECT is(
  (SELECT count(*)::int FROM public.ai_token_ledger t
     JOIN public.empresas e ON e.id = t.empresa_id
     WHERE e.owner_id = 'fa5e1111-0000-0000-0000-00000000000a' AND t.reference_id LIKE 'trial_grant:%'),
  1,
  'grant do trial tem referência trial_grant (não plan_grant mensal), uma linha só'
);

-- Segunda chamada no mesmo dia não duplica o grant (idempotência).
DO $$
DECLARE v_empresa_a uuid;
BEGIN
  SELECT id INTO v_empresa_a FROM public.empresas WHERE owner_id = 'fa5e1111-0000-0000-0000-00000000000a';
  PERFORM public.gate_tokens(v_empresa_a);
  PERFORM public.gate_tokens(v_empresa_a);
END $$;

SELECT is(
  (SELECT count(*)::int FROM public.ai_token_ledger t
     JOIN public.empresas e ON e.id = t.empresa_id
     WHERE e.owner_id = 'fa5e1111-0000-0000-0000-00000000000a' AND t.reference_id LIKE 'trial_grant:%'),
  1,
  'chamar gate_tokens de novo no mesmo dia não concede o teto do trial de novo'
);

-- =============================================
-- 5. gate_tokens: legado (override ouro) e ativa (status active) mantêm a cota
--    MENSAL do plano — nunca o teto fixo do trial.
-- =============================================
DO $$
DECLARE v_empresa_legado uuid;
BEGIN
  SELECT id INTO v_empresa_legado FROM public.empresas WHERE owner_id = 'fa5e1111-0000-0000-0000-00000000000c';
  PERFORM public.gate_tokens(v_empresa_legado);
END $$;

SELECT ok(
  (SELECT s.saldo_plano FROM public.ai_token_saldo s
     JOIN public.empresas e ON e.id = s.empresa_id
     WHERE e.owner_id = 'fa5e1111-0000-0000-0000-00000000000c') > 50000,
  'empresa legada (override ouro) recebe a cota mensal do plano, maior que o teto do trial'
);

SELECT is(
  (SELECT count(*)::int FROM public.ai_token_ledger t
     JOIN public.empresas e ON e.id = t.empresa_id
     WHERE e.owner_id = 'fa5e1111-0000-0000-0000-00000000000c' AND t.reference_id LIKE 'trial_grant:%'),
  0,
  'empresa legada nunca recebe grant trial_grant'
);

DO $$
DECLARE v_empresa_ativa uuid;
BEGIN
  SELECT id INTO v_empresa_ativa FROM public.empresas WHERE owner_id = 'fa5e1111-0000-0000-0000-00000000000d';
  PERFORM public.gate_tokens(v_empresa_ativa);
END $$;

SELECT is(
  (SELECT count(*)::int FROM public.ai_token_ledger t
     JOIN public.empresas e ON e.id = t.empresa_id
     WHERE e.owner_id = 'fa5e1111-0000-0000-0000-00000000000d' AND t.reference_id LIKE 'trial_grant:%'),
  0,
  'empresa ativa (pagante) nunca recebe grant trial_grant'
);

-- =============================================
-- 6. Circuit breaker: gasto agregado do dia de trials novos estoura o teto
--    diário → bloqueia um trial novo DIFERENTE, mesmo com saldo próprio; não
--    afeta legado nem ativa.
-- =============================================
UPDATE public.platform_settings SET trial_ai_daily_cap_tokens = 100000 WHERE id = 'default';

DO $$
DECLARE v_empresa_b uuid;
BEGIN
  SELECT id INTO v_empresa_b FROM public.empresas WHERE owner_id = 'fa5e1111-0000-0000-0000-00000000000b';
  PERFORM public.gate_tokens(v_empresa_b); -- concede o teto do trial pra B também
  INSERT INTO public.ai_token_ledger (empresa_id, agent_key, source, tokens_delta, reference_id)
  VALUES (v_empresa_b, 'chat', 'usage', -120000, 'usage:fase0-breaker-b');
END $$;

SELECT is(
  (SELECT bloqueado_motivo FROM public.gate_tokens(
    (SELECT id FROM public.empresas WHERE owner_id = 'fa5e1111-0000-0000-0000-00000000000a')
  )),
  'trial_pausado',
  'circuit breaker bloqueia trial novo quando o gasto agregado do dia estoura o teto, mesmo com saldo próprio disponível'
);

SELECT is(
  (SELECT bloqueado_motivo FROM public.gate_tokens(
    (SELECT id FROM public.empresas WHERE owner_id = 'fa5e1111-0000-0000-0000-00000000000c')
  )),
  NULL,
  'circuit breaker NÃO afeta empresa legada mesmo com o teto diário de trials estourado'
);

SELECT is(
  (SELECT bloqueado_motivo FROM public.gate_tokens(
    (SELECT id FROM public.empresas WHERE owner_id = 'fa5e1111-0000-0000-0000-00000000000d')
  )),
  NULL,
  'circuit breaker NÃO afeta empresa ativa (pagante) mesmo com o teto diário de trials estourado'
);

-- =============================================
-- 7. gate_tokens: apenas service_role/postgres podem executar (regra pré-existente).
-- =============================================
SELECT test_set_auth('fa5e1111-0000-0000-0000-00000000000a');
SELECT throws_ok(
  $$SELECT public.gate_tokens((SELECT id FROM public.empresas WHERE owner_id = 'fa5e1111-0000-0000-0000-00000000000a'))$$,
  '42501',
  NULL,
  'usuário autenticado comum não pode chamar gate_tokens diretamente'
);
SELECT test_set_postgres();

-- =============================================
-- 8. RLS: platform_settings e email_dominios_bloqueados só pro ultra_admin.
-- =============================================
SELECT test_set_auth('fa5e1111-0000-0000-0000-00000000000a'); -- admin comum, não ultra_admin
SELECT is(
  (SELECT count(*)::int FROM public.platform_settings),
  0,
  'admin comum (não ultra_admin) não enxerga platform_settings via RLS'
);
SELECT is(
  (SELECT count(*)::int FROM public.email_dominios_bloqueados),
  0,
  'admin comum (não ultra_admin) não enxerga email_dominios_bloqueados via RLS'
);

SELECT test_set_service();
UPDATE public.profiles SET role = 'ultra_admin' WHERE id = 'fa5e1111-0000-0000-0000-00000000000a';
SELECT test_set_auth('fa5e1111-0000-0000-0000-00000000000a');
SELECT ok(
  (SELECT count(*)::int FROM public.platform_settings) >= 1,
  'ultra_admin enxerga platform_settings via RLS'
);
SELECT ok(
  (SELECT count(*)::int FROM public.email_dominios_bloqueados) >= 1,
  'ultra_admin enxerga email_dominios_bloqueados via RLS (com o seed de domínios descartáveis)'
);

-- =============================================
-- 9. Backfill de nível: empresa marcada como legado tem motivo e timestamp.
-- =============================================
SELECT test_set_postgres();
SELECT is(
  (SELECT nivel_override_motivo FROM public.empresas WHERE owner_id = 'fa5e1111-0000-0000-0000-00000000000c'),
  'legado',
  'empresa marcada manualmente com override ouro/legado tem motivo registrado'
);
SELECT isnt(
  (SELECT nivel_override_em FROM public.empresas WHERE owner_id = 'fa5e1111-0000-0000-0000-00000000000c'),
  NULL,
  'override legado registra timestamp'
);

SELECT * FROM finish();
ROLLBACK;
