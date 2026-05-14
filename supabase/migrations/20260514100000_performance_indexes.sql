-- Migration: Performance indexes (partial, covering soft-delete)
-- Cobre as queries mais frequentes que filtram deleted_at IS NULL

-- Receitas: filtra por empresa_id + status + data_vencimento, excluindo soft-deleted
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_receitas_empresa_status_active
  ON public.receitas(empresa_id, status, data_vencimento DESC)
  WHERE deleted_at IS NULL;

-- Despesas: filtra por empresa_id + status + data_vencimento, excluindo soft-deleted
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_despesas_empresa_status_active
  ON public.despesas(empresa_id, status, data_vencimento DESC)
  WHERE deleted_at IS NULL;

-- Projetos: dashboard filtra empresa_id + status, excluindo soft-deleted
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projetos_empresa_status_active
  ON public.projetos(empresa_id, status)
  WHERE deleted_at IS NULL;

-- Marcos faturamento: queries por projeto_id + status, excluindo soft-deleted
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_marcos_projeto_status_active
  ON public.marcos_faturamento(projeto_id, status)
  WHERE deleted_at IS NULL;
