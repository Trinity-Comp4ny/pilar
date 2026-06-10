-- Fundação agêntica: agent_runs + agent_actions.
--
-- Substitui a antiga ai_insights (dropada em 20260429400000_drop_dormant_tables.sql)
-- com semântica de agente: cada execução nasce como draft, passa por revisão
-- humana (copilot → autopilot) e só então é aplicada ao domínio.
--
-- Máquina de estados:
--   queued → running → pending_review → approved → executed
--                          ↓                ↓
--                       rejected          failed
--
-- agent_runs    : estado + artefato (result jsonb, validado por Zod na edge function)
-- agent_actions : audit trail de cada tool/passo (exibido como log de raciocínio no cockpit)

CREATE TYPE agent_run_status AS ENUM (
  'queued', 'running', 'pending_review', 'approved', 'executed', 'rejected', 'failed'
);

CREATE TABLE public.agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  agent_type text NOT NULL,                  -- 'orcamento_honorarios' | 'proposta' | ...
  status agent_run_status NOT NULL DEFAULT 'queued',
  entity_type text,                          -- 'projeto' | 'proposta' | 'lead'
  entity_id uuid,
  input jsonb,                               -- contexto de entrada (briefing, params)
  result jsonb,                              -- artefato gerado (draft validado)
  confidence numeric,                        -- score de confiança/eval por run
  version int NOT NULL DEFAULT 1,            -- incrementa a cada regeneração
  idempotency_key text,                      -- dedupe de enfileiramento por evento
  model text,                                -- modelo usado (ex: gemini-2.0-flash)
  tokens_input int NOT NULL DEFAULT 0,
  tokens_output int NOT NULL DEFAULT 0,
  error text,                                -- preenchido quando status = 'failed'
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Idempotência: o mesmo evento não cria dois runs (entrega at-least-once das filas).
CREATE UNIQUE INDEX uq_agent_runs_idempotency
  ON public.agent_runs(empresa_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Cockpit: listar fila de revisão por empresa/status, mais recentes primeiro.
CREATE INDEX idx_agent_runs_empresa_status ON public.agent_runs(empresa_id, status, created_at DESC);
CREATE INDEX idx_agent_runs_entity ON public.agent_runs(entity_type, entity_id);

ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;

-- Membros da empresa veem os runs da própria empresa.
CREATE POLICY "agent_runs_select" ON public.agent_runs
  FOR SELECT USING (empresa_id = get_user_empresa_id());

-- Revisão humana (aprovar / editar / rejeitar) — restrita à própria empresa.
CREATE POLICY "agent_runs_update" ON public.agent_runs
  FOR UPDATE USING (empresa_id = get_user_empresa_id())
  WITH CHECK (empresa_id = get_user_empresa_id());

-- Edge functions (service role) criam os runs.
CREATE POLICY "agent_runs_service_insert" ON public.agent_runs
  FOR INSERT WITH CHECK (true);

CREATE TRIGGER trg_agent_runs_updated_at
  BEFORE UPDATE ON public.agent_runs
  FOR EACH ROW EXECUTE FUNCTION tg_pilar_touch_updated_at();

-- Audit trail: cada tool/passo que o agente executou dentro de um run.
CREATE TABLE public.agent_actions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  tool_name text NOT NULL,
  args jsonb,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_actions_run ON public.agent_actions(run_id, created_at);

ALTER TABLE public.agent_actions ENABLE ROW LEVEL SECURITY;

-- Leitura do audit segue a visibilidade do run pai (mesma empresa).
CREATE POLICY "agent_actions_select" ON public.agent_actions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.agent_runs r
      WHERE r.id = run_id AND r.empresa_id = get_user_empresa_id()
    )
  );

CREATE POLICY "agent_actions_service_insert" ON public.agent_actions
  FOR INSERT WITH CHECK (true);
