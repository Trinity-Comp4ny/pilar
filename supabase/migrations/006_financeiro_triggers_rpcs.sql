-- Migration 006: Triggers e RPCs Financeiros
-- Consolidação de: fix_financial_project_logic, alertas_pagamentos_projeto

-- ============================================================
-- 1. AUTO-MARCAR RECEITAS/DESPESAS COMO ATRASADAS
-- Roda diariamente via cron ou chamada manual
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_atualizar_status_atrasados()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  receitas_atualizadas INTEGER := 0;
  despesas_atualizadas INTEGER := 0;
BEGIN
  -- Marcar receitas pendentes vencidas como Atrasado
  UPDATE receitas
  SET status = 'Atrasado'
  WHERE status = 'Pendente'
    AND data_vencimento < CURRENT_DATE
    AND deleted_at IS NULL;
  GET DIAGNOSTICS receitas_atualizadas = ROW_COUNT;

  -- Marcar despesas pendentes vencidas como Atrasado
  UPDATE despesas
  SET status = 'Atrasado'
  WHERE status = 'Pendente'
    AND data_vencimento < CURRENT_DATE
    AND deleted_at IS NULL;
  GET DIAGNOSTICS despesas_atualizadas = ROW_COUNT;

  RETURN json_build_object(
    'receitas_atualizadas', receitas_atualizadas,
    'despesas_atualizadas', despesas_atualizadas
  );
END;
$$;

-- ============================================================
-- 2. TRIGGER: Garantir data_recebimento ao marcar como Recebido
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_receita_data_recebimento()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Se status mudou para Recebido, garantir data_recebimento
  IF NEW.status = 'Recebido' AND NEW.data_recebimento IS NULL THEN
    NEW.data_recebimento := COALESCE(OLD.data_recebimento, NEW.data_vencimento, CURRENT_DATE);
  END IF;

  -- Se status voltou para Pendente, limpar data_recebimento
  IF NEW.status = 'Pendente' AND OLD.status = 'Recebido' THEN
    NEW.data_recebimento := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS receita_enforce_data ON public.receitas;
CREATE TRIGGER receita_enforce_data
  BEFORE UPDATE ON public.receitas
  FOR EACH ROW EXECUTE FUNCTION public.enforce_receita_data_recebimento();

-- ============================================================
-- 3. TRIGGER: Garantir data_pagamento ao marcar despesa como Pago
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_despesa_data_pagamento()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Se status mudou para Pago, garantir data_pagamento
  IF NEW.status = 'Pago' AND NEW.data_pagamento IS NULL THEN
    NEW.data_pagamento := COALESCE(OLD.data_pagamento, NEW.data_vencimento, CURRENT_DATE);
  END IF;

  -- Se status voltou para Pendente, limpar data_pagamento
  IF NEW.status = 'Pendente' AND OLD.status = 'Pago' THEN
    NEW.data_pagamento := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS despesa_enforce_data ON public.despesas;
CREATE TRIGGER despesa_enforce_data
  BEFORE UPDATE ON public.despesas
  FOR EACH ROW EXECUTE FUNCTION public.enforce_despesa_data_pagamento();

-- ============================================================
-- 4. GERAR RECEITA AUTOMÁTICA AO FATURAR MARCO
-- ============================================================

CREATE OR REPLACE FUNCTION public.auto_gerar_receita_from_marco()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_receita_id UUID;
  v_projeto RECORD;
BEGIN
  -- Só roda quando marco muda para "faturado" e não tem receita vinculada
  IF NEW.status = 'faturado' AND (OLD.status IS NULL OR OLD.status != 'faturado') AND NEW.receita_id IS NULL THEN
    -- Busca dados do projeto
    SELECT id, cliente_id, empresa_id INTO v_projeto
    FROM projetos WHERE id = NEW.projeto_id;

    -- Cria receita automaticamente
    INSERT INTO receitas (empresa_id, descricao, valor, data_vencimento, status, projeto_id, cliente_id)
    VALUES (
      NEW.empresa_id,
      'Marco: ' || NEW.nome,
      NEW.valor,
      COALESCE(NEW.data_prevista, CURRENT_DATE),
      'Pendente',
      NEW.projeto_id,
      v_projeto.cliente_id
    )
    RETURNING id INTO v_receita_id;

    -- Vincula receita ao marco
    NEW.receita_id := v_receita_id;
  END IF;

  -- Quando marco é "recebido", atualiza receita para Recebido
  IF NEW.status = 'recebido' AND OLD.status = 'faturado' AND NEW.receita_id IS NOT NULL THEN
    UPDATE receitas SET status = 'Recebido', data_recebimento = CURRENT_DATE
    WHERE id = NEW.receita_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS marco_auto_receita ON public.marcos_faturamento;
CREATE TRIGGER marco_auto_receita
  BEFORE UPDATE ON public.marcos_faturamento
  FOR EACH ROW EXECUTE FUNCTION public.auto_gerar_receita_from_marco();

-- ============================================================
-- 5. ADITIVO APROVADO: Atualizar prazo do projeto + gerar receita
-- ============================================================

CREATE OR REPLACE FUNCTION public.aditivo_aprovado_handler()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_projeto RECORD;
BEGIN
  -- Só roda quando escopo tipo "aditivo" é aprovado
  IF NEW.tipo = 'aditivo' AND NEW.status = 'aprovado' AND (OLD.status IS NULL OR OLD.status != 'aprovado') THEN
    -- Buscar projeto
    SELECT id, data_previsao, cliente_id, empresa_id INTO v_projeto
    FROM projetos WHERE id = NEW.projeto_id;

    -- Atualizar prazo do projeto se há impacto
    IF NEW.impacto_prazo_dias > 0 AND v_projeto.data_previsao IS NOT NULL THEN
      UPDATE projetos
      SET data_previsao = data_previsao + (NEW.impacto_prazo_dias || ' days')::interval
      WHERE id = NEW.projeto_id;
    END IF;

    -- Gerar receita do aditivo se há valor
    IF NEW.valor_aditivo > 0 THEN
      INSERT INTO receitas (empresa_id, descricao, valor, data_vencimento, status, projeto_id, cliente_id)
      VALUES (
        NEW.empresa_id,
        'Aditivo: ' || LEFT(NEW.descricao, 100),
        NEW.valor_aditivo,
        COALESCE(v_projeto.data_previsao, CURRENT_DATE + 30),
        'Pendente',
        NEW.projeto_id,
        v_projeto.cliente_id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS escopo_aditivo_aprovado ON public.escopos;
CREATE TRIGGER escopo_aditivo_aprovado
  BEFORE UPDATE ON public.escopos
  FOR EACH ROW EXECUTE FUNCTION public.aditivo_aprovado_handler();

-- ============================================================
-- 6. RPC: Gerar parcelas de receita a partir de projeto
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_gerar_parcelas_projeto(
  p_projeto_id UUID,
  p_num_parcelas INTEGER DEFAULT 1,
  p_intervalo_dias INTEGER DEFAULT 30
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_projeto RECORD;
  v_valor_parcela NUMERIC;
  v_data_base DATE;
  i INTEGER;
  parcelas_criadas INTEGER := 0;
BEGIN
  -- Busca dados do projeto
  SELECT id, valor_contrato, cliente_id, empresa_id, data_inicio, nome, codigo_projeto
  INTO v_projeto
  FROM projetos
  WHERE id = p_projeto_id AND deleted_at IS NULL;

  IF v_projeto IS NULL THEN
    RAISE EXCEPTION 'Projeto não encontrado';
  END IF;

  IF v_projeto.valor_contrato IS NULL OR v_projeto.valor_contrato <= 0 THEN
    RAISE EXCEPTION 'Projeto sem valor de contrato';
  END IF;

  IF p_num_parcelas < 1 OR p_num_parcelas > 60 THEN
    RAISE EXCEPTION 'Número de parcelas deve ser entre 1 e 60';
  END IF;

  v_valor_parcela := ROUND(v_projeto.valor_contrato / p_num_parcelas, 2);
  v_data_base := COALESCE(v_projeto.data_inicio, CURRENT_DATE);

  FOR i IN 1..p_num_parcelas LOOP
    INSERT INTO receitas (empresa_id, descricao, valor, data_vencimento, status, projeto_id, cliente_id)
    VALUES (
      v_projeto.empresa_id,
      v_projeto.codigo_projeto || ' - Parcela ' || i || '/' || p_num_parcelas,
      v_valor_parcela,
      v_data_base + ((i - 1) * p_intervalo_dias),
      'Pendente',
      p_projeto_id,
      v_projeto.cliente_id
    );
    parcelas_criadas := parcelas_criadas + 1;
  END LOOP;

  -- Ajusta última parcela para fechar o valor exato (evita centavos perdidos)
  IF p_num_parcelas > 1 THEN
    UPDATE receitas
    SET valor = v_projeto.valor_contrato - (v_valor_parcela * (p_num_parcelas - 1))
    WHERE projeto_id = p_projeto_id
      AND descricao LIKE '%Parcela ' || p_num_parcelas || '/' || p_num_parcelas
      AND deleted_at IS NULL;
  END IF;

  RETURN parcelas_criadas;
END;
$$;

-- ============================================================
-- 7. RPC: Gerar alertas financeiros por empresa
-- Versão final com p_empresa_id parameter
-- Detecta: horas excedidas, pagamento atrasado, vencimento próximo,
--          marco próximo, recebimento baixo vs progresso
-- ============================================================

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
      c.nome AS cliente_nome, rv.projeto_id
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
        'Receita de R$ ' || TO_CHAR(r.valor, 'FM999G999D00') || ' vencida em ' || TO_CHAR(r.data_vencimento, 'DD/MM/YYYY'),
        'receita', r.id);
      alert_count := alert_count + 1;
    END IF;
  END LOOP;

  -- 3. Receitas vencendo nos próximos 7 dias (alerta preventivo)
  FOR r IN
    SELECT rv.id, rv.descricao, rv.data_vencimento, rv.valor,
      c.nome AS cliente_nome, p.nome AS projeto_nome
    FROM receitas rv
    LEFT JOIN clientes c ON c.id = rv.cliente_id
    LEFT JOIN projetos p ON p.id = rv.projeto_id
    WHERE rv.empresa_id = p_empresa_id AND rv.deleted_at IS NULL
      AND rv.status = 'Pendente'
      AND rv.data_vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM alertas a
      WHERE a.empresa_id = p_empresa_id AND a.tipo = 'vencimento_proximo'
        AND a.referencia_id = r.id AND a.created_at > NOW() - INTERVAL '7 days'
    ) THEN
      INSERT INTO alertas (empresa_id, tipo, severidade, titulo, mensagem, referencia_tipo, referencia_id)
      VALUES (p_empresa_id, 'vencimento_proximo', 'medium',
        'Vencimento próximo: ' || COALESCE(r.projeto_nome, r.descricao),
        'Receita "' || r.descricao || '" de R$ ' || TO_CHAR(r.valor, 'FM999G999D00') || ' vence em ' || TO_CHAR(r.data_vencimento, 'DD/MM/YYYY'),
        'receita', r.id);
      alert_count := alert_count + 1;
    END IF;
  END LOOP;

  -- 4. Marcos de faturamento pendentes com data prevista nos próximos 7 dias
  FOR r IN
    SELECT mf.id, mf.nome, mf.data_prevista, mf.valor,
      p.nome AS projeto_nome
    FROM marcos_faturamento mf
    JOIN projetos p ON p.id = mf.projeto_id
    WHERE p.empresa_id = p_empresa_id AND mf.deleted_at IS NULL
      AND mf.status = 'pendente'
      AND mf.data_prevista BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM alertas a
      WHERE a.empresa_id = p_empresa_id AND a.tipo = 'marco_proximo'
        AND a.referencia_id = r.id AND a.created_at > NOW() - INTERVAL '7 days'
    ) THEN
      INSERT INTO alertas (empresa_id, tipo, severidade, titulo, mensagem, referencia_tipo, referencia_id)
      VALUES (p_empresa_id, 'marco_proximo', 'medium',
        'Marco próximo: ' || r.projeto_nome,
        'Marco "' || r.nome || '" de R$ ' || TO_CHAR(r.valor, 'FM999G999D00') || ' previsto para ' || TO_CHAR(r.data_prevista, 'DD/MM/YYYY'),
        'marco', r.id);
      alert_count := alert_count + 1;
    END IF;
  END LOOP;

  -- 5. Projetos com recebimento baixo vs progresso das disciplinas
  FOR r IN
    SELECT p.id, p.nome, p.valor_contrato,
      COALESCE((SELECT SUM(rv.valor) FROM receitas rv WHERE rv.projeto_id = p.id AND rv.deleted_at IS NULL AND rv.status IN ('Recebido', 'Pago')), 0) AS recebido,
      COALESCE(p.valor_contrato, 0) AS contrato,
      (SELECT COUNT(*) FILTER (WHERE d.elem->>'status' = 'Concluído') * 100.0 / NULLIF(COUNT(*), 0)
       FROM jsonb_array_elements(p.disciplinas::jsonb) AS d(elem)) AS progresso_pct
    FROM projetos p
    WHERE p.empresa_id = p_empresa_id AND p.deleted_at IS NULL
      AND p.status = 'Em andamento'
      AND p.valor_contrato > 0
      AND jsonb_array_length(COALESCE(p.disciplinas::jsonb, '[]'::jsonb)) > 0
  LOOP
    -- Se progresso > 60% mas recebimento < 30%, alerta
    IF r.progresso_pct IS NOT NULL AND r.progresso_pct > 60
       AND r.contrato > 0 AND (r.recebido / r.contrato) < 0.3 THEN
      IF NOT EXISTS (
        SELECT 1 FROM alertas a
        WHERE a.empresa_id = p_empresa_id AND a.tipo = 'recebimento_baixo'
          AND a.referencia_id = r.id AND a.created_at > NOW() - INTERVAL '14 days'
      ) THEN
        INSERT INTO alertas (empresa_id, tipo, severidade, titulo, mensagem, referencia_tipo, referencia_id)
        VALUES (p_empresa_id, 'recebimento_baixo', 'critical',
          'Recebimento baixo: ' || r.nome,
          'Projeto ' || ROUND(r.progresso_pct::numeric, 0) || '% concluído mas apenas ' || ROUND((r.recebido / r.contrato * 100)::numeric, 0) || '% recebido (R$ ' || TO_CHAR(r.recebido, 'FM999G999D00') || ' de R$ ' || TO_CHAR(r.contrato, 'FM999G999D00') || ')',
          'projeto', r.id);
        alert_count := alert_count + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN alert_count;
END;
$$;

-- ============================================================
-- 8. RPC: Job diário unificado (alertas + status atrasados)
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_daily_maintenance()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_atrasados JSON;
  v_alertas INTEGER;
  v_empresa_id UUID;
BEGIN
  v_empresa_id := public.get_user_empresa_id();
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não associado a uma empresa';
  END IF;

  SELECT rpc_atualizar_status_atrasados() INTO v_atrasados;

  SELECT rpc_gerar_alertas(v_empresa_id) INTO v_alertas;

  UPDATE projetos
  SET updated_at = NOW()
  WHERE empresa_id = v_empresa_id
    AND deleted_at IS NULL
    AND status IN ('Planejamento', 'Em andamento');

  RETURN json_build_object(
    'atrasados', v_atrasados,
    'alertas_gerados', v_alertas
  );
END;
$$;

-- ============================================================
-- 9. INDEXES para consultas financeiras comuns
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_receitas_status ON public.receitas(empresa_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_despesas_status ON public.despesas(empresa_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_receitas_projeto ON public.receitas(projeto_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_despesas_projeto ON public.despesas(projeto_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_receitas_recebimento ON public.receitas(empresa_id, data_recebimento) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_despesas_pagamento ON public.despesas(empresa_id, data_pagamento) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_timesheets_aprovados ON public.timesheets(projeto_id, status) WHERE status = 'aprovado' AND deleted_at IS NULL;
