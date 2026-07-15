-- Migration 030: Fila de jobs de IA (scaffolding do ADR 0006)
--
-- Tabela `jobs` = fila + estado de pipeline multi-estágio (ADR 0006, padrões a/c).
-- Uma linha representa uma tarefa de IA de longa duração processada fora da
-- request síncrona: o produtor insere com status 'pending', um trigger dispara
-- pg_notify('jobs_pending', <job_id>), e um consumidor (edge function via Cron
-- por ora) faz claim atômico e processa um estágio por invocação.
--
-- IMPORTANTE: esta migration NÃO foi aplicada em nenhum banco. Rodar
-- `npm run gen:types` contra o banco depois de aplicar (ver ai-jobs.types.ts).
--
-- Convenções: multi-tenant por empresa_id + RLS (ADR 0001); nega cross-tenant.

-- =============================================
-- 1. Enum de status (state machine do pipeline)
-- =============================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_status') THEN
    CREATE TYPE public.job_status AS ENUM (
      'pending',    -- na fila, aguardando claim
      'running',    -- claim feito, estágio em execução
      'completed',  -- todos os estágios concluídos
      'failed'      -- falha terminal (após esgotar retries)
    );
  END IF;
END
$$;

-- =============================================
-- 2. Tabela jobs
-- =============================================

CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  -- Discriminador do pipeline (ex.: 'analise_rentabilidade', 'insight_mensal').
  tipo TEXT NOT NULL,
  status public.job_status NOT NULL DEFAULT 'pending',
  -- Payload de entrada (parâmetros da tarefa) e resultado final agregado.
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB,
  -- Progresso 0..100 para a UI acompanhar via Realtime.
  progress SMALLINT NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  -- Estágio atual do pipeline idempotente (ADR 0006 padrão a). NULL = não iniciou.
  stage TEXT,
  -- Mensagem de erro do último fracasso (NULL se nunca falhou).
  error TEXT,
  attempts SMALLINT NOT NULL DEFAULT 0,
  max_attempts SMALLINT NOT NULL DEFAULT 3,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

COMMENT ON TABLE public.jobs IS
  'Fila + estado de pipelines de IA de longa duração (ADR 0006). Produtor insere pending; consumidor faz claim atômico via claim_next_job() e processa um estágio por invocação.';
COMMENT ON COLUMN public.jobs.stage IS
  'Estágio atual do pipeline idempotente. O consumidor retoma daqui em caso de reexecução, sem refazer estágios já persistidos.';
COMMENT ON COLUMN public.jobs.progress IS
  'Progresso 0..100 para a UI (Realtime). Não é autoridade de estado; status/stage são.';

-- Índice para o consumidor buscar o próximo job pendente (ordem de chegada).
CREATE INDEX IF NOT EXISTS idx_jobs_pending
  ON public.jobs (created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_jobs_empresa
  ON public.jobs (empresa_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_jobs_status
  ON public.jobs (status);

-- =============================================
-- 3. RLS: isolamento por empresa (ADR 0001)
-- =============================================

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Leitura: usuário vê jobs da própria empresa (UI acompanha progresso).
DROP POLICY IF EXISTS "jobs_empresa_select" ON public.jobs;
CREATE POLICY "jobs_empresa_select" ON public.jobs
  FOR SELECT
  USING (empresa_id = public.get_user_empresa_id());

-- Inserção (enfileirar): usuário só cria job para a própria empresa, e só pode
-- enfileirar no estado inicial. Sem estas travas, como authenticated tem GRANT
-- INSERT por default privilege (ver base_schema), um usuário poderia forjar um job
-- já 'completed' com result/created_by arbitrários dentro da própria empresa e
-- enganar a UI que lê via Realtime. Transições de estado são só do consumidor.
-- Restringir por feature/role fica a cargo do consumidor/edge function (ADR 0005).
DROP POLICY IF EXISTS "jobs_empresa_insert" ON public.jobs;
CREATE POLICY "jobs_empresa_insert" ON public.jobs
  FOR INSERT
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND status = 'pending'
    AND progress = 0
    AND attempts = 0
    AND result IS NULL
    AND stage IS NULL
    AND (created_by IS NULL OR created_by = auth.uid())
  );

-- NÃO há policy de UPDATE/DELETE para authenticated: transições de estado
-- (claim, avanço de estágio, conclusão) são feitas exclusivamente pelo consumidor
-- via service_role / RPCs SECURITY DEFINER. Cliente não altera status à mão.

-- Defesa em profundidade: anon nunca deve tocar em jobs. O default privilege do
-- base_schema concede ALL a anon; RLS já bloqueia (auth.uid() null), mas revogar
-- fecha independentemente de policy futura.
REVOKE ALL ON public.jobs FROM anon;

-- =============================================
-- 4. Trigger updated_at
-- =============================================

CREATE OR REPLACE FUNCTION public.jobs_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_jobs_updated_at ON public.jobs;
CREATE TRIGGER trg_jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.jobs_set_updated_at();

-- =============================================
-- 5. Trigger pg_notify (ADR 0006 padrão c)
-- =============================================
-- AFTER INSERT de um job pending emite no canal 'jobs_pending' com o id do job.
-- Consumidores podem LISTEN nesse canal; enquanto não há bridge pg_notify->HTTP,
-- o consumidor roda por Cron e faz SELECT dos pending (fallback de polling).

CREATE OR REPLACE FUNCTION public.jobs_notify_pending()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    PERFORM pg_notify('jobs_pending', NEW.id::text);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_jobs_notify_pending ON public.jobs;
CREATE TRIGGER trg_jobs_notify_pending
  AFTER INSERT ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.jobs_notify_pending();

-- =============================================
-- 6. Claim atômico (ADR 0006 padrão c)
-- =============================================
-- Pega o próximo job pending e o marca 'running' numa única transação com
-- FOR UPDATE SKIP LOCKED, para dois consumidores nunca pegarem o mesmo job.
-- SECURITY DEFINER: chamado pela edge function (service_role). Cross-tenant é
-- esperado aqui (o consumidor processa jobs de qualquer empresa), então NÃO
-- expomos a authenticated/anon.

CREATE OR REPLACE FUNCTION public.claim_next_job(p_tipos TEXT[] DEFAULT NULL)
RETURNS public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.jobs;
BEGIN
  SELECT * INTO v_job
  FROM public.jobs
  WHERE status = 'pending'
    AND (p_tipos IS NULL OR tipo = ANY(p_tipos))
  ORDER BY created_at
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_job.id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.jobs
  SET status = 'running',
      attempts = attempts + 1,
      started_at = COALESCE(started_at, NOW())
  WHERE id = v_job.id
  RETURNING * INTO v_job;

  RETURN v_job;
END;
$$;

-- Só o consumidor server-side chama isto. Nunca o cliente.
REVOKE EXECUTE ON FUNCTION public.claim_next_job(TEXT[]) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.claim_next_job(TEXT[]) IS
  'Claim atômico do próximo job pending (FOR UPDATE SKIP LOCKED). Chamado só pelo consumidor via service_role. Opcionalmente filtra por tipos.';
