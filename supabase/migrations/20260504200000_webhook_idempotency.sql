-- Idempotência em logs de webhook: rejeita re-processamento do mesmo evento.
-- Asaas/Pilar checkout retransmitem em falha de rede; sem isso, receitas/subscriptions
-- são atualizadas múltiplas vezes para o mesmo pagamento.

-- Limpa duplicatas existentes antes de criar o índice único (mantém a primeira ocorrência).
WITH dups AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY event, payment_id ORDER BY processed_at NULLS LAST, id) AS rn
  FROM public.asaas_webhook_logs
  WHERE payment_id IS NOT NULL
)
DELETE FROM public.asaas_webhook_logs
WHERE id IN (SELECT id FROM dups WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS uq_asaas_webhook_logs_event_payment
  ON public.asaas_webhook_logs (event, payment_id)
  WHERE payment_id IS NOT NULL;

-- pilar_checkout_webhook_logs: dedup por (event, payment_id) e (event, subscription_id) separadamente,
-- pois alguns eventos vêm só com subscription_id (SUBSCRIPTION_ENDED, etc).
-- Tabela é criada por 027_pilar_saas_subscriptions.sql; defensivo se ambiente
-- não tiver essa migration aplicada (ex: DB local divergente).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'pilar_checkout_webhook_logs'
  ) THEN
    DELETE FROM public.pilar_checkout_webhook_logs
    WHERE id IN (
      SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY event, asaas_payment_id ORDER BY created_at, id) AS rn
        FROM public.pilar_checkout_webhook_logs
        WHERE asaas_payment_id IS NOT NULL
      ) d WHERE rn > 1
    );

    CREATE UNIQUE INDEX IF NOT EXISTS uq_pilar_checkout_webhook_logs_event_payment
      ON public.pilar_checkout_webhook_logs (event, asaas_payment_id)
      WHERE asaas_payment_id IS NOT NULL;

    DELETE FROM public.pilar_checkout_webhook_logs
    WHERE id IN (
      SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY event, asaas_subscription_id ORDER BY created_at, id) AS rn
        FROM public.pilar_checkout_webhook_logs
        WHERE asaas_subscription_id IS NOT NULL AND asaas_payment_id IS NULL
      ) d WHERE rn > 1
    );

    CREATE UNIQUE INDEX IF NOT EXISTS uq_pilar_checkout_webhook_logs_event_sub
      ON public.pilar_checkout_webhook_logs (event, asaas_subscription_id)
      WHERE asaas_subscription_id IS NOT NULL AND asaas_payment_id IS NULL;

    EXECUTE 'COMMENT ON INDEX public.uq_pilar_checkout_webhook_logs_event_payment IS '
      || quote_literal('Idempotência: bloqueia re-processamento do mesmo (event, asaas_payment_id). Edge Function deve tratar 23505 como noop.');
  END IF;
END $$;

COMMENT ON INDEX public.uq_asaas_webhook_logs_event_payment IS
  'Idempotência: bloqueia re-processamento do mesmo (event, payment_id). Edge Function deve tratar 23505 como noop.';
