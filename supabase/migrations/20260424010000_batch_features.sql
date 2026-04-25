-- ==============================================================================
-- Batch features 2026-04-24
-- Consolida 4 ALTERs pequenos: ordem_etapa, template tipo, pix, drive_url.
-- ==============================================================================

-- 1. projeto_disciplinas.ordem_etapa
ALTER TABLE public.projeto_disciplinas
  ADD COLUMN IF NOT EXISTS ordem_etapa INTEGER;

CREATE INDEX IF NOT EXISTS idx_projeto_disciplinas_ordem_etapa
  ON public.projeto_disciplinas(projeto_id, ordem_etapa);

COMMENT ON COLUMN public.projeto_disciplinas.ordem_etapa IS
  'Ordem da etapa no fluxo original. Disciplinas com mesma ordem são paralelas. NULL = fora de fluxo.';

-- 2. proposta_templates.tipo (proposta | contrato)
ALTER TABLE public.proposta_templates
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'proposta';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'proposta_templates_tipo_check'
  ) THEN
    ALTER TABLE public.proposta_templates
      ADD CONSTRAINT proposta_templates_tipo_check
      CHECK (tipo IN ('proposta', 'contrato'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_proposta_templates_tipo
  ON public.proposta_templates(empresa_id, tipo) WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.proposta_templates.tipo IS
  'Categoria do template: proposta (default) ou contrato. Usado para filtrar no dialog de geração.';

-- 3. empresas.pix_chave + pix_instrucoes
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS pix_chave TEXT,
  ADD COLUMN IF NOT EXISTS pix_instrucoes TEXT;

COMMENT ON COLUMN public.empresas.pix_chave IS
  'Chave Pix da empresa para receber pagamentos diretos (CPF, CNPJ, email, telefone, aleatória).';

COMMENT ON COLUMN public.empresas.pix_instrucoes IS
  'Texto livre exibido ao cliente no email de cobrança (ex: nome do titular, banco, observações).';

-- 4. portal_entregas.drive_url (alternativa ao Storage)
ALTER TABLE public.portal_entregas
  ADD COLUMN IF NOT EXISTS drive_url TEXT;

ALTER TABLE public.portal_entregas
  DROP CONSTRAINT IF EXISTS portal_entregas_drive_url_format;

ALTER TABLE public.portal_entregas
  ADD CONSTRAINT portal_entregas_drive_url_format
  CHECK (
    drive_url IS NULL
    OR drive_url ~ '^https://(drive|docs)\.google\.com/.+'
  );

COMMENT ON COLUMN public.portal_entregas.drive_url IS
  'Link Google Drive (drive.google.com ou docs.google.com) para arquivos hospedados externamente. Alternativa ao arquivo_path do Storage.';
