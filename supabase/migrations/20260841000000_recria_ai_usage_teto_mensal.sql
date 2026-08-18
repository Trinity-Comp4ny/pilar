-- Recria ai_usage, dropada por engano em 20260429400000_drop_dormant_tables.sql como
-- "módulo dormente". Não era: increment_ai_usage (20260715000073) e checkRateLimit/getAiSaldo
-- (_shared/ai-client.ts) continuaram escrevendo/lendo essa tabela via service_role, mas como
-- ela não existe a RPC falha, o fallback falha em silêncio, e o teto mensal de IA nunca barra
-- ninguém (só a janela curta de 30 chamadas/60s continua ativa).

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

-- Só leitura para authenticated: quem escreve é sempre a edge function via service_role
-- (increment_ai_usage é SECURITY DEFINER e já restrita a service_role). Sem policy de
-- escrita para authenticated/anon — impede qualquer tenant de inflar o próprio teto.
