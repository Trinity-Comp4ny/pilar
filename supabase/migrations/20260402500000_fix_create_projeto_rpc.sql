-- Fix: create_projeto_completo referenciava user_profiles (tabela inexistente)
-- Corrigido para usar profiles

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
LANGUAGE plpgsql SECURITY DEFINER
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
