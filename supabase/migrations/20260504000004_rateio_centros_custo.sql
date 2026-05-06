-- P1.3 — Rateio de lançamento entre múltiplos centros de custo
-- Permite 1 lançamento → N centros de custo por percentual.
-- Validação: soma de percentuais = 100% por lançamento.
-- centro_custo_id na tabela-base continua existindo (CC primário/único).

CREATE TABLE IF NOT EXISTS public.lancamento_rateios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  lancamento_id uuid NOT NULL,
  tipo_lancamento text NOT NULL CHECK (tipo_lancamento IN ('receita','despesa')),
  centro_custo_id uuid NOT NULL REFERENCES public.centros_custo(id) ON DELETE RESTRICT,
  percentual numeric(5,2) NOT NULL CHECK (percentual > 0 AND percentual <= 100),
  valor numeric(12,2),
  observacao text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lancamento_id, tipo_lancamento, centro_custo_id)
);

CREATE INDEX IF NOT EXISTS lancamento_rateios_lanc_idx
  ON public.lancamento_rateios (lancamento_id, tipo_lancamento);
CREATE INDEX IF NOT EXISTS lancamento_rateios_cc_idx
  ON public.lancamento_rateios (centro_custo_id);
CREATE INDEX IF NOT EXISTS lancamento_rateios_empresa_idx
  ON public.lancamento_rateios (empresa_id);

ALTER TABLE public.lancamento_rateios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lancamento_rateios_select ON public.lancamento_rateios;
CREATE POLICY lancamento_rateios_select ON public.lancamento_rateios
  FOR SELECT USING (empresa_id = public.get_user_empresa_id());

DROP POLICY IF EXISTS lancamento_rateios_insert ON public.lancamento_rateios;
CREATE POLICY lancamento_rateios_insert ON public.lancamento_rateios
  FOR INSERT WITH CHECK (empresa_id = public.get_user_empresa_id());

DROP POLICY IF EXISTS lancamento_rateios_update ON public.lancamento_rateios;
CREATE POLICY lancamento_rateios_update ON public.lancamento_rateios
  FOR UPDATE USING (empresa_id = public.get_user_empresa_id())
  WITH CHECK (empresa_id = public.get_user_empresa_id());

DROP POLICY IF EXISTS lancamento_rateios_delete ON public.lancamento_rateios;
CREATE POLICY lancamento_rateios_delete ON public.lancamento_rateios
  FOR DELETE USING (empresa_id = public.get_user_empresa_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lancamento_rateios TO authenticated;

-- =====================================================================
-- RPC atômico: substitui rateio inteiro de um lançamento
-- =====================================================================
CREATE OR REPLACE FUNCTION public.rpc_lancamento_set_rateio(
  p_lancamento_id uuid,
  p_tipo_lancamento text,
  p_rateios jsonb         -- [{centro_custo_id, percentual, observacao?}]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_valor_total numeric(12,2);
  v_soma numeric(7,2) := 0;
  v_count int := 0;
  r jsonb;
BEGIN
  v_empresa_id := public.get_user_empresa_id();

  IF p_tipo_lancamento NOT IN ('receita','despesa') THEN
    RAISE EXCEPTION 'tipo_lancamento inválido';
  END IF;

  -- Verifica posse do lançamento + pega valor
  IF p_tipo_lancamento = 'receita' THEN
    SELECT valor INTO v_valor_total
    FROM receitas WHERE id = p_lancamento_id AND empresa_id = v_empresa_id AND deleted_at IS NULL;
  ELSE
    SELECT valor INTO v_valor_total
    FROM despesas WHERE id = p_lancamento_id AND empresa_id = v_empresa_id AND deleted_at IS NULL;
  END IF;

  IF v_valor_total IS NULL THEN
    RAISE EXCEPTION 'Lançamento não encontrado';
  END IF;

  -- Valida soma percentuais
  FOR r IN SELECT * FROM jsonb_array_elements(p_rateios) LOOP
    v_soma := v_soma + (r->>'percentual')::numeric;
  END LOOP;

  IF jsonb_array_length(p_rateios) > 0 AND ABS(v_soma - 100) > 0.01 THEN
    RAISE EXCEPTION 'Soma dos percentuais deve ser 100 (atual: %)', v_soma;
  END IF;

  -- Limpa rateio anterior
  DELETE FROM lancamento_rateios
  WHERE lancamento_id = p_lancamento_id
    AND tipo_lancamento = p_tipo_lancamento;

  -- Insere novo rateio
  FOR r IN SELECT * FROM jsonb_array_elements(p_rateios) LOOP
    INSERT INTO lancamento_rateios (
      empresa_id, lancamento_id, tipo_lancamento,
      centro_custo_id, percentual, valor, observacao,
      created_by
    ) VALUES (
      v_empresa_id, p_lancamento_id, p_tipo_lancamento,
      (r->>'centro_custo_id')::uuid,
      (r->>'percentual')::numeric,
      ROUND(v_valor_total * ((r->>'percentual')::numeric / 100), 2),
      r->>'observacao',
      auth.uid()
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_lancamento_set_rateio(uuid, text, jsonb) TO authenticated;
