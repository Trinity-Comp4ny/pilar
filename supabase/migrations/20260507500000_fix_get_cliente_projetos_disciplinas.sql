-- projetos.disciplinas é coluna DEPRECATED (JSON legado).
-- Disciplinas reais estão em projeto_disciplinas. Atualiza a função do portal.
CREATE OR REPLACE FUNCTION "public"."get_cliente_projetos"("p_token" "text" DEFAULT NULL::"text")
RETURNS SETOF json
LANGUAGE "plpgsql" SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
DECLARE
  v_cliente_id UUID;
  v_empresa_id UUID;
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

  RETURN QUERY
  SELECT json_build_object(
    'projeto_id',    p.id,
    'projeto_nome',  p.nome,
    'projeto_codigo', p.codigo_projeto,
    'projeto_status', p.status,
    'data_inicio',   p.data_inicio,
    'data_previsao', p.data_previsao,
    'valor_contrato', p.valor_contrato,
    'empresa_nome',  e.nome,
    'disciplinas', COALESCE(
      (
        SELECT json_agg(json_build_object(
          'disciplina', pd.nome,
          'status',     pd.status
        ))
        FROM projeto_disciplinas pd
        WHERE pd.projeto_id = p.id
      ),
      '[]'::json
    )
  )
  FROM projetos p
  JOIN empresas e ON e.id = p.empresa_id
  WHERE p.cliente_id = v_cliente_id
    AND p.empresa_id = v_empresa_id
    AND p.deleted_at IS NULL
  ORDER BY
    CASE p.status
      WHEN 'Em andamento' THEN 1
      WHEN 'Revisão'      THEN 2
      WHEN 'Planejamento' THEN 3
      WHEN 'Paralisado'   THEN 4
      WHEN 'Concluído'    THEN 5
      WHEN 'Cancelado'    THEN 6
    END,
    p.created_at DESC;
END;
$$;
