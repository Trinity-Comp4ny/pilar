-- Motor de tokens (SPEC 080): compra de pacote vira 4 tiers fixos com desconto por
-- volume, em vez de "quantidade livre de pacotes de 500k". Coluna informativa (o
-- catálogo de tier vive no backend, não no banco, pra evoluir sem migration nova);
-- tokens_pacote/quantidade_pacotes continuam sendo a fonte que o webhook usa pra
-- creditar (quantidade_pacotes=1 sempre daqui pra frente, tokens_pacote = tier inteiro).

ALTER TABLE public.pilar_token_pack_purchases
  ADD COLUMN IF NOT EXISTS tier_id text;
