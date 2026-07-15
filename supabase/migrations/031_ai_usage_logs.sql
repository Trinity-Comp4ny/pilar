-- Migration 031: Log de uso de IA com custo e equivalente-humano (ADR 0006 padrão d)
--
-- Uma linha por chamada de modelo. Registra custo real (tokens) E o equivalente
-- em horas de trabalho humano, para amarrar custo de IA ao pricing (a régua é a
-- hora do sócio de engenharia — docs/strategy/PRICING.md) e à mensagem de valor
-- ("esta análise substituiu ~N horas de trabalho").
--
-- Distinto da tabela `ai_usage` (migration 010), que é um agregado mensal por
-- empresa. `ai_usage_logs` é o grão fino, por chamada, e alimenta esse agregado.
--
-- IMPORTANTE: NÃO aplicada em nenhum banco. Rodar `npm run gen:types` depois.
--
-- Multi-tenant por empresa_id + RLS (ADR 0001); nega cross-tenant.

-- =============================================
-- 1. Tabela ai_usage_logs
-- =============================================

CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  -- Nome da edge function / agente que fez a chamada (ex.: 'ai-chat', 'ai-insights').
  function TEXT NOT NULL,
  -- Job de origem, quando a chamada faz parte de um pipeline (ver migration 030).
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  model TEXT NOT NULL,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  -- Custo real da inferência em USD (precisão de micro-dólar).
  cost NUMERIC(12, 6) NOT NULL DEFAULT 0,
  -- Equivalente-humano: ESTIMATIVA por tipo de tarefa de quanto tempo um
  -- profissional levaria para fazer isto à mão. NÃO é tempo cronometrado.
  -- Origem do conceito: agent_context (agent_employee_equivalent + person_hours).
  human_equivalent_hours NUMERIC(8, 2),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.ai_usage_logs IS
  'Log por chamada de modelo (ADR 0006 padrão d): custo real de tokens + equivalente-humano estimado. Grão fino que alimenta o agregado ai_usage.';
COMMENT ON COLUMN public.ai_usage_logs.human_equivalent_hours IS
  'ESTIMATIVA de horas de trabalho humano que esta tarefa substitui (por tipo de tarefa), não medição cronometrada. Amarra custo de IA ao pricing (hora do sócio) e à mensagem de valor.';
COMMENT ON COLUMN public.ai_usage_logs.cost IS
  'Custo real da inferência em USD (micro-dólar). Distinto de human_equivalent_hours (valor entregue).';

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_empresa
  ON public.ai_usage_logs (empresa_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_function
  ON public.ai_usage_logs (empresa_id, function, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_job
  ON public.ai_usage_logs (job_id)
  WHERE job_id IS NOT NULL;

-- =============================================
-- 2. RLS: isolamento por empresa (ADR 0001)
-- =============================================

ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Leitura: usuário vê o uso da própria empresa (dashboard de consumo/custo).
DROP POLICY IF EXISTS "ai_usage_logs_empresa_select" ON public.ai_usage_logs;
CREATE POLICY "ai_usage_logs_empresa_select" ON public.ai_usage_logs
  FOR SELECT
  USING (empresa_id = public.get_user_empresa_id());

-- NÃO há policy de INSERT/UPDATE/DELETE para authenticated: quem grava uso é a
-- edge function via service_role, logo após a chamada do modelo. Cliente não
-- fabrica linhas de custo (senão poderia falsear consumo/faturamento).

-- Defesa em profundidade: anon nunca deve tocar em ai_usage_logs (RLS já bloqueia).
REVOKE ALL ON public.ai_usage_logs FROM anon;
