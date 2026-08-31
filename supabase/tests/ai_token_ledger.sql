-- pgTAP: motor de tokens, fundação (migration 20260867000000, SPEC 074, ADR 0035).
--
-- Prova os critérios de aceite da spec: débito em cascata (plano → comprado),
-- idempotência de retry, overdraft da chamada em voo, upsert de saldo em empresa
-- sem linha, COGS snapshot, guard de service_role, RLS multi-tenant e backfill
-- re-rodável. A corrida concorrente não é testável em sessão única de pgTAP; a
-- atomicidade vem do row lock do UPDATE dentro do trigger (mesma transação do INSERT).

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(22);

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES
  ('a70e0000-0000-0000-0000-00000000000a', 'Empresa Token A', NULL, TRUE, '{}'::jsonb),
  ('a70e0000-0000-0000-0000-00000000000b', 'Empresa Token B', NULL, TRUE, '{}'::jsonb)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

SET LOCAL session_replication_role = 'replica';
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES
  ('a70e1111-0000-0000-0000-00000000000a', 'token_a@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('a70e1111-0000-0000-0000-00000000000b', 'token_b@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
-- Volta ao modo normal: os triggers do ledger PRECISAM disparar daqui em diante.
SET LOCAL session_replication_role = 'origin';

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed)
VALUES
  ('a70e1111-0000-0000-0000-00000000000a', 'a70e0000-0000-0000-0000-00000000000a', 'Token', 'A', 'token_a@test.com', 'user', TRUE),
  ('a70e1111-0000-0000-0000-00000000000b', 'a70e0000-0000-0000-0000-00000000000b', 'Token', 'B', 'token_b@test.com', 'user', TRUE)
ON CONFLICT (id) DO UPDATE SET empresa_id = EXCLUDED.empresa_id, role = EXCLUDED.role;

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
-- 1. Créditos semeiam o saldo via trigger (plan_grant → plano, purchase → comprado)
-- =============================================
INSERT INTO public.ai_token_ledger (empresa_id, agent_key, source, tokens_delta)
VALUES
  ('a70e0000-0000-0000-0000-00000000000a', 'seed', 'plan_grant', 600),
  ('a70e0000-0000-0000-0000-00000000000a', 'seed', 'purchase', 500);

SELECT results_eq(
  $$ SELECT saldo_plano, saldo_comprado FROM public.ai_token_saldo
     WHERE empresa_id = 'a70e0000-0000-0000-0000-00000000000a' $$,
  $$ VALUES (600::bigint, 500::bigint) $$,
  'plan_grant credita saldo_plano e purchase credita saldo_comprado'
);

-- =============================================
-- 2. Débito em cascata via RPC (600/500 - 1000 → 0/100), com COGS snapshot
-- =============================================
SELECT test_set_service();

SELECT lives_ok(
  $$ SELECT * FROM public.debitar_tokens(
       'a70e0000-0000-0000-0000-00000000000a', 'a70e1111-0000-0000-0000-00000000000a',
       'chat', NULL, 'gemini-2.5-flash', 400, 600, 'turno-1') $$,
  'debitar_tokens roda como service_role'
);

SELECT results_eq(
  $$ SELECT saldo_plano, saldo_comprado FROM public.ai_token_saldo
     WHERE empresa_id = 'a70e0000-0000-0000-0000-00000000000a' $$,
  $$ VALUES (0::bigint, 100::bigint) $$,
  'débito de 1000 com saldo 600/500 zera o plano e deixa 100 no comprado (cascata)'
);

SELECT isnt(
  (SELECT custo_estimado FROM public.ai_token_ledger
   WHERE idempotency_key = 'turno-1'),
  NULL,
  'modelo com preço cadastrado grava custo_estimado (COGS snapshot)'
);

-- =============================================
-- 3. Idempotência: a mesma key não debita duas vezes
-- =============================================
SELECT lives_ok(
  $$ SELECT * FROM public.debitar_tokens(
       'a70e0000-0000-0000-0000-00000000000a', 'a70e1111-0000-0000-0000-00000000000a',
       'chat', NULL, 'gemini-2.5-flash', 400, 600, 'turno-1') $$,
  'retry com a mesma idempotency_key não é erro'
);

SELECT results_eq(
  $$ SELECT count(*)::int, (SELECT saldo_comprado FROM public.ai_token_saldo
      WHERE empresa_id = 'a70e0000-0000-0000-0000-00000000000a')
     FROM public.ai_token_ledger WHERE idempotency_key = 'turno-1' $$,
  $$ VALUES (1, 100::bigint) $$,
  'retry: uma linha só e saldo inalterado'
);

-- =============================================
-- 4. Overdraft: chamada em voo com saldo insuficiente é aceita (bloqueio é Fase 2)
-- =============================================
SELECT lives_ok(
  $$ SELECT * FROM public.debitar_tokens(
       'a70e0000-0000-0000-0000-00000000000a', 'a70e1111-0000-0000-0000-00000000000a',
       'chat', NULL, 'gemini-2.5-flash', 100, 200, 'turno-2') $$,
  'débito com saldo insuficiente é aceito (shadow mode)'
);

SELECT results_eq(
  $$ SELECT saldo_plano, saldo_comprado FROM public.ai_token_saldo
     WHERE empresa_id = 'a70e0000-0000-0000-0000-00000000000a' $$,
  $$ VALUES (0::bigint, -200::bigint) $$,
  'overdraft fica negativo no valor exato da chamada em voo'
);

-- =============================================
-- 5. Empresa sem linha de saldo: primeiro débito cria via upsert
-- =============================================
SELECT lives_ok(
  $$ SELECT * FROM public.debitar_tokens(
       'a70e0000-0000-0000-0000-00000000000b', 'a70e1111-0000-0000-0000-00000000000b',
       'chat', NULL, 'modelo-sem-preco', 30, 20, 'turno-b1') $$,
  'primeiro débito de empresa sem linha de saldo não é erro'
);

SELECT results_eq(
  $$ SELECT saldo_plano, saldo_comprado FROM public.ai_token_saldo
     WHERE empresa_id = 'a70e0000-0000-0000-0000-00000000000b' $$,
  $$ VALUES (0::bigint, -50::bigint) $$,
  'linha de saldo nasce no primeiro débito (upsert)'
);

-- =============================================
-- 6. Modelo sem preço cadastrado: débito passa, custo fica NULL
-- =============================================
SELECT is(
  (SELECT custo_estimado FROM public.ai_token_ledger WHERE idempotency_key = 'turno-b1'),
  NULL,
  'modelo sem preço em ai_model_precos grava custo_estimado NULL'
);

-- =============================================
-- 7. Guard: authenticated não executa a RPC (42501)
-- =============================================
SELECT test_set_auth('a70e1111-0000-0000-0000-00000000000a');

SELECT throws_ok(
  $$ SELECT * FROM public.debitar_tokens(
       'a70e0000-0000-0000-0000-00000000000a', 'a70e1111-0000-0000-0000-00000000000a',
       'chat', NULL, 'gemini-2.5-flash', 1, 1, 'turno-hack') $$,
  '42501',
  NULL,
  'debitar_tokens como authenticated é bloqueada (grant + guard no corpo)'
);

-- =============================================
-- 8. RLS multi-tenant: A não vê B; escrita direta é negada
-- =============================================
SELECT is(
  (SELECT count(*)::int FROM public.ai_token_ledger
   WHERE empresa_id = 'a70e0000-0000-0000-0000-00000000000b'),
  0,
  'user da empresa A não vê linhas do ledger da empresa B'
);

SELECT is(
  (SELECT count(*)::int FROM public.ai_token_saldo
   WHERE empresa_id = 'a70e0000-0000-0000-0000-00000000000b'),
  0,
  'user da empresa A não vê o saldo da empresa B'
);

SELECT throws_ok(
  $$ INSERT INTO public.ai_token_ledger (empresa_id, agent_key, source, tokens_delta)
     VALUES ('a70e0000-0000-0000-0000-00000000000a', 'hack', 'purchase', 999999) $$,
  '42501',
  NULL,
  'INSERT direto no ledger como authenticated é negado (nenhuma policy de escrita)'
);

-- =============================================
-- 9. Backfill re-rodável (mesmo INSERT...NOT EXISTS da migration 20260868000000)
-- =============================================
SELECT test_set_postgres();

INSERT INTO public.ai_usage_logs (id, empresa_id, feature_key, tokens_input, tokens_output)
VALUES ('a70e9999-0000-0000-0000-000000000001', 'a70e0000-0000-0000-0000-00000000000a', 'chat', 10, 20);

DO $do$
BEGIN
  FOR i IN 1..2 LOOP
    INSERT INTO public.ai_token_ledger (
      empresa_id, user_id, agent_key, source, tokens_input, tokens_output,
      tokens_delta, custo_estimado, model, reference_id, created_at
    )
    SELECT l.empresa_id, NULL, l.feature_key, 'usage', l.tokens_input, l.tokens_output,
           -(l.tokens_input + l.tokens_output), NULL, l.model,
           'ai_usage_logs:' || l.id, COALESCE(l.created_at, now())
    FROM public.ai_usage_logs l
    WHERE (l.tokens_input + l.tokens_output) > 0
      AND NOT EXISTS (
        SELECT 1 FROM public.ai_token_ledger t
        WHERE t.reference_id = 'ai_usage_logs:' || l.id
      );
  END LOOP;
END
$do$;

SELECT is(
  (SELECT count(*)::int FROM public.ai_token_ledger
   WHERE reference_id = 'ai_usage_logs:a70e9999-0000-0000-0000-000000000001'),
  1,
  'backfill rodado duas vezes não duplica (NOT EXISTS por reference_id)'
);

-- =============================================
-- 10. Fase 2 (spec 075): gate_tokens concede o ciclo, é idempotente e expira sobra
-- =============================================
-- Empresa C nova, sem assinatura: a cota cai no plano de entrada (starter).
INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES ('a70e0000-0000-0000-0000-00000000000c', 'Empresa Token C', NULL, TRUE, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Sobra "do ciclo anterior": grant manual com reference de um ciclo antigo, para o
-- gate do ciclo corrente ter o que expirar (não dá para viajar no tempo com now()).
INSERT INTO public.ai_token_ledger (empresa_id, agent_key, source, tokens_delta, reference_id)
VALUES ('a70e0000-0000-0000-0000-00000000000c', 'ciclo', 'plan_grant', 12000,
        'plan_grant:a70e0000-0000-0000-0000-00000000000c:2026-07');

SELECT test_set_service();

SELECT lives_ok(
  $$ SELECT * FROM public.gate_tokens('a70e0000-0000-0000-0000-00000000000c') $$,
  'gate_tokens roda como service_role'
);

-- O want cobre os dois mundos: banco com plano 'starter' seedado (staging) usa a cota
-- dele; banco sem planos (reset do zero no CI deixa a tabela vazia) cai no fallback
-- 500000 do gate_tokens, o mesmo caminho de empresa sem assinatura.
SELECT results_eq(
  $$ SELECT saldo_plano, saldo_comprado FROM public.ai_token_saldo
     WHERE empresa_id = 'a70e0000-0000-0000-0000-00000000000c' $$,
  $$ SELECT COALESCE((SELECT p.tokens_mensais FROM public.pilar_subscription_plans p WHERE p.slug = 'starter'), 500000)::bigint, 0::bigint $$,
  'gate concede a cota do ciclo e a sobra do ciclo anterior expira (use-or-lose)'
);

SELECT is(
  (SELECT tokens_delta FROM public.ai_token_ledger
   WHERE reference_id = 'plan_expire:a70e0000-0000-0000-0000-00000000000c:' || to_char(now(), 'YYYY-MM')),
  -12000,
  'a sobra expirada vira linha plan_expire no ledger (auditável)'
);

SELECT lives_ok(
  $$ SELECT * FROM public.gate_tokens('a70e0000-0000-0000-0000-00000000000c') $$,
  'gate_tokens repetido no mesmo ciclo não é erro'
);

SELECT results_eq(
  $$ SELECT count(*)::int FROM public.ai_token_ledger
     WHERE reference_id = 'plan_grant:a70e0000-0000-0000-0000-00000000000c:' || to_char(now(), 'YYYY-MM') $$,
  $$ VALUES (1) $$,
  'gate repetido no mesmo ciclo é no-op (um plan_grant só)'
);

SELECT test_set_auth('a70e1111-0000-0000-0000-00000000000a');

SELECT throws_ok(
  $$ SELECT * FROM public.gate_tokens('a70e0000-0000-0000-0000-00000000000a') $$,
  '42501',
  NULL,
  'gate_tokens como authenticated é bloqueada (grant + guard no corpo)'
);

SELECT * FROM finish();
ROLLBACK;
