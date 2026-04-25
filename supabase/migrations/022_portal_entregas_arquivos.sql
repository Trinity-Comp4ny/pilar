-- ==============================================================================
-- 021_portal_entregas_arquivos.sql
-- Estende portal_entregas para suportar upload de arquivos, versionamento,
-- disciplina e relação pai→filho entre revisões.
--
-- Mudanças:
-- 1. Novas colunas em portal_entregas
-- 2. Bucket 'portal-entregas' (privado) com RLS multitenant
-- 3. Índices novos para lookup por pai (histórico de versões)
-- ==============================================================================

-- ==============================================================================
-- 1. EXTENSÃO DA TABELA portal_entregas
-- ==============================================================================

ALTER TABLE public.portal_entregas
  ADD COLUMN IF NOT EXISTS versao INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS disciplina TEXT,
  ADD COLUMN IF NOT EXISTS fase TEXT,
  ADD COLUMN IF NOT EXISTS arquivo_path TEXT,
  ADD COLUMN IF NOT EXISTS arquivo_nome TEXT,
  ADD COLUMN IF NOT EXISTS arquivo_mime TEXT,
  ADD COLUMN IF NOT EXISTS arquivo_tamanho_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS entregavel_pai_id UUID REFERENCES public.portal_entregas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resposta_empresa TEXT,
  ADD COLUMN IF NOT EXISTS respondido_empresa_em TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_portal_entregas_pai ON public.portal_entregas(entregavel_pai_id);
CREATE INDEX IF NOT EXISTS idx_portal_entregas_empresa_projeto ON public.portal_entregas(empresa_id, projeto_id);
CREATE INDEX IF NOT EXISTS idx_portal_entregas_status ON public.portal_entregas(status);

-- ==============================================================================
-- 2. BUCKET DE STORAGE: portal-entregas
-- ==============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('portal-entregas', 'portal-entregas', false)
ON CONFLICT (id) DO NOTHING;

-- Estrutura de paths: {empresa_id}/{projeto_id}/{entrega_id}/{arquivo_nome}
-- Primeiro segmento = empresa_id para filtro multitenant por RLS

DROP POLICY IF EXISTS "portal_entregas_storage_insert" ON storage.objects;
CREATE POLICY "portal_entregas_storage_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'portal-entregas'
  AND (storage.foldername(name))[1] = public.get_user_empresa_id_text()
);

DROP POLICY IF EXISTS "portal_entregas_storage_select" ON storage.objects;
CREATE POLICY "portal_entregas_storage_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'portal-entregas'
  AND (storage.foldername(name))[1] = public.get_user_empresa_id_text()
);

DROP POLICY IF EXISTS "portal_entregas_storage_update" ON storage.objects;
CREATE POLICY "portal_entregas_storage_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'portal-entregas'
  AND (storage.foldername(name))[1] = public.get_user_empresa_id_text()
);

DROP POLICY IF EXISTS "portal_entregas_storage_delete" ON storage.objects;
CREATE POLICY "portal_entregas_storage_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'portal-entregas'
  AND (storage.foldername(name))[1] = public.get_user_empresa_id_text()
);

-- ==============================================================================
-- 3. COMENTÁRIOS PARA DOCUMENTAÇÃO
-- ==============================================================================

COMMENT ON COLUMN public.portal_entregas.versao IS 'Versão do entregável. Incrementa quando cliente solicita revisão e admin envia nova versão.';
COMMENT ON COLUMN public.portal_entregas.entregavel_pai_id IS 'Aponta para a versão anterior deste entregável. Null = versão inicial.';
COMMENT ON COLUMN public.portal_entregas.arquivo_path IS 'Path no bucket portal-entregas. Formato: {empresa_id}/{projeto_id}/{entrega_id}/{nome}.';
COMMENT ON COLUMN public.portal_entregas.resposta_empresa IS 'Resposta da empresa ao comentário/revisão do cliente (uma rodada por versão).';
