-- pgTAP: compra de pacote de tokens (migration 20260885000000, SPEC 077).
--
-- Prova RLS multi-tenant da tabela nova e a idempotência do crédito no ledger
-- que o webhook (pilar-checkout-webhook) faz via INSERT ... ON CONFLICT DO NOTHING
-- sobre reference_id (mesma técnica já provada em ai_token_ledger.sql para outros
-- sources; aqui replicamos o INSERT exato que o webhook executa).

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(8);

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES
  ('b70e0000-0000-0000-0000-00000000000a', 'Empresa Pack A', NULL, TRUE, '{}'::jsonb),
  ('b70e0000-0000-0000-0000-00000000000b', 'Empresa Pack B', NULL, TRUE, '{}'::jsonb)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

SET LOCAL session_replication_role = 'replica';
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES
  ('b70e1111-0000-0000-0000-00000000000a', 'pack_a@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('b70e1111-0000-0000-0000-00000000000b', 'pack_b@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
SET LOCAL session_replication_role = 'origin';

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed)
VALUES
  ('b70e1111-0000-0000-0000-00000000000a', 'b70e0000-0000-0000-0000-00000000000a', 'Pack', 'A', 'pack_a@test.com', 'admin', TRUE),
  ('b70e1111-0000-0000-0000-00000000000b', 'b70e0000-0000-0000-0000-00000000000b', 'Pack', 'B', 'pack_b@test.com', 'admin', TRUE)
ON CONFLICT (id) DO UPDATE SET empresa_id = EXCLUDED.empresa_id, role = EXCLUDED.role;

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

CREATE OR REPLACE FUNCTION test_set_service()
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  PERFORM set_config('role', 'service_role', true);
END; $$;

-- =============================================
-- 1. Compra criada (como o service_role da edge function faria)
-- =============================================
SELECT test_set_postgres();

INSERT INTO public.pilar_token_pack_purchases
  (id, empresa_id, user_id, quantidade_pacotes, tokens_pacote, valor_centavos, billing_type, status, asaas_payment_id)
VALUES
  ('b70e2222-0000-0000-0000-00000000000a', 'b70e0000-0000-0000-0000-00000000000a',
   'b70e1111-0000-0000-0000-00000000000a', 2, 500000, 9800, 'PIX', 'pending', 'pay_teste_pack_1');

-- =============================================
-- 2. RLS: empresa A vê a própria compra, empresa B não vê
-- =============================================
SELECT test_set_auth('b70e1111-0000-0000-0000-00000000000a');

SELECT is(
  (SELECT count(*)::int FROM public.pilar_token_pack_purchases
   WHERE id = 'b70e2222-0000-0000-0000-00000000000a'),
  1,
  'empresa dona vê a própria compra de pacote'
);

SELECT test_set_auth('b70e1111-0000-0000-0000-00000000000b');

SELECT is(
  (SELECT count(*)::int FROM public.pilar_token_pack_purchases
   WHERE id = 'b70e2222-0000-0000-0000-00000000000a'),
  0,
  'empresa B não vê compra de pacote da empresa A'
);

SELECT throws_ok(
  $$ INSERT INTO public.pilar_token_pack_purchases
       (empresa_id, quantidade_pacotes, valor_centavos, billing_type)
     VALUES ('b70e0000-0000-0000-0000-00000000000b', 1, 4900, 'PIX') $$,
  '42501',
  NULL,
  'INSERT direto como authenticated é negado (escrita só por service_role)'
);

-- =============================================
-- 3. Crédito no ledger: exatamente o INSERT que o webhook executa na confirmação
-- =============================================
SELECT test_set_postgres();

INSERT INTO public.ai_token_ledger (empresa_id, user_id, agent_key, source, tokens_delta, reference_id)
VALUES (
  'b70e0000-0000-0000-0000-00000000000a', 'b70e1111-0000-0000-0000-00000000000a', 'compra', 'purchase',
  2 * 500000, 'token_pack_purchase:b70e2222-0000-0000-0000-00000000000a'
)
ON CONFLICT (reference_id) WHERE reference_id IS NOT NULL DO NOTHING;

SELECT results_eq(
  $$ SELECT saldo_plano, saldo_comprado FROM public.ai_token_saldo
     WHERE empresa_id = 'b70e0000-0000-0000-0000-00000000000a' $$,
  $$ VALUES (0::bigint, 1000000::bigint) $$,
  'confirmação credita exatamente quantidade_pacotes * tokens_pacote no saldo_comprado'
);

-- =============================================
-- 4. Replay do webhook: o mesmo evento reprocessado não credita de novo
-- =============================================
INSERT INTO public.ai_token_ledger (empresa_id, user_id, agent_key, source, tokens_delta, reference_id)
VALUES (
  'b70e0000-0000-0000-0000-00000000000a', 'b70e1111-0000-0000-0000-00000000000a', 'compra', 'purchase',
  2 * 500000, 'token_pack_purchase:b70e2222-0000-0000-0000-00000000000a'
)
ON CONFLICT (reference_id) WHERE reference_id IS NOT NULL DO NOTHING;

SELECT results_eq(
  $$ SELECT count(*)::int FROM public.ai_token_ledger
     WHERE reference_id = 'token_pack_purchase:b70e2222-0000-0000-0000-00000000000a' $$,
  $$ VALUES (1) $$,
  'replay do webhook não duplica a linha de crédito (UNIQUE em reference_id)'
);

SELECT results_eq(
  $$ SELECT saldo_comprado FROM public.ai_token_saldo
     WHERE empresa_id = 'b70e0000-0000-0000-0000-00000000000a' $$,
  $$ VALUES (1000000::bigint) $$,
  'saldo não muda no replay: continua exatamente 1000000'
);

-- =============================================
-- 5. Débito em cascata só consome o balde comprado (nunca some com o do plano)
-- =============================================
SELECT test_set_service();

SELECT lives_ok(
  $$ SELECT * FROM public.debitar_tokens(
       'b70e0000-0000-0000-0000-00000000000a', 'b70e1111-0000-0000-0000-00000000000a',
       'chat', NULL, 'gemini-2.5-flash', 100000, 100000, 'turno-pack-1') $$,
  'débito após compra roda normalmente'
);

SELECT results_eq(
  $$ SELECT saldo_plano, saldo_comprado FROM public.ai_token_saldo
     WHERE empresa_id = 'b70e0000-0000-0000-0000-00000000000a' $$,
  $$ VALUES (0::bigint, 800000::bigint) $$,
  'sem saldo_plano, o débito consome só o comprado (800000 = 1000000 - 200000)'
);

SELECT * FROM finish();
ROLLBACK;
