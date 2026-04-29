-- Separar nome em first_name + last_name no profiles
-- Mantém compatibilidade via coluna gerada `nome`

ALTER TABLE profiles
  ADD COLUMN first_name text NOT NULL DEFAULT '',
  ADD COLUMN last_name  text NOT NULL DEFAULT '';

-- Migrar dados existentes: primeiro token = first_name, resto = last_name
UPDATE profiles SET
  first_name = COALESCE(split_part(trim(nome), ' ', 1), ''),
  last_name  = COALESCE(
    trim(substring(trim(nome) FROM position(' ' IN trim(nome)) + 1)),
    ''
  )
WHERE nome IS NOT NULL AND trim(nome) != '';

-- Remover coluna antiga e recriar como coluna gerada (read-only, calculada automaticamente)
ALTER TABLE profiles DROP COLUMN nome;

ALTER TABLE profiles
  ADD COLUMN nome text GENERATED ALWAYS AS (
    CASE
      WHEN last_name IS NOT NULL AND last_name != ''
      THEN first_name || ' ' || last_name
      ELSE first_name
    END
  ) STORED;
