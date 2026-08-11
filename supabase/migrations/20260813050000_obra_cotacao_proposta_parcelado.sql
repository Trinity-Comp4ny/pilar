-- Cotação: preço à vista vs parcelado na proposta (spec 023, revisão)
-- Orçamentos trazem o mesmo item com preços diferentes por condição: à vista,
-- parcelado/cheio, Nx no cartão. Para comparar de forma justa (à vista com à
-- vista) e ainda guardar o parcelado, a proposta passa a ter:
--   valor           = preço de referência para comparação (à vista, já existente)
--   valor_parcelado = preço cheio/parcelado quando difere do à vista (novo)
--   condicao_pagamento = texto da condição ("3x no cartão", já existente)

ALTER TABLE public.obra_cotacao_proposta
  ADD COLUMN IF NOT EXISTS valor_parcelado numeric(14,2) CHECK (valor_parcelado IS NULL OR valor_parcelado >= 0);
