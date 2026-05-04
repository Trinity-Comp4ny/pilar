-- P0.1 — Unificação lógica de lançamentos
-- Estratégia: manter receitas/despesas como tabelas físicas (30+ RPCs/triggers dependem),
-- adicionar colunas novas (data_competencia, centro_custo_id, tags) em ambas,
-- criar VIEW lancamentos com UNION ALL para leitura unificada.
-- Writes continuam indo direto às tabelas-base (hooks/RPCs existentes preservados).

-- =====================================================================
-- 1. Tabela centros_custo
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.centros_custo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  codigo text,
  nome text NOT NULL,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (empresa_id, codigo)
);

CREATE INDEX IF NOT EXISTS centros_custo_empresa_idx
  ON public.centros_custo (empresa_id) WHERE deleted_at IS NULL;

ALTER TABLE public.centros_custo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS centros_custo_select ON public.centros_custo;
CREATE POLICY centros_custo_select ON public.centros_custo
  FOR SELECT USING (empresa_id = public.get_user_empresa_id());

DROP POLICY IF EXISTS centros_custo_insert ON public.centros_custo;
CREATE POLICY centros_custo_insert ON public.centros_custo
  FOR INSERT WITH CHECK (empresa_id = public.get_user_empresa_id());

DROP POLICY IF EXISTS centros_custo_update ON public.centros_custo;
CREATE POLICY centros_custo_update ON public.centros_custo
  FOR UPDATE USING (empresa_id = public.get_user_empresa_id())
  WITH CHECK (empresa_id = public.get_user_empresa_id());

DROP POLICY IF EXISTS centros_custo_delete ON public.centros_custo;
CREATE POLICY centros_custo_delete ON public.centros_custo
  FOR DELETE USING (empresa_id = public.get_user_empresa_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.centros_custo TO authenticated;

-- =====================================================================
-- 2. Colunas novas em receitas
-- =====================================================================
ALTER TABLE public.receitas
  ADD COLUMN IF NOT EXISTS data_competencia date,
  ADD COLUMN IF NOT EXISTS centro_custo_id uuid REFERENCES public.centros_custo(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tags text[];

CREATE INDEX IF NOT EXISTS receitas_centro_custo_idx
  ON public.receitas (centro_custo_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS receitas_data_competencia_idx
  ON public.receitas (data_competencia) WHERE deleted_at IS NULL;

-- Backfill: competencia := efetivação se houve, senão vencimento
UPDATE public.receitas
SET data_competencia = COALESCE(data_recebimento, data_vencimento)
WHERE data_competencia IS NULL;

-- =====================================================================
-- 3. Colunas novas em despesas
-- =====================================================================
ALTER TABLE public.despesas
  ADD COLUMN IF NOT EXISTS data_competencia date,
  ADD COLUMN IF NOT EXISTS centro_custo_id uuid REFERENCES public.centros_custo(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tags text[],
  ADD COLUMN IF NOT EXISTS forma_pagamento text;

CREATE INDEX IF NOT EXISTS despesas_centro_custo_idx
  ON public.despesas (centro_custo_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS despesas_data_competencia_idx
  ON public.despesas (data_competencia) WHERE deleted_at IS NULL;

UPDATE public.despesas
SET data_competencia = COALESCE(data_pagamento, data_vencimento)
WHERE data_competencia IS NULL;

-- =====================================================================
-- 4. VIEW lancamentos (security_invoker — RLS herda das tabelas-base)
-- =====================================================================
DROP VIEW IF EXISTS public.lancamentos;

CREATE VIEW public.lancamentos
  WITH (security_invoker = true)
AS
SELECT
  r.id,
  r.empresa_id,
  'receita'::text AS tipo,
  r.descricao,
  r.valor,
  r.data_vencimento,
  r.data_recebimento AS data_efetivacao,
  r.data_competencia,
  r.status::text AS status,
  r.categoria_id,
  r.projeto_id,
  r.conta_id,
  r.centro_custo_id,
  r.tags,
  r.cliente_id AS contraparte_id,
  'cliente'::text AS contraparte_tipo,
  NULL::uuid AS cartao_id,
  r.forma_pagamento,
  r.grupo_parcela,
  r.parcela_numero,
  r.parcela_total,
  r.nota_fiscal,
  r.observacao,
  r.created_by,
  r.updated_by,
  r.created_at,
  r.updated_at,
  r.deleted_at
FROM public.receitas r
WHERE r.deleted_at IS NULL

UNION ALL

SELECT
  d.id,
  d.empresa_id,
  'despesa'::text AS tipo,
  d.descricao,
  d.valor,
  d.data_vencimento,
  d.data_pagamento AS data_efetivacao,
  d.data_competencia,
  d.status::text AS status,
  d.categoria_id,
  d.projeto_id,
  d.conta_id,
  d.centro_custo_id,
  d.tags,
  d.fornecedor_id AS contraparte_id,
  'fornecedor'::text AS contraparte_tipo,
  d.cartao_id,
  d.forma_pagamento,
  d.grupo_parcela,
  d.parcela_numero,
  d.parcela_total,
  d.nota_fiscal,
  d.observacao,
  d.created_by,
  d.updated_by,
  d.created_at,
  d.updated_at,
  d.deleted_at
FROM public.despesas d
WHERE d.deleted_at IS NULL;

GRANT SELECT ON public.lancamentos TO authenticated;

COMMENT ON VIEW public.lancamentos IS
  'View unificada de receitas+despesas (P0.1). Read-only — writes vão direto nas tabelas-base.';
