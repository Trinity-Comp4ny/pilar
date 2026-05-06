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
  result       json;
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

  SELECT json_build_object(
    'projeto_id',              p.id,
    'cliente_id',              p.cliente_id,
    'empresa_id',              p.empresa_id,
    'projeto_nome',            p.nome,
    'projeto_status',          p.status,
    'projeto_codigo',          p.codigo_projeto,
    'data_inicio',             p.data_inicio,
    'data_previsao',           p.data_previsao,
    'data_final',              p.data_final,
    'valor_contrato',          p.valor_contrato,
    'cliente_nome',            c.nome,
    'empresa_nome',            e.nome,
    'disciplinas', COALESCE(
      (SELECT json_agg(
         json_build_object(
           'disciplina',       pd.nome,
           'status',           pd.status,
           'data_inicio',      pd.data_inicio,
           'data_previsao',    pd.data_fim,
           'data_final',       pd.data_fim_real,
           'responsavel_nome', (
             SELECT string_agg(ps.nome, ', ')
             FROM projeto_disciplina_responsaveis pdr
             JOIN pessoas ps ON ps.id = pdr.pessoa_id
             WHERE pdr.projeto_disciplina_id = pd.id
           )
         ) ORDER BY pd.created_at
       )
       FROM projeto_disciplinas pd
       WHERE pd.projeto_id = p.id),
      '[]'::json
    ),
    'receitas', COALESCE(
      (SELECT json_agg(
         json_build_object(
           'id',               r.id,
           'descricao',        r.descricao,
           'valor',            r.valor,
           'data_vencimento',  r.data_vencimento,
           'data_recebimento', r.data_recebimento,
           'status',           r.status
         ) ORDER BY r.data_vencimento ASC NULLS LAST
       )
       FROM receitas r
       WHERE r.projeto_id = p.id
         AND r.deleted_at IS NULL),
      '[]'::json
    ),
    'portal_entregas_pendentes', (
      SELECT COUNT(*)::int
      FROM portal_entregas pent
      WHERE pent.projeto_id = p.id
        AND pent.status = 'pendente'
    )
  ) INTO result
  FROM projetos p
  JOIN clientes c ON c.id = p.cliente_id
  JOIN empresas e ON e.id = p.empresa_id
  WHERE p.id = p_projeto_id
    AND p.cliente_id = v_cliente_id
    AND p.empresa_id = v_empresa_id
    AND p.deleted_at IS NULL;

  IF result IS NULL THEN
    RAISE EXCEPTION 'Projeto não encontrado';
  END IF;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION "public"."portal_get_projeto_full"(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION "public"."portal_get_projeto_full"(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION "public"."portal_get_projeto_full"(uuid, text) TO service_role;

NOTIFY pgrst, 'reload schema';
