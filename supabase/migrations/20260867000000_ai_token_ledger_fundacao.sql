-- Motor de tokens, fundação (SPEC 074, ADR 0035): ledger append-only como fonte única
-- de uso de IA, saldo por empresa cacheado por trigger, débito idempotente via RPC.
-- Shadow mode: nada aqui bloqueia chamada de IA (enforcement é a Fase 2).
--
-- Substitui, no código, a trilha ai_usage/ai_usage_logs/increment_ai_usage; as estruturas
-- antigas ficam no banco (congeladas como baseline) até spec de deprecação própria.

-- =============================================
-- 1. ai_model_precos: preço por modelo com vigência (COGS snapshot no débito)
-- =============================================

CREATE TABLE IF NOT EXISTS public.ai_model_precos (
  modelo text NOT NULL,
  preco_input_por_milhao numeric(12, 6) NOT NULL,
  preco_output_por_milhao numeric(12, 6) NOT NULL,
  moeda text NOT NULL DEFAULT 'USD',
  vigente_desde timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (modelo, vigente_desde)
);

ALTER TABLE public.ai_model_precos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "model_precos_read" ON public.ai_model_precos;
CREATE POLICY "model_precos_read" ON public.ai_model_precos
  FOR SELECT USING (true);

-- Sem policy de escrita: preço entra por migration (ou service_role, que bypassa RLS).
REVOKE ALL ON TABLE public.ai_model_precos FROM anon;

-- Preço oficial do Gemini 2.5 Flash (ai.google.dev/gemini-api/docs/pricing, 2026-08-31):
-- US$ 0,30/M input, US$ 2,50/M output. vigente_desde retroativo cobre todo evento novo.
INSERT INTO public.ai_model_precos (modelo, preco_input_por_milhao, preco_output_por_milhao, moeda, vigente_desde)
VALUES ('gemini-2.5-flash', 0.30, 2.50, 'USD', TIMESTAMPTZ '2026-01-01 00:00:00+00')
ON CONFLICT (modelo, vigente_desde) DO NOTHING;

-- =============================================
-- 2. ai_token_ledger: fonte única, append-only
-- =============================================

CREATE TABLE IF NOT EXISTS public.ai_token_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  agent_key text NOT NULL,
  agent_run_id uuid REFERENCES public.agent_runs(id),
  source text NOT NULL CHECK (source IN ('usage', 'plan_grant', 'purchase', 'adjustment', 'refund')),
  tokens_input integer NOT NULL DEFAULT 0,
  tokens_output integer NOT NULL DEFAULT 0,
  -- Assinado: negativo = débito, positivo = crédito. O sinal por source é invariante:
  tokens_delta integer NOT NULL,
  custo_estimado numeric(12, 6),
  model text,
  -- Id externo (ex.: 'ai_usage_logs:<id>' no backfill; id de pagamento Asaas na Fase 3).
  reference_id text,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_token_ledger_delta_sinal CHECK (
    (source = 'usage' AND tokens_delta < 0)
    OR (source IN ('plan_grant', 'purchase', 'refund') AND tokens_delta > 0)
    OR (source = 'adjustment' AND tokens_delta <> 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_ai_token_ledger_empresa_created
  ON public.ai_token_ledger (empresa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_token_ledger_empresa_agent
  ON public.ai_token_ledger (empresa_id, agent_key);
-- Dedupe de retry do débito (a RPC usa ON CONFLICT ... DO NOTHING sobre este índice).
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_token_ledger_idempotency
  ON public.ai_token_ledger (empresa_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
-- Dedupe de crédito externo (replay de webhook, backfill re-rodável).
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_token_ledger_reference
  ON public.ai_token_ledger (reference_id)
  WHERE reference_id IS NOT NULL;

ALTER TABLE public.ai_token_ledger ENABLE ROW LEVEL SECURITY;

-- Extrato visível para membros da própria empresa (transparência do consumo, princípio 2
-- do MOTOR_DE_TOKENS.md). Escrita: NENHUMA policy — só service_role via RPC (bypassa RLS).
DROP POLICY IF EXISTS "ledger_select" ON public.ai_token_ledger;
CREATE POLICY "ledger_select" ON public.ai_token_ledger
  FOR SELECT USING (empresa_id = public.get_user_empresa_id());

REVOKE ALL ON TABLE public.ai_token_ledger FROM anon;

-- =============================================
-- 3. ai_token_saldo: cache O(1), mantido SÓ pelo trigger do ledger
-- =============================================

CREATE TABLE IF NOT EXISTS public.ai_token_saldo (
  empresa_id uuid PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,
  saldo_plano bigint NOT NULL DEFAULT 0,
  saldo_comprado bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_token_saldo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saldo_select" ON public.ai_token_saldo;
CREATE POLICY "saldo_select" ON public.ai_token_saldo
  FOR SELECT USING (empresa_id = public.get_user_empresa_id());

REVOKE ALL ON TABLE public.ai_token_saldo FROM anon;

-- =============================================
-- 4. Trigger: único escritor do saldo (ADR 0035, invariante central)
-- =============================================

CREATE OR REPLACE FUNCTION public.tg_aplicar_delta_no_saldo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Empresa sem linha de saldo (conta antiga): a linha nasce no primeiro evento.
  INSERT INTO public.ai_token_saldo (empresa_id)
  VALUES (NEW.empresa_id)
  ON CONFLICT (empresa_id) DO NOTHING;

  IF NEW.source = 'usage' THEN
    -- Débito em cascata: consome saldo_plano até zerar; o excedente (inclusive
    -- overdraft da chamada em voo) cai em saldo_comprado. tokens_delta < 0 aqui.
    UPDATE public.ai_token_saldo s
    SET saldo_plano = GREATEST(s.saldo_plano + NEW.tokens_delta, 0),
        saldo_comprado = s.saldo_comprado + LEAST(s.saldo_plano + NEW.tokens_delta, 0),
        updated_at = now()
    WHERE s.empresa_id = NEW.empresa_id;
  ELSIF NEW.source = 'plan_grant' THEN
    UPDATE public.ai_token_saldo s
    SET saldo_plano = s.saldo_plano + NEW.tokens_delta,
        updated_at = now()
    WHERE s.empresa_id = NEW.empresa_id;
  ELSE
    -- purchase / adjustment / refund mexem no balde comprado.
    UPDATE public.ai_token_saldo s
    SET saldo_comprado = s.saldo_comprado + NEW.tokens_delta,
        updated_at = now()
    WHERE s.empresa_id = NEW.empresa_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_token_ledger_saldo ON public.ai_token_ledger;
CREATE TRIGGER trg_ai_token_ledger_saldo
  AFTER INSERT ON public.ai_token_ledger
  FOR EACH ROW EXECUTE FUNCTION public.tg_aplicar_delta_no_saldo();

-- =============================================
-- 5. RPC debitar_tokens: único caminho de escrita de uso
-- =============================================

CREATE OR REPLACE FUNCTION public.debitar_tokens(
  p_empresa_id uuid,
  p_user_id uuid,
  p_agent_key text,
  p_agent_run_id uuid,
  p_model text,
  p_tokens_input integer,
  p_tokens_output integer,
  p_idempotency_key text
)
RETURNS TABLE (saldo_plano bigint, saldo_comprado bigint, custo_estimado numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_custo numeric(12, 6);
BEGIN
  -- Defesa em profundidade além do grant: só a edge function (service_role) debita.
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'debitar_tokens: apenas service_role pode executar'
      USING ERRCODE = '42501';
  END IF;

  IF p_tokens_input < 0 OR p_tokens_output < 0 THEN
    RAISE EXCEPTION 'debitar_tokens: contagem de tokens negativa';
  END IF;

  -- COGS snapshot: preço vigente do modelo na hora do evento. Sem preço → custo NULL
  -- (o cliente TS reporta warning ao Sentry; o débito nunca falha por falta de preço).
  SELECT round(
           (p_tokens_input::numeric * mp.preco_input_por_milhao
            + p_tokens_output::numeric * mp.preco_output_por_milhao) / 1000000, 6)
  INTO v_custo
  FROM public.ai_model_precos mp
  WHERE mp.modelo = p_model AND mp.vigente_desde <= now()
  ORDER BY mp.vigente_desde DESC
  LIMIT 1;

  -- Turno sem token medido (0/0) não vira linha (o CHECK de sinal exige delta < 0),
  -- mas ainda devolve o saldo corrente.
  IF (p_tokens_input + p_tokens_output) > 0 THEN
    INSERT INTO public.ai_token_ledger (
      empresa_id, user_id, agent_key, agent_run_id, source,
      tokens_input, tokens_output, tokens_delta, custo_estimado, model, idempotency_key
    )
    VALUES (
      p_empresa_id, p_user_id, p_agent_key, p_agent_run_id, 'usage',
      p_tokens_input, p_tokens_output, -(p_tokens_input + p_tokens_output),
      v_custo, p_model, p_idempotency_key
    )
    ON CONFLICT (empresa_id, idempotency_key) WHERE idempotency_key IS NOT NULL
    DO NOTHING;
  END IF;

  RETURN QUERY
  SELECT COALESCE(s.saldo_plano, 0)::bigint,
         COALESCE(s.saldo_comprado, 0)::bigint,
         v_custo
  FROM (VALUES (1)) AS um(x)
  LEFT JOIN public.ai_token_saldo s ON s.empresa_id = p_empresa_id;
END;
$$;

-- REVOKE depois do CREATE (DROP+CREATE reabre grant endurecido, achado de 27/08).
REVOKE ALL ON FUNCTION public.debitar_tokens(uuid, uuid, text, uuid, text, integer, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.debitar_tokens(uuid, uuid, text, uuid, text, integer, integer, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.debitar_tokens(uuid, uuid, text, uuid, text, integer, integer, text) TO service_role;

-- =============================================
-- 6. Views de breakdown (nada de agregado materializado; RLS do ledger vale nelas)
-- =============================================

DROP VIEW IF EXISTS public.v_uso_tokens_por_usuario;
CREATE VIEW public.v_uso_tokens_por_usuario
  WITH (security_invoker = true)
AS
SELECT empresa_id,
       user_id,
       agent_key,
       date_trunc('month', created_at) AS mes,
       count(*) AS eventos,
       sum(tokens_input) AS tokens_input,
       sum(tokens_output) AS tokens_output,
       sum(custo_estimado) AS custo_estimado
FROM public.ai_token_ledger
WHERE source = 'usage'
GROUP BY empresa_id, user_id, agent_key, date_trunc('month', created_at);

DROP VIEW IF EXISTS public.v_uso_tokens_por_agente;
CREATE VIEW public.v_uso_tokens_por_agente
  WITH (security_invoker = true)
AS
SELECT empresa_id,
       agent_key,
       date_trunc('month', created_at) AS mes,
       count(*) AS eventos,
       sum(tokens_input) AS tokens_input,
       sum(tokens_output) AS tokens_output,
       sum(custo_estimado) AS custo_estimado
FROM public.ai_token_ledger
WHERE source = 'usage'
GROUP BY empresa_id, agent_key, date_trunc('month', created_at);

DROP VIEW IF EXISTS public.v_uso_tokens_por_empresa;
CREATE VIEW public.v_uso_tokens_por_empresa
  WITH (security_invoker = true)
AS
SELECT empresa_id,
       date_trunc('month', created_at) AS mes,
       count(*) AS eventos,
       sum(tokens_input) AS tokens_input,
       sum(tokens_output) AS tokens_output,
       sum(custo_estimado) AS custo_estimado
FROM public.ai_token_ledger
WHERE source = 'usage'
GROUP BY empresa_id, date_trunc('month', created_at);

REVOKE ALL ON TABLE public.v_uso_tokens_por_usuario FROM anon;
REVOKE ALL ON TABLE public.v_uso_tokens_por_agente FROM anon;
REVOKE ALL ON TABLE public.v_uso_tokens_por_empresa FROM anon;
