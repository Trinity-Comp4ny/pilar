-- Add columns to support new features

-- Add contas_bancarias to clientes (storing as JSONB array for multiple accounts)
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS contas_bancarias JSONB DEFAULT '[]'::jsonb;

-- Add columns to pessoas
ALTER TABLE pessoas ADD COLUMN IF NOT EXISTS data_demissao DATE;
ALTER TABLE pessoas ADD COLUMN IF NOT EXISTS conta_bancaria TEXT;
ALTER TABLE pessoas ADD COLUMN IF NOT EXISTS contas_bancarias JSONB DEFAULT '[]'::jsonb;
