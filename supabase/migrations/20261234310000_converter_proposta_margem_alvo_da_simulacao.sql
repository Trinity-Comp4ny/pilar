-- SPEC 168 (fase 5): a margem-alvo negociada na proposta passa a ser a margem-alvo do orçamento
-- do projeto (projeto_orcamento_fases.margem_alvo_pct), para o guardião e a rentabilidade
-- compararem o real com o que foi prometido. Sem simulação, mantém a margem calculada por linha.
--
-- Esta versão parte da 20260835000000 (que tem a checagem de tenant) e RESTAURA os fixes A e B
-- da 20260713020000, que a 20260835 sobrescreveu sem querer (conferido em staging: a função
-- vigente não popula projeto_disciplinas nem promove o lead):
--   A: popula projeto_disciplinas (aba Disciplinas, cronograma e progresso do projeto novo);
--   B: proposta vinda de lead sem cliente promove o lead via rpc_converter_lead_cliente.
-- Mesma assinatura: CREATE OR REPLACE mantém os grants (authenticated, service_role).

CREATE OR REPLACE FUNCTION public.rpc_converter_proposta_projeto(p_proposta_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_proposta RECORD;
  v_empresa_id UUID;
  v_projeto_id UUID;
  v_cliente_id UUID;
  v_lead_cliente_id UUID;
  v_disc RECORD;
  v_disciplinas_json JSONB := '[]'::JSONB;
  v_codigo TEXT;
  v_seq INT;
  v_ordem INT := 0;
  v_caller_empresa_id UUID;
  v_margem_alvo NUMERIC;
BEGIN
  v_caller_empresa_id := public.get_user_empresa_id();

  IF v_caller_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

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

  -- Margem-alvo da simulação (SPEC 168). Valor inválido ou fora de 0..99 é ignorado.
  v_margem_alvo := NULL;
  IF jsonb_typeof(v_proposta.dados_simulacao) = 'object'
     AND jsonb_typeof(v_proposta.dados_simulacao -> 'margemAlvoPct') = 'number' THEN
    v_margem_alvo := (v_proposta.dados_simulacao ->> 'margemAlvoPct')::NUMERIC;
    IF v_margem_alvo < 0 OR v_margem_alvo >= 100 THEN
      v_margem_alvo := NULL;
    END IF;
  END IF;

  -- Fix B: resolver o cliente; proposta de lead sem cliente promove o lead.
  v_cliente_id := v_proposta.cliente_id;
  IF v_cliente_id IS NULL AND v_proposta.lead_id IS NOT NULL THEN
    SELECT cliente_id INTO v_lead_cliente_id
    FROM leads WHERE id = v_proposta.lead_id AND deleted_at IS NULL;

    IF v_lead_cliente_id IS NOT NULL THEN
      v_cliente_id := v_lead_cliente_id;
    ELSIF EXISTS (SELECT 1 FROM leads WHERE id = v_proposta.lead_id AND deleted_at IS NULL) THEN
      v_cliente_id := rpc_converter_lead_cliente(v_proposta.lead_id);
    END IF;
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
    ORDER BY created_at
  LOOP
    v_ordem := v_ordem + 1;

    INSERT INTO projeto_orcamento_fases (
      empresa_id, projeto_id, disciplina, horas_estimadas, custo_hora, valor_venda, margem_alvo_pct
    ) VALUES (
      v_empresa_id, v_projeto_id, v_disc.disciplina,
      v_disc.horas_estimadas, v_disc.custo_hora, v_disc.valor_venda,
      COALESCE(
        v_margem_alvo,
        CASE WHEN v_disc.custo_hora > 0 AND v_disc.horas_estimadas > 0 AND v_disc.valor_venda > 0
          THEN ROUND(((v_disc.valor_venda - (v_disc.horas_estimadas * v_disc.custo_hora)) / v_disc.valor_venda) * 100, 2)
          ELSE 20.0
        END
      )
    );

    -- Fix A
    INSERT INTO projeto_disciplinas (
      projeto_id, nome, horas_estimadas, custo_hora, ordem_etapa, status
    ) VALUES (
      v_projeto_id, v_disc.disciplina,
      COALESCE(v_disc.horas_estimadas, 0), COALESCE(v_disc.custo_hora, 0),
      v_ordem, 'Não Iniciado'
    );
  END LOOP;

  UPDATE propostas
  SET projeto_id = v_projeto_id,
      status = 'aceita',
      cliente_id = v_cliente_id
  WHERE id = p_proposta_id;

  RETURN v_projeto_id;
END;
$function$;
