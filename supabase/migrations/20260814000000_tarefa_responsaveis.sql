-- Meu trabalho · múltiplos responsáveis por tarefa
-- Antes: tarefas.responsavel_id (um FK). Agora: tabela ponte tarefa_responsaveis
-- guarda o conjunto de responsáveis. responsavel_id é mantido como "primário"
-- (o primeiro), sincronizado pelo app, para leituras/compat existentes.
-- Espelha o padrão de projeto_disciplina_responsaveis. RLS por empresa.

CREATE TABLE IF NOT EXISTS public.tarefa_responsaveis (
  tarefa_id  uuid NOT NULL REFERENCES public.tarefas(id) ON DELETE CASCADE,
  pessoa_id  uuid NOT NULL REFERENCES public.pessoas(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tarefa_id, pessoa_id)
);

-- "Minhas tarefas": busca por pessoa dentro da empresa.
CREATE INDEX IF NOT EXISTS idx_tarefa_resp_empresa_pessoa
  ON public.tarefa_responsaveis (empresa_id, pessoa_id);
CREATE INDEX IF NOT EXISTS idx_tarefa_resp_tarefa
  ON public.tarefa_responsaveis (tarefa_id);

-- Backfill: cada responsavel_id atual vira uma linha na ponte, sem perder nada.
INSERT INTO public.tarefa_responsaveis (tarefa_id, pessoa_id, empresa_id)
SELECT t.id, t.responsavel_id, t.empresa_id
  FROM public.tarefas t
 WHERE t.responsavel_id IS NOT NULL
ON CONFLICT (tarefa_id, pessoa_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- RLS — isolamento por empresa + validação cross-tenant (tarefa e pessoa da
-- mesma empresa do usuário).
-- ---------------------------------------------------------------------------
ALTER TABLE public.tarefa_responsaveis ENABLE ROW LEVEL SECURITY;

CREATE POLICY tarefa_responsaveis_select ON public.tarefa_responsaveis
  FOR SELECT USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY tarefa_responsaveis_insert ON public.tarefa_responsaveis
  FOR INSERT WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND EXISTS (
      SELECT 1 FROM public.tarefas t
      WHERE t.id = tarefa_id AND t.empresa_id = public.get_user_empresa_id()
    )
    AND EXISTS (
      SELECT 1 FROM public.pessoas p
      WHERE p.id = pessoa_id AND p.empresa_id = public.get_user_empresa_id()
    )
  );

CREATE POLICY tarefa_responsaveis_delete ON public.tarefa_responsaveis
  FOR DELETE USING (empresa_id = public.get_user_empresa_id());

GRANT SELECT, INSERT, DELETE ON public.tarefa_responsaveis TO authenticated;
