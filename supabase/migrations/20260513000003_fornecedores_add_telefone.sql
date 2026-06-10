-- Add telefone column to fornecedores table
ALTER TABLE public.fornecedores ADD COLUMN IF NOT EXISTS telefone text;
