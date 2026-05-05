-- Migration 1: CPF e telefone nullable
ALTER TABLE pessoas ALTER COLUMN cpf DROP NOT NULL;
ALTER TABLE pessoas ALTER COLUMN telefone DROP NOT NULL;

-- Migration 2: CPF índice parcial
ALTER TABLE pessoas DROP CONSTRAINT IF EXISTS pessoas_cpf_key;
CREATE UNIQUE INDEX IF NOT EXISTS pessoas_cpf_empresa_active_unique
  ON pessoas (empresa_id, cpf)
    WHERE deleted_at IS NULL AND cpf IS NOT NULL AND cpf <> '';

    -- Migration 3: Email índice parcial
    ALTER TABLE pessoas DROP CONSTRAINT IF EXISTS pessoas_email_key;
    CREATE UNIQUE INDEX IF NOT EXISTS pessoas_email_empresa_active_unique
      ON pessoas (empresa_id, email)
        WHERE deleted_at IS NULL AND email IS NOT NULL AND email <> '';