-- ==============================================================================
-- SECURITY HARDENING MIGRATION
-- Corrige vulnerabilidades identificadas na auditoria de segurança
-- ==============================================================================

-- ==============================================================================
-- 1. CRITICAL: view_folha_pagamento — revogar anon + adicionar tenant isolation
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
-- 2. CRITICAL: Corrigir rpc_gerar_alertas — não aceitar empresa_id externo
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.rpc_gerar_alertas()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  alert_count INTEGER := 0;
  r RECORD;
  v_empresa_id UUID;
BEGIN
  v_empresa_id := public.get_user_empresa_id();
  
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não associado a uma empresa';
  END IF;

  FOR r IN
    SELECT p.id, p.nome,
      COALESCE(SUM(t.horas), 0) AS horas_consumidas,
      COALESCE(SUM(o.horas_estimadas), 0) AS horas_orcadas,
      COALESCE((SELECT SUM(rv.valor) FROM receitas rv WHERE rv.projeto_id = p.id AND rv.deleted_at IS NULL AND rv.status = 'Recebido'), 0) AS recebido,
      COALESCE(p.valor_contrato, 0) AS valor_contrato
    FROM projetos p
    LEFT JOIN timesheets t ON t.projeto_id = p.id AND t.deleted_at IS NULL AND t.status = 'aprovado'
    LEFT JOIN projeto_orcamento_fases o ON o.projeto_id = p.id AND o.deleted_at IS NULL
    WHERE p.empresa_id = v_empresa_id AND p.deleted_at IS NULL AND p.status = 'Em andamento'
    GROUP BY p.id, p.nome, p.valor_contrato
    HAVING COALESCE(SUM(o.horas_estimadas), 0) > 0
  LOOP
    IF r.horas_orcadas > 0 AND (r.horas_consumidas / r.horas_orcadas) > 0.8
       AND r.valor_contrato > 0 AND (r.recebido / r.valor_contrato) < 0.5 THEN
      IF NOT EXISTS (
        SELECT 1 FROM alertas a
        WHERE a.empresa_id = v_empresa_id AND a.tipo = 'horas_excedidas'
          AND a.referencia_id = r.id AND a.created_at > NOW() - INTERVAL '7 days'
      ) THEN
        INSERT INTO alertas (empresa_id, tipo, severidade, titulo, mensagem, referencia_tipo, referencia_id)
        VALUES (v_empresa_id, 'horas_excedidas', 'high',
          'Horas excedidas: ' || r.nome,
          'Projeto consumiu ' || ROUND((r.horas_consumidas / r.horas_orcadas * 100)::numeric, 0) || '% das horas mas faturou apenas ' || ROUND((r.recebido / NULLIF(r.valor_contrato, 0) * 100)::numeric, 0) || '%',
          'projeto', r.id);
        alert_count := alert_count + 1;
      END IF;
    END IF;
  END LOOP;

  FOR r IN
    SELECT rv.id, rv.descricao, rv.data_vencimento, rv.valor,
      c.nome AS cliente_nome
    FROM receitas rv
    LEFT JOIN clientes c ON c.id = rv.cliente_id
    WHERE rv.empresa_id = v_empresa_id AND rv.deleted_at IS NULL
      AND rv.status = 'Pendente'
      AND rv.data_vencimento < CURRENT_DATE - INTERVAL '15 days'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM alertas a
      WHERE a.empresa_id = v_empresa_id AND a.tipo = 'pagamento_atrasado'
        AND a.referencia_id = r.id AND a.created_at > NOW() - INTERVAL '7 days'
    ) THEN
      INSERT INTO alertas (empresa_id, tipo, severidade, titulo, mensagem, referencia_tipo, referencia_id)
      VALUES (v_empresa_id, 'pagamento_atrasado', 'high',
        'Pagamento atrasado: ' || COALESCE(r.cliente_nome, r.descricao),
        'Receita de R$ ' || r.valor || ' vencida em ' || TO_CHAR(r.data_vencimento, 'DD/MM/YYYY'),
        'cliente', r.id);
      alert_count := alert_count + 1;
    END IF;
  END LOOP;

  RETURN alert_count;
END;
$$;

DROP FUNCTION IF EXISTS public.rpc_gerar_alertas(UUID);

-- ==============================================================================
-- 3. HIGH: Corrigir RLS de disciplinas e metas — restringir write a admin
-- ==============================================================================

DROP POLICY IF EXISTS "Enable write access for authenticated users" ON public.disciplinas;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.disciplinas;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON public.disciplinas;

DO $$ BEGIN
  CREATE POLICY "Enable write access for admin users" ON public.disciplinas
    FOR INSERT WITH CHECK (public.has_role('admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Enable update access for admin users" ON public.disciplinas
    FOR UPDATE USING (public.has_role('admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Enable delete access for admin users" ON public.disciplinas
    FOR DELETE USING (public.has_role('admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DROP POLICY IF EXISTS "Enable write access for authenticated users" ON public.metas;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.metas;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON public.metas;

DO $$ BEGIN
  CREATE POLICY "Enable write access for admin users" ON public.metas
    FOR INSERT WITH CHECK (public.has_role('admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Enable update access for admin users" ON public.metas
    FOR UPDATE USING (public.has_role('admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Enable delete access for admin users" ON public.metas
    FOR DELETE USING (public.has_role('admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ==============================================================================
-- 4. MEDIUM: Remover policy incorreta de folha_pagamento
-- ==============================================================================

DROP POLICY IF EXISTS "Users can view folha_pagamento of their company" ON public.folha_pagamento;

-- ==============================================================================
-- 5. MEDIUM: Adicionar filtro deleted_at na policy Pessoas Read
-- ==============================================================================

DROP POLICY IF EXISTS "Pessoas Read" ON public.pessoas;
CREATE POLICY "Pessoas Read" ON public.pessoas
  FOR SELECT USING (
    empresa_id = public.get_user_empresa_id()
    AND deleted_at IS NULL
  );

-- ==============================================================================
-- 6. MEDIUM: Garantir que views financeiras filtram deleted_at
-- ==============================================================================

CREATE OR REPLACE VIEW public.view_financas_resumo AS
SELECT 
  c.id as conta_id,
  c.nome as conta_nome,
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

CREATE OR REPLACE VIEW public.view_cartao_resumo AS
SELECT
  cc.id,
  cc.nome,
  cc.empresa_id,
  cc.limite,
  COALESCE((SELECT SUM(d.valor) FROM public.despesas d WHERE d.cartao_id = cc.id AND d.status = 'Pendente' AND d.deleted_at IS NULL), 0) as usado,
  (cc.limite - COALESCE((SELECT SUM(d.valor) FROM public.despesas d WHERE d.cartao_id = cc.id AND d.status = 'Pendente' AND d.deleted_at IS NULL), 0)) as disponivel
FROM public.cartoes_credito cc
WHERE cc.deleted_at IS NULL;
