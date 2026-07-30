-- Spec 014 · Etapas de tarefa personalizáveis (Kanban customizável, decisão do
-- CEO em 2026-07-30 reabrindo o board configurável que o painel travara na spec
-- 013). Vale só para TAREFAS: cada empresa define suas colunas (Backlog, Em
-- revisão, ...). Disciplina continua nos 3 baldes de status (não entra aqui).

-- Tabela de etapas (colunas) por empresa ---------------------------------------
CREATE TABLE IF NOT EXISTS public.tarefa_etapas (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome       text NOT NULL,
  ordem      integer NOT NULL DEFAULT 0,
  cor        text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tarefa_etapas_empresa_ordem
  ON public.tarefa_etapas (empresa_id, ordem);

ALTER TABLE public.tarefa_etapas ENABLE ROW LEVEL SECURITY;

-- Config da empresa: qualquer membro autenticado da empresa gerencia as colunas
-- (mesma filosofia de baixo atrito das tarefas). Escopo por empresa dos dois lados.
DROP POLICY IF EXISTS tarefa_etapas_all ON public.tarefa_etapas;
CREATE POLICY tarefa_etapas_all ON public.tarefa_etapas
  FOR ALL
  USING (empresa_id = public.get_user_empresa_id())
  WITH CHECK (empresa_id = public.get_user_empresa_id());

-- Tarefa aponta para a etapa (coluna). Apagar a etapa solta a tarefa (Sem etapa).
ALTER TABLE public.tarefas
  ADD COLUMN IF NOT EXISTS etapa_id uuid REFERENCES public.tarefa_etapas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tarefas_etapa ON public.tarefas (etapa_id);

-- Seed dos 3 padrões por empresa que ainda não tem etapa (espelha os baldes) ----
INSERT INTO public.tarefa_etapas (empresa_id, nome, ordem)
SELECT e.id, v.nome, v.ordem
FROM public.empresas e
CROSS JOIN (VALUES ('A fazer', 0), ('Fazendo', 1), ('Concluído', 2)) AS v(nome, ordem)
WHERE NOT EXISTS (SELECT 1 FROM public.tarefa_etapas t WHERE t.empresa_id = e.id);

-- Backfill: tarefa sem etapa cai na etapa que casa com o balde de status atual --
UPDATE public.tarefas t
SET etapa_id = te.id
FROM public.tarefa_etapas te
WHERE te.empresa_id = t.empresa_id
  AND t.etapa_id IS NULL
  AND te.nome = CASE t.status
    WHEN 'a_fazer'   THEN 'A fazer'
    WHEN 'fazendo'   THEN 'Fazendo'
    WHEN 'concluida' THEN 'Concluído'
  END;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarefa_etapas TO authenticated;
