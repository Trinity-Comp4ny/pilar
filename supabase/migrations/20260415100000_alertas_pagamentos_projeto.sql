-- ==============================================================================
-- Migration: Alertas aprimorados para pagamentos por projeto
-- Adiciona detecção de:
--   1. Pagamentos vencendo nos próximos 7 dias (vencimento_proximo)
--   2. Marcos de faturamento próximos do vencimento (marco_proximo)
--   3. Projetos com % recebimento baixo vs progresso (recebimento_baixo)
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
