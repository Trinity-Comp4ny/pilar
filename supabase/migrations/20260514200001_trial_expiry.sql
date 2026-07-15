-- Índice para a cron query (trial expiry lookup)
CREATE INDEX IF NOT EXISTS idx_subscriptions_trial_expiry
  ON public.pilar_subscriptions(trial_ends_at, status)
  WHERE status = 'trialing';

-- Adiciona colunas para rastrear emails enviados (evita duplicatas)
ALTER TABLE public.pilar_subscriptions
  ADD COLUMN IF NOT EXISTS trial_warning_7d_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_warning_3d_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_warning_1d_sent_at timestamptz;
