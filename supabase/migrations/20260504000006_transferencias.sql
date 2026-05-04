-- P2 — Transferências entre contas
-- Transferência não é receita nem despesa; não entra no DRE.
-- Aparece no fluxo de caixa como movimento neutro (saída + entrada se efetivada).

CREATE TABLE IF NOT EXISTS public.transferencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  conta_origem_id uuid NOT NULL REFERENCES public.contas(id) ON DELETE RESTRICT,
  conta_destino_id uuid NOT NULL REFERENCES public.contas(id) ON DELETE RESTRICT,
  valor numeric(12,2) NOT NULL CHECK (valor > 0),
  data_transferencia date NOT NULL,
  descricao text,
  status text NOT NULL DEFAULT 'Concluída' CHECK (status IN ('Concluída', 'Pendente')),
  observacao text,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT transferencias_contas_diferentes CHECK (conta_origem_id <> conta_destino_id)
);

CREATE INDEX IF NOT EXISTS transferencias_empresa_idx ON public.transferencias (empresa_id);
CREATE INDEX IF NOT EXISTS transferencias_data_idx ON public.transferencias (data_transferencia);
CREATE INDEX IF NOT EXISTS transferencias_origem_idx ON public.transferencias (conta_origem_id);
CREATE INDEX IF NOT EXISTS transferencias_destino_idx ON public.transferencias (conta_destino_id);

ALTER TABLE public.transferencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS transferencias_select ON public.transferencias;
CREATE POLICY transferencias_select ON public.transferencias
  FOR SELECT USING (empresa_id = public.get_user_empresa_id());

DROP POLICY IF EXISTS transferencias_insert ON public.transferencias;
CREATE POLICY transferencias_insert ON public.transferencias
  FOR INSERT WITH CHECK (empresa_id = public.get_user_empresa_id());

DROP POLICY IF EXISTS transferencias_update ON public.transferencias;
CREATE POLICY transferencias_update ON public.transferencias
  FOR UPDATE USING (empresa_id = public.get_user_empresa_id())
  WITH CHECK (empresa_id = public.get_user_empresa_id());

DROP POLICY IF EXISTS transferencias_delete ON public.transferencias;
CREATE POLICY transferencias_delete ON public.transferencias
  FOR DELETE USING (empresa_id = public.get_user_empresa_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transferencias TO authenticated;

-- =====================================================================
-- RPC atômico: criar transferência
-- =====================================================================
CREATE OR REPLACE FUNCTION public.rpc_criar_transferencia(
  p_conta_origem_id uuid,
  p_conta_destino_id uuid,
  p_valor numeric,
  p_data date,
  p_descricao text DEFAULT NULL,
  p_status text DEFAULT 'Concluída',
  p_observacao text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_id uuid;
BEGIN
  v_empresa_id := public.get_user_empresa_id();

  IF p_conta_origem_id = p_conta_destino_id THEN
    RAISE EXCEPTION 'Conta de origem e destino devem ser diferentes';
  END IF;

  IF p_valor <= 0 THEN
    RAISE EXCEPTION 'Valor deve ser positivo';
  END IF;

  IF p_status NOT IN ('Concluída', 'Pendente') THEN
    RAISE EXCEPTION 'Status inválido';
  END IF;

  -- Verifica que ambas as contas pertencem à empresa
  IF NOT EXISTS (
    SELECT 1 FROM contas WHERE id = p_conta_origem_id AND empresa_id = v_empresa_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Conta de origem não encontrada';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM contas WHERE id = p_conta_destino_id AND empresa_id = v_empresa_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Conta de destino não encontrada';
  END IF;

  INSERT INTO transferencias (
    empresa_id, conta_origem_id, conta_destino_id,
    valor, data_transferencia, descricao, status, observacao,
    created_by, updated_by
  ) VALUES (
    v_empresa_id, p_conta_origem_id, p_conta_destino_id,
    p_valor, p_data, p_descricao, p_status, p_observacao,
    auth.uid(), auth.uid()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_criar_transferencia(uuid, uuid, numeric, date, text, text, text) TO authenticated;

-- =====================================================================
-- RPC: editar transferência
-- =====================================================================
CREATE OR REPLACE FUNCTION public.rpc_editar_transferencia(
  p_id uuid,
  p_conta_origem_id uuid,
  p_conta_destino_id uuid,
  p_valor numeric,
  p_data date,
  p_descricao text DEFAULT NULL,
  p_status text DEFAULT 'Concluída',
  p_observacao text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
BEGIN
  v_empresa_id := public.get_user_empresa_id();

  IF p_conta_origem_id = p_conta_destino_id THEN
    RAISE EXCEPTION 'Conta de origem e destino devem ser diferentes';
  END IF;

  IF p_valor <= 0 THEN
    RAISE EXCEPTION 'Valor deve ser positivo';
  END IF;

  UPDATE transferencias SET
    conta_origem_id = p_conta_origem_id,
    conta_destino_id = p_conta_destino_id,
    valor = p_valor,
    data_transferencia = p_data,
    descricao = p_descricao,
    status = p_status,
    observacao = p_observacao,
    updated_by = auth.uid(),
    updated_at = now()
  WHERE id = p_id AND empresa_id = v_empresa_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transferência não encontrada';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_editar_transferencia(uuid, uuid, uuid, numeric, date, text, text, text) TO authenticated;

-- =====================================================================
-- RPC: excluir transferência (soft delete)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.rpc_excluir_transferencia(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
BEGIN
  v_empresa_id := public.get_user_empresa_id();

  UPDATE transferencias SET
    deleted_at = now(),
    updated_by = auth.uid(),
    updated_at = now()
  WHERE id = p_id AND empresa_id = v_empresa_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transferência não encontrada';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_excluir_transferencia(uuid) TO authenticated;

-- =====================================================================
-- Atualiza view lancamentos para incluir transferências
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
  NULL::uuid AS cartao_id, NULL::uuid AS fatura_id,
  r.forma_pagamento,
  r.grupo_parcela, r.parcela_numero, r.parcela_total,
  gp.tipo_grupo AS grupo_tipo,
  gp.status_agregado AS grupo_status,
  gp.total_original AS grupo_total_original,
  r.nota_fiscal, r.observacao,
  r.created_by, r.updated_by, r.created_at, r.updated_at, r.deleted_at,
  NULL::uuid AS transferencia_par_id
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
  d.cartao_id, d.fatura_id,
  d.forma_pagamento,
  d.grupo_parcela, d.parcela_numero, d.parcela_total,
  gp.tipo_grupo AS grupo_tipo,
  gp.status_agregado AS grupo_status,
  gp.total_original AS grupo_total_original,
  d.nota_fiscal, d.observacao,
  d.created_by, d.updated_by, d.created_at, d.updated_at, d.deleted_at,
  NULL::uuid AS transferencia_par_id
FROM public.despesas d
LEFT JOIN public.grupos_parcela gp ON gp.id = d.grupo_parcela
WHERE d.deleted_at IS NULL

UNION ALL

-- Saída: mostra como lançamento na conta de origem
SELECT
  t.id, t.empresa_id, 'transferencia'::text AS tipo,
  COALESCE(t.descricao, 'Transferência → ' || cd.nome) AS descricao,
  t.valor,
  t.data_transferencia AS data_vencimento,
  CASE WHEN t.status = 'Concluída' THEN t.data_transferencia ELSE NULL END AS data_efetivacao,
  t.data_transferencia AS data_competencia,
  t.status,
  NULL::uuid AS categoria_id, NULL::uuid AS projeto_id,
  t.conta_origem_id AS conta_id,
  NULL::uuid AS centro_custo_id, NULL::text[] AS tags,
  t.conta_destino_id AS contraparte_id, 'conta_destino'::text AS contraparte_tipo,
  NULL::uuid AS cartao_id, NULL::uuid AS fatura_id,
  NULL::text AS forma_pagamento,
  NULL::uuid AS grupo_parcela, NULL::int AS parcela_numero, NULL::int AS parcela_total,
  NULL::text AS grupo_tipo, NULL::text AS grupo_status, NULL::numeric AS grupo_total_original,
  NULL::text AS nota_fiscal, t.observacao,
  t.created_by, t.updated_by, t.created_at, t.updated_at, t.deleted_at,
  t.conta_destino_id AS transferencia_par_id
FROM public.transferencias t
JOIN public.contas cd ON cd.id = t.conta_destino_id
WHERE t.deleted_at IS NULL;

GRANT SELECT ON public.lancamentos TO authenticated;
