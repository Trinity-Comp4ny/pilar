-- Obra inteligente (spec 040): o diário passa a reportar contra as tarefas do
-- cronograma. Tabela ponte obra_rdo ↔ tarefas com o resultado do dia, e duas
-- colunas em tarefas: sensibilidade a clima (para os alertas do cronograma) e
-- um flag de "parou" vindo do diário. Padrão de RLS espelha obra_rdo (isolamento
-- por empresa + revalidação cross-tenant do rdo e da tarefa).

-- 1. tarefas: sensibilidade a clima + sinalização de parada -------------------
ALTER TABLE public.tarefas
  ADD COLUMN IF NOT EXISTS sensivel_clima text
    CHECK (sensivel_clima IS NULL OR sensivel_clima IN
      ('concretagem', 'impermeabilizacao', 'pintura_externa', 'icamento', 'telhado', 'outro'));
ALTER TABLE public.tarefas
  ADD COLUMN IF NOT EXISTS sinalizada boolean NOT NULL DEFAULT false;

-- 2. obra_rdo_tarefa — o que cada dia do diário reportou por tarefa -----------
CREATE TABLE IF NOT EXISTS public.obra_rdo_tarefa (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  rdo_id      uuid NOT NULL REFERENCES public.obra_rdo(id) ON DELETE CASCADE,
  tarefa_id   uuid NOT NULL REFERENCES public.tarefas(id) ON DELETE CASCADE,
  resultado   text NOT NULL CHECK (resultado IN ('avancou', 'concluiu', 'parou')),
  observacao  text,
  created_by  uuid NOT NULL DEFAULT auth.uid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rdo_id, tarefa_id)
);

CREATE INDEX IF NOT EXISTS idx_obra_rdo_tarefa_rdo ON public.obra_rdo_tarefa (rdo_id);
CREATE INDEX IF NOT EXISTS idx_obra_rdo_tarefa_tarefa ON public.obra_rdo_tarefa (tarefa_id);

-- 3. RLS — escopo por empresa + revalida rdo e tarefa da mesma empresa --------
ALTER TABLE public.obra_rdo_tarefa ENABLE ROW LEVEL SECURITY;

CREATE POLICY obra_rdo_tarefa_select ON public.obra_rdo_tarefa
  FOR SELECT USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY obra_rdo_tarefa_insert ON public.obra_rdo_tarefa
  FOR INSERT WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND EXISTS (
      SELECT 1 FROM public.obra_rdo r
      WHERE r.id = rdo_id AND r.empresa_id = public.get_user_empresa_id()
    )
    AND EXISTS (
      SELECT 1 FROM public.tarefas t
      WHERE t.id = tarefa_id AND t.empresa_id = public.get_user_empresa_id()
    )
  );

CREATE POLICY obra_rdo_tarefa_update ON public.obra_rdo_tarefa
  FOR UPDATE USING (empresa_id = public.get_user_empresa_id())
  WITH CHECK (empresa_id = public.get_user_empresa_id());

CREATE POLICY obra_rdo_tarefa_delete ON public.obra_rdo_tarefa
  FOR DELETE USING (empresa_id = public.get_user_empresa_id());
