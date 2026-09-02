-- Motor de tokens, alerta de anomalia de gasto diário (SPEC 085). Complementa a spec 076
-- (saldo baixo, aviso pro cliente): esta view sinaliza pro ultra-admin quando uma empresa
-- consome hoje muito acima da própria média recente, sinal que o rate limit de rajada
-- (30/min, checkRateLimit) não cobre (volume sustentado ao longo do dia).

DROP VIEW IF EXISTS public.v_uso_tokens_anomalia_diaria;
CREATE VIEW public.v_uso_tokens_anomalia_diaria
  WITH (security_invoker = true)
AS
WITH diario AS (
  SELECT
    empresa_id,
    created_at::date AS dia,
    SUM(tokens_input + tokens_output) AS tokens_dia
  FROM public.ai_token_ledger
  WHERE source = 'usage' AND created_at >= (current_date - interval '7 days')
  GROUP BY empresa_id, created_at::date
)
SELECT
  empresa_id,
  COALESCE(SUM(tokens_dia) FILTER (WHERE dia = current_date), 0)::bigint AS tokens_hoje,
  COALESCE(AVG(tokens_dia) FILTER (WHERE dia < current_date), 0)::numeric AS media_dias_anteriores,
  COUNT(*) FILTER (WHERE dia < current_date)::int AS dias_com_uso_anteriores,
  (
    COUNT(*) FILTER (WHERE dia < current_date) >= 3
    AND COALESCE(SUM(tokens_dia) FILTER (WHERE dia = current_date), 0) >
        GREATEST(COALESCE(AVG(tokens_dia) FILTER (WHERE dia < current_date), 0) * 10, 20000)
  ) AS anomalia
FROM diario
GROUP BY empresa_id;

REVOKE ALL ON TABLE public.v_uso_tokens_anomalia_diaria FROM anon;
