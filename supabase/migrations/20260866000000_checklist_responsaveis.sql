-- Spec 071 (revisão): responsável passa a ser por tarefa (item de checklist),
-- não mais só por disciplina. Mesmo padrão de projeto_disciplina_responsaveis
-- (join table + RLS via join até empresa_id), só que um nível mais fundo.
-- Igual duracao_dias_uteis/horas_estimadas do item, é populado só na criação
-- da disciplina (a partir do checklist_padrao do fluxo aplicado) — não tem
-- fluxo de edição posterior nesta spec.

CREATE TABLE IF NOT EXISTS public.projeto_disciplina_checklist_responsaveis (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_item_id uuid NOT NULL REFERENCES public.projeto_disciplina_checklist(id) ON DELETE CASCADE,
  pessoa_id        uuid NOT NULL REFERENCES public.pessoas(id) ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (checklist_item_id, pessoa_id)
);

CREATE INDEX IF NOT EXISTS idx_projeto_disciplina_checklist_responsaveis_item
  ON public.projeto_disciplina_checklist_responsaveis (checklist_item_id);

ALTER TABLE public.projeto_disciplina_checklist_responsaveis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS projeto_disciplina_checklist_responsaveis_empresa ON public.projeto_disciplina_checklist_responsaveis;
CREATE POLICY projeto_disciplina_checklist_responsaveis_empresa
  ON public.projeto_disciplina_checklist_responsaveis
  USING (EXISTS (
    SELECT 1
    FROM public.projeto_disciplina_checklist c
    JOIN public.projeto_disciplinas pd ON pd.id = c.projeto_disciplina_id
    JOIN public.projetos p ON p.id = pd.projeto_id
    WHERE c.id = projeto_disciplina_checklist_responsaveis.checklist_item_id
      AND p.empresa_id = public.get_user_empresa_id()
  ));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projeto_disciplina_checklist_responsaveis TO authenticated;
