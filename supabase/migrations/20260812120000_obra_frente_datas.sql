-- Cronograma da obra (spec 020): a frente de serviço ganha início e fim
-- previstos, para virar barra numa linha do tempo (Gantt de frentes).
-- Ambas opcionais: frentes já existentes nascem sem data e ficam fora da
-- timeline, listadas à parte (mesmo tratamento de projeto sem data).
-- RLS inalterada: as policies existentes de obra_frente já cobrem estas colunas.

ALTER TABLE public.obra_frente
  ADD COLUMN IF NOT EXISTS data_inicio date,
  ADD COLUMN IF NOT EXISTS data_fim    date;

-- Coerência: fim não pode ser antes do início quando ambos existem.
ALTER TABLE public.obra_frente
  DROP CONSTRAINT IF EXISTS obra_frente_datas_coerentes;
ALTER TABLE public.obra_frente
  ADD CONSTRAINT obra_frente_datas_coerentes
  CHECK (data_inicio IS NULL OR data_fim IS NULL OR data_fim >= data_inicio);
