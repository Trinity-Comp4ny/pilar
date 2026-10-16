-- SPEC 131: liga o agente Qualidade.
--
-- Lê o Sentry pela Edge Function ops-agente-run (secret SENTRY_READ_TOKEN, só leitura) e
-- grava tarefas com link para o erro e, quando o erro que atingiu cliente é resolvido,
-- rascunho de WhatsApp avisando que já foi corrigido. Nada novo no banco além do cron.
--
-- Todo dia às 10h03 UTC = 7h03 de Brasília: depois da Receita (7h) e antes do Clientes
-- (7h05), para o aviso de "já corrigimos" ocupar o contato do dia e o Clientes não mandar
-- outro WhatsApp ao mesmo escritório (SPEC 129).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ops-qualidade') THEN
      PERFORM cron.unschedule('ops-qualidade');
    END IF;
    PERFORM cron.schedule('ops-qualidade', '3 10 * * *', $c$SELECT public.ops_agente_disparar('qualidade');$c$);
  END IF;
END;
$$;

-- Tarefa interna é N2 (cria e avisa no resumo); mensagem a cliente segue N1 (ADR 0060).
UPDATE public.ops_agentes
   SET ativo = true, teto_mensal_brl = 30, cron = '3 10 * * *', fase = 2,
       autonomia = '{"tarefa": "N2", "whatsapp": "N1"}'::jsonb, updated_at = now()
 WHERE id = 'qualidade';
