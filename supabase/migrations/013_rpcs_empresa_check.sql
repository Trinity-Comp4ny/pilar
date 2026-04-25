-- Migration 013: Empresa check em RPCs SECURITY DEFINER
-- RPCs que aceitam p_*_id e operavam no registro sem validar que o caller
-- pertence à mesma empresa do registro. Permitia vandalismo cross-tenant.

-- =============================================
-- 1. update_projeto_completo — adiciona empresa_id check + search_path
-- =============================================

CREATE OR REPLACE FUNCTION public.update_projeto_completo(
  p_projeto_id UUID,
  p_codigo TEXT,
  p_nome TEXT,
  p_cliente_id UUID,
  p_data_inicio DATE DEFAULT NULL,
  p_data_previsao DATE DEFAULT NULL,
  p_data_final DATE DEFAULT NULL,
  p_valor_contrato DECIMAL DEFAULT 0,
  p_observacao TEXT DEFAULT '',
  p_localizacao TEXT DEFAULT '',
  p_parcelas TEXT DEFAULT NULL,
  p_area_m2 NUMERIC DEFAULT 0,
  p_disciplinas JSONB DEFAULT '[]',
  p_status TEXT DEFAULT 'Planejamento',
  p_prioridade TEXT DEFAULT 'Media'
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_caller_empresa_id UUID;
  v_projeto_empresa_id UUID;
BEGIN
  v_user_id := auth.uid();
  v_caller_empresa_id := public.get_user_empresa_id();

  SELECT empresa_id INTO v_projeto_empresa_id
  FROM public.projetos
  WHERE id = p_projeto_id AND deleted_at IS NULL;

  IF v_projeto_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Projeto não encontrado';
  END IF;

  IF v_projeto_empresa_id != v_caller_empresa_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  UPDATE public.projetos SET
    codigo_projeto = p_codigo,
    nome = p_nome,
    cliente_id = p_cliente_id,
    data_inicio = p_data_inicio,
    data_previsao = p_data_previsao,
    data_final = p_data_final,
    valor_contrato = p_valor_contrato,
    observacao = p_observacao,
    localizacao = p_localizacao,
    parcelas = p_parcelas,
    area_m2 = p_area_m2,
    disciplinas = p_disciplinas,
    status = p_status::status_projeto,
    prioridade = p_prioridade,
    updated_by = v_user_id,
    updated_at = now()
  WHERE id = p_projeto_id
    AND empresa_id = v_caller_empresa_id;
END;
$$;

-- Reforça search_path também em create_projeto_completo (estava sem)
CREATE OR REPLACE FUNCTION public.create_projeto_completo(
  p_codigo TEXT,
  p_nome TEXT,
  p_cliente_id UUID,
  p_data_inicio DATE DEFAULT NULL,
  p_data_previsao DATE DEFAULT NULL,
  p_data_final DATE DEFAULT NULL,
  p_valor_contrato DECIMAL DEFAULT 0,
  p_observacao TEXT DEFAULT '',
  p_localizacao TEXT DEFAULT '',
  p_parcelas TEXT DEFAULT NULL,
  p_area_m2 NUMERIC DEFAULT 0,
  p_disciplinas JSONB DEFAULT '[]',
  p_prioridade TEXT DEFAULT 'Media'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id UUID;
  v_user_id UUID;
  v_projeto_id UUID;
BEGIN
  v_user_id := auth.uid();
  SELECT empresa_id INTO v_empresa_id FROM public.profiles WHERE id = v_user_id;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não vinculado a uma empresa';
  END IF;

  INSERT INTO public.projetos (
    empresa_id, codigo_projeto, nome, cliente_id,
    data_inicio, data_previsao, data_final,
    valor_contrato, observacao, localizacao,
    parcelas, area_m2, disciplinas, prioridade,
    created_by, updated_by
  ) VALUES (
    v_empresa_id, p_codigo, p_nome, p_cliente_id,
    p_data_inicio, p_data_previsao, p_data_final,
    p_valor_contrato, p_observacao, p_localizacao,
    p_parcelas, p_area_m2, p_disciplinas, p_prioridade,
    v_user_id, v_user_id
  ) RETURNING id INTO v_projeto_id;

  RETURN v_projeto_id;
END;
$$;

-- =============================================
-- 2. rpc_faturar_marco — adiciona empresa_id check
-- =============================================

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
  v_caller_empresa_id UUID;
BEGIN
  v_caller_empresa_id := public.get_user_empresa_id();

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

  IF v_projeto.empresa_id != v_caller_empresa_id THEN
    RAISE EXCEPTION 'Acesso negado';
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

-- =============================================
-- 3. rpc_gerar_parcelas_projeto — adiciona empresa_id check
-- =============================================

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
  v_caller_empresa_id UUID;
  i INTEGER;
  parcelas_criadas INTEGER := 0;
BEGIN
  v_caller_empresa_id := public.get_user_empresa_id();

  SELECT id, valor_contrato, cliente_id, empresa_id, data_inicio, nome, codigo_projeto
  INTO v_projeto
  FROM projetos
  WHERE id = p_projeto_id AND deleted_at IS NULL;

  IF v_projeto IS NULL THEN
    RAISE EXCEPTION 'Projeto não encontrado';
  END IF;

  IF v_projeto.empresa_id != v_caller_empresa_id THEN
    RAISE EXCEPTION 'Acesso negado';
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

-- =============================================
-- 4. rpc_converter_lead_cliente — adiciona empresa_id check
-- =============================================

CREATE OR REPLACE FUNCTION public.rpc_converter_lead_cliente(p_lead_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead RECORD;
  v_empresa_id UUID;
  v_caller_empresa_id UUID;
  v_cliente_id UUID;
BEGIN
  v_caller_empresa_id := public.get_user_empresa_id();

  SELECT * INTO v_lead FROM leads WHERE id = p_lead_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead não encontrado';
  END IF;

  IF v_lead.empresa_id != v_caller_empresa_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF v_lead.cliente_id IS NOT NULL THEN
    RAISE EXCEPTION 'Lead já foi convertido em cliente';
  END IF;

  v_empresa_id := v_lead.empresa_id;

  INSERT INTO clientes (empresa_id, nome, email, contato, origem)
  VALUES (v_empresa_id, v_lead.nome, v_lead.email, v_lead.contato, v_lead.origem)
  RETURNING id INTO v_cliente_id;

  UPDATE leads
  SET status = 'Ganho',
      cliente_id = v_cliente_id,
      convertido_em = NOW()
  WHERE id = p_lead_id;

  RETURN v_cliente_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_converter_lead_cliente(UUID) TO authenticated;

-- =============================================
-- 5. rpc_converter_proposta_projeto — adiciona empresa_id check
-- =============================================

CREATE OR REPLACE FUNCTION public.rpc_converter_proposta_projeto(p_proposta_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proposta RECORD;
  v_lead RECORD;
  v_empresa_id UUID;
  v_caller_empresa_id UUID;
  v_projeto_id UUID;
  v_cliente_id UUID;
  v_disc RECORD;
  v_disciplinas_json JSONB := '[]'::JSONB;
  v_codigo TEXT;
  v_seq INT;
BEGIN
  v_caller_empresa_id := public.get_user_empresa_id();

  SELECT * INTO v_proposta FROM propostas WHERE id = p_proposta_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposta não encontrada';
  END IF;

  IF v_proposta.empresa_id != v_caller_empresa_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF v_proposta.projeto_id IS NOT NULL THEN
    RAISE EXCEPTION 'Proposta já foi convertida em projeto';
  END IF;

  v_empresa_id := v_proposta.empresa_id;

  IF v_proposta.lead_id IS NOT NULL AND v_proposta.cliente_id IS NULL THEN
    SELECT * INTO v_lead FROM leads WHERE id = v_proposta.lead_id AND deleted_at IS NULL;
    IF FOUND THEN
      IF v_lead.empresa_id != v_caller_empresa_id THEN
        RAISE EXCEPTION 'Acesso negado';
      END IF;

      IF v_lead.cliente_id IS NOT NULL THEN
        v_cliente_id := v_lead.cliente_id;
      ELSE
        INSERT INTO clientes (empresa_id, nome, email, contato, origem)
        VALUES (v_empresa_id, v_lead.nome, v_lead.email, v_lead.contato, v_lead.origem)
        RETURNING id INTO v_cliente_id;

        UPDATE leads
        SET status = 'Ganho',
            cliente_id = v_cliente_id,
            convertido_em = NOW()
        WHERE id = v_proposta.lead_id;
      END IF;

      UPDATE propostas SET cliente_id = v_cliente_id WHERE id = p_proposta_id;
    END IF;
  ELSE
    v_cliente_id := v_proposta.cliente_id;
  END IF;

  SELECT COALESCE(MAX(
    CASE WHEN codigo_projeto ~ '^PRJ-\d+$'
      THEN CAST(SUBSTRING(codigo_projeto FROM 5) AS INT)
      ELSE 0
    END
  ), 0) + 1
  INTO v_seq
  FROM projetos
  WHERE empresa_id = v_empresa_id;

  v_codigo := 'PRJ-' || LPAD(v_seq::TEXT, 4, '0');

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'nome', pd.disciplina,
    'horas_estimadas', pd.horas_estimadas,
    'custo_hora', pd.custo_hora,
    'valor_venda', pd.valor_venda
  )), '[]'::JSONB)
  INTO v_disciplinas_json
  FROM proposta_disciplinas pd
  WHERE pd.proposta_id = p_proposta_id;

  INSERT INTO projetos (
    empresa_id, codigo_projeto, nome, cliente_id, valor_contrato,
    area_m2, localizacao, status, prioridade, disciplinas,
    data_inicio, data_previsao, observacao
  ) VALUES (
    v_empresa_id,
    v_codigo,
    v_proposta.titulo,
    v_cliente_id,
    COALESCE(v_proposta.valor_proposto, 0),
    v_proposta.area_m2,
    v_proposta.localizacao,
    'Planejamento',
    'Media',
    v_disciplinas_json,
    CURRENT_DATE,
    CASE WHEN v_proposta.prazo_estimado_dias IS NOT NULL
      THEN CURRENT_DATE + (v_proposta.prazo_estimado_dias || ' days')::INTERVAL
      ELSE NULL
    END,
    v_proposta.observacao
  )
  RETURNING id INTO v_projeto_id;

  FOR v_disc IN
    SELECT disciplina, horas_estimadas, custo_hora, valor_venda
    FROM proposta_disciplinas
    WHERE proposta_id = p_proposta_id
  LOOP
    INSERT INTO projeto_orcamento_fases (
      empresa_id, projeto_id, disciplina, horas_estimadas, custo_hora, valor_venda, margem_alvo_pct
    ) VALUES (
      v_empresa_id, v_projeto_id, v_disc.disciplina,
      v_disc.horas_estimadas, v_disc.custo_hora, v_disc.valor_venda,
      CASE WHEN v_disc.custo_hora > 0 AND v_disc.horas_estimadas > 0 AND v_disc.valor_venda > 0
        THEN ROUND(((v_disc.valor_venda - (v_disc.horas_estimadas * v_disc.custo_hora)) / v_disc.valor_venda) * 100, 2)
        ELSE 20.0
      END
    );
  END LOOP;

  UPDATE propostas
  SET projeto_id = v_projeto_id,
      status = 'aceita'
  WHERE id = p_proposta_id;

  RETURN v_projeto_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_converter_proposta_projeto(UUID) TO authenticated;

-- =============================================
-- 6. rpc_gerar_alertas — remove p_empresa_id parameter; usa caller
-- =============================================

-- Dropa versão antiga (com parâmetro)
DROP FUNCTION IF EXISTS public.rpc_gerar_alertas(UUID);

CREATE OR REPLACE FUNCTION public.rpc_gerar_alertas()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  alert_count INTEGER := 0;
  p_empresa_id UUID;
  r RECORD;
BEGIN
  p_empresa_id := public.get_user_empresa_id();

  IF p_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa';
  END IF;

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

GRANT EXECUTE ON FUNCTION public.rpc_gerar_alertas() TO authenticated;

-- =============================================
-- 7. rpc_daily_maintenance — atualizar para chamar rpc_gerar_alertas sem parâmetro
-- =============================================

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

  SELECT rpc_gerar_alertas() INTO v_alertas;

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

GRANT EXECUTE ON FUNCTION public.rpc_daily_maintenance() TO authenticated;
