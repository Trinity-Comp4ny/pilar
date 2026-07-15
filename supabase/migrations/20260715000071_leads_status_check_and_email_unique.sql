-- Leads: integridade de status e unicidade de email por empresa.
--
-- 1. leads.status era text livre: qualquer string (typo, valor de API) entrava e
--    corrompia o kanban. Passa a ser restrito aos estágios válidos via CHECK.
-- 2. A deduplicação de email vivia só no JS (index.tsx), sujeita a corrida entre
--    abas e cega a soft delete e paginação. Backstop no banco com índice único
--    parcial por empresa, válido apenas entre leads ativos.

BEGIN;

-- --- 1. CHECK de status ------------------------------------------------------

ALTER TABLE public.leads ALTER COLUMN status SET DEFAULT 'Novo';

-- Normaliza valores fora do conjunto antes de aplicar a constraint.
UPDATE public.leads
SET status = 'Novo'
WHERE status IS NULL
   OR status NOT IN ('Novo', 'Em contato', 'Proposta', 'Negociação', 'Ganho', 'Perdido');

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_status_check
  CHECK (status IN ('Novo', 'Em contato', 'Proposta', 'Negociação', 'Ganho', 'Perdido'));

-- --- 2. Unicidade de email por empresa ---------------------------------------

-- Emails nulos ou vazios ficam fora do índice, então leads sem email não colidem
-- entre si. Comparação case-insensitive (lower) para casar João@x.com e joao@x.com.
CREATE UNIQUE INDEX IF NOT EXISTS leads_empresa_email_uidx
  ON public.leads (empresa_id, lower(email))
  WHERE deleted_at IS NULL AND email IS NOT NULL AND btrim(email) <> '';

COMMIT;
