-- SPEC 136 (BEZ-51): o CUB passa a existir nas duas versões que os Sinduscons publicam, com e sem
-- desoneração da folha. Cada linha de cub_valores ganha o regime, e ele entra na chave única: o
-- mesmo UF, subtipo, padrão e mês pode ter um valor por regime.
--
-- As linhas que já existem viram 'onerado' (sem desoneração), a série clássica do CUB.

ALTER TABLE public.cub_valores
  ADD COLUMN regime text NOT NULL DEFAULT 'onerado'
  CHECK (regime IN ('onerado', 'desonerado'));

ALTER TABLE public.cub_valores
  DROP CONSTRAINT cub_valores_uf_subtipo_padrao_mes_base_key;

ALTER TABLE public.cub_valores
  ADD CONSTRAINT cub_valores_uf_subtipo_padrao_mes_base_regime_key
  UNIQUE (uf, subtipo, padrao, mes_base, regime);

DROP INDEX public.idx_cub_valores_busca;
CREATE INDEX idx_cub_valores_busca ON public.cub_valores (uf, subtipo, regime, mes_base DESC);

COMMENT ON COLUMN public.cub_valores.regime IS
  'onerado = sem desoneração da folha (série clássica do CUB); desonerado = com desoneração.';
