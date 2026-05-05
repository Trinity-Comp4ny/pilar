-- Garante que não existam dois checkouts pendentes com o mesmo email.
-- Fecha race condition de duplo-submit que gerava 2 customers no Asaas.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pending_signup_email_active
  ON public.pilar_pending_signups(email)
  WHERE payment_status = 'pending';
