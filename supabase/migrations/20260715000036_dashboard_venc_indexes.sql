-- Migration: índices parciais em data_vencimento para o dashboard
-- Cobrem os recortes por período (A Receber/A Pagar) e o fallback do gráfico,
-- que varrem por data_vencimento filtrando deleted_at IS NULL sem usar status.

CREATE INDEX IF NOT EXISTS idx_receitas_venc
  ON public.receitas(empresa_id, data_vencimento)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_despesas_venc
  ON public.despesas(empresa_id, data_vencimento)
  WHERE deleted_at IS NULL;
