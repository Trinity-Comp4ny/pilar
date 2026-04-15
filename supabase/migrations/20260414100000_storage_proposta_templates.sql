-- Storage bucket and policies for proposta templates

-- Create buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('proposta-templates', 'proposta-templates', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('propostas-docs', 'propostas-docs', false)
ON CONFLICT (id) DO NOTHING;

-- Policies for proposta-templates bucket
-- Authenticated users can upload
CREATE POLICY "proposta_templates_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'proposta-templates');

-- Authenticated users can read
CREATE POLICY "proposta_templates_select"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'proposta-templates');

-- Authenticated users can update their uploads
CREATE POLICY "proposta_templates_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'proposta-templates');

-- Authenticated users can delete
CREATE POLICY "proposta_templates_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'proposta-templates');

-- Policies for propostas-docs bucket
CREATE POLICY "propostas_docs_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'propostas-docs');

CREATE POLICY "propostas_docs_select"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'propostas-docs');

CREATE POLICY "propostas_docs_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'propostas-docs');

CREATE POLICY "propostas_docs_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'propostas-docs');
