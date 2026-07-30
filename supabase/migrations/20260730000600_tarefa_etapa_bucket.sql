-- Spec 014 · Colunas de status = etapas (ajuste 2026-07-30)
-- O board é sempre um Kanban de status; as colunas são as etapas. As 3 âncoras
-- (A fazer / Em andamento / Concluído) recebem um `bucket` para (a) posicionar as
-- disciplinas, que só conhecem esses 3 baldes, e (b) manter o status coarse da
-- tarefa. Colunas extras (ex.: "Bloqueado") têm bucket nulo e valem só p/ tarefa.

ALTER TABLE public.tarefa_etapas
  ADD COLUMN IF NOT EXISTS bucket text
    CHECK (bucket IN ('a_fazer', 'fazendo', 'concluida'));

-- Renomeia a âncora do meio para o rótulo que o CEO usa e fixa os buckets.
UPDATE public.tarefa_etapas SET nome = 'Em andamento'
  WHERE nome = 'Fazendo' AND bucket IS NULL;

UPDATE public.tarefa_etapas
SET bucket = CASE nome
    WHEN 'A fazer'      THEN 'a_fazer'
    WHEN 'Em andamento' THEN 'fazendo'
    WHEN 'Concluído'    THEN 'concluida'
  END
WHERE bucket IS NULL AND nome IN ('A fazer', 'Em andamento', 'Concluído');

-- No máximo uma coluna-âncora por balde em cada empresa.
CREATE UNIQUE INDEX IF NOT EXISTS uq_tarefa_etapa_bucket
  ON public.tarefa_etapas (empresa_id, bucket) WHERE bucket IS NOT NULL;

COMMENT ON COLUMN public.tarefa_etapas.bucket IS
  'Âncora de status (a_fazer/fazendo/concluida) p/ posicionar disciplinas; nulo = coluna extra só de tarefa (spec 014).';
