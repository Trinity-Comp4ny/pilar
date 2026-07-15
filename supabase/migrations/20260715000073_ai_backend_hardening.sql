-- Endurecimento do backend de IA/Agentes (cauda da auditoria).
--
-- 1) increment_ai_usage: incremento ATÔMICO do contador de uso (ai_usage).
--    Substitui o read-then-update (corrida TOCTOU) da edge por um único INSERT ON CONFLICT
--    com `coluna = coluna + delta`. Conta o nº REAL de chamadas ao Gemini no turno (p_calls),
--    não 1 por mensagem — corrige a subcontagem que distorcia o billing por créditos.
--
-- 2) tg_agent_runs_audit: trilha (agent_actions) das transições de estado do run.
--    Materialização/aprovação (executed), rejeição/undo (rejected) e falha (failed) passam a
--    gravar uma linha de auditoria. Trigger AFTER UPDATE — não toca nenhuma das RPCs já aplicadas
--    (criar_*_agente, aprovar_orcamento_agente, executar_acao_agente, fechar_folha_agente) e ainda
--    assim captura o momento chave: quando o run muda para um estado terminal.

-- ---------------------------------------------------------------------------
-- 1. Incremento atômico de uso de IA
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.increment_ai_usage(uuid, int, int, int);

CREATE OR REPLACE FUNCTION public.increment_ai_usage(
  p_empresa_id uuid,
  p_calls int,
  p_tokens_input int,
  p_tokens_output int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mes int := EXTRACT(MONTH FROM now())::int;
  v_ano int := EXTRACT(YEAR FROM now())::int;
BEGIN
  INSERT INTO public.ai_usage (empresa_id, mes, ano, total_requests, total_tokens_entrada, total_tokens_saida)
  VALUES (
    p_empresa_id, v_mes, v_ano,
    GREATEST(COALESCE(p_calls, 1), 0),
    GREATEST(COALESCE(p_tokens_input, 0), 0),
    GREATEST(COALESCE(p_tokens_output, 0), 0)
  )
  ON CONFLICT (empresa_id, mes, ano) DO UPDATE
    SET total_requests       = public.ai_usage.total_requests + GREATEST(COALESCE(p_calls, 1), 0),
        total_tokens_entrada = public.ai_usage.total_tokens_entrada + GREATEST(COALESCE(p_tokens_input, 0), 0),
        total_tokens_saida   = public.ai_usage.total_tokens_saida + GREATEST(COALESCE(p_tokens_output, 0), 0),
        updated_at           = now();
END;
$$;

-- Edge usa service_role (bypassa RLS); authenticated recebe grant por consistência.
GRANT EXECUTE ON FUNCTION public.increment_ai_usage(uuid, int, int, int) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Trilha de auditoria das transições de estado do agent_run
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_agent_runs_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só registra a entrada em estado terminal (aprovação/materialização, rejeição/undo, falha).
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('executed', 'rejected', 'failed') THEN
    BEGIN
      INSERT INTO public.agent_actions (run_id, tool_name, args, result)
      VALUES (
        NEW.id,
        'transicao_status:' || NEW.status,
        jsonb_build_object(
          'de', OLD.status,
          'para', NEW.status,
          'por', auth.uid(),
          'entity_type', NEW.entity_type,
          'entity_id', NEW.entity_id
        ),
        CASE WHEN NEW.error IS NOT NULL THEN jsonb_build_object('error', NEW.error) ELSE NEW.result END
      );
    EXCEPTION WHEN OTHERS THEN
      -- A trilha nunca bloqueia a ação de negócio.
      NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_agent_runs_audit ON public.agent_runs;
CREATE TRIGGER trg_agent_runs_audit
  AFTER UPDATE ON public.agent_runs
  FOR EACH ROW EXECUTE FUNCTION public.tg_agent_runs_audit();
