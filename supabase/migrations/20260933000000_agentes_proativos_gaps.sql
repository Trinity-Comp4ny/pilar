-- Gaps do Guardião de Margem achados investigando a reclamação de cliente sobre
-- "agentes pró ativos" (2026-09-08): o agente ficou 8 dias fora do ar (401 por
-- troca de formato da service role key, corrigido em 20260914000000) e ninguém
-- percebeu, porque nada nesse fluxo é visível pro usuário quando falha ou é
-- pulado em silêncio. Três correções:
--
-- 1. agent_cron_heartbeats: registro global (não por empresa) da última
--    execução de cada cron agêntico, pra UI mostrar "rodou hoje às 06:15" em
--    vez do usuário só descobrir que está quebrado quando um cliente reclama.
--    pg_cron marca o job SQL como sucesso mesmo quando a chamada HTTP interna
--    falha (net.http_post é fire-and-forget), então isso não pode depender só
--    de cron.job_run_details nem do Sentry Cron Monitoring (que já exclui de
--    propósito os crons baseados em net.http_post, ver 20260897000000).
-- 2. escopos.adiado_ate: permite "adiar" uma pendência na aba Pendências sem
--    aprovar nem rejeitar (hoje só existem essas duas ações definitivas).
-- 3. notificar_guardiao_sem_creditos: quando a empresa está sem créditos de
--    IA, o guardião pulava o projeto com um log.warn interno, e o usuário
--    nunca ficava sabendo que um projeto estourado ficou sem análise.

CREATE TABLE public.agent_cron_heartbeats (
  agent_type text PRIMARY KEY,
  last_run_at timestamptz NOT NULL,
  last_status text NOT NULL,
  detail jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.agent_cron_heartbeats IS
  'Última execução de cada cron agêntico (guardião de margem etc), pra UI expor status de saúde. Global, não por empresa: só contagens agregadas, sem dado de cliente.';

ALTER TABLE public.agent_cron_heartbeats ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário autenticado pode ver: é só contagem agregada, sem dado de empresa.
CREATE POLICY "agent_cron_heartbeats_select" ON public.agent_cron_heartbeats
  FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.registrar_heartbeat_agente(
  p_agent_type text,
  p_status     text,
  p_detail     jsonb DEFAULT NULL
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.agent_cron_heartbeats (agent_type, last_run_at, last_status, detail, updated_at)
  VALUES (p_agent_type, now(), p_status, p_detail, now())
  ON CONFLICT (agent_type) DO UPDATE
    SET last_run_at = now(), last_status = p_status, detail = p_detail, updated_at = now();
$$;

COMMENT ON FUNCTION public.registrar_heartbeat_agente(text, text, jsonb) IS
  'Chamada pelo próprio cron (edge function) ao final de cada execução, sucesso ou falha, pra UI ter um "última vez que rodou" confiável.';

REVOKE ALL ON FUNCTION public.registrar_heartbeat_agente(text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_heartbeat_agente(text, text, jsonb) TO service_role;

-- ── Adiar pendência (aba Pendências, spec 084) ──────────────────────────────
ALTER TABLE public.escopos ADD COLUMN adiado_ate timestamptz;

COMMENT ON COLUMN public.escopos.adiado_ate IS
  'Some da aba Pendências até esta data, sem aprovar nem rejeitar. NULL = não adiado. Não afeta projetos_com_escopo_estourado(): o rascunho continua "em aberto" e o guardião não gera outro pro mesmo projeto enquanto este existir.';

-- ── Aviso de créditos insuficientes ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notificar_guardiao_sem_creditos(
  p_empresa_id    uuid,
  p_qtd_projetos  integer
) RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.notificar(
    p_empresa_id,
    public._notif_gestao(p_empresa_id),
    'guardiao_sem_creditos', 'financeiro', 'medium',
    'Guardião de margem pausado por falta de créditos',
    p_qtd_projetos || ' projeto(s) estouraram o orçamento hoje e não foram analisados: sem créditos de IA. ' ||
      'Compre mais em Configurações > Uso, ou aguarde a renovação do ciclo.',
    'empresa', NULL, NULL
  );
$$;

COMMENT ON FUNCTION public.notificar_guardiao_sem_creditos(uuid, integer) IS
  'Avisa a gestão quando o guardiao-margem-cron pula projeto(s) por falta de créditos de IA, algo que antes era um log.warn interno, invisível pro usuário.';

REVOKE ALL ON FUNCTION public.notificar_guardiao_sem_creditos(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notificar_guardiao_sem_creditos(uuid, integer) TO service_role;
