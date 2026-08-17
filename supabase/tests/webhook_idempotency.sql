-- pgTAP: idempotência/concorrência de webhooks Asaas e do convite de owner.
--
-- Contexto (auditoria de hardening pré-lançamento, item "Confirmar
-- idempotência/concorrência de webhooks e convites"):
--   1. asaas-webhook e pilar-checkout-webhook já inserem o log ANTES de
--      processar o efeito colateral, e um índice único em (event, payment_id)
--      [ou (event, subscription_id)] faz o segundo INSERT falhar com 23505.
--      Isso cobre tanto reentrega (retry) quanto corrida real: o índice único
--      do Postgres serializa os dois INSERTs concorrentes, então só um vence.
--      Estes testes travam essa garantia (regressão se alguém derrubar o índice).
--   2. empresa_owners_pending tinha dois bugs reais no fluxo de convite de
--      owner (create-company-owner e pilar-checkout-webhook):
--        a) o INSERT do pilar-checkout-webhook nunca gravava token_hash —
--           o convite nascia com token_hash NULL, então handle_new_user()
--           nunca encontrava a linha e o cadastro pago caía no fallback
--           self-serve (empresa errada, sem trial pago).
--        b) email é UNIQUE (não parcial) na tabela: reconvidar um email que
--           já teve QUALQUER pending anterior (mesmo já usado) fazia o INSERT
--           falhar com 23505 para sempre.
--      O fix trocou "invalida antigo + INSERT novo" por um UPSERT atômico em
--      (email), que corrige os dois bugs e também fecha a corrida de dois
--      cliques/dois webhooks concorrentes criando convite pro mesmo email.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(12);

-- =============================================
-- Grupo 1: asaas-webhook — idempotência por (event, payment_id)
-- =============================================

SELECT lives_ok(
  $$ INSERT INTO public.asaas_webhook_logs (event, payment_id, payload)
     VALUES ('PAYMENT_CONFIRMED', 'pay_idem_test_1', '{}'::jsonb) $$,
  'primeira entrega do webhook grava o log normalmente'
);

SELECT throws_ok(
  $$ INSERT INTO public.asaas_webhook_logs (event, payment_id, payload)
     VALUES ('PAYMENT_CONFIRMED', 'pay_idem_test_1', '{}'::jsonb) $$,
  '23505',
  NULL,
  'reentrega do MESMO evento é rejeitada pelo índice único (idempotência)'
);

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.asaas_webhook_logs WHERE payment_id = 'pay_idem_test_1'),
  1,
  'só existe 1 log para o pagamento mesmo após a tentativa de duplicata'
);

-- =============================================
-- Grupo 2: pilar-checkout-webhook — idempotência por (event, payment_id)
-- =============================================

SELECT lives_ok(
  $$ INSERT INTO public.pilar_checkout_webhook_logs (event, asaas_payment_id, payload)
     VALUES ('PAYMENT_CONFIRMED', 'ch_idem_test_1', '{}'::jsonb) $$,
  'primeira entrega (checkout) grava o log normalmente'
);

SELECT throws_ok(
  $$ INSERT INTO public.pilar_checkout_webhook_logs (event, asaas_payment_id, payload)
     VALUES ('PAYMENT_CONFIRMED', 'ch_idem_test_1', '{}'::jsonb) $$,
  '23505',
  NULL,
  'reentrega do MESMO evento (checkout, por payment) é rejeitada'
);

-- =============================================
-- Grupo 3: pilar-checkout-webhook — idempotência por (event, subscription_id)
-- (eventos que só trazem subscription, ex.: SUBSCRIPTION_ENDED)
-- =============================================

SELECT lives_ok(
  $$ INSERT INTO public.pilar_checkout_webhook_logs (event, asaas_subscription_id, payload)
     VALUES ('SUBSCRIPTION_ENDED', 'sub_idem_test_1', '{}'::jsonb) $$,
  'primeira entrega (checkout, por subscription) grava o log normalmente'
);

SELECT throws_ok(
  $$ INSERT INTO public.pilar_checkout_webhook_logs (event, asaas_subscription_id, payload)
     VALUES ('SUBSCRIPTION_ENDED', 'sub_idem_test_1', '{}'::jsonb) $$,
  '23505',
  NULL,
  'reentrega do MESMO evento (checkout, por subscription) é rejeitada'
);

-- =============================================
-- Grupo 4: empresa_owners_pending — contrato de token_hash + upsert atômico
-- =============================================

-- 4a. Insere como o código CORRIGIDO insere (token_hash setado, token NULL).
SELECT lives_ok(
  $$ INSERT INTO public.empresa_owners_pending (email, company_name, nome, token_hash)
     VALUES ('owner.idem.test@example.com', 'Empresa Teste', 'Dono Teste',
             encode(digest('raw-token-v1', 'sha256'), 'hex')) $$,
  'cria pending com token_hash (padrão que handle_new_user espera)'
);

-- 4b. handle_new_user busca por token_hash + email + usado_em IS NULL + expira_em > NOW().
-- Se essa busca não encontrar a linha, o cadastro pago cai no fallback self-serve
-- (o bug real que existia quando token_hash não era gravado).
SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.empresa_owners_pending
   WHERE token_hash = encode(digest('raw-token-v1', 'sha256'), 'hex')
     AND email = 'owner.idem.test@example.com'
     AND usado_em IS NULL
     AND expira_em > NOW()),
  1,
  'handle_new_user encontraria a linha pelo hash (token_hash gravado corretamente)'
);

-- 4c. Simula o convite já consumido (usuário completou o profile-setup).
UPDATE public.empresa_owners_pending
SET usado_em = NOW()
WHERE email = 'owner.idem.test@example.com';

-- 4d. Reconvite do MESMO email (ex.: cliente cancelou e assinou de novo, ou
-- reenvio manual). Antes do fix, o INSERT simples falhava aqui com 23505
-- porque email é UNIQUE e já existe uma linha (usada) com esse email.
SELECT lives_ok(
  $$ INSERT INTO public.empresa_owners_pending (email, company_name, nome, token_hash, usado_em, expira_em)
     VALUES ('owner.idem.test@example.com', 'Empresa Teste', 'Dono Teste',
             encode(digest('raw-token-v2', 'sha256'), 'hex'), NULL, NOW() + INTERVAL '7 days')
     ON CONFLICT (email) DO UPDATE SET
       company_name = EXCLUDED.company_name,
       nome = EXCLUDED.nome,
       token_hash = EXCLUDED.token_hash,
       usado_em = EXCLUDED.usado_em,
       expira_em = EXCLUDED.expira_em $$,
  'reconvite do mesmo email via upsert não falha mesmo com pending anterior já usado'
);

-- 4e. Ainda existe só 1 linha pra esse email (upsert não duplica).
SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.empresa_owners_pending WHERE email = 'owner.idem.test@example.com'),
  1,
  'upsert por email nunca cria uma segunda linha para o mesmo email'
);

-- 4f. O novo convite está limpo: usado_em resetado e hash atualizado pro novo token.
SELECT is(
  (SELECT (usado_em IS NULL AND token_hash = encode(digest('raw-token-v2', 'sha256'), 'hex'))
   FROM public.empresa_owners_pending WHERE email = 'owner.idem.test@example.com'),
  TRUE,
  'reconvite reseta usado_em e grava o hash do novo token'
);

SELECT * FROM finish();

ROLLBACK;
