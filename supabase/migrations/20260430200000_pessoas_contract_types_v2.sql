-- Migração: separar tipos de contrato + adicionar campos pessoa
-- Data: 2026-04-30

-- Novos campos
ALTER TABLE pessoas
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS data_nascimento DATE,
  ADD COLUMN IF NOT EXISTS rg TEXT,
  ADD COLUMN IF NOT EXISTS pis_nit TEXT,
  ADD COLUMN IF NOT EXISTS cnpj TEXT,
  ADD COLUMN IF NOT EXISTS razao_social TEXT;

-- Backfill: legacy 'contratado' → 'clt' (assumimos default mais comum)
UPDATE pessoas SET tipo_contrato = 'clt' WHERE tipo_contrato = 'contratado';

-- Backfill: pessoas com data_demissao no passado viram 'inativo'
UPDATE pessoas
SET status = 'inativo'
WHERE data_demissao IS NOT NULL
  AND data_demissao <= CURRENT_DATE;

-- Constraints
ALTER TABLE pessoas
  DROP CONSTRAINT IF EXISTS pessoas_tipo_contrato_check,
  ADD CONSTRAINT pessoas_tipo_contrato_check
    CHECK (tipo_contrato IN ('clt', 'pj', 'estagiario', 'socio', 'terceirizado'));

ALTER TABLE pessoas
  DROP CONSTRAINT IF EXISTS pessoas_status_check,
  ADD CONSTRAINT pessoas_status_check
    CHECK (status IN ('ativo', 'inativo', 'afastado'));

COMMENT ON COLUMN pessoas.tipo_contrato IS 'Tipo de vínculo: clt, pj, estagiario, socio, terceirizado';
COMMENT ON COLUMN pessoas.status IS 'Status atual: ativo, inativo (desligado), afastado (licença)';
COMMENT ON COLUMN pessoas.cnpj IS 'CNPJ — obrigatório quando tipo_contrato = pj';
COMMENT ON COLUMN pessoas.razao_social IS 'Razão social — usado com PJ';
COMMENT ON COLUMN pessoas.pis_nit IS 'PIS/NIT — usado com CLT';
