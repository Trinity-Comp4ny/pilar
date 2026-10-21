-- SPEC 123: metas personalizáveis.
--
-- Uma meta passa a ser indicador + alvo + período + escopo, sem tipo:
--   * indicador (null = acompanhamento manual) vem de um catálogo fechado;
--   * período = periodo_inicio..prazo (datas específicas) ou recorrência mensal,
--     trimestral ou anual, que cai sempre no período corrente;
--   * escopo = pessoa_id (null = empresa toda).
--
-- O progresso de meta automática deixa de ser gravado em metas.atual por quem abre a tela
-- e passa a ser calculado na leitura (rpc_metas_progresso, rpc_meta_historico). Isso dá o
-- histórico por período de graça e permite medir por colaborador.
--
-- Aditiva: `tipo` fica como legado (o código para de ler) e rpc_sync_metas continua
-- existindo, agora sobre o mesmo cálculo, para o front antigo que ainda a chame durante o
-- deploy.

-- =====================================================================
-- 1. Colunas e constraints
-- =====================================================================

ALTER TABLE public.metas
  ADD COLUMN IF NOT EXISTS indicador text,
  ADD COLUMN IF NOT EXISTS periodo_inicio date,
  ADD COLUMN IF NOT EXISTS recorrencia text NOT NULL DEFAULT 'nenhuma',
  ADD COLUMN IF NOT EXISTS unidade_rotulo text;

-- `tipo` é legado: nenhum código lê. Meta nova nasce 'livre'.
ALTER TABLE public.metas ALTER COLUMN tipo SET DEFAULT 'livre';

-- Backfill: financeira com fonte vira indicador. A janela antiga era o ano corrente
-- (receita_mes: o mês corrente), então recorrência anual (mensal) reproduz o valor.
-- margem_media e projetos_ativos nunca tiveram janela e seguem sem.
UPDATE public.metas
SET indicador = CASE sync_fonte
      WHEN 'receita_total' THEN 'receita_recebida'
      WHEN 'receita_mes' THEN 'receita_recebida'
      WHEN 'projetos_concluidos' THEN 'projetos_concluidos'
      WHEN 'projetos_ativos' THEN 'projetos_ativos'
      WHEN 'margem_media' THEN 'margem_media'
      WHEN 'leads_convertidos' THEN 'leads_ganhos'
    END,
    recorrencia = CASE sync_fonte
      WHEN 'receita_mes' THEN 'mensal'
      WHEN 'receita_total' THEN 'anual'
      WHEN 'projetos_concluidos' THEN 'anual'
      WHEN 'leads_convertidos' THEN 'anual'
      ELSE 'nenhuma'
    END,
    unidade = CASE sync_fonte
      WHEN 'receita_total' THEN 'currency'
      WHEN 'receita_mes' THEN 'currency'
      WHEN 'margem_media' THEN 'percentage'
      ELSE 'quantity'
    END,
    auto_sync = TRUE
WHERE auto_sync IS TRUE
  AND sync_fonte IN ('receita_total', 'receita_mes', 'projetos_concluidos', 'projetos_ativos',
                     'margem_media', 'leads_convertidos');

-- A fonte horas_faturadas lia timesheets, tabela removida em 20260429000001: a meta nunca
-- atualizou. Vira manual, guardando o valor que tinha.
UPDATE public.metas SET auto_sync = FALSE, sync_fonte = NULL
WHERE auto_sync IS TRUE AND sync_fonte = 'horas_faturadas';

-- Metas pessoais antigas tinham categoria própria (entregas, qualidade...). A categoria
-- passa a ser só a área opcional; o que não é área vira null, e a financeira vira
-- 'financeiro'.
UPDATE public.metas
SET categoria = CASE WHEN tipo = 'financeira' THEN 'financeiro' ELSE NULL END
WHERE categoria IS NOT NULL
  AND categoria NOT IN ('geral', 'rh', 'financeiro', 'comercial', 'logistica',
                        'administrativo', 'operacoes', 'inovacao');

ALTER TABLE public.metas DROP CONSTRAINT IF EXISTS metas_categoria_check;
ALTER TABLE public.metas ADD CONSTRAINT metas_categoria_check
  CHECK (categoria IS NULL OR categoria IN (
    'geral', 'rh', 'financeiro', 'comercial', 'logistica',
    'administrativo', 'operacoes', 'inovacao'
  ));

ALTER TABLE public.metas DROP CONSTRAINT IF EXISTS metas_indicador_check;
ALTER TABLE public.metas ADD CONSTRAINT metas_indicador_check
  CHECK (indicador IS NULL OR indicador IN (
    'receita_recebida', 'lucro', 'margem_media',
    'projetos_concluidos', 'projetos_ativos',
    'disciplinas_concluidas', 'tarefas_concluidas',
    'leads_ganhos'
  ));

ALTER TABLE public.metas DROP CONSTRAINT IF EXISTS metas_recorrencia_check;
ALTER TABLE public.metas ADD CONSTRAINT metas_recorrencia_check
  CHECK (recorrencia IN ('nenhuma', 'mensal', 'trimestral', 'anual'));

-- Meta recorrente precisa de indicador (o valor de cada período é calculado).
ALTER TABLE public.metas DROP CONSTRAINT IF EXISTS metas_recorrencia_exige_indicador;
ALTER TABLE public.metas ADD CONSTRAINT metas_recorrencia_exige_indicador
  CHECK (recorrencia = 'nenhuma' OR indicador IS NOT NULL);

-- Só alguns indicadores se medem por pessoa.
ALTER TABLE public.metas DROP CONSTRAINT IF EXISTS metas_indicador_aceita_pessoa;
ALTER TABLE public.metas ADD CONSTRAINT metas_indicador_aceita_pessoa
  CHECK (
    pessoa_id IS NULL OR indicador IS NULL OR indicador IN (
      'projetos_concluidos', 'projetos_ativos', 'disciplinas_concluidas', 'tarefas_concluidas'
    )
  );

ALTER TABLE public.metas DROP CONSTRAINT IF EXISTS metas_unidade_rotulo_len;
ALTER TABLE public.metas ADD CONSTRAINT metas_unidade_rotulo_len
  CHECK (unidade_rotulo IS NULL OR char_length(unidade_rotulo) <= 40);

COMMENT ON COLUMN public.metas.indicador IS
  'SPEC 123: indicador do catálogo (calculado); null = acompanhamento manual.';
COMMENT ON COLUMN public.metas.periodo_inicio IS
  'SPEC 123: início do período em "datas específicas"; o fim é metas.prazo.';
COMMENT ON COLUMN public.metas.recorrencia IS
  'SPEC 123: nenhuma (datas específicas) | mensal | trimestral | anual (período corrente).';
COMMENT ON COLUMN public.metas.tipo IS
  'Legado (SPEC 123): nenhum código lê. O escopo é pessoa_id e o cálculo é indicador.';

-- =====================================================================
-- 2. Janela do período
-- =====================================================================

-- Devolve início e fim do período que contém p_ref. Em "nenhuma" são as datas da meta;
-- null = sem limite daquele lado. Interna: só os RPCs abaixo chamam.
CREATE OR REPLACE FUNCTION public._meta_janela(
  p_recorrencia text, p_inicio date, p_fim date, p_ref date,
  OUT ini date, OUT fim date
)
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT
    CASE p_recorrencia
      WHEN 'mensal' THEN date_trunc('month', p_ref::timestamp)::date
      WHEN 'trimestral' THEN date_trunc('quarter', p_ref::timestamp)::date
      WHEN 'anual' THEN date_trunc('year', p_ref::timestamp)::date
      ELSE p_inicio
    END,
    CASE p_recorrencia
      WHEN 'mensal' THEN (date_trunc('month', p_ref::timestamp) + interval '1 month' - interval '1 day')::date
      WHEN 'trimestral' THEN (date_trunc('quarter', p_ref::timestamp) + interval '3 months' - interval '1 day')::date
      WHEN 'anual' THEN (date_trunc('year', p_ref::timestamp) + interval '1 year' - interval '1 day')::date
      ELSE p_fim
    END;
$$;

-- =====================================================================
-- 3. Cálculo do indicador
-- =====================================================================

-- Valor de um indicador numa janela, para a empresa toda (p_pessoa null) ou uma pessoa.
-- Não checa papel: quem chama (os RPCs abaixo) já checou. Por isso não é executável por
-- usuário.
CREATE OR REPLACE FUNCTION public._meta_valor(
  p_empresa uuid, p_indicador text, p_pessoa uuid, p_inicio date, p_fim date
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ini date := COALESCE(p_inicio, '-infinity'::date);
  v_fim date := COALESCE(p_fim, 'infinity'::date);
  v numeric;
BEGIN
  CASE p_indicador
    WHEN 'receita_recebida' THEN
      SELECT COALESCE(SUM(valor), 0) INTO v
      FROM public.receitas
      WHERE empresa_id = p_empresa
        AND status = 'Recebido'
        AND deleted_at IS NULL
        AND COALESCE(data_recebimento, data_vencimento) BETWEEN v_ini AND v_fim;

    WHEN 'lucro' THEN
      SELECT
        COALESCE((
          SELECT SUM(r.valor) FROM public.receitas r
          WHERE r.empresa_id = p_empresa AND r.status = 'Recebido' AND r.deleted_at IS NULL
            AND COALESCE(r.data_recebimento, r.data_vencimento) BETWEEN v_ini AND v_fim
        ), 0)
        - COALESCE((
          SELECT SUM(d.valor) FROM public.despesas d
          WHERE d.empresa_id = p_empresa AND d.status = 'Pago' AND d.deleted_at IS NULL
            AND COALESCE(d.is_fatura_payment, false) = false
            AND COALESCE(d.data_pagamento, d.data_vencimento) BETWEEN v_ini AND v_fim
        ), 0)
      INTO v;

    WHEN 'margem_media' THEN
      SELECT COALESCE(AVG(((r.total - d.total) / r.total) * 100), 0) INTO v
      FROM (
        SELECT projeto_id, COALESCE(SUM(valor), 0) AS total
        FROM public.receitas
        WHERE empresa_id = p_empresa AND status = 'Recebido' AND deleted_at IS NULL
          AND COALESCE(data_recebimento, data_vencimento) BETWEEN v_ini AND v_fim
        GROUP BY projeto_id
      ) r
      JOIN (
        SELECT projeto_id, COALESCE(SUM(valor), 0) AS total
        FROM public.despesas
        WHERE empresa_id = p_empresa AND status = 'Pago' AND deleted_at IS NULL
          AND projeto_id IS NOT NULL
          AND COALESCE(data_pagamento, data_vencimento) BETWEEN v_ini AND v_fim
        GROUP BY projeto_id
      ) d ON r.projeto_id = d.projeto_id
      WHERE r.total > 0;

    WHEN 'projetos_concluidos' THEN
      -- Data de conclusão: data_final, senão a última virada para Concluído, senão a criação.
      SELECT COUNT(*) INTO v
      FROM public.projetos p
      WHERE p.empresa_id = p_empresa
        AND p.deleted_at IS NULL
        AND p.status = 'Concluído'
        AND COALESCE(
              p.data_final,
              (SELECT max(h.mudado_em)::date FROM public.projeto_status_historico h
                WHERE h.projeto_id = p.id AND h.para = 'Concluído'),
              p.created_at::date
            ) BETWEEN v_ini AND v_fim
        AND (p_pessoa IS NULL OR EXISTS (
              SELECT 1
              FROM public.projeto_disciplinas d
              JOIN public.projeto_disciplina_responsaveis r ON r.projeto_disciplina_id = d.id
              WHERE d.projeto_id = p.id AND r.pessoa_id = p_pessoa
            ));

    WHEN 'projetos_ativos' THEN
      -- Retrato de hoje: não depende da janela.
      SELECT COUNT(*) INTO v
      FROM public.projetos p
      WHERE p.empresa_id = p_empresa
        AND p.deleted_at IS NULL
        AND p.status IN ('Planejamento', 'Em andamento')
        AND (p_pessoa IS NULL OR EXISTS (
              SELECT 1
              FROM public.projeto_disciplinas d
              JOIN public.projeto_disciplina_responsaveis r ON r.projeto_disciplina_id = d.id
              WHERE d.projeto_id = p.id AND r.pessoa_id = p_pessoa
            ));

    WHEN 'disciplinas_concluidas' THEN
      SELECT COUNT(*) INTO v
      FROM public.projeto_disciplinas d
      JOIN public.projetos p ON p.id = d.projeto_id
      WHERE p.empresa_id = p_empresa
        AND p.deleted_at IS NULL
        AND public.pilar_status_bucket(d.status) = 'concluida'
        AND COALESCE(d.data_fim_real, d.updated_at::date, d.created_at::date) BETWEEN v_ini AND v_fim
        AND (p_pessoa IS NULL OR EXISTS (
              SELECT 1 FROM public.projeto_disciplina_responsaveis r
              WHERE r.projeto_disciplina_id = d.id AND r.pessoa_id = p_pessoa
            ));

    WHEN 'tarefas_concluidas' THEN
      -- A tabela não guarda a data de conclusão: vale a última atualização.
      SELECT COUNT(*) INTO v
      FROM public.tarefas t
      WHERE t.empresa_id = p_empresa
        AND t.status = 'concluida'
        AND t.updated_at::date BETWEEN v_ini AND v_fim
        AND (p_pessoa IS NULL
             OR t.responsavel_id = p_pessoa
             OR EXISTS (
                  SELECT 1 FROM public.tarefa_responsaveis tr
                  WHERE tr.tarefa_id = t.id AND tr.pessoa_id = p_pessoa
                ));

    WHEN 'leads_ganhos' THEN
      SELECT COUNT(*) INTO v
      FROM public.leads
      WHERE empresa_id = p_empresa
        AND status = 'Ganho'
        AND deleted_at IS NULL
        AND COALESCE(convertido_em::date, created_at::date) BETWEEN v_ini AND v_fim;

    ELSE
      v := NULL;
  END CASE;

  RETURN v;
END;
$$;

-- =====================================================================
-- 4. RPCs de leitura
-- =====================================================================

-- Progresso de todas as metas da empresa no período que contém p_ref (hoje por padrão).
-- Meta manual devolve o atual gravado. Indicador financeiro sem acesso ao financeiro
-- devolve atual null e restrito = true, em vez de 0.
CREATE OR REPLACE FUNCTION public.rpc_metas_progresso(p_ref date DEFAULT CURRENT_DATE)
RETURNS TABLE (
  meta_id uuid,
  atual numeric,
  janela_inicio date,
  janela_fim date,
  restrito boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_empresa uuid := public.get_user_empresa_id();
  v_fin boolean;
BEGIN
  IF v_empresa IS NULL OR NOT public.user_has_feature('metas', 'viewer') THEN
    RETURN;
  END IF;
  v_fin := public.can_view_financeiro();

  RETURN QUERY
  SELECT
    m.id,
    CASE
      WHEN m.indicador IS NULL THEN m.atual
      WHEN m.indicador IN ('receita_recebida', 'lucro', 'margem_media') AND NOT v_fin THEN NULL
      ELSE public._meta_valor(m.empresa_id, m.indicador, m.pessoa_id, j.ini, j.fim)
    END,
    j.ini,
    j.fim,
    (m.indicador IN ('receita_recebida', 'lucro', 'margem_media') AND NOT v_fin)
  FROM public.metas m
  CROSS JOIN LATERAL public._meta_janela(m.recorrencia, m.periodo_inicio, m.prazo, p_ref) j
  WHERE m.empresa_id = v_empresa
    AND m.deleted_at IS NULL;
END;
$$;

-- Últimos períodos de uma meta recorrente (o corrente primeiro). Meta manual ou sem
-- recorrência não tem histórico e devolve vazio.
CREATE OR REPLACE FUNCTION public.rpc_meta_historico(p_meta_id uuid, p_periodos integer DEFAULT 6)
RETURNS TABLE (
  janela_inicio date,
  janela_fim date,
  atual numeric,
  restrito boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_empresa uuid := public.get_user_empresa_id();
  v_fin boolean;
  v_n integer := LEAST(GREATEST(COALESCE(p_periodos, 6), 1), 24);
  m public.metas;
  v_passo interval;
  v_restrito boolean;
BEGIN
  IF v_empresa IS NULL OR NOT public.user_has_feature('metas', 'viewer') THEN
    RETURN;
  END IF;

  SELECT * INTO m
  FROM public.metas
  WHERE id = p_meta_id AND empresa_id = v_empresa AND deleted_at IS NULL;
  IF NOT FOUND OR m.indicador IS NULL OR m.recorrencia = 'nenhuma' THEN
    RETURN;
  END IF;

  v_fin := public.can_view_financeiro();
  v_restrito := m.indicador IN ('receita_recebida', 'lucro', 'margem_media') AND NOT v_fin;
  v_passo := CASE m.recorrencia
    WHEN 'mensal' THEN interval '1 month'
    WHEN 'trimestral' THEN interval '3 months'
    ELSE interval '1 year'
  END;

  RETURN QUERY
  SELECT
    j.ini,
    j.fim,
    CASE WHEN v_restrito THEN NULL
         ELSE public._meta_valor(m.empresa_id, m.indicador, m.pessoa_id, j.ini, j.fim) END,
    v_restrito
  FROM generate_series(0, v_n - 1) AS i
  CROSS JOIN LATERAL public._meta_janela(m.recorrencia, NULL, NULL, (CURRENT_DATE - i * v_passo)::date) j
  ORDER BY j.ini DESC;
END;
$$;

-- =====================================================================
-- 5. rpc_sync_metas: legado, sobre o mesmo cálculo
-- =====================================================================

-- O front novo não chama mais. Fica para o front antigo durante o deploy e para qualquer
-- leitor de metas.atual: grava o valor do período corrente das metas automáticas.
CREATE OR REPLACE FUNCTION public.rpc_sync_metas()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa uuid := public.get_user_empresa_id();
  v_fin boolean := public.can_view_financeiro();
  v_count integer := 0;
  m record;
  j record;
  v numeric;
BEGIN
  IF v_empresa IS NULL THEN
    RETURN 0;
  END IF;

  FOR m IN
    SELECT * FROM public.metas
    WHERE empresa_id = v_empresa AND deleted_at IS NULL AND indicador IS NOT NULL
  LOOP
    -- ADR 0046: indicador de dinheiro só sincroniza para quem vê o financeiro.
    IF m.indicador IN ('receita_recebida', 'lucro', 'margem_media') AND NOT v_fin THEN
      CONTINUE;
    END IF;
    SELECT * INTO j FROM public._meta_janela(m.recorrencia, m.periodo_inicio, m.prazo, CURRENT_DATE);
    v := public._meta_valor(m.empresa_id, m.indicador, m.pessoa_id, j.ini, j.fim);
    IF v IS NOT NULL THEN
      UPDATE public.metas SET atual = v WHERE id = m.id;
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$function$;

-- =====================================================================
-- 6. Grants
-- =====================================================================

-- Nasce executável por PUBLIC (default privilege do Supabase): fecha antes de abrir.
REVOKE ALL ON FUNCTION public._meta_janela(text, date, date, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._meta_valor(uuid, text, uuid, date, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rpc_metas_progresso(date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_meta_historico(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_metas_progresso(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_meta_historico(uuid, integer) TO authenticated;
