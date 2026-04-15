-- ==============================================================================
-- FIX: Storage RLS — isolamento multi-tenant
-- Corrige policies de storage para proposta-templates e propostas-docs
-- garantindo que cada empresa só acessa seus próprios arquivos.
-- ==============================================================================

-- Helper: retorna empresa_id do usuário autenticado (text, para comparar com folder)
CREATE OR REPLACE FUNCTION public.get_user_empresa_id_text()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT empresa_id::text FROM profiles WHERE id = auth.uid();
$$;

-- ============================================================
-- proposta-templates: DROP + RECREATE com filtro de empresa
-- ============================================================

DROP POLICY IF EXISTS "proposta_templates_insert" ON storage.objects;
DROP POLICY IF EXISTS "proposta_templates_select" ON storage.objects;
DROP POLICY IF EXISTS "proposta_templates_update" ON storage.objects;
DROP POLICY IF EXISTS "proposta_templates_delete" ON storage.objects;

CREATE POLICY "proposta_templates_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'proposta-templates'
  AND (storage.foldername(name))[1] = public.get_user_empresa_id_text()
);

CREATE POLICY "proposta_templates_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'proposta-templates'
  AND (storage.foldername(name))[1] = public.get_user_empresa_id_text()
);

CREATE POLICY "proposta_templates_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'proposta-templates'
  AND (storage.foldername(name))[1] = public.get_user_empresa_id_text()
);

CREATE POLICY "proposta_templates_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'proposta-templates'
  AND (storage.foldername(name))[1] = public.get_user_empresa_id_text()
);

-- ============================================================
-- propostas-docs: DROP + RECREATE com filtro de empresa
-- ============================================================

DROP POLICY IF EXISTS "propostas_docs_insert" ON storage.objects;
DROP POLICY IF EXISTS "propostas_docs_select" ON storage.objects;
DROP POLICY IF EXISTS "propostas_docs_update" ON storage.objects;
DROP POLICY IF EXISTS "propostas_docs_delete" ON storage.objects;

CREATE POLICY "propostas_docs_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'propostas-docs'
  AND (storage.foldername(name))[1] = public.get_user_empresa_id_text()
);

CREATE POLICY "propostas_docs_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'propostas-docs'
  AND (storage.foldername(name))[1] = public.get_user_empresa_id_text()
);

CREATE POLICY "propostas_docs_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'propostas-docs'
  AND (storage.foldername(name))[1] = public.get_user_empresa_id_text()
);

CREATE POLICY "propostas_docs_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'propostas-docs'
  AND (storage.foldername(name))[1] = public.get_user_empresa_id_text()
);
