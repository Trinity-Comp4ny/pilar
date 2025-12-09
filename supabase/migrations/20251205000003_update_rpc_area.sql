CREATE OR REPLACE FUNCTION public.create_projeto_completo(
  p_codigo TEXT,
  p_nome TEXT,
  p_cliente_id UUID,
  p_data_inicio DATE,
  p_data_previsao DATE,
  p_data_final DATE,
  p_valor_contrato NUMERIC,
  p_observacao TEXT,
  p_localizacao TEXT,
  p_parcelas TEXT,
  p_area_m2 NUMERIC, -- Added parameter
  p_responsaveis JSONB
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_projeto_id UUID;
  v_empresa_id UUID;
  v_resp JSONB;
BEGIN
  -- Get empresa_id from current user's metadata or profile (Assuming single tenant or derived from auth)
  -- For now, we will try to get it from the client_id's company or just set it to a default if your schema uses it.
  -- Checking the schema provided in previous turns, 'projetos' has 'user_id' usually set to auth.uid() by RLS or default.
  -- But here we are inserting directly.
  
  -- Insert Project
  INSERT INTO public.projetos (
    codigo_projeto, nome, cliente_id, data_inicio, data_previsao, 
    data_final, valor_contrato, observacao, localizacao, parcelas, area_m2, status
  ) VALUES (
    p_codigo, p_nome, p_cliente_id, p_data_inicio, p_data_previsao, 
    p_data_final, p_valor_contrato, p_observacao, p_localizacao, p_parcelas, p_area_m2, 'Planejamento'
  )
  RETURNING id INTO v_projeto_id;

  -- Insert Responsaveis
  IF p_responsaveis IS NOT NULL AND jsonb_array_length(p_responsaveis) > 0 THEN
    FOR v_resp IN SELECT * FROM jsonb_array_elements(p_responsaveis)
    LOOP
      INSERT INTO public.projetos_responsaveis (
        projeto_id, pessoa_id, responsabilidade
      ) VALUES (
        v_projeto_id, (v_resp->>'pessoa_id')::UUID, v_resp->>'responsabilidade'
      );
    END LOOP;
  END IF;

  RETURN v_projeto_id;
END;
$$;
