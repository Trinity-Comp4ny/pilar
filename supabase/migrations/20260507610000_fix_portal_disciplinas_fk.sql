CREATE OR REPLACE FUNCTION "public"."portal_get_projeto_disciplinas"(
  "p_token"      text,
  "p_projeto_id" uuid
)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cliente_id uuid;
  v_empresa_id uuid;
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

  IF NOT EXISTS (
    SELECT 1 FROM projetos p
    WHERE p.id = p_projeto_id
      AND p.cliente_id = v_cliente_id
      AND p.empresa_id = v_empresa_id
      AND p.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Projeto não encontrado';
  END IF;

  RETURN (
    SELECT COALESCE(json_agg(
      json_build_object(
        'disciplina',      pd.nome,
        'status',          pd.status,
        'data_inicio',     pd.data_inicio,
        'data_previsao',   pd.data_fim,
        'data_final',      pd.data_fim_real,
        'responsavel_nome', (
          SELECT string_agg(pe.nome, ', ')
          FROM projeto_disciplina_responsaveis pdr
          JOIN pessoas pe ON pe.id = pdr.pessoa_id
          WHERE pdr.projeto_disciplina_id = pd.id
        )
      )
      ORDER BY pd.created_at
    ), '[]'::json)
    FROM projeto_disciplinas pd
    WHERE pd.projeto_id = p_projeto_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION "public"."portal_get_projeto_disciplinas"(text, uuid) TO anon;
GRANT EXECUTE ON FUNCTION "public"."portal_get_projeto_disciplinas"(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION "public"."portal_get_projeto_disciplinas"(text, uuid) TO service_role;
