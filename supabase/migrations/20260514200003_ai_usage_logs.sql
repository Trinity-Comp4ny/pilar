CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  tokens_input integer NOT NULL DEFAULT 0,
  tokens_output integer NOT NULL DEFAULT 0,
  model text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Só admins podem ver os logs de uso de IA da sua empresa
CREATE POLICY "admin_read" ON public.ai_usage_logs
  FOR SELECT USING (
    empresa_id = get_user_empresa_id() AND user_has_feature('pessoas')
  );

-- Apenas service role pode inserir (edge functions usam service role)
CREATE POLICY "service_insert" ON public.ai_usage_logs
  FOR INSERT WITH CHECK (true);

CREATE INDEX idx_ai_usage_empresa_created ON public.ai_usage_logs(empresa_id, created_at DESC);
CREATE INDEX idx_ai_usage_feature ON public.ai_usage_logs(empresa_id, feature_key);
