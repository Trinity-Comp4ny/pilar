-- Sinais de saúde do produto (SPEC 105, ADR 0047).
--
-- Conta o que aconteceu de fato numa janela recente, por componente, para o /health
-- decidir se pagamentos, e-mails, IA e crons estão saudáveis. Só contagens e horários:
-- nenhum dado de empresa sai daqui. Interna: só o service_role (a Edge Function health)
-- chama; prefixo "_" e o pgTAP funcoes_internas_grants.sql garantem que usuário não chama.

CREATE OR REPLACE FUNCTION public._ops_sinais_saude(
  p_janela interval DEFAULT interval '1 hour',
  p_janela_crons interval DEFAULT interval '24 hours'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_desde timestamptz := now() - p_janela;
  v_emails jsonb;
  v_pagamentos jsonb;
  v_ia jsonb;
  v_crons jsonb;
BEGIN
  -- Bounce e reclamação são problema do destinatário, não do envio: não contam.
  SELECT jsonb_build_object(
    'ok', count(*) FILTER (WHERE status IN ('enviado', 'entregue')),
    'falhas', count(*) FILTER (WHERE status = 'falhou'),
    'ultimo_ok', max(created_at) FILTER (WHERE status IN ('enviado', 'entregue')),
    'ultima_falha', max(created_at) FILTER (WHERE status = 'falhou')
  ) INTO v_emails
  FROM public.email_envios
  WHERE created_at >= v_desde;

  -- Webhook do checkout do Pilar (assinatura). O de cobrança de cliente
  -- (asaas_webhook_logs) não guarda erro; falha dele aparece no Sentry.
  SELECT jsonb_build_object(
    'ok', count(*) FILTER (WHERE error IS NULL AND processed IS TRUE),
    'falhas', count(*) FILTER (WHERE error IS NOT NULL),
    'ultimo_ok', max(created_at) FILTER (WHERE error IS NULL AND processed IS TRUE),
    'ultima_falha', max(created_at) FILTER (WHERE error IS NOT NULL)
  ) INTO v_pagamentos
  FROM public.pilar_checkout_webhook_logs
  WHERE created_at >= v_desde;

  -- Agentes (agent_runs) e tarefas assíncronas de IA (jobs) juntos: os dois falham
  -- pelo mesmo motivo quando o modelo cai.
  SELECT jsonb_build_object(
    'ok', sum(ok)::int,
    'falhas', sum(falhas)::int,
    'ultimo_ok', max(ultimo_ok),
    'ultima_falha', max(ultima_falha)
  ) INTO v_ia
  FROM (
    SELECT
      count(*) FILTER (WHERE status IN ('executed', 'approved', 'pending_review')) AS ok,
      count(*) FILTER (WHERE status = 'failed') AS falhas,
      max(updated_at) FILTER (WHERE status IN ('executed', 'approved', 'pending_review')) AS ultimo_ok,
      max(updated_at) FILTER (WHERE status = 'failed') AS ultima_falha
    FROM public.agent_runs
    WHERE updated_at >= v_desde
    UNION ALL
    SELECT
      count(*) FILTER (WHERE status = 'completed'),
      count(*) FILTER (WHERE status = 'failed'),
      max(updated_at) FILTER (WHERE status = 'completed'),
      max(updated_at) FILTER (WHERE status = 'failed')
    FROM public.jobs
    WHERE updated_at >= v_desde
  ) s;

  -- pg_cron só existe nos projetos hospedados; no banco local e no CI a tabela não
  -- existe e o componente volta como "sem dados".
  IF to_regclass('cron.job_run_details') IS NOT NULL THEN
    EXECUTE $q$
      SELECT jsonb_build_object(
        'disponivel', true,
        'ok', count(*) FILTER (WHERE status = 'succeeded'),
        'falhas', count(*) FILTER (WHERE status = 'failed'),
        'ultimo_ok', max(end_time) FILTER (WHERE status = 'succeeded'),
        'ultima_falha', max(end_time) FILTER (WHERE status = 'failed')
      )
      FROM cron.job_run_details
      WHERE start_time >= now() - $1
    $q$ INTO v_crons USING p_janela_crons;
  ELSE
    v_crons := jsonb_build_object('disponivel', false, 'ok', 0, 'falhas', 0);
  END IF;

  RETURN jsonb_build_object(
    'emails', v_emails,
    'pagamentos', v_pagamentos,
    'ia', v_ia,
    'crons', v_crons
  );
END;
$$;

REVOKE ALL ON FUNCTION public._ops_sinais_saude(interval, interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._ops_sinais_saude(interval, interval) TO service_role;

COMMENT ON FUNCTION public._ops_sinais_saude(interval, interval) IS
  'Contagens de sucesso e falha por componente para o /health (SPEC 105). Só service_role.';
