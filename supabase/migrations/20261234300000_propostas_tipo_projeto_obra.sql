-- Proposta passa a ter tipo: projeto (honorário por disciplina) ou obra/serviço.
-- Obra e móveis planejados não têm área nem hora de projeto; a tela esconde esses campos.
ALTER TABLE public.propostas
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'projeto';

ALTER TABLE public.propostas
  DROP CONSTRAINT IF EXISTS propostas_tipo_check;
ALTER TABLE public.propostas
  ADD CONSTRAINT propostas_tipo_check CHECK (tipo IN ('projeto', 'obra'));
