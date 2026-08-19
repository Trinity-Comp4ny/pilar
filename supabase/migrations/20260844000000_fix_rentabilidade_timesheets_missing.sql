-- Fix: rentabilidade quebrada em produção, "relation timesheets does not exist"
--
-- A tabela timesheets foi derrubada de propósito duas vezes (20260429000001 e
-- 20260429400000, feature de timesheet descontinuada; ver 20260813060000, que
-- criou tarefas.horas_reais como substituto leve e explicitamente NÃO ligado à
-- rentabilidade). Mesmo assim, três funções escritas DEPOIS do drop voltaram a
-- referenciar timesheets, herdando o cálculo antigo do rpc_calcular_wip_custo_real
-- (023) sem notar que a tabela não existe mais:
--   - rpc_dashboard_rentabilidade / rpc_projeto_rentabilidade (20260813000000)
--   - get_projeto_rentabilidade_detalhe (20260825000000)
-- Toda chamada quebrava com "relation timesheets does not exist" (Sentry
-- PILAR-2/PILAR-3/PILAR-7, no dashboard, no detalhe do projeto e em meu-trabalho).
--
-- Fix: mesmo padrão já usado em 20260514100002_budget_vs_actual_view (linha
-- "horas_reais e custo_real estão zerados enquanto timesheet estiver dormente"):
-- zera custo_mao_de_obra/horas_consumidas/custo_mo em vez de fazer a rentabilidade
-- quebrar. Reintroduzir o custo real de mão de obra exige decidir a fonte (tarefas
-- .horas_reais não é isso hoje) e fica para quando o assunto for retomado.

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
      -- timesheet dormente: sem fonte de horas realizadas por ora.
      'horas_consumidas', 0,
      'custo_mao_de_obra', 0
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
    -- timesheet dormente: sem fonte de horas realizadas por ora.
    'horas_consumidas', 0,
    'custo_orcado', COALESCE((
      SELECT SUM(o.horas_estimadas * o.custo_hora) FROM projeto_orcamento_fases o
      WHERE o.projeto_id = p.id AND o.deleted_at IS NULL
    ), 0),
    'custo_mao_de_obra', 0,
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

CREATE OR REPLACE FUNCTION public.get_projeto_rentabilidade_detalhe(p_projeto_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid := public.get_user_empresa_id();
  v_projeto_empresa uuid;
BEGIN
  SELECT empresa_id INTO v_projeto_empresa
  FROM projetos
  WHERE id = p_projeto_id AND deleted_at IS NULL;

  IF v_empresa_id IS NULL OR v_projeto_empresa IS NULL OR v_projeto_empresa <> v_empresa_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN jsonb_build_object(
    'receitas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'descricao', r.descricao,
        'valor', r.valor,
        'status', r.status,
        'data', COALESCE(r.data_recebimento, r.data_vencimento, r.data_competencia)
      ) ORDER BY COALESCE(r.data_recebimento, r.data_vencimento))
      FROM receitas r
      WHERE r.projeto_id = p_projeto_id AND r.deleted_at IS NULL
        AND r.empresa_id = v_empresa_id AND r.status IN ('Recebido', 'Pendente')
    ), '[]'::jsonb),

    'despesas_diretas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'descricao', d.descricao,
        'valor', d.valor,
        'status', d.status,
        'data', COALESCE(d.data_pagamento, d.data_vencimento),
        'fornecedor', f.nome
      ) ORDER BY COALESCE(d.data_pagamento, d.data_vencimento))
      FROM despesas d
      LEFT JOIN fornecedores f ON f.id = d.fornecedor_id
      WHERE d.projeto_id = p_projeto_id AND d.deleted_at IS NULL
        AND d.empresa_id = v_empresa_id AND d.status IN ('Pago', 'Pendente')
    ), '[]'::jsonb),

    -- timesheet dormente: sem fonte de horas realizadas por ora (ver rpc_dashboard_rentabilidade).
    'custo_mo', '[]'::jsonb,

    'parcelas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'descricao', m.nome,
        'valor', m.valor,
        'status', m.status,
        'percentual', m.percentual,
        'data', COALESCE(m.data_faturada, m.data_prevista)
      ) ORDER BY m.data_prevista)
      FROM marcos_faturamento m
      WHERE m.projeto_id = p_projeto_id AND m.deleted_at IS NULL
        AND m.empresa_id = v_empresa_id
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_projeto_rentabilidade_detalhe(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_projeto_rentabilidade_detalhe(uuid) TO authenticated;
