-- Proveniência da execução do agente (SPEC 110): qual versão do código e do prompt gerou
-- cada agent_run. Liga uma execução ruim à versão que a produziu e ao resultado dos evals
-- daquela versão (ADR 0048).
--
-- release      commit do deploy das edge functions (RELEASE_SHA, setado pelo CI no deploy).
-- prompt_hash  16 primeiros hex do SHA-256 do system prompt. Em agente de prompt único e na
--              extração de criação do ai-chat. Consulta e operação do ai-chat passam por mais
--              de um prompt: ficam sem hash e o release fixa a versão de todos.
--
-- Colunas nulas: runs antigos e ambiente local (sem RELEASE_SHA) ficam sem valor.
ALTER TABLE public.agent_runs
  ADD COLUMN IF NOT EXISTS release text,
  ADD COLUMN IF NOT EXISTS prompt_hash text;

COMMENT ON COLUMN public.agent_runs.release IS 'Commit do deploy das edge functions que gerou o run (RELEASE_SHA). SPEC 110.';
COMMENT ON COLUMN public.agent_runs.prompt_hash IS '16 primeiros hex do SHA-256 do system prompt (agente de prompt único). SPEC 110.';
