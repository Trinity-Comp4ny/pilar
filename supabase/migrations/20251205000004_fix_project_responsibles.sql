-- Add responsabilidade column to projetos_responsaveis
ALTER TABLE public.projetos_responsaveis ADD COLUMN IF NOT EXISTS responsabilidade TEXT;
