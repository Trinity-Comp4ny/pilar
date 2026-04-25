-- Migration 010: AI e Integrações
-- Consolidação de: create_ai_tables, asaas_integration, asaas_webhook_token

-- ==============================================================================
-- PARTE 1: TABELAS DE IA
-- ==============================================================================

-- 1.1 Armazenamento de insights gerados por IA
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

CREATE INDEX IF NOT EXISTS idx_ai_insights_empresa ON public.ai_insights(empresa_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_tipo ON public.ai_insights(empresa_id, tipo);
CREATE INDEX IF NOT EXISTS idx_ai_insights_ref ON public.ai_insights(referencia_id);

ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "AI Insights Read" ON public.ai_insights;
CREATE POLICY "AI Insights Read" ON public.ai_insights
  FOR SELECT USING (empresa_id = public.get_user_empresa_id());

DROP POLICY IF EXISTS "AI Insights Full Admin" ON public.ai_insights;
CREATE POLICY "AI Insights Full Admin" ON public.ai_insights
  FOR ALL USING (empresa_id = public.get_user_empresa_id() AND public.has_role('admin'))
  WITH CHECK (empresa_id = public.get_user_empresa_id() AND public.has_role('admin'));

DROP POLICY IF EXISTS "AI Insights Insert Auth" ON public.ai_insights;
CREATE POLICY "AI Insights Insert Auth" ON public.ai_insights
  FOR INSERT WITH CHECK (empresa_id = public.get_user_empresa_id());

-- 1.2 Controle de uso mensal por empresa
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

DROP POLICY IF EXISTS "AI Usage Read" ON public.ai_usage;
CREATE POLICY "AI Usage Read" ON public.ai_usage
  FOR SELECT USING (empresa_id = public.get_user_empresa_id());

DROP POLICY IF EXISTS "AI Usage Upsert" ON public.ai_usage;
CREATE POLICY "AI Usage Upsert" ON public.ai_usage
  FOR ALL USING (empresa_id = public.get_user_empresa_id())
  WITH CHECK (empresa_id = public.get_user_empresa_id());

-- 1.3 Saúde Operacional (snapshots mensais)
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

DROP POLICY IF EXISTS "Saude Read" ON public.saude_operacional_snapshots;
CREATE POLICY "Saude Read" ON public.saude_operacional_snapshots
  FOR SELECT USING (empresa_id = public.get_user_empresa_id());

DROP POLICY IF EXISTS "Saude Upsert" ON public.saude_operacional_snapshots;
CREATE POLICY "Saude Upsert" ON public.saude_operacional_snapshots
  FOR ALL USING (empresa_id = public.get_user_empresa_id())
  WITH CHECK (empresa_id = public.get_user_empresa_id());

-- ==============================================================================
-- PARTE 2: INTEGRAÇÃO ASAAS
-- ==============================================================================

-- 2.1 Configuração Asaas por empresa (webhook_token já incluso)
CREATE TABLE IF NOT EXISTS public.asaas_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  api_key TEXT NOT NULL,
  ambiente TEXT NOT NULL DEFAULT 'sandbox' CHECK (ambiente IN ('sandbox', 'producao')),
  webhook_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (empresa_id)
);

ALTER TABLE public.asaas_config ADD COLUMN IF NOT EXISTS webhook_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex');

ALTER TABLE public.asaas_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "asaas_config_empresa_select" ON public.asaas_config;
CREATE POLICY "asaas_config_empresa_select" ON public.asaas_config
  FOR SELECT USING (
    empresa_id IN (SELECT empresa_id FROM public.profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "asaas_config_empresa_insert" ON public.asaas_config;
CREATE POLICY "asaas_config_empresa_insert" ON public.asaas_config
  FOR INSERT WITH CHECK (
    empresa_id IN (SELECT empresa_id FROM public.profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "asaas_config_empresa_update" ON public.asaas_config;
CREATE POLICY "asaas_config_empresa_update" ON public.asaas_config
  FOR UPDATE USING (
    empresa_id IN (SELECT empresa_id FROM public.profiles WHERE id = auth.uid())
  );

GRANT ALL ON public.asaas_config TO authenticated;

-- 2.2 Colunas Asaas em clientes
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT;

-- 2.3 Colunas Asaas em receitas
ALTER TABLE public.receitas
  ADD COLUMN IF NOT EXISTS asaas_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS asaas_payment_url TEXT,
  ADD COLUMN IF NOT EXISTS asaas_payment_status TEXT,
  ADD COLUMN IF NOT EXISTS asaas_billing_type TEXT;

-- 2.4 Log de webhooks recebidos do Asaas (auditoria)
CREATE TABLE IF NOT EXISTS public.asaas_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES public.empresas(id),
  event TEXT NOT NULL,
  payment_id TEXT,
  receita_id UUID REFERENCES public.receitas(id),
  payload JSONB,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.asaas_webhook_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "asaas_webhook_logs_select" ON public.asaas_webhook_logs;
CREATE POLICY "asaas_webhook_logs_select" ON public.asaas_webhook_logs
  FOR SELECT USING (
    empresa_id IN (SELECT empresa_id FROM public.profiles WHERE id = auth.uid())
  );

GRANT SELECT ON public.asaas_webhook_logs TO authenticated;
