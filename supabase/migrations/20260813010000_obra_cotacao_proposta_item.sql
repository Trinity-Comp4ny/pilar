-- Cotação: cesta multi-item na proposta (spec 023)
-- A proposta de um fornecedor (obra_cotacao_proposta, spec 018) passa a poder ter
-- N itens: o orçamento vem com vários materiais num único PDF. O `valor` da
-- proposta continua sendo o total; quando há itens, o total é a soma deles.
-- Itens são filhos da proposta (sem soft delete: somem por CASCADE).

CREATE TABLE IF NOT EXISTS public.obra_cotacao_proposta_item (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id     uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  proposta_id    uuid NOT NULL REFERENCES public.obra_cotacao_proposta(id) ON DELETE CASCADE,
  descricao      text NOT NULL,
  quantidade     numeric(14,3) CHECK (quantidade IS NULL OR quantidade >= 0),
  unidade        text,
  preco_unitario numeric(14,2) CHECK (preco_unitario IS NULL OR preco_unitario >= 0),
  valor_total    numeric(14,2) NOT NULL DEFAULT 0 CHECK (valor_total >= 0),
  ordem          integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_obra_cotacao_prop_item_proposta
  ON public.obra_cotacao_proposta_item (proposta_id, ordem);

CREATE TRIGGER trg_obra_cotacao_prop_item_updated_at
  BEFORE UPDATE ON public.obra_cotacao_proposta_item
  FOR EACH ROW EXECUTE FUNCTION public.tg_pilar_touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — isolamento por empresa + revalidação de que a proposta é da empresa
--       (mesmo padrão de obra_cotacao_proposta, spec 018)
-- ---------------------------------------------------------------------------
ALTER TABLE public.obra_cotacao_proposta_item ENABLE ROW LEVEL SECURITY;

CREATE POLICY obra_cotacao_prop_item_select ON public.obra_cotacao_proposta_item
  FOR SELECT USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY obra_cotacao_prop_item_insert ON public.obra_cotacao_proposta_item
  FOR INSERT WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND EXISTS (
      SELECT 1 FROM public.obra_cotacao_proposta p
      WHERE p.id = proposta_id AND p.empresa_id = public.get_user_empresa_id()
    )
  );

CREATE POLICY obra_cotacao_prop_item_update ON public.obra_cotacao_proposta_item
  FOR UPDATE USING (empresa_id = public.get_user_empresa_id())
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND EXISTS (
      SELECT 1 FROM public.obra_cotacao_proposta p
      WHERE p.id = proposta_id AND p.empresa_id = public.get_user_empresa_id()
    )
  );

CREATE POLICY obra_cotacao_prop_item_delete ON public.obra_cotacao_proposta_item
  FOR DELETE USING (empresa_id = public.get_user_empresa_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_cotacao_proposta_item TO authenticated;
