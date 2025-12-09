-- Atualiza a função create_projeto_completo para usar a nova coluna disciplinas
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
  p_area_m2 NUMERIC,
  p_disciplinas JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_projeto_id UUID;
  v_empresa_id UUID;
BEGIN
  -- Get empresa_id from current user
  v_empresa_id := public.get_user_empresa_id();
  
  -- Insert Projeto com disciplinas
  INSERT INTO public.projetos (
    empresa_id, codigo_projeto, nome, cliente_id, data_inicio, data_previsao, data_final, 
    valor_contrato, observacao, localizacao, parcelas, area_m2, disciplinas, status
  ) VALUES (
    v_empresa_id, p_codigo, p_nome, p_cliente_id, p_data_inicio, p_data_previsao, p_data_final, 
    p_valor_contrato, p_observacao, p_localizacao, p_parcelas, p_area_m2, 
    COALESCE(p_disciplinas, '[]'::jsonb), 'Planejamento'
  )
  RETURNING id INTO v_projeto_id;

  RETURN v_projeto_id;
END;
$$;
