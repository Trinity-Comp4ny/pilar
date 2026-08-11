-- Cotação: tipo do fluxo (spec 023, revisão)
-- Dois modos escolhidos ao criar a cotação, para não misturar os fluxos:
--   'item'  = comparar UM item/serviço entre vários fornecedores (fluxo da 018;
--             cada proposta é um valor único).
--   'cesta' = registrar a cesta de materiais de UM fornecedor (cada proposta tem
--             seus itens, preenchíveis por import de PDF).
-- Default 'item': é o fluxo mais comum e o que as cotações existentes já eram.

ALTER TABLE public.obra_cotacao
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'item'
    CHECK (tipo IN ('item', 'cesta'));
