-- Cotações na obra (spec 018)
-- Fluxo: registrar uma necessidade de compra/serviço (item único por cotação) →
-- receber propostas de N fornecedores → comparar → decidir a vencedora.
-- Ao decidir, o client PODE lançar a vencedora como despesa na conta da obra
-- reusando rpc_obra_despesa_salvar (spec 016). Nada de dinheiro é duplicado aqui:
-- estas tabelas só guardam a negociação, não o financeiro.

-- ---------------------------------------------------------------------------
-- 1. obra_cotacao — a necessidade a cotar
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.obra_cotacao (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id            uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  obra_id               uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  obra_frente_id        uuid REFERENCES public.obra_frente(id) ON DELETE SET NULL,
  descricao             text NOT NULL,
  quantidade            numeric(14,3) CHECK (quantidade IS NULL OR quantidade > 0),
  unidade               text,
  prazo_necessidade     date,
  status                text NOT NULL DEFAULT 'aberta'
                          CHECK (status IN ('aberta', 'decidida', 'cancelada')),
  -- vencedora: FK adicionada depois da tabela de propostas (dependência circular)
  proposta_vencedora_id uuid,
  observacoes           text,
  created_by            uuid NOT NULL DEFAULT auth.uid(),
  updated_by            uuid,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  deleted_at            timestamptz
);

CREATE INDEX IF NOT EXISTS idx_obra_cotacao_obra
  ON public.obra_cotacao (obra_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_obra_cotacao_frente
  ON public.obra_cotacao (obra_frente_id) WHERE obra_frente_id IS NOT NULL;

CREATE TRIGGER trg_obra_cotacao_updated_at
  BEFORE UPDATE ON public.obra_cotacao
  FOR EACH ROW EXECUTE FUNCTION public.tg_pilar_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 2. obra_cotacao_proposta — preço de um fornecedor para a cotação
--    fornecedor_id (cadastro) OU fornecedor_nome (texto livre): a cotação de
--    campo raramente tem o fornecedor cadastrado, então nome cru é aceito.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.obra_cotacao_proposta (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id         uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  cotacao_id         uuid NOT NULL REFERENCES public.obra_cotacao(id) ON DELETE CASCADE,
  fornecedor_id      uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  fornecedor_nome    text,
  valor              numeric(14,2) NOT NULL CHECK (valor >= 0),
  prazo_entrega_dias integer CHECK (prazo_entrega_dias IS NULL OR prazo_entrega_dias >= 0),
  condicao_pagamento text,
  link_orcamento     text,
  observacoes        text,
  created_by         uuid NOT NULL DEFAULT auth.uid(),
  updated_by         uuid,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz
);

CREATE INDEX IF NOT EXISTS idx_obra_cotacao_prop_cotacao
  ON public.obra_cotacao_proposta (cotacao_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_obra_cotacao_prop_updated_at
  BEFORE UPDATE ON public.obra_cotacao_proposta
  FOR EACH ROW EXECUTE FUNCTION public.tg_pilar_touch_updated_at();

-- Fecha o ciclo: a vencedora aponta para uma proposta (limpa se a proposta sair).
ALTER TABLE public.obra_cotacao
  ADD CONSTRAINT obra_cotacao_vencedora_fk
  FOREIGN KEY (proposta_vencedora_id)
  REFERENCES public.obra_cotacao_proposta(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 3. RLS — isolamento por empresa + revalidação cross-tenant das FKs
--    (mesmo padrão de obra_conta_lancamento, spec 016)
-- ---------------------------------------------------------------------------
ALTER TABLE public.obra_cotacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obra_cotacao_proposta ENABLE ROW LEVEL SECURITY;

-- obra_cotacao
CREATE POLICY obra_cotacao_select ON public.obra_cotacao
  FOR SELECT USING (empresa_id = public.get_user_empresa_id() AND deleted_at IS NULL);

CREATE POLICY obra_cotacao_insert ON public.obra_cotacao
  FOR INSERT WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND EXISTS (
      SELECT 1 FROM public.obras o
      WHERE o.id = obra_id AND o.empresa_id = public.get_user_empresa_id()
    )
    AND (
      obra_frente_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.obra_frente f
        WHERE f.id = obra_frente_id AND f.empresa_id = public.get_user_empresa_id()
      )
    )
  );

CREATE POLICY obra_cotacao_update ON public.obra_cotacao
  FOR UPDATE USING (empresa_id = public.get_user_empresa_id())
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND (
      obra_frente_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.obra_frente f
        WHERE f.id = obra_frente_id AND f.empresa_id = public.get_user_empresa_id()
      )
    )
    AND (
      proposta_vencedora_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.obra_cotacao_proposta p
        WHERE p.id = proposta_vencedora_id AND p.empresa_id = public.get_user_empresa_id()
      )
    )
  );

CREATE POLICY obra_cotacao_delete ON public.obra_cotacao
  FOR DELETE USING (empresa_id = public.get_user_empresa_id());

-- obra_cotacao_proposta
CREATE POLICY obra_cotacao_prop_select ON public.obra_cotacao_proposta
  FOR SELECT USING (empresa_id = public.get_user_empresa_id() AND deleted_at IS NULL);

CREATE POLICY obra_cotacao_prop_insert ON public.obra_cotacao_proposta
  FOR INSERT WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND EXISTS (
      SELECT 1 FROM public.obra_cotacao c
      WHERE c.id = cotacao_id AND c.empresa_id = public.get_user_empresa_id()
    )
    AND (
      fornecedor_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.fornecedores fo
        WHERE fo.id = fornecedor_id AND fo.empresa_id = public.get_user_empresa_id()
      )
    )
  );

CREATE POLICY obra_cotacao_prop_update ON public.obra_cotacao_proposta
  FOR UPDATE USING (empresa_id = public.get_user_empresa_id())
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND (
      fornecedor_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.fornecedores fo
        WHERE fo.id = fornecedor_id AND fo.empresa_id = public.get_user_empresa_id()
      )
    )
  );

CREATE POLICY obra_cotacao_prop_delete ON public.obra_cotacao_proposta
  FOR DELETE USING (empresa_id = public.get_user_empresa_id());

-- ---------------------------------------------------------------------------
-- 4. Grants — só authenticated (nunca anon)
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_cotacao TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_cotacao_proposta TO authenticated;
