-- ==============================================================================
-- ORÇAMENTO POR FASE/DISCIPLINA
-- ==============================================================================

-- Coluna de custo indireto no projeto
ALTER TABLE public.projetos ADD COLUMN IF NOT EXISTS custo_indireto_pct DECIMAL(5,2) DEFAULT 15.0;

CREATE TABLE IF NOT EXISTS public.projeto_orcamento_fases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  disciplina TEXT NOT NULL,
  horas_estimadas DECIMAL(8,2) DEFAULT 0,
  custo_hora DECIMAL(10,2) DEFAULT 0,
  custo_estimado DECIMAL(12,2) GENERATED ALWAYS AS (horas_estimadas * custo_hora) STORED,
  margem_alvo_pct DECIMAL(5,2) DEFAULT 20.0,
  valor_venda DECIMAL(12,2) DEFAULT 0,
  observacao TEXT,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT orcamento_unique_projeto_disciplina UNIQUE (projeto_id, disciplina)
);

CREATE INDEX idx_orcamento_fases_empresa ON public.projeto_orcamento_fases(empresa_id);
CREATE INDEX idx_orcamento_fases_projeto ON public.projeto_orcamento_fases(projeto_id);

ALTER TABLE public.projeto_orcamento_fases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Orcamento Full Admin/Op" ON public.projeto_orcamento_fases
  FOR ALL
  USING (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'operacional') AND deleted_at IS NULL)
  WITH CHECK (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'operacional') AND deleted_at IS NULL);

CREATE POLICY "Orcamento Read Financeiro" ON public.projeto_orcamento_fases
  FOR SELECT
  USING (empresa_id = public.get_user_empresa_id() AND public.has_role('financeiro') AND deleted_at IS NULL);

CREATE TRIGGER orcamento_fases_audit
  BEFORE INSERT OR UPDATE ON public.projeto_orcamento_fases
  FOR EACH ROW EXECUTE FUNCTION public.handle_record_audit();

CREATE TRIGGER orcamento_fases_prevent_company_change
  BEFORE UPDATE ON public.projeto_orcamento_fases
  FOR EACH ROW EXECUTE FUNCTION public.prevent_company_change();

CREATE TRIGGER orcamento_fases_soft_delete
  BEFORE DELETE ON public.projeto_orcamento_fases
  FOR EACH ROW EXECUTE FUNCTION public.soft_delete_generic();

-- ==============================================================================
-- MARCOS DE FATURAMENTO (Billing Milestones)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.marcos_faturamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  disciplina TEXT,
  percentual DECIMAL(5,2),
  valor DECIMAL(12,2) NOT NULL,
  data_prevista DATE,
  data_faturada DATE,
  receita_id UUID REFERENCES public.receitas(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'faturado', 'recebido', 'cancelado')),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_marcos_empresa ON public.marcos_faturamento(empresa_id);
CREATE INDEX idx_marcos_projeto ON public.marcos_faturamento(projeto_id);

ALTER TABLE public.marcos_faturamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Marcos Full Admin/Fin" ON public.marcos_faturamento
  FOR ALL
  USING (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'financeiro') AND deleted_at IS NULL)
  WITH CHECK (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'financeiro') AND deleted_at IS NULL);

CREATE POLICY "Marcos Read Op" ON public.marcos_faturamento
  FOR SELECT
  USING (empresa_id = public.get_user_empresa_id() AND public.has_role('operacional') AND deleted_at IS NULL);

CREATE TRIGGER marcos_audit
  BEFORE INSERT OR UPDATE ON public.marcos_faturamento
  FOR EACH ROW EXECUTE FUNCTION public.handle_record_audit();

CREATE TRIGGER marcos_prevent_company_change
  BEFORE UPDATE ON public.marcos_faturamento
  FOR EACH ROW EXECUTE FUNCTION public.prevent_company_change();

CREATE TRIGGER marcos_soft_delete
  BEFORE DELETE ON public.marcos_faturamento
  FOR EACH ROW EXECUTE FUNCTION public.soft_delete_generic();

-- ==============================================================================
-- ALERTAS INTELIGENTES
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.alertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN (
    'horas_excedidas', 'pagamento_atrasado', 'superalocacao',
    'margem_baixa', 'marco_proximo', 'orcamento_excedido'
  )),
  severidade TEXT DEFAULT 'medium' CHECK (severidade IN ('low', 'medium', 'high', 'critical')),
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  referencia_tipo TEXT,
  referencia_id UUID,
  lido BOOLEAN DEFAULT FALSE,
  lido_por UUID REFERENCES auth.users(id),
  lido_em TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_alertas_empresa_lido ON public.alertas(empresa_id, lido, created_at DESC);
CREATE INDEX idx_alertas_empresa_tipo ON public.alertas(empresa_id, tipo);

ALTER TABLE public.alertas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alertas Read" ON public.alertas
  FOR SELECT
  USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Alertas Update" ON public.alertas
  FOR UPDATE
  USING (empresa_id = public.get_user_empresa_id())
  WITH CHECK (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Alertas Insert Admin" ON public.alertas
  FOR INSERT
  WITH CHECK (empresa_id = public.get_user_empresa_id() AND public.has_role('admin'));

CREATE POLICY "Alertas Delete Admin" ON public.alertas
  FOR DELETE
  USING (empresa_id = public.get_user_empresa_id() AND public.has_role('admin'));

-- ==============================================================================
-- RPC: Rentabilidade por projeto
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.rpc_projeto_rentabilidade(p_projeto_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
  v_empresa_id UUID;
BEGIN
  v_empresa_id := public.get_user_empresa_id();

  SELECT json_build_object(
    'projeto_id', p.id,
    'projeto_nome', p.nome,
    'valor_contrato', COALESCE(p.valor_contrato, 0),
    'custo_indireto_pct', COALESCE(p.custo_indireto_pct, 15.0),
    'receitas_total', COALESCE((
      SELECT SUM(r.valor) FROM receitas r
      WHERE r.projeto_id = p.id AND r.deleted_at IS NULL AND r.status IN ('Recebido', 'Pendente')
    ), 0),
    'receitas_recebidas', COALESCE((
      SELECT SUM(r.valor) FROM receitas r
      WHERE r.projeto_id = p.id AND r.deleted_at IS NULL AND r.status = 'Recebido'
    ), 0),
    'despesas_diretas', COALESCE((
      SELECT SUM(d.valor) FROM despesas d
      WHERE d.projeto_id = p.id AND d.deleted_at IS NULL AND d.status IN ('Pago', 'Pendente')
    ), 0),
    'horas_orcadas', COALESCE((
      SELECT SUM(o.horas_estimadas) FROM projeto_orcamento_fases o
      WHERE o.projeto_id = p.id AND o.deleted_at IS NULL
    ), 0),
    'horas_consumidas', COALESCE((
      SELECT SUM(t.horas) FROM timesheets t
      WHERE t.projeto_id = p.id AND t.deleted_at IS NULL AND t.status = 'aprovado'
    ), 0),
    'custo_orcado', COALESCE((
      SELECT SUM(o.horas_estimadas * o.custo_hora) FROM projeto_orcamento_fases o
      WHERE o.projeto_id = p.id AND o.deleted_at IS NULL
    ), 0),
    'marcos_total', (
      SELECT COUNT(*) FROM marcos_faturamento m
      WHERE m.projeto_id = p.id AND m.deleted_at IS NULL
    ),
    'marcos_faturados', (
      SELECT COUNT(*) FROM marcos_faturamento m
      WHERE m.projeto_id = p.id AND m.deleted_at IS NULL AND m.status IN ('faturado', 'recebido')
    )
  ) INTO result
  FROM projetos p
  WHERE p.id = p_projeto_id AND p.empresa_id = v_empresa_id AND p.deleted_at IS NULL;

  RETURN result;
END;
$$;

-- ==============================================================================
-- RPC: Dashboard de rentabilidade (todos projetos ativos)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.rpc_dashboard_rentabilidade()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
  v_empresa_id UUID;
BEGIN
  v_empresa_id := public.get_user_empresa_id();

  SELECT json_agg(proj_data) INTO result
  FROM (
    SELECT json_build_object(
      'projeto_id', p.id,
      'projeto_nome', p.nome,
      'codigo_projeto', p.codigo_projeto,
      'status', p.status,
      'valor_contrato', COALESCE(p.valor_contrato, 0),
      'receitas_total', COALESCE((
        SELECT SUM(r.valor) FROM receitas r
        WHERE r.projeto_id = p.id AND r.deleted_at IS NULL AND r.status IN ('Recebido', 'Pendente')
      ), 0),
      'receitas_recebidas', COALESCE((
        SELECT SUM(r.valor) FROM receitas r
        WHERE r.projeto_id = p.id AND r.deleted_at IS NULL AND r.status = 'Recebido'
      ), 0),
      'despesas_diretas', COALESCE((
        SELECT SUM(d.valor) FROM despesas d
        WHERE d.projeto_id = p.id AND d.deleted_at IS NULL AND d.status IN ('Pago', 'Pendente')
      ), 0),
      'horas_orcadas', COALESCE((
        SELECT SUM(o.horas_estimadas) FROM projeto_orcamento_fases o
        WHERE o.projeto_id = p.id AND o.deleted_at IS NULL
      ), 0),
      'horas_consumidas', COALESCE((
        SELECT SUM(t.horas) FROM timesheets t
        WHERE t.projeto_id = p.id AND t.deleted_at IS NULL AND t.status = 'aprovado'
      ), 0)
    ) AS proj_data
    FROM projetos p
    WHERE p.empresa_id = v_empresa_id
      AND p.deleted_at IS NULL
      AND p.status IN ('Planejamento', 'Em andamento', 'Concluído')
    ORDER BY p.created_at DESC
  ) sub;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- ==============================================================================
-- RPC: Gerar alertas automáticos
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.rpc_gerar_alertas(p_empresa_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  alert_count INTEGER := 0;
  r RECORD;
BEGIN
  -- 1. Projetos com horas consumidas > 80% e faturamento < 50%
  FOR r IN
    SELECT p.id, p.nome,
      COALESCE(SUM(t.horas), 0) AS horas_consumidas,
      COALESCE(SUM(o.horas_estimadas), 0) AS horas_orcadas,
      COALESCE((SELECT SUM(rv.valor) FROM receitas rv WHERE rv.projeto_id = p.id AND rv.deleted_at IS NULL AND rv.status = 'Recebido'), 0) AS recebido,
      COALESCE(p.valor_contrato, 0) AS valor_contrato
    FROM projetos p
    LEFT JOIN timesheets t ON t.projeto_id = p.id AND t.deleted_at IS NULL AND t.status = 'aprovado'
    LEFT JOIN projeto_orcamento_fases o ON o.projeto_id = p.id AND o.deleted_at IS NULL
    WHERE p.empresa_id = p_empresa_id AND p.deleted_at IS NULL AND p.status = 'Em andamento'
    GROUP BY p.id, p.nome, p.valor_contrato
    HAVING COALESCE(SUM(o.horas_estimadas), 0) > 0
  LOOP
    IF r.horas_orcadas > 0 AND (r.horas_consumidas / r.horas_orcadas) > 0.8
       AND r.valor_contrato > 0 AND (r.recebido / r.valor_contrato) < 0.5 THEN
      -- Verifica se alerta similar já existe (últimos 7 dias)
      IF NOT EXISTS (
        SELECT 1 FROM alertas a
        WHERE a.empresa_id = p_empresa_id AND a.tipo = 'horas_excedidas'
          AND a.referencia_id = r.id AND a.created_at > NOW() - INTERVAL '7 days'
      ) THEN
        INSERT INTO alertas (empresa_id, tipo, severidade, titulo, mensagem, referencia_tipo, referencia_id)
        VALUES (p_empresa_id, 'horas_excedidas', 'high',
          'Horas excedidas: ' || r.nome,
          'Projeto consumiu ' || ROUND((r.horas_consumidas / r.horas_orcadas * 100)::numeric, 0) || '% das horas mas faturou apenas ' || ROUND((r.recebido / NULLIF(r.valor_contrato, 0) * 100)::numeric, 0) || '%',
          'projeto', r.id);
        alert_count := alert_count + 1;
      END IF;
    END IF;
  END LOOP;

  -- 2. Receitas atrasadas > 15 dias
  FOR r IN
    SELECT rv.id, rv.descricao, rv.data_vencimento, rv.valor,
      c.nome AS cliente_nome
    FROM receitas rv
    LEFT JOIN clientes c ON c.id = rv.cliente_id
    WHERE rv.empresa_id = p_empresa_id AND rv.deleted_at IS NULL
      AND rv.status = 'Pendente'
      AND rv.data_vencimento < CURRENT_DATE - INTERVAL '15 days'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM alertas a
      WHERE a.empresa_id = p_empresa_id AND a.tipo = 'pagamento_atrasado'
        AND a.referencia_id = r.id AND a.created_at > NOW() - INTERVAL '7 days'
    ) THEN
      INSERT INTO alertas (empresa_id, tipo, severidade, titulo, mensagem, referencia_tipo, referencia_id)
      VALUES (p_empresa_id, 'pagamento_atrasado', 'high',
        'Pagamento atrasado: ' || COALESCE(r.cliente_nome, r.descricao),
        'Receita de R$ ' || r.valor || ' vencida em ' || TO_CHAR(r.data_vencimento, 'DD/MM/YYYY'),
        'cliente', r.id);
      alert_count := alert_count + 1;
    END IF;
  END LOOP;

  RETURN alert_count;
END;
$$;
