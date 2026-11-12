-- Pasta "Cliente" do projeto no Google Drive (SPEC 163).
--
-- Todo projeto ganha, ao lado das pastas das disciplinas, uma pasta "Cliente": o que o
-- escritório põe nela (e nas subpastas dela) o cliente vê e baixa no portal. O resto da
-- pasta do projeto continua interno.
--
-- para_cliente marca essa pasta; uma por projeto. A Edge Function portal-arquivos só
-- lista e baixa dentro dela (e das subpastas registradas abaixo dela), para o cliente
-- dono do projeto. A função google-drive não deixa essa pasta ir para a lixeira.

ALTER TABLE public.drive_pastas
  ADD COLUMN IF NOT EXISTS para_cliente boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS drive_pastas_uma_do_cliente
  ON public.drive_pastas (projeto_id) WHERE para_cliente;

COMMENT ON COLUMN public.drive_pastas.para_cliente IS
  'Pasta "Cliente" do projeto: o conteúdo aparece no portal do cliente (SPEC 163).';
