-- Função mínima para isolar o problema
CREATE OR REPLACE FUNCTION "public"."portal_get_projeto_full"(
  "p_projeto_id" uuid,
  "p_token"      text
)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cliente_id uuid;
  v_empresa_id uuid;
  v_projeto_id uuid;
BEGIN
  SELECT cpa.cliente_id, cpa.empresa_id
  INTO v_cliente_id, v_empresa_id
  FROM cliente_portal_accounts cpa
  WHERE cpa.token_sessao = p_token
    AND cpa.token_expira_em > NOW()
    AND cpa.ativo = true;

  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida';
  END IF;

  -- Apenas verifica se projeto existe sem o filtro de cliente/empresa
  SELECT p.id INTO v_projeto_id
  FROM projetos p
  WHERE p.id = p_projeto_id AND p.deleted_at IS NULL;

  IF v_projeto_id IS NULL THEN
    RAISE EXCEPTION 'Projeto não existe no DB';
  END IF;

  -- Verifica com filtro completo
  SELECT p.id INTO v_projeto_id
  FROM projetos p
  WHERE p.id = p_projeto_id
    AND p.cliente_id = v_cliente_id
    AND p.empresa_id = v_empresa_id
    AND p.deleted_at IS NULL;

  RETURN json_build_object(
    'debug_cliente_id', v_cliente_id,
    'debug_empresa_id', v_empresa_id,
    'debug_projeto_found', v_projeto_id IS NOT NULL,
    'p_projeto_id', p_projeto_id
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
