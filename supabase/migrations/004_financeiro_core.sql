-- Migration 004: Financeiro Core
-- Consolidação de: fix_financial_rls_policies, create_folha_pagamento, create_folha_rpc, remove_origem_pagamento_check, security_hardening (views), update_financial_views, despesas_recorrentes, parcelas_estruturadas

-- ==============================================================================
-- 1. RLS POLICIES: receitas, despesas, contas_bancarias, cartoes_credito,
--    fornecedores, categorias_financeiras
-- ==============================================================================

-- RECEITAS
DROP POLICY IF EXISTS "Financeiro Full Receitas" ON public.receitas;
DROP POLICY IF EXISTS "Receitas Full Access" ON public.receitas;
DROP POLICY IF EXISTS "Receitas Read Only" ON public.receitas;

CREATE POLICY "Receitas Full Access" ON public.receitas
  FOR ALL
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.has_role('admin', 'financeiro')
    AND deleted_at IS NULL
  )
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.has_role('admin', 'financeiro')
    AND deleted_at IS NULL
  );

CREATE POLICY "Receitas Read Only" ON public.receitas
  FOR SELECT
  USING (
    empresa_id = public.get_user_empresa_id()
    AND deleted_at IS NULL
  );

-- DESPESAS
DROP POLICY IF EXISTS "Financeiro Full Despesas" ON public.despesas;
DROP POLICY IF EXISTS "Despesas Full Access" ON public.despesas;
DROP POLICY IF EXISTS "Despesas Read Only" ON public.despesas;

CREATE POLICY "Despesas Full Access" ON public.despesas
  FOR ALL
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.has_role('admin', 'financeiro')
    AND deleted_at IS NULL
  )
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.has_role('admin', 'financeiro')
    AND deleted_at IS NULL
  );

CREATE POLICY "Despesas Read Only" ON public.despesas
  FOR SELECT
  USING (
    empresa_id = public.get_user_empresa_id()
    AND deleted_at IS NULL
  );

-- CONTAS BANCÁRIAS
DROP POLICY IF EXISTS "Financeiro Full Contas" ON public.contas;
DROP POLICY IF EXISTS "Contas Full Access" ON public.contas;
DROP POLICY IF EXISTS "Contas Read Only" ON public.contas;

CREATE POLICY "Contas Full Access" ON public.contas
  FOR ALL
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.has_role('admin', 'financeiro')
    AND deleted_at IS NULL
  )
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.has_role('admin', 'financeiro')
    AND deleted_at IS NULL
  );

CREATE POLICY "Contas Read Only" ON public.contas
  FOR SELECT
  USING (
    empresa_id = public.get_user_empresa_id()
    AND deleted_at IS NULL
  );

-- CARTÕES DE CRÉDITO
DROP POLICY IF EXISTS "Financeiro Full Cartoes" ON public.cartoes_credito;
DROP POLICY IF EXISTS "Cartoes Full Access" ON public.cartoes_credito;
DROP POLICY IF EXISTS "Cartoes Read Only" ON public.cartoes_credito;

CREATE POLICY "Cartoes Full Access" ON public.cartoes_credito
  FOR ALL
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.has_role('admin', 'financeiro')
    AND deleted_at IS NULL
  )
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.has_role('admin', 'financeiro')
    AND deleted_at IS NULL
  );

CREATE POLICY "Cartoes Read Only" ON public.cartoes_credito
  FOR SELECT
  USING (
    empresa_id = public.get_user_empresa_id()
    AND deleted_at IS NULL
  );

-- FORNECEDORES
DROP POLICY IF EXISTS "Financeiro Full Fornecedores" ON public.fornecedores;
DROP POLICY IF EXISTS "Fornecedores Full Access" ON public.fornecedores;
DROP POLICY IF EXISTS "Fornecedores Read Only" ON public.fornecedores;

CREATE POLICY "Fornecedores Full Access" ON public.fornecedores
  FOR ALL
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.has_role('admin', 'financeiro')
    AND deleted_at IS NULL
  )
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.has_role('admin', 'financeiro')
    AND deleted_at IS NULL
  );

CREATE POLICY "Fornecedores Read Only" ON public.fornecedores
  FOR SELECT
  USING (
    empresa_id = public.get_user_empresa_id()
    AND deleted_at IS NULL
  );

-- CATEGORIAS FINANCEIRAS
DROP POLICY IF EXISTS "Financeiro Full Categorias" ON public.categorias_financeiras;
DROP POLICY IF EXISTS "Categorias Full Access" ON public.categorias_financeiras;
DROP POLICY IF EXISTS "Categorias Read Only" ON public.categorias_financeiras;

CREATE POLICY "Categorias Full Access" ON public.categorias_financeiras
  FOR ALL
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.has_role('admin', 'financeiro')
  )
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.has_role('admin', 'financeiro')
  );

CREATE POLICY "Categorias Read Only" ON public.categorias_financeiras
  FOR SELECT
  USING (
    empresa_id = public.get_user_empresa_id()
  );

-- ==============================================================================
-- 2. FOLHA DE PAGAMENTO: tabela + RLS (com fix do security_hardening)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.folha_pagamento (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID NOT NULL,
    pessoa_id UUID NOT NULL REFERENCES public.pessoas(id) ON DELETE CASCADE,
    mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
    ano INTEGER NOT NULL,
    salario_fixo DECIMAL(10, 2) DEFAULT 0,
    total_area_projetada DECIMAL(10, 2) DEFAULT 0,
    valor_m2 DECIMAL(10, 2) DEFAULT 0,
    adicional_variavel DECIMAL(10, 2) DEFAULT 0,
    total_receber DECIMAL(10, 2) DEFAULT 0,
    status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'cancelado')),
    data_pagamento TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(pessoa_id, mes, ano)
);

ALTER TABLE public.folha_pagamento ENABLE ROW LEVEL SECURITY;

-- Drop the bad anon-style policy from original migration (security_hardening fix)
DROP POLICY IF EXISTS "Users can view folha_pagamento of their company" ON public.folha_pagamento;

-- Drop existing policies to allow re-creation
DROP POLICY IF EXISTS "Enable read access for authenticated users based on company" ON public.folha_pagamento;
DROP POLICY IF EXISTS "Enable insert access for authenticated users based on company" ON public.folha_pagamento;
DROP POLICY IF EXISTS "Enable update access for authenticated users based on company" ON public.folha_pagamento;
DROP POLICY IF EXISTS "Enable delete access for authenticated users based on company" ON public.folha_pagamento;

CREATE POLICY "Enable read access for authenticated users based on company"
ON public.folha_pagamento
FOR SELECT
TO authenticated
USING (empresa_id = (SELECT public.get_user_empresa_id()));

CREATE POLICY "Enable insert access for authenticated users based on company"
ON public.folha_pagamento
FOR INSERT
TO authenticated
WITH CHECK (empresa_id = (SELECT public.get_user_empresa_id()));

CREATE POLICY "Enable update access for authenticated users based on company"
ON public.folha_pagamento
FOR UPDATE
TO authenticated
USING (empresa_id = (SELECT public.get_user_empresa_id()));

CREATE POLICY "Enable delete access for authenticated users based on company"
ON public.folha_pagamento
FOR DELETE
TO authenticated
USING (empresa_id = (SELECT public.get_user_empresa_id()));

-- ==============================================================================
-- 3. VIEW: view_folha_pagamento (FINAL do security_hardening — com empresa_id,
--    disciplinas info, REVOKE from anon)
-- ==============================================================================

DO $$ BEGIN
  REVOKE SELECT ON public.view_folha_pagamento FROM anon;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

CREATE OR REPLACE VIEW public.view_folha_pagamento AS
SELECT
  p.id as pessoa_id,
  p.nome as pessoa_nome,
  p.cargo,
  p.empresa_id,
  COALESCE(p.salario_fixo, 0) as salario_fixo,
  COALESCE(p.valor_m2, 0) as valor_m2,
  COUNT(DISTINCT proj.id) as qtd_projetos,
  COALESCE(SUM(proj.area_m2), 0) as total_area_m2,
  COALESCE(SUM(proj.area_m2 * COALESCE(p.valor_m2, 0)), 0) as total_comissao,
  (COALESCE(p.salario_fixo, 0) + COALESCE(SUM(proj.area_m2 * COALESCE(p.valor_m2, 0)), 0)) as total_receber
FROM
  public.pessoas p
LEFT JOIN
  public.projetos proj ON proj.empresa_id = p.empresa_id
    AND proj.deleted_at IS NULL
    AND proj.status IN ('Planejamento', 'Em andamento')
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(proj.disciplinas) AS d
      WHERE (d->>'responsavel_id')::uuid = p.id
    )
WHERE
  p.deleted_at IS NULL
GROUP BY
  p.id, p.nome, p.cargo, p.empresa_id, p.salario_fixo, p.valor_m2;

GRANT SELECT ON public.view_folha_pagamento TO authenticated;

-- ==============================================================================
-- 4. VIEW: view_financas_resumo (FINAL do update_financial_views — com banco, cor)
-- ==============================================================================

DROP VIEW IF EXISTS public.view_financas_resumo;
CREATE VIEW public.view_financas_resumo AS
SELECT
  c.id as conta_id,
  c.nome as conta_nome,
  c.banco,
  c.cor,
  c.empresa_id,
  c.saldo_inicial,
  COALESCE((SELECT SUM(r.valor) FROM public.receitas r WHERE r.conta_id = c.id AND r.status = 'Recebido' AND r.deleted_at IS NULL), 0) as total_entradas,
  COALESCE((SELECT SUM(d.valor) FROM public.despesas d WHERE d.conta_id = c.id AND d.status = 'Pago' AND d.deleted_at IS NULL), 0) as total_saidas,
  (c.saldo_inicial +
   COALESCE((SELECT SUM(r.valor) FROM public.receitas r WHERE r.conta_id = c.id AND r.status = 'Recebido' AND r.deleted_at IS NULL), 0) -
   COALESCE((SELECT SUM(d.valor) FROM public.despesas d WHERE d.conta_id = c.id AND d.status = 'Pago' AND d.deleted_at IS NULL), 0)
  ) as saldo_atual
FROM public.contas c
WHERE c.deleted_at IS NULL;

GRANT SELECT ON public.view_financas_resumo TO authenticated;

-- VIEW: view_cartao_resumo (do update_financial_views — com cor, dia_fechamento, dia_vencimento)
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
  COALESCE((SELECT SUM(d.valor) FROM public.despesas d WHERE d.cartao_id = cc.id AND d.status = 'Pendente' AND d.deleted_at IS NULL), 0) as usado,
  (cc.limite - COALESCE((SELECT SUM(d.valor) FROM public.despesas d WHERE d.cartao_id = cc.id AND d.status = 'Pendente' AND d.deleted_at IS NULL), 0)) as disponivel
FROM public.cartoes_credito cc
WHERE cc.deleted_at IS NULL;

GRANT SELECT ON public.view_cartao_resumo TO authenticated;

-- ==============================================================================
-- 5. RPC: get_folha_preview
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_folha_preview(
  p_mes INTEGER,
  p_ano INTEGER
)
RETURNS TABLE (
  pessoa_id UUID,
  nome TEXT,
  cargo TEXT,
  salario_fixo DECIMAL,
  valor_m2 DECIMAL,
  total_area DECIMAL,
  total_variavel DECIMAL,
  total_receber DECIMAL,
  projetos_nomes TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_empresa_id UUID;
BEGIN
  v_empresa_id := public.get_user_empresa_id();

  RETURN QUERY
  WITH projetos_periodo AS (
    SELECT
      pr.id,
      pr.nome as projeto_nome,
      pr.area_m2,
      pr.disciplinas
    FROM public.projetos pr
    WHERE pr.empresa_id = v_empresa_id
    AND EXTRACT(MONTH FROM pr.data_inicio) = p_mes
    AND EXTRACT(YEAR FROM pr.data_inicio) = p_ano
  ),
  calculo_por_pessoa AS (
    SELECT
      pe.id as p_id,
      pe.nome as p_nome,
      pe.cargo as p_cargo,
      COALESCE(pe.salario_fixo, 0) as p_salario_fixo,
      COALESCE(pe.valor_m2, 0) as p_valor_m2,
      COALESCE(SUM(pp.area_m2) FILTER (WHERE pp.id IS NOT NULL), 0) as soma_area,
      array_agg(pp.projeto_nome) FILTER (WHERE pp.id IS NOT NULL) as lista_projetos
    FROM public.pessoas pe
    LEFT JOIN projetos_periodo pp ON EXISTS (
      SELECT 1
      FROM jsonb_array_elements(pp.disciplinas) as d
      WHERE (d->>'responsavel_id')::uuid = pe.id
    )
    WHERE pe.empresa_id = v_empresa_id
    GROUP BY pe.id
  )
  SELECT
    c.p_id,
    c.p_nome,
    c.p_cargo,
    c.p_salario_fixo,
    c.p_valor_m2,
    c.soma_area,
    (c.soma_area * c.p_valor_m2)::DECIMAL(10,2) as v_variavel,
    (c.p_salario_fixo + (c.soma_area * c.p_valor_m2))::DECIMAL(10,2) as v_total,
    COALESCE(c.lista_projetos, ARRAY[]::TEXT[])
  FROM calculo_por_pessoa c
  ORDER BY c.p_nome;
END;
$$;

-- ==============================================================================
-- 6. ALTER DESPESAS: recorrente, periodicidade, despesa_pai_id,
--    grupo_parcela, parcela_numero, parcela_total
-- ==============================================================================

ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS recorrente BOOLEAN DEFAULT FALSE;
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS periodicidade TEXT CHECK (periodicidade IN ('mensal', 'trimestral', 'semestral', 'anual'));
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS despesa_pai_id UUID REFERENCES public.despesas(id);
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS grupo_parcela UUID DEFAULT NULL;
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS parcela_numero INTEGER DEFAULT NULL;
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS parcela_total INTEGER DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_despesas_grupo_parcela
  ON public.despesas (grupo_parcela) WHERE grupo_parcela IS NOT NULL;

-- ==============================================================================
-- 7. ALTER RECEITAS: grupo_parcela, parcela_numero, parcela_total
-- ==============================================================================

ALTER TABLE public.receitas ADD COLUMN IF NOT EXISTS grupo_parcela UUID DEFAULT NULL;
ALTER TABLE public.receitas ADD COLUMN IF NOT EXISTS parcela_numero INTEGER DEFAULT NULL;
ALTER TABLE public.receitas ADD COLUMN IF NOT EXISTS parcela_total INTEGER DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_receitas_grupo_parcela
  ON public.receitas (grupo_parcela) WHERE grupo_parcela IS NOT NULL;

-- ==============================================================================
-- 8. REMOVE origem_pagamento CHECK CONSTRAINT
-- ==============================================================================

ALTER TABLE public.despesas DROP CONSTRAINT IF EXISTS origem_pagamento_check;

-- ==============================================================================
-- 9. RPC: rpc_gerar_despesas_recorrentes
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.rpc_gerar_despesas_recorrentes()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_despesa RECORD;
  v_proxima_data DATE;
  v_count INTEGER := 0;
  v_empresa_id UUID;
BEGIN
  v_empresa_id := public.get_user_empresa_id();

  FOR v_despesa IN
    SELECT d.*
    FROM despesas d
    WHERE d.empresa_id = v_empresa_id
      AND d.recorrente = TRUE
      AND d.deleted_at IS NULL
      AND d.periodicidade IS NOT NULL
      -- Só gera se não existe filha no futuro
      AND NOT EXISTS (
        SELECT 1 FROM despesas filha
        WHERE filha.despesa_pai_id = d.id
          AND filha.deleted_at IS NULL
          AND filha.data_vencimento > CURRENT_DATE
      )
  LOOP
    -- Calcular próxima data
    v_proxima_data := CASE v_despesa.periodicidade
      WHEN 'mensal' THEN v_despesa.data_vencimento + INTERVAL '1 month'
      WHEN 'trimestral' THEN v_despesa.data_vencimento + INTERVAL '3 months'
      WHEN 'semestral' THEN v_despesa.data_vencimento + INTERVAL '6 months'
      WHEN 'anual' THEN v_despesa.data_vencimento + INTERVAL '1 year'
      ELSE v_despesa.data_vencimento + INTERVAL '1 month'
    END;

    -- Ajustar se data já passou (avançar até o futuro)
    WHILE v_proxima_data <= CURRENT_DATE LOOP
      v_proxima_data := CASE v_despesa.periodicidade
        WHEN 'mensal' THEN v_proxima_data + INTERVAL '1 month'
        WHEN 'trimestral' THEN v_proxima_data + INTERVAL '3 months'
        WHEN 'semestral' THEN v_proxima_data + INTERVAL '6 months'
        WHEN 'anual' THEN v_proxima_data + INTERVAL '1 year'
        ELSE v_proxima_data + INTERVAL '1 month'
      END;
    END LOOP;

    -- Criar próxima ocorrência
    INSERT INTO despesas (
      empresa_id, descricao, valor, data_vencimento, status,
      projeto_id, fornecedor_id, categoria_id, conta_id,
      recorrente, periodicidade, despesa_pai_id, observacao
    ) VALUES (
      v_despesa.empresa_id,
      v_despesa.descricao,
      v_despesa.valor,
      v_proxima_data,
      'Pendente',
      v_despesa.projeto_id,
      v_despesa.fornecedor_id,
      v_despesa.categoria_id,
      v_despesa.conta_id,
      TRUE,
      v_despesa.periodicidade,
      v_despesa.id,
      v_despesa.observacao
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_gerar_despesas_recorrentes() TO authenticated;
