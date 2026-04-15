-- Fix: gerar codigo_projeto sequencial único por empresa ao converter proposta
-- Evita "duplicate key value violates unique constraint projetos_unique_empresa_codigo"

CREATE OR REPLACE FUNCTION public.rpc_converter_proposta_projeto(p_proposta_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proposta RECORD;
  v_empresa_id UUID;
  v_projeto_id UUID;
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
    v_proposta.cliente_id,
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
