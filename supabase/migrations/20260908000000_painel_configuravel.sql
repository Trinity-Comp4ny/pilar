-- ============================================================================
-- SPEC 092 (revisada) / ADR 0038: o painel do /inicio é montado pelo usuário.
--
-- 1. profiles.painel_layout: lista ordenada de widgets escolhidos. Lista vazia
--    significa "usar o padrão", e o padrão vive no front (por papel), para que
--    mudar o padrão não exija migration de dado de ninguém.
-- 2. set_painel_layout: única porta de escrita, sempre no próprio perfil.
-- 3. get_painel_gestao passa a devolver quatro blocos (gestao, projetos, obras,
--    financeiro) e o `financeiro` só é preenchido para quem pode ver dinheiro.
--    O ADR 0037 tinha eliminado esse ramo condicional; o 0038 o reintroduz de
--    olhos abertos, com teste pgTAP cobrindo os dois papéis.
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS painel_layout jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.profiles.painel_layout IS
  'SPEC 092: widgets escolhidos no /inicio, na ordem da tela. [{"w":"<id>","s":"kpi|terco|meia|inteira"}]. Vazio = layout padrão do front.';

-- ── Escrita do layout ───────────────────────────────────────────────────────
-- SECURITY DEFINER de propósito, e com escopo mínimo: `authenticated` não tem
-- UPDATE em profiles, e dar essa permissão abriria `role` e `empresa_id` na
-- mesma tacada. Esta função escreve UMA coluna, sempre em `auth.uid()`, então o
-- privilégio elevado não vaza para nada além da preferência do próprio usuário.
CREATE OR REPLACE FUNCTION public.set_painel_layout(p_layout jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_item jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'sem sessão';
  END IF;

  IF p_layout IS NULL OR jsonb_typeof(p_layout) <> 'array' THEN
    RAISE EXCEPTION 'painel_layout: deve ser uma lista';
  END IF;

  -- Teto de itens: o construtor de layout não pode virar a poluição que ele
  -- veio resolver, e um array sem limite é payload sem limite.
  IF jsonb_array_length(p_layout) > 40 THEN
    RAISE EXCEPTION 'painel_layout: no máximo 40 widgets';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_layout) LOOP
    IF COALESCE(jsonb_typeof(v_item -> 'w'), 'ausente') <> 'string'
       OR btrim(v_item ->> 'w') = '' THEN
      RAISE EXCEPTION 'painel_layout: cada item precisa de "w" (id do widget) como texto';
    END IF;
    IF COALESCE(v_item ->> 's', '') NOT IN ('kpi', 'terco', 'meia', 'inteira') THEN
      RAISE EXCEPTION 'painel_layout: tamanho inválido (%)', COALESCE(v_item ->> 's', 'ausente');
    END IF;
  END LOOP;

  UPDATE public.profiles SET painel_layout = p_layout WHERE id = auth.uid();
END;
$fn$;

REVOKE ALL ON FUNCTION public.set_painel_layout(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_painel_layout(jsonb) TO authenticated;

-- ── Dados do painel, agora por módulo ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_painel_gestao()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
SET search_path = public
AS $fn$
DECLARE
  v_hoje date := current_date;
  v_ve_dinheiro boolean := public.can_view_financeiro();
  v_result jsonb;
BEGIN
  WITH
  -- ══ Propostas e leads (seção Gestão) ═════════════════════════════════════
  -- "expirada" é derivada, não gravada: mesma regra da tela de propostas.
  prop AS (
    SELECT
      p.id,
      p.created_at,
      CASE
        WHEN p.status IN ('rascunho', 'enviada') AND p.validade IS NOT NULL AND p.validade < v_hoje
          THEN 'expirada'
        ELSE COALESCE(p.status, 'rascunho')
      END AS status_efetivo
    FROM public.propostas p
    WHERE p.deleted_at IS NULL
  ),
  prop_90 AS (SELECT * FROM prop WHERE created_at >= (v_hoje - interval '90 days')),
  meses AS (
    SELECT generate_series(
      date_trunc('month', v_hoje) - interval '11 months',
      date_trunc('month', v_hoje),
      interval '1 month'
    )::date AS mes
  ),
  funil AS (
    SELECT jsonb_agg(jsonb_build_object('etapa', etapa, 'n', n) ORDER BY ord) AS items
    FROM (
      SELECT e.etapa, e.ord, COUNT(prop_90.id)::int AS n
      FROM (VALUES ('rascunho', 1), ('enviada', 2), ('aceita', 3), ('recusada', 4), ('expirada', 5))
             AS e(etapa, ord)
      LEFT JOIN prop_90 ON prop_90.status_efetivo = e.etapa
      GROUP BY e.etapa, e.ord
    ) x
  ),
  -- Coorte de criação, não data de decisão: handle_record_audit reescreve
  -- updated_at em toda edição, então ele é a data da última mexida.
  decididas AS (
    SELECT date_trunc('month', created_at)::date AS mes, status_efetivo
    FROM prop WHERE status_efetivo IN ('aceita', 'recusada', 'expirada')
  ),
  conversao_mensal AS (
    SELECT jsonb_agg(jsonb_build_object(
             'mes', m.mes, 'ganhas', COALESCE(g.n, 0), 'perdidas', COALESCE(pd.n, 0)
           ) ORDER BY m.mes) AS items
    FROM meses m
    LEFT JOIN (SELECT mes, COUNT(*)::int AS n FROM decididas WHERE status_efetivo = 'aceita' GROUP BY mes) g
      ON g.mes = m.mes
    LEFT JOIN (SELECT mes, COUNT(*)::int AS n FROM decididas WHERE status_efetivo <> 'aceita' GROUP BY mes) pd
      ON pd.mes = m.mes
  ),
  perdas AS (
    SELECT lower(btrim(COALESCE(motivo_perda, ''))) AS motivo
    FROM public.leads
    WHERE deleted_at IS NULL AND status = 'Perdido' AND created_at >= (v_hoje - interval '12 months')
  ),
  perdas_norm AS (
    SELECT CASE
             WHEN motivo LIKE '%preç%' OR motivo LIKE '%prec%' OR motivo LIKE '%valor%' OR motivo LIKE '%car%' THEN 'Preço'
             WHEN motivo LIKE '%prazo%' OR motivo LIKE '%tempo%' THEN 'Prazo'
             WHEN motivo LIKE '%respost%' OR motivo LIKE '%contato%' OR motivo LIKE '%sumi%' THEN 'Sem resposta'
             WHEN motivo LIKE '%escopo%' THEN 'Escopo'
             WHEN motivo LIKE '%concorr%' THEN 'Concorrente'
             WHEN motivo LIKE '%cancel%' OR motivo LIKE '%desist%' THEN 'Projeto cancelado'
             WHEN motivo = '' THEN 'Sem motivo registrado'
             ELSE 'Outro'
           END AS motivo_padrao
    FROM perdas
  ),
  motivos AS (
    SELECT jsonb_agg(jsonb_build_object('motivo', motivo_padrao, 'n', n) ORDER BY n DESC) AS items
    FROM (SELECT motivo_padrao, COUNT(*)::int AS n FROM perdas_norm GROUP BY motivo_padrao) x
  ),
  espera AS (
    SELECT jsonb_agg(jsonb_build_object('faixa', faixa, 'n', n) ORDER BY ord) AS items
    FROM (
      SELECT f.faixa, f.ord, COUNT(e.id)::int AS n
      FROM (VALUES ('Até 7 dias', 1), ('8 a 15 dias', 2), ('16 a 30 dias', 3), ('Mais de 30 dias', 4))
             AS f(faixa, ord)
      LEFT JOIN (
        -- Idade da proposta: updated_at é reescrito pelo trigger de auditoria.
        SELECT id, CASE
                     WHEN (v_hoje - created_at::date) <= 7 THEN 'Até 7 dias'
                     WHEN (v_hoje - created_at::date) <= 15 THEN '8 a 15 dias'
                     WHEN (v_hoje - created_at::date) <= 30 THEN '16 a 30 dias'
                     ELSE 'Mais de 30 dias'
                   END AS faixa
        FROM prop WHERE status_efetivo = 'enviada'
      ) e ON e.faixa = f.faixa
      GROUP BY f.faixa, f.ord
    ) x
  ),
  origens AS (
    SELECT jsonb_agg(jsonb_build_object('origem', origem, 'leads', total, 'ganhoPct', pct) ORDER BY total DESC) AS items
    FROM (
      SELECT COALESCE(NULLIF(btrim(origem), ''), 'Sem origem') AS origem,
             COUNT(*)::int AS total,
             ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'Ganho') / NULLIF(COUNT(*), 0))::int AS pct
      FROM public.leads
      WHERE deleted_at IS NULL AND created_at >= (v_hoje - interval '12 months')
      GROUP BY 1 HAVING COUNT(*) >= 2 ORDER BY total DESC LIMIT 6
    ) x
  ),

  -- ══ Projetos ═════════════════════════════════════════════════════════════
  proj AS (
    SELECT p.id, p.nome, p.status::text AS status, p.data_previsao, p.data_final
    FROM public.projetos p WHERE p.deleted_at IS NULL
  ),
  ativos AS (SELECT * FROM proj WHERE status NOT IN ('Concluído', 'Cancelado')),
  -- Os números palpáveis que o design partner pediu, sem rodeio.
  projetos_totais AS (
    SELECT
      (SELECT COUNT(*)::int FROM ativos) AS ativos,
      (SELECT COUNT(*)::int FROM ativos WHERE status = 'Em andamento') AS em_andamento,
      (SELECT COUNT(*)::int FROM ativos WHERE status = 'Planejamento') AS planejamento,
      (SELECT COUNT(*)::int FROM ativos WHERE status = 'Paralisado') AS paralisado,
      (SELECT COUNT(*)::int FROM ativos WHERE data_previsao IS NOT NULL AND data_previsao < v_hoje) AS atrasados,
      (SELECT COUNT(*)::int FROM ativos WHERE data_previsao IS NOT NULL AND data_previsao BETWEEN v_hoje AND v_hoje + 15) AS risco,
      (SELECT COUNT(*)::int FROM ativos WHERE data_previsao IS NULL) AS sem_prazo,
      (SELECT COUNT(*)::int FROM proj WHERE data_final IS NOT NULL AND data_final >= date_trunc('year', v_hoje)::date) AS concluidos_ano
  ),
  status_ativos AS (
    SELECT jsonb_agg(jsonb_build_object('status', status, 'n', n) ORDER BY n DESC) AS items
    FROM (SELECT status, COUNT(*)::int AS n FROM ativos GROUP BY status) x
  ),
  concluidos AS (
    SELECT date_trunc('month', data_final)::date AS mes, (data_final <= data_previsao) AS no_prazo
    FROM proj
    WHERE data_final IS NOT NULL AND data_previsao IS NOT NULL
      AND data_final >= (date_trunc('month', v_hoje) - interval '11 months')
  ),
  pontualidade AS (
    SELECT jsonb_agg(jsonb_build_object('mes', m.mes, 'pct', c.pct, 'total', COALESCE(c.total, 0)) ORDER BY m.mes) AS items
    FROM meses m
    LEFT JOIN (
      SELECT mes, COUNT(*)::int AS total,
             ROUND(100.0 * COUNT(*) FILTER (WHERE no_prazo) / NULLIF(COUNT(*), 0))::int AS pct
      FROM concluidos GROUP BY mes
    ) c ON c.mes = m.mes
  ),
  pausas AS (
    SELECT projeto_disciplina_id,
           SUM(GREATEST(0, EXTRACT(day FROM COALESCE(retomado_em, now()) - pausado_em)))::int AS dias
    FROM public.projeto_disciplina_pausas GROUP BY projeto_disciplina_id
  ),
  disc_atraso AS (
    SELECT COALESCE(NULLIF(btrim(d.nome), ''), 'Sem nome') AS disciplina,
           GREATEST(0, (d.data_fim_real - d.data_fim) - COALESCE(pa.dias, 0)) AS dias_atraso
    FROM public.projeto_disciplinas d
    LEFT JOIN pausas pa ON pa.projeto_disciplina_id = d.id
    WHERE d.data_fim IS NOT NULL AND d.data_fim_real IS NOT NULL
      AND d.data_fim_real >= (v_hoje - interval '12 months')
  ),
  atraso_disciplina AS (
    SELECT jsonb_agg(jsonb_build_object('disciplina', disciplina, 'diasMedio', dias, 'entregas', entregas) ORDER BY dias DESC) AS items
    FROM (
      SELECT disciplina, ROUND(AVG(dias_atraso))::int AS dias, COUNT(*)::int AS entregas
      FROM disc_atraso GROUP BY disciplina ORDER BY dias DESC LIMIT 8
    ) x
  ),
  prazos_15 AS (
    SELECT jsonb_agg(jsonb_build_object(
             'disciplinaId', id, 'disciplina', disciplina, 'projetoId', projeto_id,
             'projeto', projeto, 'dias', dias, 'responsavel', responsavel
           ) ORDER BY dias) AS items
    FROM (
      SELECT d.id, COALESCE(NULLIF(btrim(d.nome), ''), 'Sem nome') AS disciplina,
             p.id AS projeto_id, p.nome AS projeto, (d.data_fim - v_hoje) AS dias,
             ps.primeiro_nome AS responsavel
      FROM public.projeto_disciplinas d
      JOIN proj p ON p.id = d.projeto_id
      LEFT JOIN public.projeto_disciplina_responsaveis dr ON dr.projeto_disciplina_id = d.id
      LEFT JOIN public.pessoas_safe ps ON ps.id = dr.pessoa_id
      WHERE COALESCE(d.status, 'pendente') <> 'concluida'
        AND d.data_fim IS NOT NULL AND d.data_fim <= v_hoje + 15
      ORDER BY d.data_fim LIMIT 8
    ) x
  ),
  horas_proj AS (
    SELECT p.id, p.nome, SUM(d.horas_estimadas)::numeric AS est, SUM(d.horas_realizadas)::numeric AS realizadas
    FROM ativos p
    JOIN public.projeto_disciplinas d ON d.projeto_id = p.id
    GROUP BY p.id, p.nome HAVING SUM(d.horas_estimadas) > 0
  ),
  horas AS (
    SELECT jsonb_agg(jsonb_build_object(
             'projetoId', id, 'projeto', nome, 'estimadas', est, 'realizadas', realizadas, 'desvioPct', pct
           ) ORDER BY abs(pct) DESC) AS items
    FROM (
      SELECT id, nome, est, realizadas, ROUND(100.0 * (realizadas - est) / NULLIF(est, 0))::int AS pct
      FROM horas_proj ORDER BY abs(ROUND(100.0 * (realizadas - est) / NULLIF(est, 0))) DESC LIMIT 8
    ) x
  ),

  -- ══ Equipe e fila (seção Gestão) ═════════════════════════════════════════
  semanas AS (
    SELECT generate_series(
      date_trunc('week', v_hoje) - interval '11 weeks', date_trunc('week', v_hoje), interval '1 week'
    )::date AS semana
  ),
  -- `tarefas` não tem data de conclusão: updated_at é o proxy disponível.
  tarefas_feitas AS (
    SELECT date_trunc('week', updated_at)::date AS semana
    FROM public.tarefas
    WHERE status = 'concluida' AND updated_at >= (date_trunc('week', v_hoje) - interval '11 weeks')
  ),
  throughput AS (
    SELECT jsonb_agg(jsonb_build_object('semana', s.semana, 'n', COALESCE(t.n, 0)) ORDER BY s.semana) AS items
    FROM semanas s
    LEFT JOIN (SELECT semana, COUNT(*)::int AS n FROM tarefas_feitas GROUP BY semana) t ON t.semana = s.semana
  ),
  carga AS (
    SELECT jsonb_agg(jsonb_build_object(
             'pessoaId', pessoa_id, 'nome', nome, 'emDia', em_dia, 'atrasada', atrasada
           ) ORDER BY (em_dia + atrasada) DESC) AS items
    FROM (
      SELECT dr.pessoa_id,
             COALESCE(NULLIF(btrim(COALESCE(ps.primeiro_nome, '') || ' ' || COALESCE(ps.sobrenome, '')), ''), 'Sem responsável') AS nome,
             COUNT(*) FILTER (WHERE d.data_fim IS NULL OR d.data_fim >= v_hoje)::int AS em_dia,
             COUNT(*) FILTER (WHERE d.data_fim IS NOT NULL AND d.data_fim < v_hoje)::int AS atrasada
      FROM public.projeto_disciplina_responsaveis dr
      JOIN public.projeto_disciplinas d ON d.id = dr.projeto_disciplina_id
      JOIN ativos p ON p.id = d.projeto_id
      LEFT JOIN public.pessoas_safe ps ON ps.id = dr.pessoa_id
      WHERE COALESCE(d.status, 'pendente') <> 'concluida'
      GROUP BY dr.pessoa_id, ps.primeiro_nome, ps.sobrenome
      ORDER BY em_dia DESC, atrasada DESC LIMIT 8
    ) x
  ),
  aprovacoes AS (
    SELECT jsonb_agg(jsonb_build_object(
             'escopoId', id, 'tipo', tipo, 'projetoId', projeto_id, 'projeto', projeto, 'dias', dias
           ) ORDER BY dias DESC) AS items
    FROM (
      SELECT e.id, e.tipo, p.id AS projeto_id, p.nome AS projeto, (v_hoje - e.created_at::date) AS dias
      FROM public.escopos e JOIN proj p ON p.id = e.projeto_id
      WHERE e.deleted_at IS NULL AND e.status = 'pendente_aprovacao'
      ORDER BY e.created_at LIMIT 8
    ) x
  ),
  propostas_totais AS (
    SELECT
      (SELECT COUNT(*)::int FROM prop_90 WHERE status_efetivo IN ('enviada', 'aceita', 'recusada', 'expirada')) AS enviadas,
      (SELECT COUNT(*)::int FROM prop_90 WHERE status_efetivo = 'aceita') AS ganhas,
      (SELECT COUNT(*)::int FROM prop_90 WHERE status_efetivo IN ('recusada', 'expirada')) AS perdidas,
      (SELECT COUNT(*)::int FROM prop WHERE status_efetivo = 'enviada') AS aguardando,
      (SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE status_efetivo = 'aceita')
              / NULLIF(COUNT(*) FILTER (WHERE status_efetivo IN ('aceita','recusada','expirada')), 0))::int
       FROM prop_90) AS conversao_pct
  ),

  -- ══ Obras ════════════════════════════════════════════════════════════════
  obr AS (
    SELECT o.id, o.nome, o.status, o.data_fim_prevista, o.data_fim_real
    FROM public.obras o WHERE o.deleted_at IS NULL
  ),
  obras_totais AS (
    SELECT
      (SELECT COUNT(*)::int FROM obr WHERE status = 'em_andamento') AS em_andamento,
      (SELECT COUNT(*)::int FROM obr WHERE status = 'planejada') AS planejadas,
      (SELECT COUNT(*)::int FROM obr WHERE status = 'paralisada') AS paralisadas,
      (SELECT COUNT(*)::int FROM obr
        WHERE status <> 'concluida' AND data_fim_prevista IS NOT NULL AND data_fim_prevista < v_hoje) AS atrasadas
  ),
  -- Dias sem RDO por obra em andamento: é o indicador de campo que diz se o
  -- diário está sendo alimentado.
  rdo_ultimo AS (
    SELECT o.id, o.nome, MAX(r.data) AS ultimo
    FROM obr o
    LEFT JOIN public.obra_rdo r ON r.obra_id = o.id
    WHERE o.status = 'em_andamento'
    GROUP BY o.id, o.nome
  ),
  obras_rdo AS (
    SELECT jsonb_agg(jsonb_build_object(
             'obraId', id, 'obra', nome, 'ultimoRdo', ultimo, 'diasSemRdo', dias
           ) ORDER BY dias DESC NULLS FIRST) AS items
    FROM (
      SELECT id, nome, ultimo,
             CASE WHEN ultimo IS NULL THEN NULL ELSE (v_hoje - ultimo) END AS dias
      FROM rdo_ultimo ORDER BY dias DESC NULLS FIRST LIMIT 8
    ) x
  ),
  -- Avanço físico por obra: tarefas concluídas sobre total, o mesmo cálculo
  -- que a tela de obra usa.
  obras_avanco AS (
    SELECT jsonb_agg(jsonb_build_object(
             'obraId', obra_id, 'obra', obra, 'concluidas', feitas, 'total', total, 'pct', pct
           ) ORDER BY pct) AS items
    FROM (
      SELECT o.id AS obra_id, o.nome AS obra,
             COUNT(*) FILTER (WHERE t.status = 'concluida')::int AS feitas,
             COUNT(*)::int AS total,
             ROUND(100.0 * COUNT(*) FILTER (WHERE t.status = 'concluida') / NULLIF(COUNT(*), 0))::int AS pct
      FROM obr o
      JOIN public.tarefas t ON t.obra_id = o.id
      WHERE o.status = 'em_andamento'
      GROUP BY o.id, o.nome
      ORDER BY pct LIMIT 8
    ) x
  ),

  -- ══ Financeiro: só para quem pode ver dinheiro (ADR 0034/0038) ═══════════
  -- Recebido/pago são FLUXO do mês corrente. A receber, a pagar e o que está
  -- vencido são ESTOQUE: não filtram por mês, senão uma fatura vencida no mês
  -- passado desapareceria justamente do número que existe para cobrá-la.
  fin_mes AS (
    SELECT
      COALESCE(SUM(r.valor) FILTER (
        WHERE r.status = 'Recebido'
          AND COALESCE(r.data_recebimento, r.data_vencimento) >= date_trunc('month', v_hoje)::date
      ), 0)::float8 AS recebido,
      COALESCE(SUM(r.valor) FILTER (WHERE r.status = 'Pendente' AND r.data_vencimento < v_hoje), 0)::float8 AS receber_vencido,
      COALESCE(SUM(r.valor) FILTER (WHERE r.status = 'Pendente'), 0)::float8 AS a_receber
    FROM public.receitas r
    WHERE v_ve_dinheiro AND r.status <> 'Cancelado'
  ),
  fin_desp AS (
    SELECT
      COALESCE(SUM(d.valor) FILTER (
        WHERE d.status = 'Pago'
          AND COALESCE(d.data_pagamento, d.data_vencimento) >= date_trunc('month', v_hoje)::date
      ), 0)::float8 AS pago,
      COALESCE(SUM(d.valor) FILTER (WHERE d.status = 'Pendente' AND d.data_vencimento < v_hoje), 0)::float8 AS pagar_vencido,
      COALESCE(SUM(d.valor) FILTER (WHERE d.status = 'Pendente'), 0)::float8 AS a_pagar
    FROM public.despesas d
    WHERE v_ve_dinheiro AND d.status <> 'Cancelado'
  ),
  fin_marcos AS (
    SELECT jsonb_agg(jsonb_build_object('mes', mes, 'previsto', previsto, 'faturado', faturado) ORDER BY mes) AS items
    FROM (
      SELECT date_trunc('month', COALESCE(m.data_faturada, m.data_prevista))::date AS mes,
             COALESCE(SUM(m.valor) FILTER (WHERE m.data_prevista IS NOT NULL), 0)::float8 AS previsto,
             COALESCE(SUM(m.valor) FILTER (WHERE m.data_faturada IS NOT NULL), 0)::float8 AS faturado
      FROM public.marcos_faturamento m
      WHERE v_ve_dinheiro AND m.deleted_at IS NULL
        AND COALESCE(m.data_faturada, m.data_prevista) >= date_trunc('year', v_hoje)::date
      GROUP BY 1 ORDER BY 1
    ) x
  ),
  fin_margem AS (
    SELECT jsonb_agg(jsonb_build_object('projetoId', projeto_id, 'projeto', projeto, 'pct', pct) ORDER BY pct) AS items
    FROM (
      SELECT p.id AS projeto_id, p.nome AS projeto,
             ROUND(100.0 * (SUM(v.custo_orcado) - SUM(v.custo_real)) / NULLIF(SUM(v.custo_orcado), 0))::int AS pct
      FROM public.v_budget_vs_actual v
      JOIN ativos p ON p.id = v.projeto_id
      WHERE v_ve_dinheiro
      GROUP BY p.id, p.nome
      HAVING SUM(v.custo_orcado) > 0
      ORDER BY 3 LIMIT 8
    ) x
  ),

  cobertura AS (
    SELECT
      (SELECT MIN(created_at)::date FROM prop) AS desde,
      (SELECT COUNT(*)::int FROM ativos WHERE data_previsao IS NULL) AS projetos_sem_prazo,
      (SELECT COUNT(*)::int FROM perdas_norm WHERE motivo_padrao IN ('Outro', 'Sem motivo registrado')) AS leads_sem_motivo_padrao
  )

  SELECT jsonb_build_object(
    'gestao', jsonb_build_object(
      'propostasTotais', (SELECT jsonb_build_object(
        'enviadas', enviadas, 'ganhas', ganhas, 'perdidas', perdidas,
        'aguardando', aguardando, 'conversaoPct', conversao_pct
      ) FROM propostas_totais),
      'funil', COALESCE((SELECT items FROM funil), '[]'::jsonb),
      'conversaoMensal', COALESCE((SELECT items FROM conversao_mensal), '[]'::jsonb),
      'motivosPerda', COALESCE((SELECT items FROM motivos), '[]'::jsonb),
      'esperaProposta', COALESCE((SELECT items FROM espera), '[]'::jsonb),
      'origemGanho', COALESCE((SELECT items FROM origens), '[]'::jsonb),
      'throughputSemanal', COALESCE((SELECT items FROM throughput), '[]'::jsonb),
      'cargaEquipe', COALESCE((SELECT items FROM carga), '[]'::jsonb),
      'filaAprovacao', COALESCE((SELECT items FROM aprovacoes), '[]'::jsonb)
    ),
    'projetos', jsonb_build_object(
      'totais', (SELECT jsonb_build_object(
        'ativos', ativos, 'emAndamento', em_andamento, 'planejamento', planejamento,
        'paralisado', paralisado, 'atrasados', atrasados, 'risco', risco,
        'semPrazo', sem_prazo, 'concluidosAno', concluidos_ano
      ) FROM projetos_totais),
      'statusAtivos', COALESCE((SELECT items FROM status_ativos), '[]'::jsonb),
      'pontualidadeMensal', COALESCE((SELECT items FROM pontualidade), '[]'::jsonb),
      'atrasoPorDisciplina', COALESCE((SELECT items FROM atraso_disciplina), '[]'::jsonb),
      'prazos15Dias', COALESCE((SELECT items FROM prazos_15), '[]'::jsonb),
      'horasPorProjeto', COALESCE((SELECT items FROM horas), '[]'::jsonb)
    ),
    'obras', jsonb_build_object(
      'totais', (SELECT jsonb_build_object(
        'emAndamento', em_andamento, 'planejadas', planejadas,
        'paralisadas', paralisadas, 'atrasadas', atrasadas
      ) FROM obras_totais),
      'rdoPorObra', COALESCE((SELECT items FROM obras_rdo), '[]'::jsonb),
      'avancoPorObra', COALESCE((SELECT items FROM obras_avanco), '[]'::jsonb)
    ),
    'financeiro', CASE WHEN v_ve_dinheiro THEN jsonb_build_object(
      'mes', (SELECT jsonb_build_object(
        'recebido', recebido, 'aReceber', a_receber, 'receberVencido', receber_vencido
      ) FROM fin_mes),
      'despesaMes', (SELECT jsonb_build_object(
        'pago', pago, 'aPagar', a_pagar, 'pagarVencido', pagar_vencido
      ) FROM fin_desp),
      'faturamento', COALESCE((SELECT items FROM fin_marcos), '[]'::jsonb),
      'margemPorProjeto', COALESCE((SELECT items FROM fin_margem), '[]'::jsonb)
    ) ELSE NULL END,
    'cobertura', (SELECT jsonb_build_object(
      'desde', desde,
      'projetosSemPrazo', projetos_sem_prazo,
      'leadsSemMotivoPadrao', leads_sem_motivo_padrao
    ) FROM cobertura)
  ) INTO v_result;

  RETURN v_result;
END;
$fn$;

COMMENT ON FUNCTION public.get_painel_gestao() IS
  'SPEC 092: agrega o painel do /inicio em uma chamada, por módulo (gestao, projetos, obras) mais financeiro. SECURITY INVOKER: o RLS filtra a empresa. A chave financeiro é nula para quem não passa em can_view_financeiro (ADR 0034/0038).';

REVOKE ALL ON FUNCTION public.get_painel_gestao() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_painel_gestao() TO authenticated;
