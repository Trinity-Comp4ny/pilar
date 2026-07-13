-- Onda 3 — Conversão proposta→projeto: dois bugs de lógica.
--
-- Bug A: a RPC criava projetos.disciplinas (JSONB deprecado) + projeto_orcamento_fases,
--        mas NUNCA populava projeto_disciplinas (tabela relacional que a UI lê). Resultado:
--        projeto convertido nascia com aba Disciplinas vazia, cronograma vazio, progresso 0%.
-- Bug B: propostas vindas de LEAD (lead_id preenchido, cliente_id NULL) geravam projeto com
--        cliente_id NULL e o lead não era promovido — ficava preso no pipeline.
--
-- Fix A: no mesmo loop de proposta_disciplinas, insere em projeto_disciplinas (nome, horas,
--        custo/hora, ordem_etapa sequencial, status 'Não Iniciado').
-- Fix B: se cliente_id é NULL e há lead_id, promove o lead reusando a RPC canônica
--        rpc_converter_lead_cliente (status→'Ganho', cria cliente, seta convertido_em) e usa
--        o cliente resultante no projeto e na proposta. Idempotente: se o lead já tem cliente,
--        reaproveita esse cliente. Tudo numa transação (rollback total em qualquer falha).

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

  -- Fix B: resolver o cliente. Se a proposta veio de um lead sem cliente, promover o lead.
  v_cliente_id := v_proposta.cliente_id;
  IF v_cliente_id IS NULL AND v_proposta.lead_id IS NOT NULL THEN
    SELECT cliente_id INTO v_lead_cliente_id
    FROM leads WHERE id = v_proposta.lead_id AND deleted_at IS NULL;

    IF v_lead_cliente_id IS NOT NULL THEN
      -- lead já convertido em cliente anteriormente
      v_cliente_id := v_lead_cliente_id;
    ELSIF EXISTS (SELECT 1 FROM leads WHERE id = v_proposta.lead_id AND deleted_at IS NULL) THEN
      -- promove o lead reusando a RPC canônica (marca 'Ganho', cria cliente, convertido_em)
      v_cliente_id := rpc_converter_lead_cliente(v_proposta.lead_id);
    END IF;
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

  -- Montar JSON de disciplinas a partir de proposta_disciplinas (mantém compat com JSONB legado)
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

  -- Criar orcamento por fase E disciplina relacional a partir de proposta_disciplinas
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
      CASE WHEN v_disc.custo_hora > 0 AND v_disc.horas_estimadas > 0 AND v_disc.valor_venda > 0
        THEN ROUND(((v_disc.valor_venda - (v_disc.horas_estimadas * v_disc.custo_hora)) / v_disc.valor_venda) * 100, 2)
        ELSE 20.0
      END
    );

    -- Fix A: popular a tabela relacional que a UI lê (Disciplinas, cronograma, progresso)
    INSERT INTO projeto_disciplinas (
      projeto_id, nome, horas_estimadas, custo_hora, ordem_etapa, status
    ) VALUES (
      v_projeto_id, v_disc.disciplina,
      COALESCE(v_disc.horas_estimadas, 0), COALESCE(v_disc.custo_hora, 0),
      v_ordem, 'Não Iniciado'
    );
  END LOOP;

  -- Atualizar proposta: vincular ao projeto, marcar aceita e refletir o cliente resolvido
  UPDATE propostas
  SET projeto_id = v_projeto_id,
      status = 'aceita',
      cliente_id = v_cliente_id
  WHERE id = p_proposta_id;

  RETURN v_projeto_id;
END;
$function$;
