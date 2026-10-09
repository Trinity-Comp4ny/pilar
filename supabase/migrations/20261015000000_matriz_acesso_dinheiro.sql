-- Matriz de acesso a dinheiro (ADR 0046, aplica o escopo da ADR 0034).
--
-- A ADR 0034 define "financeiro geral" (contas, faturas, lançamentos, valor de contrato
-- e margem em projeto/obra) como visível só para admin ou financeiro_delegado, via
-- can_view_financeiro(). Esta migration estende o mesmo gate, de forma uniforme, a:
--
-- 1. Funções SECURITY DEFINER de dinheiro (gráfico financeiro, custo real do projeto,
--    despesa de obra, despesas recorrentes, parcelas por dia fixo, sync de metas).
-- 2. Orçamento por fase. O lançamento de horas, que só precisa de id e disciplina da
--    fase, passa a usar fases_do_projeto().
-- 3. Conta da obra.
-- 4. Valor do aditivo e custo do escopo (leitura pela escopos_safe) e a decisão de
--    aprovar ou rejeitar aditivo.
-- 5. leads.valor_estimado, lido pela leads_safe.
-- 6. Parcelamentos (grupos_parcela), no mesmo acesso dos lançamentos que agrupam.
--
-- Leitura por coluna segue o padrão de 20260879000000 (projetos): REVOKE SELECT da
-- tabela e GRANT coluna a coluna, porque REVOKE de uma coluna não tem efeito enquanto
-- o papel tem SELECT na tabela inteira. Coluna nova nessas tabelas NÃO fica legível
-- até entrar no GRANT; o pgTAP acesso_dinheiro.sql reprova o esquecimento.

-- =====================================================================
-- 1. Funções: checagem de papel além da empresa
-- =====================================================================

-- get_financial_chart_data
CREATE OR REPLACE FUNCTION public.get_financial_chart_data(p_empresa_id uuid, p_data_inicio date, p_data_fim date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result JSONB;
BEGIN
  -- ADR 0046: dinheiro exige can_view_financeiro() (admin ou financeiro_delegado).
  -- O filtro por empresa abaixo isola tenants, mas não papéis dentro da empresa.
  IF NOT public.can_view_financeiro() THEN
    RAISE EXCEPTION 'Sem acesso ao financeiro' USING ERRCODE = '42501';
  END IF;
  IF p_empresa_id != public.get_user_empresa_id() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT jsonb_build_object(
    'por_mes', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::JSONB)
      FROM (
        SELECT
          TO_CHAR(DATE_TRUNC('month', COALESCE(r.data_recebimento, r.data_vencimento)), 'YYYY-MM') AS mes,
          SUM(CASE WHEN r.status = 'Recebido' THEN r.valor ELSE 0 END)  AS receitas_recebidas,
          SUM(CASE WHEN r.status = 'Pendente' THEN r.valor ELSE 0 END)  AS receitas_pendentes
        FROM public.receitas r
        WHERE r.empresa_id = p_empresa_id
          AND r.deleted_at IS NULL
          AND COALESCE(r.data_recebimento, r.data_vencimento) BETWEEN p_data_inicio AND p_data_fim
        GROUP BY DATE_TRUNC('month', COALESCE(r.data_recebimento, r.data_vencimento))
        ORDER BY 1
      ) t
    ),
    'despesas_por_mes', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::JSONB)
      FROM (
        SELECT
          TO_CHAR(DATE_TRUNC('month', COALESCE(d.data_pagamento, d.data_vencimento)), 'YYYY-MM') AS mes,
          SUM(CASE WHEN d.status = 'Pago'    THEN d.valor ELSE 0 END)  AS despesas_pagas,
          SUM(CASE WHEN d.status = 'Pendente' THEN d.valor ELSE 0 END) AS despesas_pendentes
        FROM public.despesas d
        WHERE d.empresa_id = p_empresa_id
          AND d.deleted_at IS NULL
          AND COALESCE(d.is_fatura_payment, false) = false
          AND COALESCE(d.data_pagamento, d.data_vencimento) BETWEEN p_data_inicio AND p_data_fim
        GROUP BY DATE_TRUNC('month', COALESCE(d.data_pagamento, d.data_vencimento))
        ORDER BY 1
      ) t
    )
  ) INTO v_result;

  RETURN COALESCE(v_result, '{}'::JSONB);
END;
$function$;

-- rpc_custo_real_projeto
CREATE OR REPLACE FUNCTION public.rpc_custo_real_projeto(p_projeto_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa_id      UUID;
  v_custo_estimado  DECIMAL;
  v_despesas_diretas DECIMAL;
BEGIN
  -- ADR 0046: dinheiro exige can_view_financeiro() (admin ou financeiro_delegado).
  -- O filtro por empresa abaixo isola tenants, mas não papéis dentro da empresa.
  IF NOT public.can_view_financeiro() THEN
    RAISE EXCEPTION 'Sem acesso ao financeiro' USING ERRCODE = '42501';
  END IF;
  -- Busca empresa_id e valida acesso
  SELECT p.empresa_id INTO v_empresa_id
  FROM public.projetos p
  WHERE p.id = p_projeto_id
    AND p.deleted_at IS NULL;

  IF v_empresa_id IS NULL OR v_empresa_id != public.get_user_empresa_id() THEN
    RAISE EXCEPTION 'Projeto não encontrado ou acesso negado';
  END IF;

  -- Custo estimado a partir das fases de orçamento (custo_estimado é coluna GENERATED)
  SELECT COALESCE(SUM(pof.custo_estimado), 0) INTO v_custo_estimado
  FROM public.projeto_orcamento_fases pof
  WHERE pof.projeto_id = p_projeto_id
    AND pof.deleted_at IS NULL;

  -- Despesas diretas vinculadas ao projeto (excluindo pagamentos de fatura)
  SELECT COALESCE(SUM(d.valor), 0) INTO v_despesas_diretas
  FROM public.despesas d
  WHERE d.projeto_id = p_projeto_id
    AND d.deleted_at IS NULL
    AND d.is_fatura_payment = false
    AND d.status IN ('Pago', 'Pendente');

  RETURN jsonb_build_object(
    'custo_estimado',       v_custo_estimado,
    'despesas_diretas',     v_despesas_diretas,
    'custo_total_estimado', v_custo_estimado + v_despesas_diretas,
    -- Será 'timesheet' quando o módulo for reativado e as horas reais forem somadas
    'fonte', 'estimativa'
  );
END;
$function$;

-- rpc_obra_despesa_salvar
CREATE OR REPLACE FUNCTION public.rpc_obra_despesa_salvar(p_obra_id uuid, p_data date, p_descricao text, p_valor numeric, p_id uuid DEFAULT NULL::uuid, p_obra_frente_id uuid DEFAULT NULL::uuid, p_fornecedor_id uuid DEFAULT NULL::uuid, p_pago_por text DEFAULT 'cliente'::text, p_comprovante_url text DEFAULT NULL::text, p_confirmada_portal boolean DEFAULT true)
 RETURNS obra_conta_lancamento
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa    uuid := public.get_user_empresa_id();
  v_obra       public.obras;
  v_lanc       public.obra_conta_lancamento;
  v_cliente    uuid;
  v_taxa_valor numeric(14,2);
BEGIN
  -- ADR 0046: dinheiro exige can_view_financeiro() (admin ou financeiro_delegado).
  -- O filtro por empresa abaixo isola tenants, mas não papéis dentro da empresa.
  IF NOT public.can_view_financeiro() THEN
    RAISE EXCEPTION 'Sem acesso ao financeiro' USING ERRCODE = '42501';
  END IF;
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'usuário sem empresa';
  END IF;
  IF p_valor IS NULL OR p_valor < 0 THEN
    RAISE EXCEPTION 'valor inválido';
  END IF;

  SELECT * INTO v_obra
  FROM public.obras
  WHERE id = p_obra_id AND empresa_id = v_empresa AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'obra inexistente ou de outra empresa';
  END IF;

  IF p_obra_frente_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.obra_frente
    WHERE id = p_obra_frente_id AND empresa_id = v_empresa
  ) THEN
    RAISE EXCEPTION 'frente inválida';
  END IF;

  IF p_fornecedor_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.fornecedores
    WHERE id = p_fornecedor_id AND empresa_id = v_empresa
  ) THEN
    RAISE EXCEPTION 'fornecedor inválido';
  END IF;

  IF p_pago_por IS NOT NULL AND p_pago_por NOT IN ('cliente', 'escritorio_reembolsavel') THEN
    RAISE EXCEPTION 'pago_por inválido';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.obra_conta_lancamento (
      empresa_id, obra_id, tipo, data, descricao, valor,
      obra_frente_id, fornecedor_id, pago_por, comprovante_url, confirmada_portal, created_by
    ) VALUES (
      v_empresa, p_obra_id, 'despesa', p_data, p_descricao, p_valor,
      p_obra_frente_id, p_fornecedor_id, COALESCE(p_pago_por, 'cliente'), p_comprovante_url,
      COALESCE(p_confirmada_portal, true), auth.uid()
    )
    RETURNING * INTO v_lanc;
  ELSE
    UPDATE public.obra_conta_lancamento SET
      data = p_data, descricao = p_descricao, valor = p_valor,
      obra_frente_id = p_obra_frente_id, fornecedor_id = p_fornecedor_id,
      pago_por = COALESCE(p_pago_por, 'cliente'), comprovante_url = p_comprovante_url,
      confirmada_portal = COALESCE(p_confirmada_portal, true),
      updated_by = auth.uid()
    WHERE id = p_id AND empresa_id = v_empresa AND deleted_at IS NULL AND tipo = 'despesa'
    RETURNING * INTO v_lanc;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'lançamento inexistente ou de outra empresa';
    END IF;
  END IF;

  -- Taxa de administração: só no modelo administracao e taxa > 0. Idempotente pelo
  -- vínculo obra_lancamento_origem_id (upsert; estorna se a taxa deixar de existir).
  IF v_obra.modelo_cobranca = 'administracao' AND COALESCE(v_obra.taxa_administracao_pct, 0) > 0 THEN
    v_taxa_valor := round(p_valor * v_obra.taxa_administracao_pct / 100, 2);
    SELECT cliente_id INTO v_cliente FROM public.projetos WHERE id = v_obra.projeto_id;

    UPDATE public.receitas SET
      valor = v_taxa_valor,
      descricao = 'Taxa de administração — ' || v_obra.nome,
      projeto_id = v_obra.projeto_id,
      cliente_id = v_cliente,
      data_vencimento = p_data,
      deleted_at = NULL,
      updated_by = auth.uid()
    WHERE obra_lancamento_origem_id = v_lanc.id;

    IF NOT FOUND THEN
      INSERT INTO public.receitas (
        empresa_id, descricao, valor, status, projeto_id, cliente_id,
        data_vencimento, obra_lancamento_origem_id, created_by
      ) VALUES (
        v_empresa, 'Taxa de administração — ' || v_obra.nome, v_taxa_valor, 'Pendente',
        v_obra.projeto_id, v_cliente, p_data, v_lanc.id, auth.uid()
      );
    END IF;
  ELSE
    UPDATE public.receitas SET deleted_at = now(), updated_by = auth.uid()
    WHERE obra_lancamento_origem_id = v_lanc.id AND deleted_at IS NULL;
  END IF;

  RETURN v_lanc;
END;
$function$;

-- rpc_obra_despesa_excluir
CREATE OR REPLACE FUNCTION public.rpc_obra_despesa_excluir(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa uuid := public.get_user_empresa_id();
BEGIN
  -- ADR 0046: dinheiro exige can_view_financeiro() (admin ou financeiro_delegado).
  -- O filtro por empresa abaixo isola tenants, mas não papéis dentro da empresa.
  IF NOT public.can_view_financeiro() THEN
    RAISE EXCEPTION 'Sem acesso ao financeiro' USING ERRCODE = '42501';
  END IF;
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'usuário sem empresa';
  END IF;

  UPDATE public.obra_conta_lancamento
    SET deleted_at = now(), updated_by = auth.uid()
  WHERE id = p_id AND empresa_id = v_empresa AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'lançamento inexistente ou de outra empresa';
  END IF;

  UPDATE public.receitas SET deleted_at = now(), updated_by = auth.uid()
  WHERE obra_lancamento_origem_id = p_id AND deleted_at IS NULL;
END;
$function$;

-- rpc_gerar_despesas_recorrentes
CREATE OR REPLACE FUNCTION public.rpc_gerar_despesas_recorrentes()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_despesa RECORD;
  v_proxima_data DATE;
  v_count INTEGER := 0;
  v_empresa_id UUID;
BEGIN
  -- ADR 0046: dinheiro exige can_view_financeiro() (admin ou financeiro_delegado).
  -- O filtro por empresa abaixo isola tenants, mas não papéis dentro da empresa.
  IF NOT public.can_view_financeiro() THEN
    RAISE EXCEPTION 'Sem acesso ao financeiro' USING ERRCODE = '42501';
  END IF;
  v_empresa_id := public.get_user_empresa_id();

  FOR v_despesa IN
    SELECT d.*
    FROM despesas d
    WHERE d.empresa_id = v_empresa_id
      AND d.recorrente = TRUE
      AND d.deleted_at IS NULL
      AND d.periodicidade IS NOT NULL
      -- Só gera se não existe filha no futuro
      AND NOT EXISTS (
        SELECT 1 FROM despesas filha
        WHERE filha.despesa_pai_id = d.id
          AND filha.deleted_at IS NULL
          AND filha.data_vencimento > CURRENT_DATE
      )
  LOOP
    -- Calcular próxima data
    v_proxima_data := CASE v_despesa.periodicidade
      WHEN 'mensal' THEN v_despesa.data_vencimento + INTERVAL '1 month'
      WHEN 'trimestral' THEN v_despesa.data_vencimento + INTERVAL '3 months'
      WHEN 'semestral' THEN v_despesa.data_vencimento + INTERVAL '6 months'
      WHEN 'anual' THEN v_despesa.data_vencimento + INTERVAL '1 year'
      ELSE v_despesa.data_vencimento + INTERVAL '1 month'
    END;

    -- Ajustar se data já passou (avançar até o futuro)
    WHILE v_proxima_data <= CURRENT_DATE LOOP
      v_proxima_data := CASE v_despesa.periodicidade
        WHEN 'mensal' THEN v_proxima_data + INTERVAL '1 month'
        WHEN 'trimestral' THEN v_proxima_data + INTERVAL '3 months'
        WHEN 'semestral' THEN v_proxima_data + INTERVAL '6 months'
        WHEN 'anual' THEN v_proxima_data + INTERVAL '1 year'
        ELSE v_proxima_data + INTERVAL '1 month'
      END;
    END LOOP;

    -- Criar próxima ocorrência
    INSERT INTO despesas (
      empresa_id, descricao, valor, data_vencimento, status,
      projeto_id, fornecedor_id, categoria_id, conta_id,
      recorrente, periodicidade, despesa_pai_id, observacao
    ) VALUES (
      v_despesa.empresa_id,
      v_despesa.descricao,
      v_despesa.valor,
      v_proxima_data,
      'Pendente',
      v_despesa.projeto_id,
      v_despesa.fornecedor_id,
      v_despesa.categoria_id,
      v_despesa.conta_id,
      TRUE,
      v_despesa.periodicidade,
      v_despesa.id,
      v_despesa.observacao
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;

-- rpc_gerar_parcelas_dia_fixo
CREATE OR REPLACE FUNCTION public.rpc_gerar_parcelas_dia_fixo(p_projeto_id uuid, p_num_parcelas integer, p_dia_fixo integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_projeto RECORD;
  v_valor_parcela NUMERIC;
  v_caller_empresa_id UUID;
  v_data_venc DATE;
  v_ano INTEGER;
  v_mes INTEGER;
  v_dia_efetivo INTEGER;
  v_ultimo_dia INTEGER;
  v_start_mes INTEGER;
  v_start_ano INTEGER;
  i INTEGER;
  parcelas_criadas INTEGER := 0;
BEGIN
  -- ADR 0046: dinheiro exige can_view_financeiro() (admin ou financeiro_delegado).
  -- O filtro por empresa abaixo isola tenants, mas não papéis dentro da empresa.
  IF NOT public.can_view_financeiro() THEN
    RAISE EXCEPTION 'Sem acesso ao financeiro' USING ERRCODE = '42501';
  END IF;
  v_caller_empresa_id := public.get_user_empresa_id();

  SELECT id, valor_contrato, cliente_id, empresa_id, nome, codigo_projeto
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

  IF p_dia_fixo < 1 OR p_dia_fixo > 31 THEN
    RAISE EXCEPTION 'Dia fixo deve estar entre 1 e 31';
  END IF;

  v_valor_parcela := ROUND(v_projeto.valor_contrato / p_num_parcelas, 2);

  IF EXTRACT(DAY FROM CURRENT_DATE)::INTEGER >= p_dia_fixo THEN
    v_start_mes := EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER + 1;
    v_start_ano := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
    IF v_start_mes > 12 THEN
      v_start_mes := 1;
      v_start_ano := v_start_ano + 1;
    END IF;
  ELSE
    v_start_mes := EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER;
    v_start_ano := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  END IF;

  FOR i IN 0..(p_num_parcelas - 1) LOOP
    v_mes := ((v_start_mes - 1 + i) % 12) + 1;
    v_ano := v_start_ano + ((v_start_mes - 1 + i) / 12);

    v_ultimo_dia := EXTRACT(DAY FROM (DATE_TRUNC('MONTH', MAKE_DATE(v_ano, v_mes, 1)) + INTERVAL '1 month - 1 day'))::INTEGER;
    v_dia_efetivo := LEAST(p_dia_fixo, v_ultimo_dia);
    v_data_venc := MAKE_DATE(v_ano, v_mes, v_dia_efetivo);

    -- Pula fim de semana (domingo=0, sábado=6 no PG)
    WHILE EXTRACT(DOW FROM v_data_venc) IN (0, 6) LOOP
      v_data_venc := v_data_venc + 1;
    END LOOP;

    INSERT INTO receitas (empresa_id, descricao, valor, data_vencimento, status, projeto_id, cliente_id)
    VALUES (
      v_projeto.empresa_id,
      v_projeto.codigo_projeto || ' - Parcela ' || (i + 1) || '/' || p_num_parcelas,
      v_valor_parcela,
      v_data_venc,
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

-- rpc_sync_metas
CREATE OR REPLACE FUNCTION public.rpc_sync_metas()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_meta RECORD;
  v_valor NUMERIC;
  v_count INTEGER := 0;
  v_empresa_id UUID;
BEGIN
  -- ADR 0046: a sincronização lê receitas e despesas. Sem acesso ao financeiro,
  -- não sincroniza (devolve 0) em vez de erro: a tela de Metas chama ao abrir.
  IF NOT public.can_view_financeiro() THEN
    RETURN 0;
  END IF;
  v_empresa_id := public.get_user_empresa_id();

  FOR v_meta IN
    SELECT * FROM metas
    WHERE empresa_id = v_empresa_id
      AND auto_sync = TRUE
      AND sync_fonte IS NOT NULL
  LOOP
    v_valor := NULL;

    CASE v_meta.sync_fonte
      WHEN 'receita_total' THEN
        SELECT COALESCE(SUM(valor), 0) INTO v_valor
        FROM receitas
        WHERE empresa_id = v_empresa_id
          AND status = 'Recebido'
          AND deleted_at IS NULL
          AND data_vencimento >= date_trunc('year', CURRENT_DATE);

      WHEN 'receita_mes' THEN
        SELECT COALESCE(SUM(valor), 0) INTO v_valor
        FROM receitas
        WHERE empresa_id = v_empresa_id
          AND status = 'Recebido'
          AND deleted_at IS NULL
          AND date_trunc('month', data_vencimento) = date_trunc('month', CURRENT_DATE);

      WHEN 'projetos_concluidos' THEN
        SELECT COUNT(*) INTO v_valor
        FROM projetos
        WHERE empresa_id = v_empresa_id
          AND status = 'Concluído'
          AND deleted_at IS NULL
          AND date_trunc('year', COALESCE(data_final, created_at)) = date_trunc('year', CURRENT_DATE);

      WHEN 'projetos_ativos' THEN
        SELECT COUNT(*) INTO v_valor
        FROM projetos
        WHERE empresa_id = v_empresa_id
          AND status IN ('Planejamento', 'Em andamento')
          AND deleted_at IS NULL;

      WHEN 'margem_media' THEN
        SELECT COALESCE(AVG(
          CASE WHEN r.total > 0 THEN ((r.total - d.total) / r.total) * 100 ELSE 0 END
        ), 0) INTO v_valor
        FROM (
          SELECT projeto_id, COALESCE(SUM(valor), 0) AS total
          FROM receitas WHERE empresa_id = v_empresa_id AND status = 'Recebido' AND deleted_at IS NULL
          GROUP BY projeto_id
        ) r
        JOIN (
          SELECT projeto_id, COALESCE(SUM(valor), 0) AS total
          FROM despesas WHERE empresa_id = v_empresa_id AND status = 'Pago' AND deleted_at IS NULL AND projeto_id IS NOT NULL
          GROUP BY projeto_id
        ) d ON r.projeto_id = d.projeto_id
        WHERE r.total > 0;

      WHEN 'leads_convertidos' THEN
        SELECT COUNT(*) INTO v_valor
        FROM leads
        WHERE empresa_id = v_empresa_id
          AND status = 'Ganho'
          AND deleted_at IS NULL
          AND date_trunc('year', COALESCE(convertido_em, created_at)) = date_trunc('year', CURRENT_DATE);

      WHEN 'horas_faturadas' THEN
        SELECT COALESCE(SUM(horas), 0) INTO v_valor
        FROM timesheets
        WHERE empresa_id = v_empresa_id
          AND status = 'aprovado'
          AND deleted_at IS NULL
          AND date_trunc('year', data) = date_trunc('year', CURRENT_DATE);

      ELSE
        CONTINUE;
    END CASE;

    IF v_valor IS NOT NULL THEN
      UPDATE metas SET atual = v_valor WHERE id = v_meta.id;
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$function$;

-- =====================================================================
-- 2. Orçamento por fase: só com acesso ao financeiro
-- =====================================================================

DROP POLICY IF EXISTS projeto_orcamento_fases_select ON public.projeto_orcamento_fases;
CREATE POLICY projeto_orcamento_fases_select ON public.projeto_orcamento_fases
  FOR SELECT USING (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('projetos'::text, 'viewer'::text)
    AND public.can_view_financeiro()
  );

DROP POLICY IF EXISTS projeto_orcamento_fases_write ON public.projeto_orcamento_fases;
CREATE POLICY projeto_orcamento_fases_write ON public.projeto_orcamento_fases
  FOR ALL USING (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('projetos'::text, 'editor'::text)
    AND public.can_view_financeiro()
  ) WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('projetos'::text, 'editor'::text)
    AND public.can_view_financeiro()
  );

-- Quem lança horas escolhe a fase, mas não precisa (nem pode) ver custo e margem.
CREATE OR REPLACE FUNCTION public.fases_do_projeto(p_projeto_id uuid)
RETURNS TABLE (id uuid, disciplina text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT f.id, f.disciplina
  FROM public.projeto_orcamento_fases f
  WHERE f.projeto_id = p_projeto_id
    AND f.deleted_at IS NULL
    AND f.empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('projetos'::text, 'viewer'::text)
  ORDER BY f.disciplina;
$$;

REVOKE ALL ON FUNCTION public.fases_do_projeto(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fases_do_projeto(uuid) TO authenticated;

COMMENT ON FUNCTION public.fases_do_projeto(uuid) IS
  'Fases do orçamento (id e disciplina) para quem lança horas, sem custo nem margem (ADR 0046).';

-- =====================================================================
-- 3. Conta da obra: só com acesso ao financeiro (e ao módulo Obras)
-- =====================================================================

DROP POLICY IF EXISTS obra_conta_lanc_select ON public.obra_conta_lancamento;
CREATE POLICY obra_conta_lanc_select ON public.obra_conta_lancamento
  FOR SELECT USING (
    empresa_id = public.get_user_empresa_id()
    AND deleted_at IS NULL
    AND public.can_view_financeiro()
  );

DROP POLICY IF EXISTS obra_conta_lanc_insert ON public.obra_conta_lancamento;
CREATE POLICY obra_conta_lanc_insert ON public.obra_conta_lancamento
  FOR INSERT WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.can_view_financeiro()
    AND EXISTS (SELECT 1 FROM public.obras o WHERE o.id = obra_conta_lancamento.obra_id AND o.empresa_id = public.get_user_empresa_id())
    AND (obra_frente_id IS NULL OR EXISTS (SELECT 1 FROM public.obra_frente f WHERE f.id = obra_conta_lancamento.obra_frente_id AND f.empresa_id = public.get_user_empresa_id()))
    AND (fornecedor_id IS NULL OR EXISTS (SELECT 1 FROM public.fornecedores fo WHERE fo.id = obra_conta_lancamento.fornecedor_id AND fo.empresa_id = public.get_user_empresa_id()))
  );

DROP POLICY IF EXISTS obra_conta_lanc_update ON public.obra_conta_lancamento;
CREATE POLICY obra_conta_lanc_update ON public.obra_conta_lancamento
  FOR UPDATE USING (
    empresa_id = public.get_user_empresa_id()
    AND public.can_view_financeiro()
  ) WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.can_view_financeiro()
    AND EXISTS (SELECT 1 FROM public.obras o WHERE o.id = obra_conta_lancamento.obra_id AND o.empresa_id = public.get_user_empresa_id())
    AND (obra_frente_id IS NULL OR EXISTS (SELECT 1 FROM public.obra_frente f WHERE f.id = obra_conta_lancamento.obra_frente_id AND f.empresa_id = public.get_user_empresa_id()))
    AND (fornecedor_id IS NULL OR EXISTS (SELECT 1 FROM public.fornecedores fo WHERE fo.id = obra_conta_lancamento.fornecedor_id AND fo.empresa_id = public.get_user_empresa_id()))
  );

DROP POLICY IF EXISTS obra_conta_lanc_delete ON public.obra_conta_lancamento;
CREATE POLICY obra_conta_lanc_delete ON public.obra_conta_lancamento
  FOR DELETE USING (
    empresa_id = public.get_user_empresa_id()
    AND public.can_view_financeiro()
  );

-- =====================================================================
-- 4. Escopos e aditivos: valor mascarado, decisão só com acesso ao financeiro
-- =====================================================================

REVOKE SELECT, INSERT, UPDATE ON public.escopos FROM authenticated, anon;
GRANT SELECT (
  id, empresa_id, projeto_id, descricao, tipo, status, horas_estimadas, impacto_prazo_dias,
  justificativa, aprovado_por, aprovado_em, created_by, updated_by, created_at, updated_at,
  deleted_at, adiado_ate
) ON public.escopos TO authenticated;
GRANT INSERT (
  id, empresa_id, projeto_id, descricao, tipo, status, horas_estimadas, impacto_prazo_dias,
  justificativa, aprovado_por, aprovado_em, created_by, updated_by, created_at, updated_at,
  deleted_at, adiado_ate
) ON public.escopos TO authenticated;
GRANT UPDATE (
  descricao, status, horas_estimadas, impacto_prazo_dias, justificativa, aprovado_por,
  aprovado_em, updated_by, updated_at, deleted_at, adiado_ate
) ON public.escopos TO authenticated;

REVOKE SELECT, INSERT, UPDATE ON public.escopo_itens FROM authenticated, anon;
GRANT SELECT (id, escopo_id, descricao, disciplina, horas, created_at) ON public.escopo_itens TO authenticated;
GRANT INSERT (id, escopo_id, descricao, disciplina, horas, created_at) ON public.escopo_itens TO authenticated;
GRANT UPDATE (descricao, disciplina, horas) ON public.escopo_itens TO authenticated;

-- Leitura para a tela: mesmo recorte da policy escopos_select, valor só com acesso.
CREATE OR REPLACE VIEW public.escopos_safe
WITH (security_barrier = true) AS
SELECT
  e.id, e.empresa_id, e.projeto_id, e.descricao, e.tipo, e.status, e.horas_estimadas,
  e.impacto_prazo_dias, e.justificativa, e.aprovado_por, e.aprovado_em, e.created_by,
  e.updated_by, e.created_at, e.updated_at, e.deleted_at, e.adiado_ate,
  CASE WHEN public.can_view_financeiro() THEN e.custo_estimado END AS custo_estimado,
  CASE WHEN public.can_view_financeiro() THEN e.valor_aditivo END AS valor_aditivo,
  public.can_view_financeiro() AS pode_ver_valor,
  p.nome AS projeto_nome,
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', i.id, 'escopo_id', i.escopo_id, 'descricao', i.descricao,
      'disciplina', i.disciplina, 'horas', i.horas, 'created_at', i.created_at,
      'custo', CASE WHEN public.can_view_financeiro() THEN i.custo END
    ) ORDER BY i.created_at)
    FROM public.escopo_itens i
    WHERE i.escopo_id = e.id
  ), '[]'::jsonb) AS escopo_itens
FROM public.escopos e
LEFT JOIN public.projetos p ON p.id = e.projeto_id
WHERE e.empresa_id = public.get_user_empresa_id()
  AND public.user_has_feature('projetos'::text, 'viewer'::text);

REVOKE ALL ON public.escopos_safe FROM PUBLIC, anon;
GRANT SELECT ON public.escopos_safe TO authenticated;

COMMENT ON VIEW public.escopos_safe IS
  'Escopos e aditivos com valor e custo mascarados sem can_view_financeiro() (ADR 0046).';

-- Aprovar soma o valor no contrato; rejeitar descarta uma cobrança. Os dois são
-- decisão de dinheiro. Sessão de serviço (cron, guardião) passa: auth.uid() é nulo.
CREATE OR REPLACE FUNCTION public.tg_escopos_decisao_exige_financeiro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tipo = 'aditivo'
     AND NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('aprovado', 'rejeitado')
     AND auth.uid() IS NOT NULL
     AND NOT public.can_view_financeiro() THEN
    RAISE EXCEPTION 'Aprovar ou rejeitar aditivo exige acesso ao financeiro'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tg_escopos_decisao_exige_financeiro() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS tg_escopos_decisao_exige_financeiro ON public.escopos;
CREATE TRIGGER tg_escopos_decisao_exige_financeiro
  BEFORE UPDATE OF status ON public.escopos
  FOR EACH ROW EXECUTE FUNCTION public.tg_escopos_decisao_exige_financeiro();

-- =====================================================================
-- 5. leads.valor_estimado: só pela leads_safe
-- =====================================================================

REVOKE SELECT ON public.leads FROM authenticated, anon;
GRANT SELECT (
  id, empresa_id, nome, email, contato, status, origem, created_by, created_at, updated_at,
  deleted_at, cliente_id, motivo_perda, convertido_em, responsavel_id, previsao_fechamento,
  empresa_lead, notas, sobrenome, cnpj
) ON public.leads TO authenticated;

-- =====================================================================
-- 6. Parcelamentos: mesmo acesso dos lançamentos que agrupam
-- =====================================================================

DROP POLICY IF EXISTS grupos_parcela_select ON public.grupos_parcela;
CREATE POLICY grupos_parcela_select ON public.grupos_parcela
  FOR SELECT USING (empresa_id = public.get_user_empresa_id() AND public.can_view_financeiro());

DROP POLICY IF EXISTS grupos_parcela_insert ON public.grupos_parcela;
CREATE POLICY grupos_parcela_insert ON public.grupos_parcela
  FOR INSERT WITH CHECK (empresa_id = public.get_user_empresa_id() AND public.can_view_financeiro());

DROP POLICY IF EXISTS grupos_parcela_update ON public.grupos_parcela;
CREATE POLICY grupos_parcela_update ON public.grupos_parcela
  FOR UPDATE USING (empresa_id = public.get_user_empresa_id() AND public.can_view_financeiro())
  WITH CHECK (empresa_id = public.get_user_empresa_id() AND public.can_view_financeiro());

DROP POLICY IF EXISTS grupos_parcela_delete ON public.grupos_parcela;
CREATE POLICY grupos_parcela_delete ON public.grupos_parcela
  FOR DELETE USING (empresa_id = public.get_user_empresa_id() AND public.can_view_financeiro());
