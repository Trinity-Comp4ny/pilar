-- Migration 005: Orçamento, Marcos, Faturas e Compliance
-- Consolidação de: create_orcamento_marcos_alertas, create_faturas_system, rpc_faturar_marco, trigger_aditivo, wip_snapshots, compliance_fundacoes, fix_financial_system

-- ==============================================================================
-- 1. COLUNA DE CUSTO INDIRETO NO PROJETO
-- ==============================================================================

ALTER TABLE public.projetos ADD COLUMN IF NOT EXISTS custo_indireto_pct DECIMAL(5,2) DEFAULT 15.0;

-- ==============================================================================
-- 2. TABELA: projeto_orcamento_fases
-- ==============================================================================

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

CREATE INDEX IF NOT EXISTS idx_orcamento_fases_empresa ON public.projeto_orcamento_fases(empresa_id);
CREATE INDEX IF NOT EXISTS idx_orcamento_fases_projeto ON public.projeto_orcamento_fases(projeto_id);

ALTER TABLE public.projeto_orcamento_fases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Orcamento Full Admin/Op" ON public.projeto_orcamento_fases;
CREATE POLICY "Orcamento Full Admin/Op" ON public.projeto_orcamento_fases
  FOR ALL
  USING (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'operacional') AND deleted_at IS NULL)
  WITH CHECK (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'operacional') AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Orcamento Read Financeiro" ON public.projeto_orcamento_fases;
CREATE POLICY "Orcamento Read Financeiro" ON public.projeto_orcamento_fases
  FOR SELECT
  USING (empresa_id = public.get_user_empresa_id() AND public.has_role('financeiro') AND deleted_at IS NULL);

DROP TRIGGER IF EXISTS orcamento_fases_audit ON public.projeto_orcamento_fases;
CREATE TRIGGER orcamento_fases_audit
  BEFORE INSERT OR UPDATE ON public.projeto_orcamento_fases
  FOR EACH ROW EXECUTE FUNCTION public.handle_record_audit();

DROP TRIGGER IF EXISTS orcamento_fases_prevent_company_change ON public.projeto_orcamento_fases;
CREATE TRIGGER orcamento_fases_prevent_company_change
  BEFORE UPDATE ON public.projeto_orcamento_fases
  FOR EACH ROW EXECUTE FUNCTION public.prevent_company_change();

DROP TRIGGER IF EXISTS orcamento_fases_soft_delete ON public.projeto_orcamento_fases;
CREATE TRIGGER orcamento_fases_soft_delete
  BEFORE DELETE ON public.projeto_orcamento_fases
  FOR EACH ROW EXECUTE FUNCTION public.soft_delete_generic();

-- ==============================================================================
-- 3. TABELA: marcos_faturamento
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

CREATE INDEX IF NOT EXISTS idx_marcos_empresa ON public.marcos_faturamento(empresa_id);
CREATE INDEX IF NOT EXISTS idx_marcos_projeto ON public.marcos_faturamento(projeto_id);

ALTER TABLE public.marcos_faturamento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Marcos Full Admin/Fin" ON public.marcos_faturamento;
CREATE POLICY "Marcos Full Admin/Fin" ON public.marcos_faturamento
  FOR ALL
  USING (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'financeiro') AND deleted_at IS NULL)
  WITH CHECK (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'financeiro') AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Marcos Read Op" ON public.marcos_faturamento;
CREATE POLICY "Marcos Read Op" ON public.marcos_faturamento
  FOR SELECT
  USING (empresa_id = public.get_user_empresa_id() AND public.has_role('operacional') AND deleted_at IS NULL);

DROP TRIGGER IF EXISTS marcos_audit ON public.marcos_faturamento;
CREATE TRIGGER marcos_audit
  BEFORE INSERT OR UPDATE ON public.marcos_faturamento
  FOR EACH ROW EXECUTE FUNCTION public.handle_record_audit();

DROP TRIGGER IF EXISTS marcos_prevent_company_change ON public.marcos_faturamento;
CREATE TRIGGER marcos_prevent_company_change
  BEFORE UPDATE ON public.marcos_faturamento
  FOR EACH ROW EXECUTE FUNCTION public.prevent_company_change();

DROP TRIGGER IF EXISTS marcos_soft_delete ON public.marcos_faturamento;
CREATE TRIGGER marcos_soft_delete
  BEFORE DELETE ON public.marcos_faturamento
  FOR EACH ROW EXECUTE FUNCTION public.soft_delete_generic();

-- ==============================================================================
-- 4. TABELA: alertas
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

CREATE INDEX IF NOT EXISTS idx_alertas_empresa_lido ON public.alertas(empresa_id, lido, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alertas_empresa_tipo ON public.alertas(empresa_id, tipo);

ALTER TABLE public.alertas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Alertas Read" ON public.alertas;
CREATE POLICY "Alertas Read" ON public.alertas
  FOR SELECT
  USING (empresa_id = public.get_user_empresa_id());

DROP POLICY IF EXISTS "Alertas Update" ON public.alertas;
CREATE POLICY "Alertas Update" ON public.alertas
  FOR UPDATE
  USING (empresa_id = public.get_user_empresa_id())
  WITH CHECK (empresa_id = public.get_user_empresa_id());

DROP POLICY IF EXISTS "Alertas Insert Admin" ON public.alertas;
CREATE POLICY "Alertas Insert Admin" ON public.alertas
  FOR INSERT
  WITH CHECK (empresa_id = public.get_user_empresa_id() AND public.has_role('admin'));

DROP POLICY IF EXISTS "Alertas Delete Admin" ON public.alertas;
CREATE POLICY "Alertas Delete Admin" ON public.alertas
  FOR DELETE
  USING (empresa_id = public.get_user_empresa_id() AND public.has_role('admin'));

-- ==============================================================================
-- 5. TABELA: faturas (cartão de crédito)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.faturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  cartao_id UUID NOT NULL REFERENCES public.cartoes_credito(id) ON DELETE RESTRICT,
  mes_referencia INTEGER NOT NULL CHECK (mes_referencia BETWEEN 1 AND 12),
  ano_referencia INTEGER NOT NULL CHECK (ano_referencia BETWEEN 2020 AND 2100),

  -- Ciclo de billing
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  data_vencimento DATE NOT NULL,

  -- Valores
  valor_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  valor_pago DECIMAL(12,2) NOT NULL DEFAULT 0,

  -- Status e pagamento
  status TEXT NOT NULL DEFAULT 'Aberta'
    CHECK (status IN ('Aberta', 'Fechada', 'Paga', 'Parcial')),
  conta_pagamento_id UUID REFERENCES public.contas(id) ON DELETE SET NULL,
  data_pagamento DATE,

  -- Auditoria
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,

  -- Uma fatura por cartão por mês
  CONSTRAINT faturas_unique_cartao_mes UNIQUE (cartao_id, mes_referencia, ano_referencia)
);

CREATE INDEX IF NOT EXISTS idx_faturas_empresa ON public.faturas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_faturas_cartao ON public.faturas(cartao_id);
CREATE INDEX IF NOT EXISTS idx_faturas_status ON public.faturas(empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_faturas_periodo ON public.faturas(cartao_id, ano_referencia, mes_referencia);

ALTER TABLE public.faturas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "faturas_select" ON public.faturas;
CREATE POLICY "faturas_select" ON public.faturas
  FOR SELECT USING (
    empresa_id = public.get_user_empresa_id()
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS "faturas_insert" ON public.faturas;
CREATE POLICY "faturas_insert" ON public.faturas
  FOR INSERT WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.has_role('admin', 'financeiro')
  );

DROP POLICY IF EXISTS "faturas_update" ON public.faturas;
CREATE POLICY "faturas_update" ON public.faturas
  FOR UPDATE USING (
    empresa_id = public.get_user_empresa_id()
    AND deleted_at IS NULL
    AND public.has_role('admin', 'financeiro')
  ) WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.has_role('admin', 'financeiro')
  );

DROP POLICY IF EXISTS "faturas_delete" ON public.faturas;
CREATE POLICY "faturas_delete" ON public.faturas
  FOR DELETE USING (
    empresa_id = public.get_user_empresa_id()
    AND public.has_role('admin', 'financeiro')
  );

DROP TRIGGER IF EXISTS tr_audit_faturas ON public.faturas;
CREATE TRIGGER tr_audit_faturas
  BEFORE INSERT OR UPDATE ON public.faturas
  FOR EACH ROW EXECUTE FUNCTION public.handle_record_audit();

DROP TRIGGER IF EXISTS tr_soft_del_faturas ON public.faturas;
CREATE TRIGGER tr_soft_del_faturas
  BEFORE DELETE ON public.faturas
  FOR EACH ROW EXECUTE FUNCTION public.soft_delete_generic();

-- ==============================================================================
-- 6. ALTER despesas: fatura_id + is_fatura_payment
-- ==============================================================================

ALTER TABLE public.despesas
  ADD COLUMN IF NOT EXISTS fatura_id UUID REFERENCES public.faturas(id) ON DELETE SET NULL;

ALTER TABLE public.despesas
  ADD COLUMN IF NOT EXISTS is_fatura_payment BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_despesas_fatura ON public.despesas(fatura_id);
CREATE INDEX IF NOT EXISTS idx_despesas_is_fatura_payment
  ON public.despesas(is_fatura_payment)
  WHERE is_fatura_payment = true;

-- Marcar registros existentes de pagamento de fatura
UPDATE public.despesas
SET is_fatura_payment = true
WHERE descricao LIKE 'Pgto Fatura %'
  AND cartao_id IS NULL
  AND deleted_at IS NULL
  AND is_fatura_payment = false;

-- ==============================================================================
-- 7. ALTER cartoes_credito: conta_pagamento_id
-- ==============================================================================

ALTER TABLE public.cartoes_credito
  ADD COLUMN IF NOT EXISTS conta_pagamento_id UUID REFERENCES public.contas(id) ON DELETE SET NULL;

-- ==============================================================================
-- 8. TABELA: wip_snapshots
-- ==============================================================================

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

CREATE INDEX IF NOT EXISTS idx_wip_empresa ON public.wip_snapshots(empresa_id);
CREATE INDEX IF NOT EXISTS idx_wip_periodo ON public.wip_snapshots(empresa_id, ano, mes);

ALTER TABLE public.wip_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "WIP read all roles" ON public.wip_snapshots;
CREATE POLICY "WIP read all roles" ON public.wip_snapshots
  FOR SELECT USING (empresa_id = public.get_user_empresa_id());

DROP POLICY IF EXISTS "WIP write admin/fin" ON public.wip_snapshots;
CREATE POLICY "WIP write admin/fin" ON public.wip_snapshots
  FOR ALL USING (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'financeiro'))
  WITH CHECK (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'financeiro'));

-- ==============================================================================
-- 9. TABELA: aprovacoes (compliance)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.aprovacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('despesa_acima_limite', 'aditivo', 'contratacao', 'orcamento', 'proposta')),
  referencia_tipo TEXT NOT NULL,
  referencia_id UUID NOT NULL,
  solicitante_id UUID REFERENCES auth.users(id),
  aprovador_id UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
  justificativa TEXT,
  resposta TEXT,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_aprovacoes_empresa ON public.aprovacoes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_aprovacoes_status ON public.aprovacoes(empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_aprovacoes_ref ON public.aprovacoes(referencia_tipo, referencia_id);

ALTER TABLE public.aprovacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Aprovacoes read all" ON public.aprovacoes;
CREATE POLICY "Aprovacoes read all" ON public.aprovacoes
  FOR SELECT USING (empresa_id = public.get_user_empresa_id() AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Aprovacoes write admin" ON public.aprovacoes;
CREATE POLICY "Aprovacoes write admin" ON public.aprovacoes
  FOR ALL USING (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'financeiro') AND deleted_at IS NULL)
  WITH CHECK (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'financeiro') AND deleted_at IS NULL);

-- ==============================================================================
-- 10. TABELA: orcamento_versoes (versionamento)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.orcamento_versoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  versao INTEGER NOT NULL DEFAULT 1,
  dados JSONB NOT NULL,
  motivo TEXT,
  criado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orcamento_versoes_projeto ON public.orcamento_versoes(projeto_id);

ALTER TABLE public.orcamento_versoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Versoes read all" ON public.orcamento_versoes;
CREATE POLICY "Versoes read all" ON public.orcamento_versoes
  FOR SELECT USING (empresa_id = public.get_user_empresa_id());

DROP POLICY IF EXISTS "Versoes write admin/op" ON public.orcamento_versoes;
CREATE POLICY "Versoes write admin/op" ON public.orcamento_versoes
  FOR INSERT WITH CHECK (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'operacional'));

-- ==============================================================================
-- 11. VIEW: view_fatura_resumo
-- ==============================================================================

CREATE OR REPLACE VIEW public.view_fatura_resumo AS
SELECT
  f.id,
  f.empresa_id,
  f.cartao_id,
  cc.nome as cartao_nome,
  cc.cor as cartao_cor,
  f.mes_referencia,
  f.ano_referencia,
  f.data_inicio,
  f.data_fim,
  f.data_vencimento,
  f.status,
  f.data_pagamento,
  f.conta_pagamento_id,
  c.nome as conta_pagamento_nome,
  COALESCE(
    (SELECT SUM(d.valor)
     FROM public.despesas d
     WHERE d.fatura_id = f.id
       AND d.cartao_id IS NOT NULL
       AND d.deleted_at IS NULL),
    0
  ) as valor_total,
  f.valor_pago,
  (SELECT COUNT(*)
   FROM public.despesas d
   WHERE d.fatura_id = f.id
     AND d.cartao_id IS NOT NULL
     AND d.deleted_at IS NULL) as qtd_despesas
FROM public.faturas f
JOIN public.cartoes_credito cc ON f.cartao_id = cc.id
LEFT JOIN public.contas c ON f.conta_pagamento_id = c.id
WHERE f.deleted_at IS NULL;

-- ==============================================================================
-- 12. VIEW: view_cartao_resumo (FINAL — com conta_pagamento_id)
-- ==============================================================================

DROP VIEW IF EXISTS public.view_cartao_resumo;
CREATE VIEW public.view_cartao_resumo AS
SELECT
  cc.id,
  cc.nome,
  cc.empresa_id,
  cc.dia_fechamento,
  cc.dia_vencimento,
  cc.cor,
  cc.limite,
  cc.conta_pagamento_id,
  COALESCE(
    (SELECT SUM(d.valor)
     FROM public.despesas d
     WHERE d.cartao_id = cc.id
       AND d.status = 'Pendente'
       AND d.deleted_at IS NULL),
    0
  ) as usado,
  (cc.limite - COALESCE(
    (SELECT SUM(d.valor)
     FROM public.despesas d
     WHERE d.cartao_id = cc.id
       AND d.status = 'Pendente'
       AND d.deleted_at IS NULL),
    0
  )) as disponivel
FROM public.cartoes_credito cc
WHERE cc.deleted_at IS NULL;

GRANT SELECT ON public.view_cartao_resumo TO authenticated;

-- ==============================================================================
-- 13. RPC: rpc_projeto_rentabilidade
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
-- 14. RPC: rpc_dashboard_rentabilidade
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
-- 15. RPC: rpc_gerar_alertas
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

-- ==============================================================================
-- 16. RPC: rpc_faturar_marco
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.rpc_faturar_marco(p_marco_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_marco RECORD;
  v_projeto RECORD;
  v_receita_id UUID;
BEGIN
  SELECT * INTO v_marco FROM marcos_faturamento WHERE id = p_marco_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Marco não encontrado';
  END IF;

  IF v_marco.status != 'pendente' THEN
    RAISE EXCEPTION 'Apenas marcos pendentes podem ser faturados';
  END IF;

  SELECT id, cliente_id, empresa_id, nome FROM projetos
  WHERE id = v_marco.projeto_id AND deleted_at IS NULL
  INTO v_projeto;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Projeto não encontrado';
  END IF;

  INSERT INTO receitas (
    empresa_id, descricao, valor, data_vencimento, status,
    projeto_id, cliente_id
  ) VALUES (
    v_projeto.empresa_id,
    'Marco: ' || v_marco.nome || ' — ' || v_projeto.nome,
    v_marco.valor,
    CURRENT_DATE,
    'Pendente',
    v_marco.projeto_id,
    v_projeto.cliente_id
  )
  RETURNING id INTO v_receita_id;

  UPDATE marcos_faturamento
  SET status = 'faturado',
      data_faturada = CURRENT_DATE,
      receita_id = v_receita_id
  WHERE id = p_marco_id;

  RETURN v_receita_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_faturar_marco(UUID) TO authenticated;

-- ==============================================================================
-- 17. RPC: gerar_fatura (cartão de crédito)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.gerar_fatura(
  p_cartao_id UUID,
  p_mes INTEGER,
  p_ano INTEGER
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fatura_id UUID;
  v_dia_fechamento INTEGER;
  v_dia_vencimento INTEGER;
  v_data_inicio DATE;
  v_data_fim DATE;
  v_data_vencimento DATE;
  v_empresa_id UUID;
  v_valor_total DECIMAL(12,2);
  v_max_day_fim INTEGER;
  v_max_day_venc INTEGER;
BEGIN
  SELECT dia_fechamento, dia_vencimento, empresa_id
  INTO v_dia_fechamento, v_dia_vencimento, v_empresa_id
  FROM cartoes_credito WHERE id = p_cartao_id AND deleted_at IS NULL;

  IF v_dia_fechamento IS NULL THEN
    RAISE EXCEPTION 'Cartão não encontrado';
  END IF;

  IF v_empresa_id != public.get_user_empresa_id() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  -- data_fim = dia_fechamento do mês de referência (limitado ao último dia do mês)
  v_max_day_fim := EXTRACT(DAY FROM (DATE_TRUNC('month', make_date(p_ano, p_mes, 1)) + INTERVAL '1 month - 1 day'))::INTEGER;
  v_data_fim := make_date(p_ano, p_mes, LEAST(v_dia_fechamento, v_max_day_fim));

  -- data_inicio = dia_fechamento+1 do mês anterior
  v_data_inicio := (v_data_fim - INTERVAL '1 month')::DATE + INTERVAL '1 day';

  -- data_vencimento = dia_vencimento do mês de referência
  v_max_day_venc := EXTRACT(DAY FROM (DATE_TRUNC('month', make_date(p_ano, p_mes, 1)) + INTERVAL '1 month - 1 day'))::INTEGER;
  v_data_vencimento := make_date(p_ano, p_mes, LEAST(v_dia_vencimento, v_max_day_venc));

  -- Se dia_vencimento < dia_fechamento, o vencimento é no mês seguinte
  IF v_dia_vencimento < v_dia_fechamento THEN
    v_data_vencimento := v_data_vencimento + INTERVAL '1 month';
  END IF;

  -- Upsert da fatura
  INSERT INTO faturas (empresa_id, cartao_id, mes_referencia, ano_referencia,
                       data_inicio, data_fim, data_vencimento, status)
  VALUES (v_empresa_id, p_cartao_id, p_mes, p_ano,
          v_data_inicio, v_data_fim, v_data_vencimento, 'Aberta')
  ON CONFLICT (cartao_id, mes_referencia, ano_referencia)
  DO UPDATE SET updated_at = NOW()
  RETURNING id INTO v_fatura_id;

  -- Associar despesas não vinculadas ao ciclo
  UPDATE despesas
  SET fatura_id = v_fatura_id
  WHERE cartao_id = p_cartao_id
    AND deleted_at IS NULL
    AND data_vencimento >= v_data_inicio
    AND data_vencimento <= v_data_fim
    AND fatura_id IS NULL;

  -- Atualizar total da fatura
  SELECT COALESCE(SUM(valor), 0) INTO v_valor_total
  FROM despesas
  WHERE fatura_id = v_fatura_id
    AND cartao_id IS NOT NULL
    AND deleted_at IS NULL;

  UPDATE faturas SET valor_total = v_valor_total WHERE id = v_fatura_id;

  RETURN v_fatura_id;
END;
$$;

-- ==============================================================================
-- 18. RPC: pagar_fatura (FINAL — com is_fatura_payment)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.pagar_fatura(
  p_fatura_id UUID,
  p_conta_id UUID,
  p_valor_pago DECIMAL(12,2) DEFAULT NULL,
  p_data_pagamento DATE DEFAULT CURRENT_DATE
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fatura RECORD;
  v_valor_a_pagar DECIMAL(12,2);
BEGIN
  -- Lock e buscar fatura
  SELECT f.*, cc.nome as cartao_nome
  INTO v_fatura
  FROM faturas f
  JOIN cartoes_credito cc ON f.cartao_id = cc.id
  WHERE f.id = p_fatura_id
    AND f.deleted_at IS NULL
  FOR UPDATE;

  IF v_fatura IS NULL THEN
    RAISE EXCEPTION 'Fatura não encontrada';
  END IF;

  IF v_fatura.empresa_id != public.get_user_empresa_id() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF v_fatura.status = 'Paga' THEN
    RAISE EXCEPTION 'Fatura já está paga';
  END IF;

  v_valor_a_pagar := COALESCE(p_valor_pago, v_fatura.valor_total - v_fatura.valor_pago);

  IF v_valor_a_pagar <= 0 THEN
    RAISE EXCEPTION 'Valor de pagamento inválido';
  END IF;

  -- 1. Atualizar fatura
  UPDATE faturas SET
    valor_pago = valor_pago + v_valor_a_pagar,
    conta_pagamento_id = p_conta_id,
    data_pagamento = p_data_pagamento,
    status = CASE
      WHEN (valor_pago + v_valor_a_pagar) >= valor_total THEN 'Paga'
      ELSE 'Parcial'
    END
  WHERE id = p_fatura_id;

  -- 2. Se totalmente paga, marcar despesas do cartão como Pago
  IF (v_fatura.valor_pago + v_valor_a_pagar) >= v_fatura.valor_total THEN
    UPDATE despesas SET
      status = 'Pago',
      data_pagamento = p_data_pagamento
    WHERE fatura_id = p_fatura_id
      AND cartao_id IS NOT NULL
      AND deleted_at IS NULL
      AND status = 'Pendente';
  END IF;

  -- 3. Criar débito na conta bancária (marcado como pagamento de fatura)
  INSERT INTO despesas (
    empresa_id,
    descricao,
    valor,
    data_vencimento,
    data_pagamento,
    status,
    conta_id,
    cartao_id,
    fatura_id,
    observacao,
    is_fatura_payment
  ) VALUES (
    v_fatura.empresa_id,
    'Pgto Fatura ' || v_fatura.cartao_nome || ' ' ||
      LPAD(v_fatura.mes_referencia::TEXT, 2, '0') || '/' || v_fatura.ano_referencia,
    v_valor_a_pagar,
    v_fatura.data_vencimento,
    p_data_pagamento,
    'Pago',
    p_conta_id,
    NULL,
    p_fatura_id,
    'Pagamento de fatura de cartão de crédito',
    true
  );
END;
$$;

-- ==============================================================================
-- 19. RPC: rpc_calcular_wip
-- ==============================================================================

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

-- ==============================================================================
-- 20. TRIGGER: handle_escopo_aprovado (aditivo atualiza orçamento)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_escopo_aprovado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_empresa_id UUID;
BEGIN
  -- Só executa quando status muda para 'aprovado' e tipo é 'aditivo'
  IF NEW.status = 'aprovado' AND NEW.tipo = 'aditivo'
     AND (OLD.status IS DISTINCT FROM 'aprovado') THEN

    v_empresa_id := NEW.empresa_id;

    FOR v_item IN
      SELECT disciplina, horas, custo
      FROM escopo_itens
      WHERE escopo_id = NEW.id
    LOOP
      INSERT INTO projeto_orcamento_fases (
        empresa_id, projeto_id, disciplina, horas_estimadas, custo_hora, valor_venda
      ) VALUES (
        v_empresa_id, NEW.projeto_id, v_item.disciplina,
        COALESCE(v_item.horas, 0),
        CASE WHEN v_item.horas > 0 THEN COALESCE(v_item.custo, 0) / v_item.horas ELSE 0 END,
        COALESCE(v_item.custo, 0) * 1.3
      )
      ON CONFLICT (projeto_id, disciplina) DO UPDATE SET
        horas_estimadas = projeto_orcamento_fases.horas_estimadas + COALESCE(v_item.horas, 0),
        valor_venda = projeto_orcamento_fases.valor_venda + (COALESCE(v_item.custo, 0) * 1.3),
        updated_at = NOW();
    END LOOP;

    IF NEW.valor_aditivo IS NOT NULL AND NEW.valor_aditivo > 0 THEN
      UPDATE projetos
      SET valor_contrato = COALESCE(valor_contrato, 0) + NEW.valor_aditivo,
          updated_at = NOW()
      WHERE id = NEW.projeto_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_escopo_aprovado ON public.escopos;

CREATE TRIGGER trigger_escopo_aprovado
  AFTER UPDATE ON public.escopos
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_escopo_aprovado();

-- ==============================================================================
-- 21. TRIGGER: handle_orcamento_versao (versionamento automático)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_orcamento_versao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dados JSONB;
  v_versao INTEGER;
  v_empresa_id UUID;
BEGIN
  SELECT empresa_id INTO v_empresa_id FROM projetos WHERE id = NEW.projeto_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'disciplina', disciplina,
    'horas_estimadas', horas_estimadas,
    'custo_hora', custo_hora,
    'valor_venda', valor_venda,
    'margem_alvo_pct', margem_alvo_pct
  )), '[]'::JSONB)
  INTO v_dados
  FROM projeto_orcamento_fases
  WHERE projeto_id = NEW.projeto_id AND deleted_at IS NULL;

  SELECT COALESCE(MAX(versao), 0) + 1 INTO v_versao
  FROM orcamento_versoes
  WHERE projeto_id = NEW.projeto_id;

  INSERT INTO orcamento_versoes (empresa_id, projeto_id, versao, dados, criado_por, motivo)
  VALUES (v_empresa_id, NEW.projeto_id, v_versao, v_dados, auth.uid(), 'Atualização automática');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_orcamento_versao ON public.projeto_orcamento_fases;

CREATE TRIGGER trigger_orcamento_versao
  AFTER INSERT OR UPDATE ON public.projeto_orcamento_fases
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_orcamento_versao();
