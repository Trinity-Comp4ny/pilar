-- Prevent duplicate pending signups for same email (race condition protection).
-- pilar-checkout-create already handles the 23505 unique_violation error gracefully;
-- this index is the DB-side enforcement that makes it atomic.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pending_signup_email_active
  ON public.pilar_pending_signups(lower(email))
  WHERE payment_status = 'pending';
