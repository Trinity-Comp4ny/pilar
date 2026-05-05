-- Garante que não existam dois checkouts pendentes com o mesmo email.
-- Fecha race condition de duplo-submit que gerava 2 customers no Asaas.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'pilar_pending_signups'
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_pending_signup_email_active
      ON public.pilar_pending_signups(email)
      WHERE payment_status = 'pending';
  END IF;
END $$;
