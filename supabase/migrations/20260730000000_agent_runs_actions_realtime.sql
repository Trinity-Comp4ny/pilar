-- Realtime (postgres_changes) para a Mesa de Trabalho dos agentes (spec 007, Fase 2b).
--
-- Objetivo: deixar o modal de raciocínio dos agentes atualizar em tempo real. O front
-- vai abrir uma subscription do Supabase Realtime em public.agent_runs (transições de
-- estado: queued → running → pending_review → approved → executed) e em
-- public.agent_actions (cada passo/tool que o agente registra durante o run), para que
-- a timeline apareça progressivamente sem refresh manual, com fallback de polling.
--
-- Como funciona: o Realtime do Supabase publica mudanças das tabelas que estão na
-- publication `supabase_realtime` (criada no base_schema). Aqui só ADICIONAMOS as duas
-- tabelas à publication; não mexemos em dados nem em RLS.
--
-- AUTORIZAÇÃO: o RLS já existente continua sendo a barreira. O Realtime respeita as
-- policies de SELECT — cada cliente só recebe eventos das linhas que já poderia ler:
--   * agent_runs_select    → empresa_id = get_user_empresa_id()
--   * agent_actions_select → run pai da mesma empresa (EXISTS em agent_runs)
-- Não há vazamento cross-tenant: quem não enxerga a linha via RLS não recebe o evento.
--
-- REPLICA IDENTITY FULL: por padrão o Postgres publica só a PK nos eventos de UPDATE/
-- DELETE. agent_runs sofre UPDATE a cada transição de estado (aprovar/rejeitar/executar);
-- para o Realtime aplicar o RLS na linha ATUALIZADA e entregar o payload completo (old +
-- new), a tabela precisa de REPLICA IDENTITY FULL. Fazemos o mesmo em agent_actions por
-- consistência (é insert-only hoje, mas garante o payload completo se algum dia mudar).

ALTER TABLE public.agent_runs REPLICA IDENTITY FULL;
ALTER TABLE public.agent_actions REPLICA IDENTITY FULL;

-- Idempotente: só adiciona à publication se ainda não estiver lá (evita erro
-- "relation is already member of publication" ao reaplicar a migration).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'agent_runs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_runs;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'agent_actions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_actions;
  END IF;
END $$;
