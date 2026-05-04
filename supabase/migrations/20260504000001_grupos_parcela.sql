-- P0.2 — Grupos de parcela como entidade
-- Antes: receitas/despesas.grupo_parcela era UUID solto sem metadados.
-- Agora: tabela grupos_parcela com tipo (finito/recorrente), total, contraparte,
-- status agregado computado por trigger nas tabelas-filha.

-- =====================================================================
-- 1. Tabela grupos_parcela
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.grupos_parcela (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo_lancamento text NOT NULL CHECK (tipo_lancamento IN ('receita', 'despesa')),
  tipo_grupo text NOT NULL DEFAULT 'finito' CHECK (tipo_grupo IN ('finito', 'recorrente')),
  descricao text,
  total_original numeric(12,2),
  num_parcelas integer,
  periodicidade text DEFAULT 'mensal'
    CHECK (periodicidade IN ('mensal', 'bimestral', 'trimestral', 'semestral', 'anual')),
  dia_vencimento integer CHECK (dia_vencimento BETWEEN 1 AND 31),
  contraparte_id uuid,
  contraparte_tipo text CHECK (contraparte_tipo IN ('cliente', 'fornecedor')),
  projeto_id uuid REFERENCES public.projetos(id) ON DELETE SET NULL,
  categoria_id uuid REFERENCES public.categorias_financeiras(id) ON DELETE SET NULL,
  centro_custo_id uuid REFERENCES public.centros_custo(id) ON DELETE SET NULL,
  observacao text,
  status_agregado text NOT NULL DEFAULT 'aberto'
    CHECK (status_agregado IN ('aberto', 'parcial', 'quitado', 'cancelado')),
  renegociado_de uuid REFERENCES public.grupos_parcela(id) ON DELETE SET NULL,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CHECK (
    (tipo_grupo = 'finito' AND num_parcelas IS NOT NULL AND num_parcelas > 0)
    OR tipo_grupo = 'recorrente'
  )
);

CREATE INDEX IF NOT EXISTS grupos_parcela_empresa_idx
  ON public.grupos_parcela (empresa_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS grupos_parcela_contraparte_idx
  ON public.grupos_parcela (contraparte_id, contraparte_tipo) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS grupos_parcela_projeto_idx
  ON public.grupos_parcela (projeto_id) WHERE deleted_at IS NULL;

ALTER TABLE public.grupos_parcela ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS grupos_parcela_select ON public.grupos_parcela;
CREATE POLICY grupos_parcela_select ON public.grupos_parcela
  FOR SELECT USING (empresa_id = public.get_user_empresa_id());

DROP POLICY IF EXISTS grupos_parcela_insert ON public.grupos_parcela;
CREATE POLICY grupos_parcela_insert ON public.grupos_parcela
  FOR INSERT WITH CHECK (empresa_id = public.get_user_empresa_id());

DROP POLICY IF EXISTS grupos_parcela_update ON public.grupos_parcela;
CREATE POLICY grupos_parcela_update ON public.grupos_parcela
  FOR UPDATE USING (empresa_id = public.get_user_empresa_id())
  WITH CHECK (empresa_id = public.get_user_empresa_id());

DROP POLICY IF EXISTS grupos_parcela_delete ON public.grupos_parcela;
CREATE POLICY grupos_parcela_delete ON public.grupos_parcela
  FOR DELETE USING (empresa_id = public.get_user_empresa_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.grupos_parcela TO authenticated;

-- =====================================================================
-- 2. Backfill: criar grupos_parcela para grupo_parcela existentes em receitas
-- =====================================================================
INSERT INTO public.grupos_parcela (
  id, empresa_id, tipo_lancamento, tipo_grupo, descricao,
  total_original, num_parcelas, contraparte_id, contraparte_tipo,
  projeto_id, categoria_id, created_at, updated_at
)
SELECT
  r.grupo_parcela AS id,
  (array_agg(r.empresa_id))[1] AS empresa_id,
  'receita' AS tipo_lancamento,
  'finito' AS tipo_grupo,
  (array_agg(r.descricao ORDER BY r.parcela_numero NULLS LAST))[1] AS descricao,
  SUM(r.valor) AS total_original,
  COALESCE(MAX(r.parcela_total), COUNT(*)::int) AS num_parcelas,
  (array_agg(r.cliente_id))[1] AS contraparte_id,
  'cliente' AS contraparte_tipo,
  (array_agg(r.projeto_id))[1] AS projeto_id,
  (array_agg(r.categoria_id))[1] AS categoria_id,
  MIN(r.created_at) AS created_at,
  MAX(r.updated_at) AS updated_at
FROM public.receitas r
WHERE r.grupo_parcela IS NOT NULL
  AND r.deleted_at IS NULL
GROUP BY r.grupo_parcela
ON CONFLICT (id) DO NOTHING;

-- Backfill despesas
INSERT INTO public.grupos_parcela (
  id, empresa_id, tipo_lancamento, tipo_grupo, descricao,
  total_original, num_parcelas, contraparte_id, contraparte_tipo,
  projeto_id, categoria_id, created_at, updated_at
)
SELECT
  d.grupo_parcela AS id,
  (array_agg(d.empresa_id))[1] AS empresa_id,
  'despesa' AS tipo_lancamento,
  CASE WHEN BOOL_OR(COALESCE(d.recorrente, false)) THEN 'recorrente' ELSE 'finito' END AS tipo_grupo,
  (array_agg(d.descricao ORDER BY d.parcela_numero NULLS LAST))[1] AS descricao,
  SUM(d.valor) AS total_original,
  COALESCE(MAX(d.parcela_total), COUNT(*)::int) AS num_parcelas,
  (array_agg(d.fornecedor_id))[1] AS contraparte_id,
  'fornecedor' AS contraparte_tipo,
  (array_agg(d.projeto_id))[1] AS projeto_id,
  (array_agg(d.categoria_id))[1] AS categoria_id,
  MIN(d.created_at) AS created_at,
  MAX(d.updated_at) AS updated_at
FROM public.despesas d
WHERE d.grupo_parcela IS NOT NULL
  AND d.deleted_at IS NULL
GROUP BY d.grupo_parcela
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- 3. Função: recalc status agregado do grupo
-- =====================================================================
CREATE OR REPLACE FUNCTION public.recalc_grupo_parcela_status(p_grupo_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipo text;
  v_total int := 0;
  v_pagos int := 0;
  v_cancelados int := 0;
  v_status text;
BEGIN
  SELECT tipo_lancamento INTO v_tipo
  FROM grupos_parcela WHERE id = p_grupo_id;

  IF v_tipo IS NULL THEN RETURN; END IF;

  IF v_tipo = 'receita' THEN
    SELECT
      COUNT(*) FILTER (WHERE deleted_at IS NULL),
      COUNT(*) FILTER (WHERE status::text = 'Recebido' AND deleted_at IS NULL),
      COUNT(*) FILTER (WHERE status::text = 'Cancelado' AND deleted_at IS NULL)
    INTO v_total, v_pagos, v_cancelados
    FROM receitas WHERE grupo_parcela = p_grupo_id;
  ELSE
    SELECT
      COUNT(*) FILTER (WHERE deleted_at IS NULL),
      COUNT(*) FILTER (WHERE status::text = 'Pago' AND deleted_at IS NULL),
      COUNT(*) FILTER (WHERE status::text = 'Cancelado' AND deleted_at IS NULL)
    INTO v_total, v_pagos, v_cancelados
    FROM despesas WHERE grupo_parcela = p_grupo_id;
  END IF;

  IF v_total = 0 THEN
    v_status := 'cancelado';
  ELSIF v_cancelados = v_total THEN
    v_status := 'cancelado';
  ELSIF v_pagos + v_cancelados = v_total THEN
    v_status := 'quitado';
  ELSIF v_pagos > 0 THEN
    v_status := 'parcial';
  ELSE
    v_status := 'aberto';
  END IF;

  UPDATE grupos_parcela
  SET status_agregado = v_status, updated_at = now()
  WHERE id = p_grupo_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalc_grupo_parcela_status(uuid) TO authenticated;

-- =====================================================================
-- 4. Triggers: chamam recalc quando filho muda
-- =====================================================================
CREATE OR REPLACE FUNCTION public.tr_recalc_grupo_parcela()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.grupo_parcela IS NOT NULL THEN
      PERFORM recalc_grupo_parcela_status(OLD.grupo_parcela);
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.grupo_parcela IS NOT NULL THEN
    PERFORM recalc_grupo_parcela_status(NEW.grupo_parcela);
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.grupo_parcela IS DISTINCT FROM NEW.grupo_parcela
     AND OLD.grupo_parcela IS NOT NULL THEN
    PERFORM recalc_grupo_parcela_status(OLD.grupo_parcela);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_recalc_grupo_parcela_receitas ON public.receitas;
CREATE TRIGGER tr_recalc_grupo_parcela_receitas
  AFTER INSERT OR UPDATE OF status, deleted_at, grupo_parcela
     OR DELETE
  ON public.receitas
  FOR EACH ROW
  EXECUTE FUNCTION public.tr_recalc_grupo_parcela();

DROP TRIGGER IF EXISTS tr_recalc_grupo_parcela_despesas ON public.despesas;
CREATE TRIGGER tr_recalc_grupo_parcela_despesas
  AFTER INSERT OR UPDATE OF status, deleted_at, grupo_parcela
     OR DELETE
  ON public.despesas
  FOR EACH ROW
  EXECUTE FUNCTION public.tr_recalc_grupo_parcela();

-- Recalc inicial dos grupos backfilled
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM grupos_parcela LOOP
    PERFORM recalc_grupo_parcela_status(r.id);
  END LOOP;
END;
$$;

-- =====================================================================
-- 5. Atualiza VIEW lancamentos para incluir status_agregado do grupo
-- =====================================================================
DROP VIEW IF EXISTS public.lancamentos;

CREATE VIEW public.lancamentos
  WITH (security_invoker = true)
AS
SELECT
  r.id, r.empresa_id, 'receita'::text AS tipo, r.descricao, r.valor,
  r.data_vencimento, r.data_recebimento AS data_efetivacao, r.data_competencia,
  r.status::text AS status, r.categoria_id, r.projeto_id, r.conta_id,
  r.centro_custo_id, r.tags,
  r.cliente_id AS contraparte_id, 'cliente'::text AS contraparte_tipo,
  NULL::uuid AS cartao_id, r.forma_pagamento,
  r.grupo_parcela, r.parcela_numero, r.parcela_total,
  gp.tipo_grupo AS grupo_tipo,
  gp.status_agregado AS grupo_status,
  gp.total_original AS grupo_total_original,
  r.nota_fiscal, r.observacao,
  r.created_by, r.updated_by, r.created_at, r.updated_at, r.deleted_at
FROM public.receitas r
LEFT JOIN public.grupos_parcela gp ON gp.id = r.grupo_parcela
WHERE r.deleted_at IS NULL

UNION ALL

SELECT
  d.id, d.empresa_id, 'despesa'::text AS tipo, d.descricao, d.valor,
  d.data_vencimento, d.data_pagamento AS data_efetivacao, d.data_competencia,
  d.status::text AS status, d.categoria_id, d.projeto_id, d.conta_id,
  d.centro_custo_id, d.tags,
  d.fornecedor_id AS contraparte_id, 'fornecedor'::text AS contraparte_tipo,
  d.cartao_id, d.forma_pagamento,
  d.grupo_parcela, d.parcela_numero, d.parcela_total,
  gp.tipo_grupo AS grupo_tipo,
  gp.status_agregado AS grupo_status,
  gp.total_original AS grupo_total_original,
  d.nota_fiscal, d.observacao,
  d.created_by, d.updated_by, d.created_at, d.updated_at, d.deleted_at
FROM public.despesas d
LEFT JOIN public.grupos_parcela gp ON gp.id = d.grupo_parcela
WHERE d.deleted_at IS NULL;

GRANT SELECT ON public.lancamentos TO authenticated;
