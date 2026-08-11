-- Rentabilidade: fechar mão de obra no cálculo (custo direto)
--
-- Até aqui a rentabilidade só considerava despesas diretas (tabela despesas).
-- As horas de timesheet entravam apenas como métrica de utilização, nunca como
-- custo em R$, então o índice de margem subestimava o custo do projeto.
--
-- Esta migration reintroduz o custo REALIZADO de mão de obra nas duas RPCs de
-- rentabilidade, expondo uma nova chave `custo_mao_de_obra`. O cálculo é o mesmo
-- do rpc_calcular_wip original (023), que foi revertido depois por 028 e pelo
-- dump remoto:
--   custo = Σ horas_aprovadas × custo/hora da pessoa
--   custo/hora da pessoa = salario_fixo / (horas_semanais × 4.33)
--   fallback = custo/hora médio do orçamento do projeto, quando a pessoa não tem
--              salário cadastrado ou o timesheet não tem pessoa vinculada.
--
-- Só timesheets com status 'aprovado' entram, para não contar hora não validada.
-- Como o retorno continua sendo json, o types.ts gerado não muda.

CREATE OR REPLACE FUNCTION "public"."rpc_dashboard_rentabilidade"() RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  result JSON;
  v_empresa_id UUID;
BEGIN
  v_empresa_id := public.get_user_empresa_id();

  SELECT json_agg(proj_data) INTO result
  FROM (
    SELECT json_build_object(
      'projeto_id', p.id,
      'projeto_nome', p.nome,
      'codigo_projeto', p.codigo_projeto,
      'status', p.status,
      'valor_contrato', COALESCE(p.valor_contrato, 0),
      'receitas_total', COALESCE((
        SELECT SUM(r.valor) FROM receitas r
        WHERE r.projeto_id = p.id AND r.deleted_at IS NULL AND r.status IN ('Recebido', 'Pendente')
      ), 0),
      'receitas_recebidas', COALESCE((
        SELECT SUM(r.valor) FROM receitas r
        WHERE r.projeto_id = p.id AND r.deleted_at IS NULL AND r.status = 'Recebido'
      ), 0),
      'despesas_diretas', COALESCE((
        SELECT SUM(d.valor) FROM despesas d
        WHERE d.projeto_id = p.id AND d.deleted_at IS NULL AND d.status IN ('Pago', 'Pendente')
      ), 0),
      'horas_orcadas', COALESCE((
        SELECT SUM(o.horas_estimadas) FROM projeto_orcamento_fases o
        WHERE o.projeto_id = p.id AND o.deleted_at IS NULL
      ), 0),
      'horas_consumidas', COALESCE((
        SELECT SUM(t.horas) FROM timesheets t
        WHERE t.projeto_id = p.id AND t.deleted_at IS NULL AND t.status = 'aprovado'
      ), 0),
      'custo_mao_de_obra', COALESCE((
        SELECT SUM(
          t.horas * COALESCE(
            CASE
              WHEN pe.salario_fixo IS NOT NULL
                AND pe.salario_fixo > 0
                AND COALESCE(pe.horas_semanais, 40) > 0
              THEN pe.salario_fixo / (COALESCE(pe.horas_semanais, 40) * 4.33)
              ELSE NULL
            END,
            (
              SELECT CASE WHEN SUM(o2.horas_estimadas) > 0
                THEN SUM(o2.horas_estimadas * o2.custo_hora) / SUM(o2.horas_estimadas)
                ELSE 0
              END
              FROM projeto_orcamento_fases o2
              WHERE o2.projeto_id = p.id AND o2.deleted_at IS NULL
            )
          )
        )
        FROM timesheets t
        LEFT JOIN pessoas pe
          ON pe.id = t.pessoa_id
          AND pe.empresa_id = v_empresa_id
          AND pe.deleted_at IS NULL
        WHERE t.projeto_id = p.id
          AND t.empresa_id = v_empresa_id
          AND t.status = 'aprovado'
          AND t.deleted_at IS NULL
      ), 0)
    ) AS proj_data
    FROM projetos p
    WHERE p.empresa_id = v_empresa_id
      AND p.deleted_at IS NULL
      AND p.status IN ('Planejamento', 'Em andamento', 'Concluído')
    ORDER BY p.created_at DESC
  ) sub;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

CREATE OR REPLACE FUNCTION "public"."rpc_projeto_rentabilidade"("p_projeto_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  result JSON;
  v_empresa_id UUID;
BEGIN
  v_empresa_id := public.get_user_empresa_id();

  SELECT json_build_object(
    'projeto_id', p.id,
    'projeto_nome', p.nome,
    'valor_contrato', COALESCE(p.valor_contrato, 0),
    'custo_indireto_pct', COALESCE(p.custo_indireto_pct, 15.0),
    'receitas_total', COALESCE((
      SELECT SUM(r.valor) FROM receitas r
      WHERE r.projeto_id = p.id AND r.deleted_at IS NULL AND r.status IN ('Recebido', 'Pendente')
    ), 0),
    'receitas_recebidas', COALESCE((
      SELECT SUM(r.valor) FROM receitas r
      WHERE r.projeto_id = p.id AND r.deleted_at IS NULL AND r.status = 'Recebido'
    ), 0),
    'despesas_diretas', COALESCE((
      SELECT SUM(d.valor) FROM despesas d
      WHERE d.projeto_id = p.id AND d.deleted_at IS NULL AND d.status IN ('Pago', 'Pendente')
    ), 0),
    'horas_orcadas', COALESCE((
      SELECT SUM(o.horas_estimadas) FROM projeto_orcamento_fases o
      WHERE o.projeto_id = p.id AND o.deleted_at IS NULL
    ), 0),
    'horas_consumidas', COALESCE((
      SELECT SUM(t.horas) FROM timesheets t
      WHERE t.projeto_id = p.id AND t.deleted_at IS NULL AND t.status = 'aprovado'
    ), 0),
    'custo_orcado', COALESCE((
      SELECT SUM(o.horas_estimadas * o.custo_hora) FROM projeto_orcamento_fases o
      WHERE o.projeto_id = p.id AND o.deleted_at IS NULL
    ), 0),
    'custo_mao_de_obra', COALESCE((
      SELECT SUM(
        t.horas * COALESCE(
          CASE
            WHEN pe.salario_fixo IS NOT NULL
              AND pe.salario_fixo > 0
              AND COALESCE(pe.horas_semanais, 40) > 0
            THEN pe.salario_fixo / (COALESCE(pe.horas_semanais, 40) * 4.33)
            ELSE NULL
          END,
          (
            SELECT CASE WHEN SUM(o2.horas_estimadas) > 0
              THEN SUM(o2.horas_estimadas * o2.custo_hora) / SUM(o2.horas_estimadas)
              ELSE 0
            END
            FROM projeto_orcamento_fases o2
            WHERE o2.projeto_id = p.id AND o2.deleted_at IS NULL
          )
        )
      )
      FROM timesheets t
      LEFT JOIN pessoas pe
        ON pe.id = t.pessoa_id
        AND pe.empresa_id = v_empresa_id
        AND pe.deleted_at IS NULL
      WHERE t.projeto_id = p.id
        AND t.empresa_id = v_empresa_id
        AND t.status = 'aprovado'
        AND t.deleted_at IS NULL
    ), 0),
    'marcos_total', (
      SELECT COUNT(*) FROM marcos_faturamento m
      WHERE m.projeto_id = p.id AND m.deleted_at IS NULL
    ),
    'marcos_faturados', (
      SELECT COUNT(*) FROM marcos_faturamento m
      WHERE m.projeto_id = p.id AND m.deleted_at IS NULL AND m.status IN ('faturado', 'recebido')
    )
  ) INTO result
  FROM projetos p
  WHERE p.id = p_projeto_id AND p.empresa_id = v_empresa_id AND p.deleted_at IS NULL;

  RETURN result;
END;
$$;

-- Grants (padrão do repo)
GRANT ALL ON FUNCTION "public"."rpc_dashboard_rentabilidade"() TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_dashboard_rentabilidade"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_dashboard_rentabilidade"() TO "service_role";
GRANT ALL ON FUNCTION "public"."rpc_projeto_rentabilidade"("uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_projeto_rentabilidade"("uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_projeto_rentabilidade"("uuid") TO "service_role";
