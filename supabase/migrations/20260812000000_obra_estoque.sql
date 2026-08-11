-- Estoque da obra (spec 019 · fase 4 "compra unificada" do roadmap da spec 016)
-- Lente física sobre a compra que já existe: material da obra + movimentos
-- (entrada = compra recebida, baixa = consumo/aplicação). Saldo = comprado − aplicado,
-- derivado dos movimentos (sem tabela de saldo materializada).
-- Nada de dinheiro é criado aqui: a entrada só REFERENCIA a despesa que a conta da
-- obra / cotação já lançou (obra_conta_lancamento_id), nunca a duplica.
-- RLS no padrão de obra_cotacao (spec 018): empresa + revalidação cross-tenant das FKs.

-- ---------------------------------------------------------------------------
-- 1. obra_material — catálogo leve por obra (criado inline; sem catálogo global)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.obra_material (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  obra_id     uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  nome        text NOT NULL,
  unidade     text NOT NULL,               -- sc, kg, m2, m3, un...
  categoria   text,                        -- agrupador livre, opcional
  created_by  uuid NOT NULL DEFAULT auth.uid(),
  updated_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_obra_material_obra
  ON public.obra_material (obra_id, nome) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_obra_material_updated_at
  BEFORE UPDATE ON public.obra_material
  FOR EACH ROW EXECUTE FUNCTION public.tg_pilar_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 2. obra_material_mov — entrada (compra) ou baixa (consumo) de um material
--    valor_unitario só faz sentido na entrada (custo de aquisição, valoriza o saldo).
--    obra_conta_lancamento_id / obra_rdo_id: rastro para a compra e o dia (SET NULL:
--    excluir a despesa/RDO não apaga o movimento físico, só desfaz o vínculo).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.obra_material_mov (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id               uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  obra_id                  uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  obra_material_id         uuid NOT NULL REFERENCES public.obra_material(id) ON DELETE CASCADE,
  tipo                     text NOT NULL CHECK (tipo IN ('entrada', 'baixa')),
  quantidade               numeric(14,3) NOT NULL CHECK (quantidade > 0),
  data                     date NOT NULL,
  obra_frente_id           uuid REFERENCES public.obra_frente(id) ON DELETE SET NULL,
  valor_unitario           numeric(14,2) CHECK (valor_unitario IS NULL OR valor_unitario >= 0),
  obra_conta_lancamento_id uuid REFERENCES public.obra_conta_lancamento(id) ON DELETE SET NULL,
  obra_rdo_id              uuid REFERENCES public.obra_rdo(id) ON DELETE SET NULL,
  observacoes              text,
  created_by               uuid NOT NULL DEFAULT auth.uid(),
  updated_by               uuid,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  deleted_at               timestamptz
);

CREATE INDEX IF NOT EXISTS idx_obra_material_mov_obra
  ON public.obra_material_mov (obra_id, data DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_obra_material_mov_material
  ON public.obra_material_mov (obra_material_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_obra_material_mov_updated_at
  BEFORE UPDATE ON public.obra_material_mov
  FOR EACH ROW EXECUTE FUNCTION public.tg_pilar_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 3. RLS — isolamento por empresa + revalidação cross-tenant das FKs
-- ---------------------------------------------------------------------------
ALTER TABLE public.obra_material ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obra_material_mov ENABLE ROW LEVEL SECURITY;

-- obra_material
CREATE POLICY obra_material_select ON public.obra_material
  FOR SELECT USING (empresa_id = public.get_user_empresa_id() AND deleted_at IS NULL);

CREATE POLICY obra_material_insert ON public.obra_material
  FOR INSERT WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND EXISTS (
      SELECT 1 FROM public.obras o
      WHERE o.id = obra_id AND o.empresa_id = public.get_user_empresa_id()
    )
  );

CREATE POLICY obra_material_update ON public.obra_material
  FOR UPDATE USING (empresa_id = public.get_user_empresa_id())
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND EXISTS (
      SELECT 1 FROM public.obras o
      WHERE o.id = obra_id AND o.empresa_id = public.get_user_empresa_id()
    )
  );

CREATE POLICY obra_material_delete ON public.obra_material
  FOR DELETE USING (empresa_id = public.get_user_empresa_id());

-- obra_material_mov
CREATE POLICY obra_material_mov_select ON public.obra_material_mov
  FOR SELECT USING (empresa_id = public.get_user_empresa_id() AND deleted_at IS NULL);

CREATE POLICY obra_material_mov_insert ON public.obra_material_mov
  FOR INSERT WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND EXISTS (
      SELECT 1 FROM public.obra_material m
      WHERE m.id = obra_material_id AND m.empresa_id = public.get_user_empresa_id()
        AND m.obra_id = obra_material_mov.obra_id
    )
    AND EXISTS (
      SELECT 1 FROM public.obras o
      WHERE o.id = obra_material_mov.obra_id AND o.empresa_id = public.get_user_empresa_id()
    )
    AND (
      obra_frente_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.obra_frente f
        WHERE f.id = obra_frente_id AND f.empresa_id = public.get_user_empresa_id()
      )
    )
    AND (
      obra_conta_lancamento_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.obra_conta_lancamento l
        WHERE l.id = obra_conta_lancamento_id AND l.empresa_id = public.get_user_empresa_id()
      )
    )
    AND (
      obra_rdo_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.obra_rdo r
        WHERE r.id = obra_rdo_id AND r.empresa_id = public.get_user_empresa_id()
      )
    )
  );

-- UPDATE revalida as MESMAS FKs cross-tenant do INSERT: sem isso, um usuário da
-- empresa A poderia repontar um movimento próprio para material/obra/lançamento/RDO
-- da empresa B (integridade cross-tenant + risco de CASCADE de B sobre dado de A).
CREATE POLICY obra_material_mov_update ON public.obra_material_mov
  FOR UPDATE USING (empresa_id = public.get_user_empresa_id())
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND EXISTS (
      SELECT 1 FROM public.obra_material m
      WHERE m.id = obra_material_id AND m.empresa_id = public.get_user_empresa_id()
        AND m.obra_id = obra_material_mov.obra_id
    )
    AND EXISTS (
      SELECT 1 FROM public.obras o
      WHERE o.id = obra_material_mov.obra_id AND o.empresa_id = public.get_user_empresa_id()
    )
    AND (
      obra_frente_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.obra_frente f
        WHERE f.id = obra_frente_id AND f.empresa_id = public.get_user_empresa_id()
      )
    )
    AND (
      obra_conta_lancamento_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.obra_conta_lancamento l
        WHERE l.id = obra_conta_lancamento_id AND l.empresa_id = public.get_user_empresa_id()
      )
    )
    AND (
      obra_rdo_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.obra_rdo r
        WHERE r.id = obra_rdo_id AND r.empresa_id = public.get_user_empresa_id()
      )
    )
  );

CREATE POLICY obra_material_mov_delete ON public.obra_material_mov
  FOR DELETE USING (empresa_id = public.get_user_empresa_id());

-- ---------------------------------------------------------------------------
-- 4. Grants — só authenticated (nunca anon)
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_material TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_material_mov TO authenticated;
