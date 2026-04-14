-- Sprint 6.1: WIP (Work in Progress) formal
-- Tabela de snapshots mensais + RPC de cálculo

CREATE TABLE IF NOT EXISTS public.wip_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano INTEGER NOT NULL,
  horas_realizadas NUMERIC(10,2) DEFAULT 0,
  custo_realizado NUMERIC(14,2) DEFAULT 0,
  faturado NUMERIC(14,2) DEFAULT 0,
  recebido NUMERIC(14,2) DEFAULT 0,
  wip_saldo NUMERIC(14,2) GENERATED ALWAYS AS (custo_realizado - faturado) STORED,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  CONSTRAINT wip_unique_projeto_periodo UNIQUE (projeto_id, mes, ano)
);

CREATE INDEX idx_wip_empresa ON public.wip_snapshots(empresa_id);
CREATE INDEX idx_wip_periodo ON public.wip_snapshots(empresa_id, ano, mes);

ALTER TABLE public.wip_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "WIP read all roles" ON public.wip_snapshots
  FOR SELECT USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY "WIP write admin/fin" ON public.wip_snapshots
  FOR ALL USING (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'financeiro'))
  WITH CHECK (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'financeiro'));

-- RPC para calcular WIP do mês
CREATE OR REPLACE FUNCTION public.rpc_calcular_wip(p_mes INTEGER, p_ano INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id UUID;
  v_projeto RECORD;
  v_horas NUMERIC;
  v_custo NUMERIC;
  v_faturado NUMERIC;
  v_recebido NUMERIC;
  v_custo_hora_medio NUMERIC;
  v_count INTEGER := 0;
BEGIN
  v_empresa_id := public.get_user_empresa_id();

  FOR v_projeto IN
    SELECT p.id, p.nome
    FROM projetos p
    WHERE p.empresa_id = v_empresa_id
      AND p.deleted_at IS NULL
      AND p.status IN ('Planejamento', 'Em andamento', 'Revisão', 'Concluído')
  LOOP
    -- Custo/hora médio do orçamento
    SELECT COALESCE(
      CASE WHEN SUM(horas_estimadas) > 0
        THEN SUM(horas_estimadas * custo_hora) / SUM(horas_estimadas)
        ELSE 0
      END, 0)
    INTO v_custo_hora_medio
    FROM projeto_orcamento_fases
    WHERE projeto_id = v_projeto.id AND deleted_at IS NULL;

    -- Horas realizadas (aprovadas) até o fim do mês
    SELECT COALESCE(SUM(horas), 0) INTO v_horas
    FROM timesheets
    WHERE projeto_id = v_projeto.id
      AND status = 'aprovado'
      AND deleted_at IS NULL
      AND data <= (make_date(p_ano, p_mes, 1) + INTERVAL '1 month - 1 day')::DATE;

    v_custo := v_horas * v_custo_hora_medio;

    -- Faturado (marcos faturados/recebidos) até o fim do mês
    SELECT COALESCE(SUM(valor), 0) INTO v_faturado
    FROM marcos_faturamento
    WHERE projeto_id = v_projeto.id
      AND status IN ('faturado', 'recebido')
      AND deleted_at IS NULL
      AND data_faturada <= (make_date(p_ano, p_mes, 1) + INTERVAL '1 month - 1 day')::DATE;

    -- Recebido (receitas efetivamente recebidas)
    SELECT COALESCE(SUM(valor), 0) INTO v_recebido
    FROM receitas
    WHERE projeto_id = v_projeto.id
      AND status = 'Recebido'
      AND deleted_at IS NULL
      AND data_recebimento <= (make_date(p_ano, p_mes, 1) + INTERVAL '1 month - 1 day')::DATE;

    -- Skip se tudo zero
    IF v_horas = 0 AND v_faturado = 0 AND v_recebido = 0 THEN
      CONTINUE;
    END IF;

    -- Upsert
    INSERT INTO wip_snapshots (empresa_id, projeto_id, mes, ano, horas_realizadas, custo_realizado, faturado, recebido)
    VALUES (v_empresa_id, v_projeto.id, p_mes, p_ano, v_horas, v_custo, v_faturado, v_recebido)
    ON CONFLICT (projeto_id, mes, ano) DO UPDATE SET
      horas_realizadas = EXCLUDED.horas_realizadas,
      custo_realizado = EXCLUDED.custo_realizado,
      faturado = EXCLUDED.faturado,
      recebido = EXCLUDED.recebido;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_calcular_wip(INTEGER, INTEGER) TO authenticated;
