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

SELECT plan(31);

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

-- =============================================
-- 11. Fase 4/5 (spec 076): bypass de RLS pra ultra_admin no ledger/saldo/extrato
-- =============================================
-- Volta a postgres (superuser) antes de mexer em session_replication_role: o teste
-- anterior deixou o role como 'authenticated', que não tem esse privilégio.
SELECT test_set_postgres();

SET LOCAL session_replication_role = 'replica';
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES ('a70e1111-0000-0000-0000-0000000000ff', 'ultra@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
SET LOCAL session_replication_role = 'origin';

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed)
VALUES ('a70e1111-0000-0000-0000-0000000000ff', 'a70e0000-0000-0000-0000-00000000000b', 'Ultra', 'Admin', 'ultra@test.com', 'ultra_admin', TRUE)
ON CONFLICT (id) DO UPDATE SET role = 'ultra_admin';

SELECT test_set_auth('a70e1111-0000-0000-0000-0000000000ff');

SELECT ok(
  (SELECT count(*) FROM public.ai_token_ledger WHERE empresa_id = 'a70e0000-0000-0000-0000-00000000000a') > 0,
  'ultra_admin vê linhas do ledger de empresa que não é a sua (bypass de RLS)'
);

SELECT ok(
  (SELECT count(*) FROM public.ai_token_saldo WHERE empresa_id = 'a70e0000-0000-0000-0000-00000000000a') > 0,
  'ultra_admin vê o saldo de empresa que não é a sua (bypass de RLS)'
);

SELECT ok(
  (SELECT count(*) FROM public.v_extrato_tokens WHERE empresa_id = 'a70e0000-0000-0000-0000-00000000000a') > 0,
  'ultra_admin vê o extrato (view) de empresa que não é a sua'
);

-- Volta pro usuário comum: continua sem ver a empresa alheia (a policy é OR, não troca).
SELECT test_set_auth('a70e1111-0000-0000-0000-00000000000b');

SELECT is(
  (SELECT count(*)::int FROM public.ai_token_ledger WHERE empresa_id = 'a70e0000-0000-0000-0000-00000000000a'),
  0,
  'usuário comum da empresa B continua sem ver o ledger da empresa A'
);

-- =============================================
-- 12. Fase 4/5 (spec 076): alerta de saldo baixo, idempotente
-- =============================================
SELECT test_set_postgres();

-- Empresa C (spec 075) já tem assinatura ausente → cota starter. Debita quase tudo
-- pra ficar abaixo de 10%.
SELECT test_set_service();
SELECT public.debitar_tokens(
  'a70e0000-0000-0000-0000-00000000000c', NULL, 'consumo-total', NULL, 'gemini-2.5-flash',
  1, 999000, 'zera-saldo-c');
SELECT test_set_postgres();

-- Empresa C precisa de um dono pra receber a notificação (_notif_gestao exige owner/admin).
SET LOCAL session_replication_role = 'replica';
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES ('a70e1111-0000-0000-0000-00000000000c', 'dono_c@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
SET LOCAL session_replication_role = 'origin';

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed)
VALUES ('a70e1111-0000-0000-0000-00000000000c', 'a70e0000-0000-0000-0000-00000000000c', 'Dono', 'C', 'dono_c@test.com', 'owner', TRUE)
ON CONFLICT (id) DO UPDATE SET empresa_id = EXCLUDED.empresa_id, role = 'owner';

SELECT public.gerar_notificacoes_ambient();

SELECT is(
  (SELECT count(*)::int FROM public.notificacoes
   WHERE destinatario_id = 'a70e1111-0000-0000-0000-00000000000c' AND tipo = 'tokens_baixo'),
  1,
  'saldo abaixo de 10% da cota gera notificação tokens_baixo pro dono da empresa'
);

SELECT public.gerar_notificacoes_ambient();

SELECT is(
  (SELECT count(*)::int FROM public.notificacoes
   WHERE destinatario_id = 'a70e1111-0000-0000-0000-00000000000c' AND tipo = 'tokens_baixo'),
  1,
  'rodar de novo sem ler a notificação anterior não duplica (dedupe do notificar())'
);

-- =============================================
-- 13. SPEC 085: v_uso_tokens_anomalia_diaria (alerta de gasto anômalo, ultra-admin)
-- =============================================
SELECT test_set_postgres();

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES
  ('a70e0000-0000-0000-0000-00000000000d', 'Empresa Token D (anomalia)', NULL, TRUE, '{}'::jsonb),
  ('a70e0000-0000-0000-0000-00000000000e', 'Empresa Token E (sem historico)', NULL, TRUE, '{}'::jsonb),
  ('a70e0000-0000-0000-0000-00000000000f', 'Empresa Token F (uso normal)', NULL, TRUE, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Empresa D: 3 dias anteriores com 2000 tokens/dia (baseline suficiente) + hoje com
-- 50000 (>10x a média de 2000 e acima do piso de 20000) → anomalia = true.
INSERT INTO public.ai_token_ledger (empresa_id, agent_key, source, tokens_input, tokens_output, tokens_delta, created_at)
VALUES
  ('a70e0000-0000-0000-0000-00000000000d', 'chat', 'usage', 1000, 1000, -2000, now() - interval '3 days'),
  ('a70e0000-0000-0000-0000-00000000000d', 'chat', 'usage', 1000, 1000, -2000, now() - interval '2 days'),
  ('a70e0000-0000-0000-0000-00000000000d', 'chat', 'usage', 1000, 1000, -2000, now() - interval '1 days'),
  ('a70e0000-0000-0000-0000-00000000000d', 'chat', 'usage', 25000, 25000, -50000, now());

SELECT results_eq(
  $$ SELECT tokens_hoje, dias_com_uso_anteriores, anomalia FROM public.v_uso_tokens_anomalia_diaria
     WHERE empresa_id = 'a70e0000-0000-0000-0000-00000000000d' $$,
  $$ VALUES (50000::bigint, 3, true) $$,
  'gasto de hoje 25x a média com baseline de 3 dias marca anomalia'
);

-- Empresa E: só 1 dia de histórico anterior (baseline insuficiente) + hoje com salto
-- gigante (100000) → não marca anomalia (falta de histórico impede o cálculo confiável).
INSERT INTO public.ai_token_ledger (empresa_id, agent_key, source, tokens_input, tokens_output, tokens_delta, created_at)
VALUES
  ('a70e0000-0000-0000-0000-00000000000e', 'chat', 'usage', 250, 250, -500, now() - interval '1 days'),
  ('a70e0000-0000-0000-0000-00000000000e', 'chat', 'usage', 50000, 50000, -100000, now());

SELECT is(
  (SELECT anomalia FROM public.v_uso_tokens_anomalia_diaria WHERE empresa_id = 'a70e0000-0000-0000-0000-00000000000e'),
  false,
  'menos de 3 dias de historico anterior nunca marca anomalia, mesmo com salto grande'
);

-- Empresa F: 3 dias anteriores com 5000 tokens/dia + hoje com 6000 (1.2x, dentro do
-- normal) → não marca anomalia.
INSERT INTO public.ai_token_ledger (empresa_id, agent_key, source, tokens_input, tokens_output, tokens_delta, created_at)
VALUES
  ('a70e0000-0000-0000-0000-00000000000f', 'chat', 'usage', 2500, 2500, -5000, now() - interval '3 days'),
  ('a70e0000-0000-0000-0000-00000000000f', 'chat', 'usage', 2500, 2500, -5000, now() - interval '2 days'),
  ('a70e0000-0000-0000-0000-00000000000f', 'chat', 'usage', 2500, 2500, -5000, now() - interval '1 days'),
  ('a70e0000-0000-0000-0000-00000000000f', 'chat', 'usage', 3000, 3000, -6000, now());

SELECT is(
  (SELECT anomalia FROM public.v_uso_tokens_anomalia_diaria WHERE empresa_id = 'a70e0000-0000-0000-0000-00000000000f'),
  false,
  'gasto de hoje dentro da faixa normal (menos de 10x a media) nao marca anomalia'
);

SELECT * FROM finish();
ROLLBACK;
