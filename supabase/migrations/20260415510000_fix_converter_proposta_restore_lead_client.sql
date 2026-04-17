-- Fix: restaurar lógica de criação automática de cliente a partir do lead
-- A migration 20260415200000 corrigiu o código único mas perdeu a lógica lead→client
-- Esta migration combina ambas as correções

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
  v_projeto_id UUID;
  v_cliente_id UUID;
  v_disc RECORD;
  v_disciplinas_json JSONB := '[]'::JSONB;
  v_codigo TEXT;
  v_seq INT;
BEGIN
  -- Buscar proposta
  SELECT * INTO v_proposta FROM propostas WHERE id = p_proposta_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposta não encontrada';
  END IF;

  IF v_proposta.projeto_id IS NOT NULL THEN
    RAISE EXCEPTION 'Proposta já foi convertida em projeto';
  END IF;

  v_empresa_id := v_proposta.empresa_id;

  -- Se proposta tem lead_id e não tem cliente_id, criar cliente automaticamente
  IF v_proposta.lead_id IS NOT NULL AND v_proposta.cliente_id IS NULL THEN
    SELECT * INTO v_lead FROM leads WHERE id = v_proposta.lead_id AND deleted_at IS NULL;
    IF FOUND THEN
      -- Verificar se lead já tem cliente_id (já foi convertido antes)
      IF v_lead.cliente_id IS NOT NULL THEN
        v_cliente_id := v_lead.cliente_id;
      ELSE
        -- Criar cliente a partir do lead
        INSERT INTO clientes (empresa_id, nome, email, contato, origem)
        VALUES (v_empresa_id, v_lead.nome, v_lead.email, v_lead.contato, v_lead.origem)
        RETURNING id INTO v_cliente_id;

        -- Atualizar lead
        UPDATE leads
        SET status = 'Ganho',
            cliente_id = v_cliente_id,
            convertido_em = NOW()
        WHERE id = v_proposta.lead_id;
      END IF;

      -- Vincular cliente à proposta
      UPDATE propostas SET cliente_id = v_cliente_id WHERE id = p_proposta_id;
    END IF;
  ELSE
    v_cliente_id := v_proposta.cliente_id;
  END IF;

  -- Gerar codigo sequencial único por empresa
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

  -- Montar JSON de disciplinas a partir de proposta_disciplinas
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'nome', pd.disciplina,
    'horas_estimadas', pd.horas_estimadas,
    'custo_hora', pd.custo_hora,
    'valor_venda', pd.valor_venda
  )), '[]'::JSONB)
  INTO v_disciplinas_json
  FROM proposta_disciplinas pd
  WHERE pd.proposta_id = p_proposta_id;

  -- Criar projeto
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

  -- Criar orcamento por fase/disciplina a partir de proposta_disciplinas
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

  -- Atualizar proposta: vincular ao projeto e marcar como aceita
  UPDATE propostas
  SET projeto_id = v_projeto_id,
      status = 'aceita'
  WHERE id = p_proposta_id;

  RETURN v_projeto_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_converter_proposta_projeto(UUID) TO authenticated;
