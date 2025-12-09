
CREATE OR REPLACE FUNCTION public.create_projeto_completo(
  p_codigo TEXT,
  p_nome TEXT,
  p_cliente_id UUID,
  p_data_inicio DATE,
  p_data_previsao DATE,
  p_data_final DATE,
  p_valor_contrato DECIMAL,
  p_observacao TEXT,
  p_localizacao TEXT,
  p_parcelas TEXT,
  p_responsaveis JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_projeto_id UUID;
  v_empresa_id UUID;
  v_resp JSONB;
BEGIN
  -- Get empresa_id from current user
  v_empresa_id := public.get_user_empresa_id();
  
  -- Insert Projeto
  INSERT INTO public.projetos (
    empresa_id, codigo_projeto, nome, cliente_id, data_inicio, data_previsao, data_final, 
    valor_contrato, observacao, localizacao, parcelas, status
  ) VALUES (
    v_empresa_id, p_codigo, p_nome, p_cliente_id, p_data_inicio, p_data_previsao, p_data_final, 
    p_valor_contrato, p_observacao, p_localizacao, p_parcelas, 'Planejamento'
  )
  RETURNING id INTO v_projeto_id;

  -- Insert Responsaveis
  IF p_responsaveis IS NOT NULL AND jsonb_array_length(p_responsaveis) > 0 THEN
    FOR v_resp IN SELECT * FROM jsonb_array_elements(p_responsaveis)
    LOOP
      INSERT INTO public.projetos_responsaveis (
        empresa_id, projeto_id, pessoa_id, responsabilidade
      ) VALUES (
        v_empresa_id, v_projeto_id, (v_resp->>'pessoa_id')::UUID, v_resp->>'responsabilidade'
      );
    END LOOP;
  END IF;

  RETURN v_projeto_id;
END;
$$;
