-- pessoas_email_key é UNIQUE simples e bloqueia re-cadastro com mesmo e-mail
-- após soft-delete. Substituída por índice parcial que ignora deleted_at preenchido.
ALTER TABLE pessoas
  DROP CONSTRAINT IF EXISTS pessoas_email_key;

CREATE UNIQUE INDEX IF NOT EXISTS pessoas_email_empresa_active_unique
  ON pessoas (empresa_id, email)
  WHERE deleted_at IS NULL
    AND email IS NOT NULL
    AND email <> '';
