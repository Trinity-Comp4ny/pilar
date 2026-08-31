-- SPEC 073 / ADR 0034: fase 9, varredura final. Partindo das ~55 RPCs que o
-- app de verdade chama (grep de `.rpc("..."` fora de src/pages/cliente, que
-- é autorização separada via cliente_portal_accounts), achei mais 9 funções
-- SECURITY DEFINER que bypassam RLS e escrevem/leem dado financeiro sem
-- nenhum gate — mesma classe dos achados anteriores desta sessão, cada uma
-- descoberta e corrigida em sequência conforme a varredura avançava.
--
-- Não é regressão desta spec: nenhuma delas jamais chamou
-- user_has_feature('financeiro', ...) nem qualquer helper de sigilo, desde
-- a migration que as criou. O grep de fechamento da SPEC 073 não pega essa
-- classe porque procura uso do helper ERRADO, não ausência de gate.
--
-- Fora desta migration, de propósito: rpc_calcular_wip (028) referencia a
-- tabela `timesheets`, dropada em 20260429000001/20260429400000 — já quebra
-- com "relation timesheets does not exist" antes de chegar em qualquer
-- dado, não é um vazamento vivo. rpc_excluir_projeto/rpc_restaurar_projeto
-- usam user_has_feature('projetos','editor'), fora do escopo financeiro
-- (excluir um projeto não expõe valor, só marca deleted_at).

-- ----------------------------- get_folha_preview -----------------------------
-- Prévia de folha (salário/valor_m2/total_receber por pessoa, mês/ano
-- qualquer). É folha, não financeiro geral: can_view_folha().
CREATE OR REPLACE FUNCTION public.get_folha_preview(p_mes integer, p_ano integer)
 RETURNS TABLE(
   pessoa_id uuid,
   nome text,
   cargo text,
   salario_fixo numeric,
   valor_m2 numeric,
   total_area numeric,
   total_variavel numeric,
   total_receber numeric,
   projetos_nomes text[],
   detalhe_projetos jsonb
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa_id UUID;
BEGIN
  IF NOT public.can_view_folha() THEN
    RAISE EXCEPTION 'Sem permissão para ver a folha';
  END IF;

  v_empresa_id := public.get_user_empresa_id();

  RETURN QUERY
  WITH projetos_periodo AS (
    SELECT
      pr.id,
      pr.nome as projeto_nome,
      pr.area_m2,
      pr.disciplinas
    FROM public.projetos pr
    WHERE pr.empresa_id = v_empresa_id
    AND EXTRACT(MONTH FROM pr.data_inicio) = p_mes
    AND EXTRACT(YEAR FROM pr.data_inicio) = p_ano
  ),
  calculo_por_pessoa AS (
    SELECT
      pe.id as p_id,
      pe.nome as p_nome,
      pe.cargo as p_cargo,
      COALESCE(pe.salario_fixo, 0) as p_salario_fixo,
      COALESCE(pe.valor_m2, 0) as p_valor_m2,
      COALESCE(SUM(pp.area_m2) FILTER (WHERE pp.id IS NOT NULL), 0) as soma_area,
      array_agg(pp.projeto_nome) FILTER (WHERE pp.id IS NOT NULL) as lista_projetos,
      jsonb_agg(
        jsonb_build_object('nome', pp.projeto_nome, 'area_m2', COALESCE(pp.area_m2, 0))
      ) FILTER (WHERE pp.id IS NOT NULL) as detalhe
    FROM public.pessoas pe
    LEFT JOIN projetos_periodo pp ON EXISTS (
      SELECT 1
      FROM jsonb_array_elements(pp.disciplinas) as d
      WHERE NULLIF(d->>'responsavel_id', '')::uuid = pe.id
    )
    WHERE pe.empresa_id = v_empresa_id
      AND pe.deleted_at IS NULL
      AND pe.status = 'ativo'
    GROUP BY pe.id
  )
  SELECT
    c.p_id,
    c.p_nome,
    c.p_cargo,
    c.p_salario_fixo,
    c.p_valor_m2,
    c.soma_area,
    (c.soma_area * c.p_valor_m2)::DECIMAL(10,2) as v_variavel,
    (c.p_salario_fixo + (c.soma_area * c.p_valor_m2))::DECIMAL(10,2) as v_total,
    COALESCE(c.lista_projetos, ARRAY[]::TEXT[]),
    COALESCE(c.detalhe, '[]'::jsonb)
  FROM calculo_por_pessoa c
  ORDER BY c.p_nome;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_folha_preview(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_folha_preview(integer, integer) TO authenticated;

-- ----------------------------- rpc_criar_transferencia -----------------------------
CREATE OR REPLACE FUNCTION public.rpc_criar_transferencia(
  p_conta_origem_id uuid,
  p_conta_destino_id uuid,
  p_valor numeric,
  p_data date,
  p_descricao text DEFAULT NULL,
  p_status text DEFAULT 'Concluída',
  p_observacao text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_id uuid;
BEGIN
  IF NOT public.can_view_financeiro() THEN
    RAISE EXCEPTION 'Sem permissão para criar transferência';
  END IF;

  v_empresa_id := public.get_user_empresa_id();

  IF p_conta_origem_id = p_conta_destino_id THEN
    RAISE EXCEPTION 'Conta de origem e destino devem ser diferentes';
  END IF;

  IF p_valor <= 0 THEN
    RAISE EXCEPTION 'Valor deve ser positivo';
  END IF;

  IF p_status NOT IN ('Concluída', 'Pendente') THEN
    RAISE EXCEPTION 'Status inválido';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM contas WHERE id = p_conta_origem_id AND empresa_id = v_empresa_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Conta de origem não encontrada';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM contas WHERE id = p_conta_destino_id AND empresa_id = v_empresa_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Conta de destino não encontrada';
  END IF;

  INSERT INTO transferencias (
    empresa_id, conta_origem_id, conta_destino_id,
    valor, data_transferencia, descricao, status, observacao,
    created_by, updated_by
  ) VALUES (
    v_empresa_id, p_conta_origem_id, p_conta_destino_id,
    p_valor, p_data, p_descricao, p_status, p_observacao,
    auth.uid(), auth.uid()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ----------------------------- rpc_editar_transferencia -----------------------------
CREATE OR REPLACE FUNCTION public.rpc_editar_transferencia(
  p_id uuid,
  p_conta_origem_id uuid,
  p_conta_destino_id uuid,
  p_valor numeric,
  p_data date,
  p_descricao text DEFAULT NULL,
  p_status text DEFAULT 'Concluída',
  p_observacao text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
BEGIN
  IF NOT public.can_view_financeiro() THEN
    RAISE EXCEPTION 'Sem permissão para editar transferência';
  END IF;

  v_empresa_id := public.get_user_empresa_id();

  IF p_conta_origem_id = p_conta_destino_id THEN
    RAISE EXCEPTION 'Conta de origem e destino devem ser diferentes';
  END IF;

  IF p_valor <= 0 THEN
    RAISE EXCEPTION 'Valor deve ser positivo';
  END IF;

  UPDATE transferencias SET
    conta_origem_id = p_conta_origem_id,
    conta_destino_id = p_conta_destino_id,
    valor = p_valor,
    data_transferencia = p_data,
    descricao = p_descricao,
    status = p_status,
    observacao = p_observacao,
    updated_by = auth.uid(),
    updated_at = now()
  WHERE id = p_id AND empresa_id = v_empresa_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transferência não encontrada';
  END IF;
END;
$$;

-- ----------------------------- rpc_excluir_transferencia -----------------------------
CREATE OR REPLACE FUNCTION public.rpc_excluir_transferencia(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
BEGIN
  IF NOT public.can_view_financeiro() THEN
    RAISE EXCEPTION 'Sem permissão para excluir transferência';
  END IF;

  v_empresa_id := public.get_user_empresa_id();

  UPDATE transferencias SET
    deleted_at = now(),
    updated_by = auth.uid(),
    updated_at = now()
  WHERE id = p_id AND empresa_id = v_empresa_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transferência não encontrada';
  END IF;
END;
$$;

-- ----------------------------- rpc_faturar_marco -----------------------------
CREATE OR REPLACE FUNCTION public.rpc_faturar_marco(p_marco_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_marco RECORD;
  v_projeto RECORD;
  v_receita_id UUID;
  v_caller_empresa_id UUID;
BEGIN
  IF NOT public.can_view_financeiro() THEN
    RAISE EXCEPTION 'Sem permissão para faturar marco';
  END IF;

  v_caller_empresa_id := public.get_user_empresa_id();

  IF v_caller_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT * INTO v_marco FROM marcos_faturamento WHERE id = p_marco_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Marco não encontrado';
  END IF;

  IF v_marco.status != 'pendente' THEN
    RAISE EXCEPTION 'Apenas marcos pendentes podem ser faturados';
  END IF;

  SELECT id, cliente_id, empresa_id, nome FROM projetos
  WHERE id = v_marco.projeto_id AND deleted_at IS NULL
  INTO v_projeto;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Projeto não encontrado';
  END IF;

  IF v_projeto.empresa_id != v_caller_empresa_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  INSERT INTO receitas (
    empresa_id, descricao, valor, data_vencimento, status,
    projeto_id, cliente_id
  ) VALUES (
    v_projeto.empresa_id,
    'Marco: ' || v_marco.nome || ' — ' || v_projeto.nome,
    v_marco.valor,
    CURRENT_DATE,
    'Pendente',
    v_marco.projeto_id,
    v_projeto.cliente_id
  )
  RETURNING id INTO v_receita_id;

  UPDATE marcos_faturamento
  SET status = 'faturado',
      data_faturada = CURRENT_DATE,
      receita_id = v_receita_id
  WHERE id = p_marco_id;

  RETURN v_receita_id;
END;
$$;

-- ----------------------------- gerar_fatura -----------------------------
CREATE OR REPLACE FUNCTION public.gerar_fatura(
  p_cartao_id UUID,
  p_mes INTEGER,
  p_ano INTEGER
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fatura_id UUID;
  v_dia_fechamento INTEGER;
  v_dia_vencimento INTEGER;
  v_data_inicio DATE;
  v_data_fim DATE;
  v_data_vencimento DATE;
  v_empresa_id UUID;
  v_valor_total DECIMAL(12,2);
  v_max_day_fim INTEGER;
  v_max_day_venc INTEGER;
BEGIN
  IF NOT public.can_view_financeiro() THEN
    RAISE EXCEPTION 'Sem permissão para gerar fatura';
  END IF;

  SELECT dia_fechamento, dia_vencimento, empresa_id
  INTO v_dia_fechamento, v_dia_vencimento, v_empresa_id
  FROM cartoes WHERE id = p_cartao_id AND deleted_at IS NULL;

  IF v_dia_fechamento IS NULL THEN
    RAISE EXCEPTION 'Cartão não encontrado';
  END IF;

  IF v_empresa_id != public.get_user_empresa_id() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  v_max_day_fim := EXTRACT(DAY FROM (DATE_TRUNC('month', make_date(p_ano, p_mes, 1)) + INTERVAL '1 month - 1 day'))::INTEGER;
  v_data_fim := make_date(p_ano, p_mes, LEAST(v_dia_fechamento, v_max_day_fim));

  v_data_inicio := (v_data_fim - INTERVAL '1 month')::DATE + INTERVAL '1 day';

  v_max_day_venc := EXTRACT(DAY FROM (DATE_TRUNC('month', make_date(p_ano, p_mes, 1)) + INTERVAL '1 month - 1 day'))::INTEGER;
  v_data_vencimento := make_date(p_ano, p_mes, LEAST(v_dia_vencimento, v_max_day_venc));

  IF v_dia_vencimento < v_dia_fechamento THEN
    v_data_vencimento := v_data_vencimento + INTERVAL '1 month';
  END IF;

  INSERT INTO faturas (empresa_id, cartao_id, mes_referencia, ano_referencia,
                       data_inicio, data_fim, data_vencimento, status)
  VALUES (v_empresa_id, p_cartao_id, p_mes, p_ano,
          v_data_inicio, v_data_fim, v_data_vencimento, 'Aberta')
  ON CONFLICT (cartao_id, mes_referencia, ano_referencia)
  DO UPDATE SET updated_at = NOW()
  RETURNING id INTO v_fatura_id;

  UPDATE despesas
  SET fatura_id = v_fatura_id
  WHERE cartao_id = p_cartao_id
    AND deleted_at IS NULL
    AND data_vencimento >= v_data_inicio
    AND data_vencimento <= v_data_fim
    AND fatura_id IS NULL;

  SELECT COALESCE(SUM(valor), 0) INTO v_valor_total
  FROM despesas
  WHERE fatura_id = v_fatura_id
    AND cartao_id IS NOT NULL
    AND deleted_at IS NULL;

  UPDATE faturas SET valor_total = v_valor_total WHERE id = v_fatura_id;

  RETURN v_fatura_id;
END;
$$;

-- ----------------------------- rpc_lancamento_set_rateio -----------------------------
CREATE OR REPLACE FUNCTION public.rpc_lancamento_set_rateio(
  p_lancamento_id uuid,
  p_tipo_lancamento text,
  p_rateios jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_valor_total numeric(12,2);
  v_soma numeric(7,2) := 0;
  v_count int := 0;
  r jsonb;
BEGIN
  IF NOT public.can_view_financeiro() THEN
    RAISE EXCEPTION 'Sem permissão para ratear lançamento';
  END IF;

  v_empresa_id := public.get_user_empresa_id();

  IF p_tipo_lancamento NOT IN ('receita','despesa') THEN
    RAISE EXCEPTION 'tipo_lancamento inválido';
  END IF;

  IF p_tipo_lancamento = 'receita' THEN
    SELECT valor INTO v_valor_total
    FROM receitas WHERE id = p_lancamento_id AND empresa_id = v_empresa_id AND deleted_at IS NULL;
  ELSE
    SELECT valor INTO v_valor_total
    FROM despesas WHERE id = p_lancamento_id AND empresa_id = v_empresa_id AND deleted_at IS NULL;
  END IF;

  IF v_valor_total IS NULL THEN
    RAISE EXCEPTION 'Lançamento não encontrado';
  END IF;

  FOR r IN SELECT * FROM jsonb_array_elements(p_rateios) LOOP
    v_soma := v_soma + (r->>'percentual')::numeric;
  END LOOP;

  IF jsonb_array_length(p_rateios) > 0 AND ABS(v_soma - 100) > 0.01 THEN
    RAISE EXCEPTION 'Soma dos percentuais deve ser 100 (atual: %)', v_soma;
  END IF;

  DELETE FROM lancamento_rateios
  WHERE lancamento_id = p_lancamento_id
    AND tipo_lancamento = p_tipo_lancamento;

  FOR r IN SELECT * FROM jsonb_array_elements(p_rateios) LOOP
    INSERT INTO lancamento_rateios (
      empresa_id, lancamento_id, tipo_lancamento,
      centro_custo_id, percentual, valor, observacao,
      created_by
    ) VALUES (
      v_empresa_id, p_lancamento_id, p_tipo_lancamento,
      (r->>'centro_custo_id')::uuid,
      (r->>'percentual')::numeric,
      ROUND(v_valor_total * ((r->>'percentual')::numeric / 100), 2),
      r->>'observacao',
      auth.uid()
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ----------------------------- rpc_gerar_parcelas_projeto -----------------------------
CREATE OR REPLACE FUNCTION public.rpc_gerar_parcelas_projeto(p_projeto_id uuid, p_num_parcelas integer DEFAULT 1, p_intervalo_dias integer DEFAULT 30)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_projeto RECORD;
  v_valor_parcela NUMERIC;
  v_data_base DATE;
  i INTEGER;
  parcelas_criadas INTEGER := 0;
  v_caller_empresa_id UUID;
BEGIN
  IF NOT public.can_view_financeiro() THEN
    RAISE EXCEPTION 'Sem permissão para gerar parcelas';
  END IF;

  v_caller_empresa_id := public.get_user_empresa_id();

  IF v_caller_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT id, valor_contrato, cliente_id, empresa_id, data_inicio, nome, codigo_projeto
  INTO v_projeto
  FROM projetos
  WHERE id = p_projeto_id AND deleted_at IS NULL;

  IF v_projeto IS NULL THEN
    RAISE EXCEPTION 'Projeto não encontrado';
  END IF;

  IF v_projeto.empresa_id != v_caller_empresa_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF v_projeto.valor_contrato IS NULL OR v_projeto.valor_contrato <= 0 THEN
    RAISE EXCEPTION 'Projeto sem valor de contrato';
  END IF;

  IF p_num_parcelas < 1 OR p_num_parcelas > 60 THEN
    RAISE EXCEPTION 'Número de parcelas deve ser entre 1 e 60';
  END IF;

  v_valor_parcela := ROUND(v_projeto.valor_contrato / p_num_parcelas, 2);
  v_data_base := COALESCE(v_projeto.data_inicio, CURRENT_DATE);

  FOR i IN 1..p_num_parcelas LOOP
    INSERT INTO receitas (empresa_id, descricao, valor, data_vencimento, status, projeto_id, cliente_id)
    VALUES (
      v_projeto.empresa_id,
      v_projeto.codigo_projeto || ' - Parcela ' || i || '/' || p_num_parcelas,
      v_valor_parcela,
      v_data_base + ((i - 1) * p_intervalo_dias),
      'Pendente',
      p_projeto_id,
      v_projeto.cliente_id
    );
    parcelas_criadas := parcelas_criadas + 1;
  END LOOP;

  IF p_num_parcelas > 1 THEN
    UPDATE receitas
    SET valor = v_projeto.valor_contrato - (v_valor_parcela * (p_num_parcelas - 1))
    WHERE projeto_id = p_projeto_id
      AND descricao LIKE '%Parcela ' || p_num_parcelas || '/' || p_num_parcelas
      AND deleted_at IS NULL;
  END IF;

  RETURN parcelas_criadas;
END;
$function$;

-- ----------------------------- _soft_delete_guard -----------------------------
-- rpc_soft_delete/rpc_soft_delete_grupo/rpc_restaurar (20260859000000) usam
-- este guard comum, que mapeia tabela → feature e chama
-- user_has_feature(v_feature, 'editor'). Pra 'financeiro' isso é o mesmo
-- gate fraco de sempre (qualquer membro, pós ADR 0029) — um user sem
-- financeiro_delegado conseguia public.rpc_soft_delete('receitas', id) e
-- apagar (soft) qualquer lançamento. Fix: quando a feature mapeada é
-- 'financeiro', troca para can_view_financeiro(); as outras features
-- (clientes, projetos, templates, obra) continuam pelo caminho de sempre,
-- não fazem parte deste achado.
CREATE OR REPLACE FUNCTION public._soft_delete_guard(p_tabela text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_feature text;
  v_empresa uuid;
BEGIN
  v_feature := public._soft_delete_feature(p_tabela);
  IF v_feature IS NULL THEN
    RAISE EXCEPTION 'Tabela % não permite soft delete por esta via', p_tabela
      USING ERRCODE = '22023';
  END IF;

  v_empresa := public.get_user_empresa_id();
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa' USING ERRCODE = '42501';
  END IF;

  IF v_feature = 'financeiro' THEN
    IF NOT public.can_view_financeiro() THEN
      RAISE EXCEPTION 'Sem permissão de escrita em financeiro' USING ERRCODE = '42501';
    END IF;
  ELSIF v_feature <> '' AND NOT public.user_has_feature(v_feature, 'editor') THEN
    RAISE EXCEPTION 'Sem permissão de escrita em %', v_feature USING ERRCODE = '42501';
  END IF;

  RETURN v_empresa;
END;
$function$;
