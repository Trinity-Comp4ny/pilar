-- ==============================================================================
-- FASE 4: INTELIGÊNCIA COM IA
-- ==============================================================================

-- Armazenamento de insights gerados por IA
CREATE TABLE IF NOT EXISTS public.ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  referencia_id UUID,
  referencia_tipo TEXT,
  conteudo JSONB NOT NULL,
  resumo TEXT,
  status TEXT DEFAULT 'ativo' CHECK (status IN ('ativo', 'descartado', 'aplicado')),
  mes_referencia INTEGER,
  ano_referencia INTEGER,
  modelo_ia TEXT,
  tokens_entrada INTEGER,
  tokens_saida INTEGER,
  custo_estimado DECIMAL(8,6),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ai_insights_empresa ON public.ai_insights(empresa_id);
CREATE INDEX idx_ai_insights_tipo ON public.ai_insights(empresa_id, tipo);
CREATE INDEX idx_ai_insights_ref ON public.ai_insights(referencia_id);

ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "AI Insights Read" ON public.ai_insights
  FOR SELECT USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY "AI Insights Full Admin" ON public.ai_insights
  FOR ALL USING (empresa_id = public.get_user_empresa_id() AND public.has_role('admin'))
  WITH CHECK (empresa_id = public.get_user_empresa_id() AND public.has_role('admin'));

-- Insert para qualquer role autenticado (a edge function insere com service role)
CREATE POLICY "AI Insights Insert Auth" ON public.ai_insights
  FOR INSERT WITH CHECK (empresa_id = public.get_user_empresa_id());

-- Controle de uso mensal por empresa
CREATE TABLE IF NOT EXISTS public.ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  mes INTEGER NOT NULL,
  ano INTEGER NOT NULL,
  total_requests INTEGER DEFAULT 0,
  total_tokens_entrada INTEGER DEFAULT 0,
  total_tokens_saida INTEGER DEFAULT 0,
  custo_estimado_total DECIMAL(10,4) DEFAULT 0,
  limite_requests INTEGER DEFAULT 100,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(empresa_id, mes, ano)
);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "AI Usage Read" ON public.ai_usage
  FOR SELECT USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY "AI Usage Upsert" ON public.ai_usage
  FOR ALL USING (empresa_id = public.get_user_empresa_id())
  WITH CHECK (empresa_id = public.get_user_empresa_id());

-- ==============================================================================
-- FASE 5: SAÚDE OPERACIONAL (snapshots mensais)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.saude_operacional_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  mes INTEGER NOT NULL,
  ano INTEGER NOT NULL,
  score NUMERIC NOT NULL,
  breakdown JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(empresa_id, mes, ano)
);

ALTER TABLE public.saude_operacional_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Saude Read" ON public.saude_operacional_snapshots
  FOR SELECT USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Saude Upsert" ON public.saude_operacional_snapshots
  FOR ALL USING (empresa_id = public.get_user_empresa_id())
  WITH CHECK (empresa_id = public.get_user_empresa_id());
