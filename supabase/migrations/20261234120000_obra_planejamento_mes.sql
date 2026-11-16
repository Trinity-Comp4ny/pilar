-- Físico-financeiro da obra · planejamento mensal manual (spec 165)
-- A grade de desembolso previsto por mês é calculada no cliente a partir do previsto
-- (obra_orcamento_etapa) e das datas do cronograma (obra_frente). Esta tabela guarda só o que o usuário
-- AJUSTOU À MÃO: o percentual de cada mês de um nó. Um nó é "manual" se e somente se tem linha aqui;
-- apagar as linhas devolve o nó ao cálculo automático. Guarda percentual, não valor, para o planejamento
-- continuar valendo quando o previsto for reajustado.

CREATE TABLE IF NOT EXISTS public.obra_planejamento_mes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id     uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  obra_id        uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  obra_frente_id uuid NOT NULL REFERENCES public.obra_frente(id) ON DELETE CASCADE,
  -- Sempre o dia 1 do mês: a chave natural é (obra, nó, mês).
  mes            date NOT NULL CHECK (EXTRACT(DAY FROM mes) = 1),
  percentual     numeric(7,4) NOT NULL CHECK (percentual >= 0 AND percentual <= 100),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (obra_id, obra_frente_id, mes)
);

CREATE INDEX IF NOT EXISTS idx_obra_planejamento_mes_obra
  ON public.obra_planejamento_mes (obra_id);
-- Índice na chave estrangeira usada pelo ON DELETE CASCADE de obra_frente (padrão de 20261031000000).
CREATE INDEX IF NOT EXISTS idx_obra_planejamento_mes_frente
  ON public.obra_planejamento_mes (obra_frente_id);

-- Toda FK para empresas tem índice (regra do pgTAP fk_sem_indice, migration 20261031000000).
CREATE INDEX IF NOT EXISTS idx_obra_planejamento_mes_empresa_id
  ON public.obra_planejamento_mes (empresa_id);

CREATE TRIGGER trg_obra_planejamento_mes_updated_at
  BEFORE UPDATE ON public.obra_planejamento_mes
  FOR EACH ROW EXECUTE FUNCTION public.tg_pilar_touch_updated_at();

ALTER TABLE public.obra_planejamento_mes ENABLE ROW LEVEL SECURITY;

CREATE POLICY obra_planejamento_mes_select ON public.obra_planejamento_mes
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id());

-- O nó precisa ser da mesma obra e da mesma empresa: sem isso, dava para pendurar um mês de uma obra
-- no nó de outra.
CREATE POLICY obra_planejamento_mes_insert ON public.obra_planejamento_mes
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND EXISTS (
      SELECT 1 FROM public.obras o
      WHERE o.id = obra_id AND o.empresa_id = public.get_user_empresa_id()
    )
    AND EXISTS (
      SELECT 1 FROM public.obra_frente f
      WHERE f.id = obra_frente_id
        AND f.obra_id = obra_id
        AND f.empresa_id = public.get_user_empresa_id()
    )
  );

CREATE POLICY obra_planejamento_mes_update ON public.obra_planejamento_mes
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id())
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND EXISTS (
      SELECT 1 FROM public.obras o
      WHERE o.id = obra_id AND o.empresa_id = public.get_user_empresa_id()
    )
    AND EXISTS (
      SELECT 1 FROM public.obra_frente f
      WHERE f.id = obra_frente_id
        AND f.obra_id = obra_id
        AND f.empresa_id = public.get_user_empresa_id()
    )
  );

CREATE POLICY obra_planejamento_mes_delete ON public.obra_planejamento_mes
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_planejamento_mes TO authenticated;
