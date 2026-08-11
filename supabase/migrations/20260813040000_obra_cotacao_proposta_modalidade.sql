-- Cotação: modalidade da proposta (spec 023, revisão)
-- Num comparativo, cada fornecedor pode ofertar em condições diferentes: um cota
-- 3h, outro 4h, outro a diária. Comparar só o valor bruto engana — o justo é o
-- preço por unidade (R$/h). Guardamos a quantidade e a unidade POR PROPOSTA para
-- calcular o unitário e comparar de forma honesta. Ambas nullable (proposta
-- simples não precisa).

ALTER TABLE public.obra_cotacao_proposta
  ADD COLUMN IF NOT EXISTS quantidade numeric(14,3) CHECK (quantidade IS NULL OR quantidade > 0),
  ADD COLUMN IF NOT EXISTS unidade text;
