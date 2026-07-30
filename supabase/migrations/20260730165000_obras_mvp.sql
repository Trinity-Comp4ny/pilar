-- Obras · MVP (spec 015-obras-mvp, ADR 0011)
-- A obra é a fase de execução de um projeto: obras -> projeto_id.
-- Cria obras, obra_frente, obra_rdo; pendura obra_id/obra_frente_id em tarefas
-- (reusa o motor de tarefa, sem duplicar). RLS no padrão de tarefas.

-- ---------------------------------------------------------------------------
-- 1. obras — a fase de execução de um projeto
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.obras (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id          uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  projeto_id          uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  nome                text NOT NULL,
  status              text NOT NULL DEFAULT 'planejada'
                        CHECK (status IN ('planejada', 'em_andamento', 'paralisada', 'concluida')),
  responsavel_id      uuid REFERENCES public.pessoas(id) ON DELETE SET NULL,
  data_inicio_prevista date,
  data_fim_prevista    date,
  data_inicio_real     date,
  data_fim_real        date,
  observacoes         text,
  created_by          uuid NOT NULL DEFAULT auth.uid(),
  updated_by          uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);

-- Uma obra ativa por projeto (req. 1 da spec).
CREATE UNIQUE INDEX IF NOT EXISTS obras_projeto_ativa_uniq
  ON public.obras (projeto_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_obras_empresa_status
  ON public.obras (empresa_id, status) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_obras_updated_at
  BEFORE UPDATE ON public.obras
  FOR EACH ROW EXECUTE FUNCTION public.tg_pilar_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 2. obra_frente — agrupador de serviço dentro da obra
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.obra_frente (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  obra_id     uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  nome        text NOT NULL,
  ordem       int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_obra_frente_obra
  ON public.obra_frente (obra_id, ordem);

CREATE TRIGGER trg_obra_frente_updated_at
  BEFORE UPDATE ON public.obra_frente
  FOR EACH ROW EXECUTE FUNCTION public.tg_pilar_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 3. obra_rdo — diário de obra, no máximo um por dia
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.obra_rdo (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  obra_id           uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  data              date NOT NULL,
  clima             text CHECK (clima IN ('ensolarado', 'nublado', 'chuvoso', 'chuva_forte')),
  condicao_trabalho text CHECK (condicao_trabalho IN ('normal', 'parcial', 'paralisada')),
  efetivo           int CHECK (efetivo IS NULL OR efetivo >= 0),
  atividades        text,
  ocorrencias       text,
  pendencias        text,
  autor_id          uuid REFERENCES public.pessoas(id) ON DELETE SET NULL,
  created_by        uuid NOT NULL DEFAULT auth.uid(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (obra_id, data)
);

CREATE INDEX IF NOT EXISTS idx_obra_rdo_obra_data
  ON public.obra_rdo (obra_id, data DESC);

CREATE TRIGGER trg_obra_rdo_updated_at
  BEFORE UPDATE ON public.obra_rdo
  FOR EACH ROW EXECUTE FUNCTION public.tg_pilar_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 4. tarefas ganha vínculo opcional com obra e frente (reusa o motor de tarefa)
-- ---------------------------------------------------------------------------
ALTER TABLE public.tarefas
  ADD COLUMN IF NOT EXISTS obra_id uuid REFERENCES public.obras(id) ON DELETE SET NULL;
ALTER TABLE public.tarefas
  ADD COLUMN IF NOT EXISTS obra_frente_id uuid REFERENCES public.obra_frente(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tarefas_obra
  ON public.tarefas (obra_id) WHERE obra_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tarefas_obra_frente
  ON public.tarefas (obra_frente_id) WHERE obra_frente_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 5. RLS — isolamento por empresa + revalidação cross-tenant (padrão tarefas)
-- ---------------------------------------------------------------------------
ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obra_frente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obra_rdo ENABLE ROW LEVEL SECURITY;

-- obras: leitura só ativas da empresa; escrita revalida projeto/responsável.
CREATE POLICY obras_select ON public.obras
  FOR SELECT USING (empresa_id = public.get_user_empresa_id() AND deleted_at IS NULL);

CREATE POLICY obras_insert ON public.obras
  FOR INSERT WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND EXISTS (
      SELECT 1 FROM public.projetos pr
      WHERE pr.id = projeto_id AND pr.empresa_id = public.get_user_empresa_id()
    )
    AND (
      responsavel_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.pessoas p
        WHERE p.id = responsavel_id AND p.empresa_id = public.get_user_empresa_id()
      )
    )
  );

CREATE POLICY obras_update ON public.obras
  FOR UPDATE USING (empresa_id = public.get_user_empresa_id())
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND EXISTS (
      SELECT 1 FROM public.projetos pr
      WHERE pr.id = projeto_id AND pr.empresa_id = public.get_user_empresa_id()
    )
    AND (
      responsavel_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.pessoas p
        WHERE p.id = responsavel_id AND p.empresa_id = public.get_user_empresa_id()
      )
    )
  );

CREATE POLICY obras_delete ON public.obras
  FOR DELETE USING (empresa_id = public.get_user_empresa_id());

-- obra_frente: escopo por empresa + a obra tem que ser da empresa.
CREATE POLICY obra_frente_select ON public.obra_frente
  FOR SELECT USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY obra_frente_insert ON public.obra_frente
  FOR INSERT WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND EXISTS (
      SELECT 1 FROM public.obras o
      WHERE o.id = obra_id AND o.empresa_id = public.get_user_empresa_id()
    )
  );

CREATE POLICY obra_frente_update ON public.obra_frente
  FOR UPDATE USING (empresa_id = public.get_user_empresa_id())
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND EXISTS (
      SELECT 1 FROM public.obras o
      WHERE o.id = obra_id AND o.empresa_id = public.get_user_empresa_id()
    )
  );

CREATE POLICY obra_frente_delete ON public.obra_frente
  FOR DELETE USING (empresa_id = public.get_user_empresa_id());

-- obra_rdo: escopo por empresa + revalida obra e autor.
CREATE POLICY obra_rdo_select ON public.obra_rdo
  FOR SELECT USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY obra_rdo_insert ON public.obra_rdo
  FOR INSERT WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND EXISTS (
      SELECT 1 FROM public.obras o
      WHERE o.id = obra_id AND o.empresa_id = public.get_user_empresa_id()
    )
    AND (
      autor_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.pessoas p
        WHERE p.id = autor_id AND p.empresa_id = public.get_user_empresa_id()
      )
    )
  );

CREATE POLICY obra_rdo_update ON public.obra_rdo
  FOR UPDATE USING (empresa_id = public.get_user_empresa_id())
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND EXISTS (
      SELECT 1 FROM public.obras o
      WHERE o.id = obra_id AND o.empresa_id = public.get_user_empresa_id()
    )
  );

CREATE POLICY obra_rdo_delete ON public.obra_rdo
  FOR DELETE USING (empresa_id = public.get_user_empresa_id());

-- ---------------------------------------------------------------------------
-- 6. tarefas: revalidar obra_id/obra_frente_id no insert/update (recria policies)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS tarefas_insert ON public.tarefas;
CREATE POLICY tarefas_insert ON public.tarefas
  FOR INSERT WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND (
      responsavel_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.pessoas p
        WHERE p.id = responsavel_id AND p.empresa_id = public.get_user_empresa_id()
      )
    )
    AND (
      projeto_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.projetos pr
        WHERE pr.id = projeto_id AND pr.empresa_id = public.get_user_empresa_id()
      )
    )
    AND (
      obra_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.obras o
        WHERE o.id = obra_id AND o.empresa_id = public.get_user_empresa_id()
      )
    )
    AND (
      obra_frente_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.obra_frente f
        WHERE f.id = obra_frente_id AND f.empresa_id = public.get_user_empresa_id()
      )
    )
  );

DROP POLICY IF EXISTS tarefas_update ON public.tarefas;
CREATE POLICY tarefas_update ON public.tarefas
  FOR UPDATE USING (empresa_id = public.get_user_empresa_id())
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND (
      responsavel_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.pessoas p
        WHERE p.id = responsavel_id AND p.empresa_id = public.get_user_empresa_id()
      )
    )
    AND (
      projeto_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.projetos pr
        WHERE pr.id = projeto_id AND pr.empresa_id = public.get_user_empresa_id()
      )
    )
    AND (
      obra_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.obras o
        WHERE o.id = obra_id AND o.empresa_id = public.get_user_empresa_id()
      )
    )
    AND (
      obra_frente_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.obra_frente f
        WHERE f.id = obra_frente_id AND f.empresa_id = public.get_user_empresa_id()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 7. Grants
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.obras TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_frente TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_rdo TO authenticated;
