-- Financeiro: resumo diário "o que vence hoje" na central.
--
-- A varredura das 06:00 (gerar_notificacoes_ambient) avisa vencimento em até 7 dias
-- e atraso, um aviso por lançamento. Faltava o dia em si, de forma que dê para ler
-- de relance: uma notificação por empresa, às 08:00 de Brasília, com o total a pagar
-- e a receber que vence hoje. Sem nada vencendo hoje, não avisa.
--
-- Vai para quem pode ver dinheiro (_notif_ve_financeiro). Função própria em vez de
-- mexer no gerador grande: o gerador segue como está.

CREATE OR REPLACE FUNCTION public.gerar_resumo_financeiro_dia()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hoje date := current_date;
  fmt text := 'FM999999990.00';
  v_total integer := 0;
  rec record;
  v_partes text[];
BEGIN
  FOR rec IN
    SELECT e.id AS empresa_id,
           COALESCE(d.qtd, 0) AS qtd_pagar,  COALESCE(d.soma, 0) AS soma_pagar,
           COALESCE(r.qtd, 0) AS qtd_receber, COALESCE(r.soma, 0) AS soma_receber
    FROM public.empresas e
    LEFT JOIN LATERAL (
      SELECT count(*) AS qtd, sum(x.valor) AS soma
      FROM public.despesas x
      WHERE x.empresa_id = e.id AND x.status = 'Pendente' AND x.is_fatura_payment = false
        AND x.deleted_at IS NULL AND x.data_vencimento = v_hoje
    ) d ON true
    LEFT JOIN LATERAL (
      SELECT count(*) AS qtd, sum(x.valor) AS soma
      FROM public.receitas x
      WHERE x.empresa_id = e.id AND x.status = 'Pendente'
        AND x.deleted_at IS NULL AND x.data_vencimento = v_hoje
    ) r ON true
    WHERE COALESCE(d.qtd, 0) + COALESCE(r.qtd, 0) > 0
  LOOP
    v_partes := '{}';
    IF rec.qtd_pagar > 0 THEN
      v_partes := v_partes || (rec.qtd_pagar || ' a pagar (R$ ' || to_char(rec.soma_pagar, fmt) || ')');
    END IF;
    IF rec.qtd_receber > 0 THEN
      v_partes := v_partes || (rec.qtd_receber || ' a receber (R$ ' || to_char(rec.soma_receber, fmt) || ')');
    END IF;

    v_total := v_total + public.notificar(
      rec.empresa_id, public._notif_ve_financeiro(rec.empresa_id),
      'resumo_financeiro_dia', 'financeiro', 'medium',
      'Vence hoje: ' || array_to_string(v_partes, ' e '),
      'Abra o financeiro para dar baixa conforme for pagando e recebendo.',
      NULL,
      -- Uma referência estável por empresa e dia: o dedup do notificar() não empilha.
      md5(rec.empresa_id::text || v_hoje::text)::uuid,
      '/gestao/financeiro');
  END LOOP;

  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.gerar_resumo_financeiro_dia() FROM PUBLIC, anon, authenticated;

-- Check-in no Sentry Crons, como os demais jobs (ADR 0036).
CREATE OR REPLACE FUNCTION public.gerar_resumo_financeiro_dia_monitored()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_check_in_id uuid;
BEGIN
  v_check_in_id := public.sentry_cron_checkin('resumo-financeiro-dia', 'in_progress');
  BEGIN
    PERFORM public.gerar_resumo_financeiro_dia();
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.sentry_cron_checkin('resumo-financeiro-dia', 'error', v_check_in_id);
    RAISE;
  END;
  PERFORM public.sentry_cron_checkin('resumo-financeiro-dia', 'ok', v_check_in_id);
END;
$$;

REVOKE ALL ON FUNCTION public.gerar_resumo_financeiro_dia_monitored() FROM PUBLIC, anon, authenticated;

-- 11:00 UTC = 08:00 em Brasília.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron não disponível: resumo diário não agendado (dev local sem a extensão).';
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'resumo-financeiro-dia') THEN
    PERFORM cron.unschedule('resumo-financeiro-dia');
  END IF;
  PERFORM cron.schedule('resumo-financeiro-dia', '0 11 * * *', 'SELECT public.gerar_resumo_financeiro_dia_monitored();');
END;
$$;
