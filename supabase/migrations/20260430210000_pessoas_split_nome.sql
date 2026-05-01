-- Separar nome em primeiro_nome + sobrenome
-- Mantém coluna nome (concatenada) por compatibilidade com queries existentes

ALTER TABLE pessoas
  ADD COLUMN IF NOT EXISTS primeiro_nome TEXT,
  ADD COLUMN IF NOT EXISTS sobrenome TEXT;

-- Backfill: primeiro token vai para primeiro_nome, resto para sobrenome
UPDATE pessoas
SET
  primeiro_nome = split_part(nome, ' ', 1),
  sobrenome = NULLIF(trim(substring(nome FROM position(' ' IN nome) + 1)), '')
WHERE primeiro_nome IS NULL;

-- primeiro_nome e sobrenome obrigatórios dali pra frente
ALTER TABLE pessoas
  ALTER COLUMN primeiro_nome SET NOT NULL,
  ALTER COLUMN sobrenome SET NOT NULL;

COMMENT ON COLUMN pessoas.primeiro_nome IS 'Primeiro nome';
COMMENT ON COLUMN pessoas.sobrenome IS 'Sobrenome (pode conter múltiplas palavras)';
COMMENT ON COLUMN pessoas.nome IS 'Nome completo concatenado (mantido por compatibilidade)';
