-- Backfill do ledger de tokens (SPEC 074, passo 2): traz o histórico de ai_usage_logs
-- para ai_token_ledger. Idempotente e re-rodável: a chave é reference_id
-- ('ai_usage_logs:<id>'), protegida por unique parcial.
--
-- Origem ÚNICA: ai_usage_logs. agent_runs fica de fora de propósito — todo caminho de
-- código grava tokens nas DUAS tabelas (dupla contagem verificada em 31/08), então
-- backfillar ambas duplicaria o histórico. user_id fica NULL (nunca foi capturado) e
-- custo fica NULL (sem modelo registrado por linha; o código nunca preencheu `model`).
--
-- O saldo se materializa sozinho: o trigger trg_ai_token_ledger_saldo roda por linha
-- inserida aqui. Nenhuma reagregação manual.

INSERT INTO public.ai_token_ledger (
  empresa_id,
  user_id,
  agent_key,
  source,
  tokens_input,
  tokens_output,
  tokens_delta,
  custo_estimado,
  model,
  reference_id,
  created_at
)
SELECT
  l.empresa_id,
  NULL,
  l.feature_key,
  'usage',
  l.tokens_input,
  l.tokens_output,
  -(l.tokens_input + l.tokens_output),
  NULL,
  l.model,
  'ai_usage_logs:' || l.id,
  COALESCE(l.created_at, now())
FROM public.ai_usage_logs l
-- Linha 0/0 não entra: o CHECK de sinal do ledger exige delta < 0 em 'usage'.
WHERE (l.tokens_input + l.tokens_output) > 0
  AND NOT EXISTS (
    SELECT 1
    FROM public.ai_token_ledger t
    WHERE t.reference_id = 'ai_usage_logs:' || l.id
  );
