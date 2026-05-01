-- Adiciona novos campos ao pipeline de leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS valor_estimado NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS responsavel_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS previsao_fechamento DATE,
  ADD COLUMN IF NOT EXISTS empresa_lead TEXT,
  ADD COLUMN IF NOT EXISTS notas TEXT;

CREATE INDEX IF NOT EXISTS idx_leads_responsavel ON public.leads(responsavel_id);
