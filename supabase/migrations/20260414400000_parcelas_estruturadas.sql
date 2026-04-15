-- Adiciona colunas estruturadas de parcelas em receitas e despesas.
-- grupo_parcela: UUID que agrupa parcelas do mesmo lançamento.
-- parcela_numero: qual parcela é (1, 2, 3...).
-- parcela_total: total de parcelas no grupo (3).

-- RECEITAS
ALTER TABLE public.receitas
  ADD COLUMN IF NOT EXISTS grupo_parcela UUID DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS parcela_numero INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS parcela_total INTEGER DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_receitas_grupo_parcela
  ON public.receitas (grupo_parcela) WHERE grupo_parcela IS NOT NULL;

-- DESPESAS
ALTER TABLE public.despesas
  ADD COLUMN IF NOT EXISTS grupo_parcela UUID DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS parcela_numero INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS parcela_total INTEGER DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_despesas_grupo_parcela
  ON public.despesas (grupo_parcela) WHERE grupo_parcela IS NOT NULL;
