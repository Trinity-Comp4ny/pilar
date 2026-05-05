-- A constraint pessoas_cpf_key é UNIQUE simples e bloqueia re-criação de pessoa
-- com mesmo CPF após soft-delete. Substituída por índice parcial que ignora
-- linhas com deleted_at preenchido.
ALTER TABLE pessoas
  DROP CONSTRAINT IF EXISTS pessoas_cpf_key;

CREATE UNIQUE INDEX IF NOT EXISTS pessoas_cpf_empresa_active_unique
  ON pessoas (empresa_id, cpf)
  WHERE deleted_at IS NULL
    AND cpf IS NOT NULL
    AND cpf <> '';
