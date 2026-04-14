-- Expand metas table to support different goal types (financial, personal, project)

-- Add tipo column to distinguish meta types
ALTER TABLE metas ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'financeira';

-- Add optional FK to pessoas for personal goals
ALTER TABLE metas ADD COLUMN IF NOT EXISTS pessoa_id uuid REFERENCES pessoas(id) ON DELETE SET NULL;

-- Add optional FK to projetos for project goals
ALTER TABLE metas ADD COLUMN IF NOT EXISTS projeto_id uuid REFERENCES projetos(id) ON DELETE SET NULL;

-- Add empresa_id for multi-tenant support
ALTER TABLE metas ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES empresas(id) ON DELETE CASCADE;

-- Add description field
ALTER TABLE metas ADD COLUMN IF NOT EXISTS descricao text;

-- Add unidade field (currency, percentage, quantity, etc.)
ALTER TABLE metas ADD COLUMN IF NOT EXISTS unidade text NOT NULL DEFAULT 'currency';

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_metas_tipo ON metas(tipo);
CREATE INDEX IF NOT EXISTS idx_metas_pessoa_id ON metas(pessoa_id);
CREATE INDEX IF NOT EXISTS idx_metas_projeto_id ON metas(projeto_id);
CREATE INDEX IF NOT EXISTS idx_metas_empresa_id ON metas(empresa_id);
