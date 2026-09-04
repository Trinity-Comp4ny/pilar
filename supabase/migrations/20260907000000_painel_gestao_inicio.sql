-- ============================================================================
-- SPEC 092 / ADR 0037: painel de gestão no /inicio.
--
-- Uma RPC agregada por painel, em vez das ~12 queries de linha que o
-- useDashboardData faz hoje no client. Segue o padrão da spec 044
-- (get_finance_stats): SECURITY INVOKER + STABLE, deixando o RLS filtrar a
-- empresa. Não usamos SECURITY DEFINER: com INVOKER, quem não pode ler a linha
-- não a soma, sem nós precisarmos acertar um filtro de empresa_id à mão.
--
-- REGRA DURA DESTA FUNÇÃO: nenhuma coluna monetária entra aqui. Sem valor,
-- valor_proposto, valor_contrato, valor_aditivo, custo_*. Dinheiro tem eixo de
-- acesso próprio (ADR 0034) e vive no Financeiro; este painel serve a qualquer
-- papel e pode ficar numa TV do escritório. O teste em
-- supabase/tests/painel_gestao.sql falha se alguma aparecer no corpo da função.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_painel_gestao()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
SET search_path = public
AS $fn$
DECLARE
  v_hoje date := current_date;
  v_result jsonb;
BEGIN
  WITH
  -- ══ Comercial ════════════════════════════════════════════════════════════
  -- Expirada é derivada, não gravada: mesma regra da tela de propostas
  -- (validade no passado + status ainda aberto).
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
  prop_90 AS (
    SELECT * FROM prop WHERE created_at >= (v_hoje - interval '90 days')
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
  -- Conversão mensal por COORTE de criação: das propostas criadas no mês X,
  -- quantas foram ganhas e quantas perdidas. Não usamos updated_at como data da
  -- decisão porque o trigger handle_record_audit o reescreve em toda edição:
  -- seria o mês da última edição, não o da decisão. Com `decidida_em` (fase 2)
  -- isto passa a ser uma linha do tempo de decisões, que é o que o sócio lê.
  meses AS (
    SELECT generate_series(
      date_trunc('month', v_hoje) - interval '11 months',
      date_trunc('month', v_hoje),
      interval '1 month'
    )::date AS mes
  ),
  decididas AS (
    SELECT date_trunc('month', created_at)::date AS mes, status_efetivo
    FROM prop
    WHERE status_efetivo IN ('aceita', 'recusada', 'expirada')
  ),
  conversao_mensal AS (
    SELECT jsonb_agg(jsonb_build_object(
             'mes', m.mes,
             'ganhas', COALESCE(g.n, 0),
             'perdidas', COALESCE(pd.n, 0)
           ) ORDER BY m.mes) AS items
    FROM meses m
    LEFT JOIN (
      SELECT mes, COUNT(*)::int AS n FROM decididas WHERE status_efetivo = 'aceita' GROUP BY mes
    ) g ON g.mes = m.mes
    LEFT JOIN (
      SELECT mes, COUNT(*)::int AS n FROM decididas WHERE status_efetivo <> 'aceita' GROUP BY mes
    ) pd ON pd.mes = m.mes
  ),
  -- Pareto de perda. motivo_perda é texto livre (fase 2): normalizamos o que dá
  -- e jogamos o resto em "outro", contando quantos ficaram fora do padrão.
  perdas AS (
    SELECT lower(btrim(COALESCE(motivo_perda, ''))) AS motivo
    FROM public.leads
    WHERE deleted_at IS NULL AND status = 'Perdido'
      AND created_at >= (v_hoje - interval '12 months')
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
  -- Tempo de espera das propostas que estão na mão do cliente agora.
  espera AS (
    SELECT jsonb_agg(jsonb_build_object('faixa', faixa, 'n', n) ORDER BY ord) AS items
    FROM (
      SELECT f.faixa, f.ord, COUNT(e.id)::int AS n
      FROM (VALUES ('Até 7 dias', 1), ('8 a 15 dias', 2), ('16 a 30 dias', 3), ('Mais de 30 dias', 4))
             AS f(faixa, ord)
      LEFT JOIN (
        -- Idade da proposta (created_at), não tempo desde a última edição:
        -- updated_at é reescrito pelo trigger de auditoria a cada save.
        SELECT id,
               CASE
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
    SELECT jsonb_agg(jsonb_build_object(
             'origem', origem, 'leads', total, 'ganhoPct', pct
           ) ORDER BY total DESC) AS items
    FROM (
      SELECT COALESCE(NULLIF(btrim(origem), ''), 'Sem origem') AS origem,
             COUNT(*)::int AS total,
             ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'Ganho') / NULLIF(COUNT(*), 0))::int AS pct
      FROM public.leads
      WHERE deleted_at IS NULL AND created_at >= (v_hoje - interval '12 months')
      GROUP BY 1
      HAVING COUNT(*) >= 2
      ORDER BY total DESC
      LIMIT 6
    ) x
  ),

  -- ══ Entrega ══════════════════════════════════════════════════════════════
  -- data_previsao_original ainda não existe (fase 2). Usamos data_previsao com
  -- fallback declarado, e a cobertura avisa que o baseline pode ter andado.
  proj AS (
    SELECT p.id, p.nome, p.status::text AS status, p.data_previsao, p.data_final, p.status_data
    FROM public.projetos p
    WHERE p.deleted_at IS NULL
  ),
  ativos AS (
    SELECT * FROM proj WHERE status NOT IN ('Concluído', 'Cancelado')
  ),
  disc_abertas AS (
    SELECT d.projeto_id, d.data_fim
    FROM public.projeto_disciplinas d
    WHERE COALESCE(d.status, 'pendente') <> 'concluida'
  ),
  semaforo AS (
    SELECT
      COUNT(*) FILTER (WHERE a.data_previsao IS NOT NULL AND a.data_previsao < v_hoje)::int AS estourado,
      COUNT(*) FILTER (
        WHERE a.data_previsao IS NOT NULL
          AND a.data_previsao >= v_hoje
          AND a.data_previsao <= v_hoje + 15
      )::int AS risco,
      COUNT(*) FILTER (WHERE a.data_previsao IS NOT NULL AND a.data_previsao > v_hoje + 15)::int AS no_prazo,
      COUNT(*) FILTER (WHERE a.data_previsao IS NULL)::int AS sem_prazo
    FROM ativos a
  ),
  status_ativos AS (
    SELECT jsonb_agg(jsonb_build_object('status', status, 'n', n) ORDER BY n DESC) AS items
    FROM (SELECT status, COUNT(*)::int AS n FROM ativos GROUP BY status) x
  ),
  concluidos AS (
    SELECT date_trunc('month', data_final)::date AS mes,
           (data_final <= data_previsao) AS no_prazo
    FROM proj
    WHERE data_final IS NOT NULL AND data_previsao IS NOT NULL
      AND data_final >= (date_trunc('month', v_hoje) - interval '11 months')
  ),
  pontualidade AS (
    SELECT jsonb_agg(jsonb_build_object(
             'mes', m.mes,
             'pct', c.pct,
             'total', COALESCE(c.total, 0)
           ) ORDER BY m.mes) AS items
    FROM meses m
    LEFT JOIN (
      SELECT mes,
             COUNT(*)::int AS total,
             ROUND(100.0 * COUNT(*) FILTER (WHERE no_prazo) / NULLIF(COUNT(*), 0))::int AS pct
      FROM concluidos GROUP BY mes
    ) c ON c.mes = m.mes
  ),
  -- Atraso por disciplina, descontando pausa documentada (spec 084): parada por
  -- pendência do cliente não é atraso da equipe.
  pausas AS (
    SELECT projeto_disciplina_id,
           SUM(GREATEST(0, EXTRACT(day FROM COALESCE(retomado_em, now()) - pausado_em)))::int AS dias
    FROM public.projeto_disciplina_pausas
    GROUP BY projeto_disciplina_id
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
    SELECT jsonb_agg(jsonb_build_object(
             'disciplina', disciplina, 'diasMedio', dias, 'entregas', entregas
           ) ORDER BY dias DESC) AS items
    FROM (
      SELECT disciplina,
             ROUND(AVG(dias_atraso))::int AS dias,
             COUNT(*)::int AS entregas
      FROM disc_atraso
      GROUP BY disciplina
      ORDER BY dias DESC
      LIMIT 8
    ) x
  ),
  prazos_15 AS (
    SELECT jsonb_agg(jsonb_build_object(
             'disciplinaId', id, 'disciplina', disciplina, 'projetoId', projeto_id,
             'projeto', projeto, 'dias', dias, 'responsavel', responsavel, 'iniciais', iniciais
           ) ORDER BY dias) AS items
    FROM (
      SELECT d.id,
             COALESCE(NULLIF(btrim(d.nome), ''), 'Sem nome') AS disciplina,
             p.id AS projeto_id,
             p.nome AS projeto,
             (d.data_fim - v_hoje) AS dias,
             ps.primeiro_nome AS responsavel,
             -- Iniciais prontas do servidor: o modo TV não expõe nome de pessoa.
             NULLIF(upper(COALESCE(left(btrim(ps.primeiro_nome), 1), '')) || upper(COALESCE(left(btrim(ps.sobrenome), 1), '')), '') AS iniciais
      FROM public.projeto_disciplinas d
      JOIN proj p ON p.id = d.projeto_id
      LEFT JOIN public.projeto_disciplina_responsaveis dr ON dr.projeto_disciplina_id = d.id
      LEFT JOIN public.pessoas_safe ps ON ps.id = dr.pessoa_id
      WHERE COALESCE(d.status, 'pendente') <> 'concluida'
        AND d.data_fim IS NOT NULL
        AND d.data_fim <= v_hoje + 15
      ORDER BY d.data_fim
      LIMIT 8
    ) x
  ),

  -- ══ Produtividade ════════════════════════════════════════════════════════
  semanas AS (
    SELECT generate_series(
      date_trunc('week', v_hoje) - interval '11 weeks',
      date_trunc('week', v_hoje),
      interval '1 week'
    )::date AS semana
  ),
  -- `tarefas` não tem coluna de data de conclusão: updated_at é o proxy
  -- disponível e, para tarefa já concluída, corresponde à última mexida nela.
  tarefas_feitas AS (
    SELECT date_trunc('week', updated_at)::date AS semana
    FROM public.tarefas
    WHERE status = 'concluida'
      AND updated_at >= (date_trunc('week', v_hoje) - interval '11 weeks')
  ),
  throughput AS (
    SELECT jsonb_agg(jsonb_build_object('semana', s.semana, 'n', COALESCE(t.n, 0)) ORDER BY s.semana) AS items
    FROM semanas s
    LEFT JOIN (SELECT semana, COUNT(*)::int AS n FROM tarefas_feitas GROUP BY semana) t ON t.semana = s.semana
  ),
  -- Horas, nunca dinheiro: a mesma leitura de "queimou a folga" sem valor.
  horas_proj AS (
    SELECT p.id, p.nome,
           SUM(d.horas_estimadas)::numeric AS est,
           SUM(d.horas_realizadas)::numeric AS realizadas
    FROM ativos p
    JOIN public.projeto_disciplinas d ON d.projeto_id = p.id
    GROUP BY p.id, p.nome
    HAVING SUM(d.horas_estimadas) > 0
  ),
  horas AS (
    SELECT jsonb_agg(jsonb_build_object(
             'projetoId', id, 'projeto', nome, 'estimadas', est, 'realizadas', realizadas, 'desvioPct', pct
           ) ORDER BY abs(pct) DESC) AS items
    FROM (
      SELECT id, nome, est, realizadas,
             ROUND(100.0 * (realizadas - est) / NULLIF(est, 0))::int AS pct
      FROM horas_proj
      ORDER BY abs(ROUND(100.0 * (realizadas - est) / NULLIF(est, 0))) DESC
      LIMIT 8
    ) x
  ),
  carga AS (
    SELECT jsonb_agg(jsonb_build_object(
             'pessoaId', user_id, 'nome', nome, 'iniciais', iniciais,
             'emDia', em_dia, 'atrasada', atrasada
           ) ORDER BY (em_dia + atrasada) DESC) AS items
    FROM (
      SELECT dr.pessoa_id AS user_id,
             COALESCE(NULLIF(btrim(COALESCE(ps.primeiro_nome, '') || ' ' || COALESCE(ps.sobrenome, '')), ''), 'Sem responsável') AS nome,
             COALESCE(NULLIF(upper(COALESCE(left(btrim(ps.primeiro_nome), 1), '')) || upper(COALESCE(left(btrim(ps.sobrenome), 1), '')), ''), '??') AS iniciais,
             COUNT(*) FILTER (WHERE d.data_fim IS NULL OR d.data_fim >= v_hoje)::int AS em_dia,
             COUNT(*) FILTER (WHERE d.data_fim IS NOT NULL AND d.data_fim < v_hoje)::int AS atrasada
      FROM public.projeto_disciplina_responsaveis dr
      JOIN public.projeto_disciplinas d ON d.id = dr.projeto_disciplina_id
      JOIN ativos p ON p.id = d.projeto_id
      LEFT JOIN public.pessoas_safe ps ON ps.id = dr.pessoa_id
      WHERE COALESCE(d.status, 'pendente') <> 'concluida'
      GROUP BY dr.pessoa_id, ps.primeiro_nome, ps.sobrenome
      ORDER BY em_dia DESC, atrasada DESC
      LIMIT 8
    ) x
  ),
  -- Fila de aprovação em quantidade e dias de espera, sem o valor do aditivo.
  aprovacoes AS (
    SELECT jsonb_agg(jsonb_build_object(
             'escopoId', id, 'tipo', tipo, 'projetoId', projeto_id, 'projeto', projeto, 'dias', dias
           ) ORDER BY dias DESC) AS items
    FROM (
      SELECT e.id, e.tipo, p.id AS projeto_id, p.nome AS projeto,
             (v_hoje - e.created_at::date) AS dias
      FROM public.escopos e
      JOIN proj p ON p.id = e.projeto_id
      WHERE e.deleted_at IS NULL AND e.status = 'pendente_aprovacao'
      ORDER BY e.created_at
      LIMIT 8
    ) x
  ),

  -- ══ Âncoras ══════════════════════════════════════════════════════════════
  anc_conversao AS (
    SELECT
      ROUND(100.0 * COUNT(*) FILTER (WHERE status_efetivo = 'aceita')
            / NULLIF(COUNT(*) FILTER (WHERE status_efetivo IN ('aceita', 'recusada', 'expirada')), 0))::int AS atual,
      COUNT(*) FILTER (WHERE status_efetivo IN ('aceita', 'recusada', 'expirada'))::int AS decididas
    FROM prop_90
  ),
  anc_conversao_ant AS (
    SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE status_efetivo = 'aceita')
                 / NULLIF(COUNT(*) FILTER (WHERE status_efetivo IN ('aceita', 'recusada', 'expirada')), 0))::int AS ant
    FROM prop
    WHERE created_at >= (v_hoje - interval '180 days') AND created_at < (v_hoje - interval '90 days')
  ),
  anc_prazo AS (
    SELECT
      ROUND(100.0 * COUNT(*) FILTER (WHERE no_prazo) / NULLIF(COUNT(*), 0))::int AS atual
    FROM concluidos WHERE mes >= (date_trunc('month', v_hoje) - interval '5 months')::date
  ),
  anc_prazo_ant AS (
    SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE no_prazo) / NULLIF(COUNT(*), 0))::int AS ant
    FROM concluidos WHERE mes < (date_trunc('month', v_hoje) - interval '5 months')::date
  ),
  anc_semana AS (
    SELECT
      (SELECT COUNT(*)::int FROM tarefas_feitas WHERE semana = date_trunc('week', v_hoje)::date) AS atual,
      (SELECT ROUND(AVG(n))::int FROM (SELECT COUNT(*)::int AS n FROM tarefas_feitas GROUP BY semana) y) AS media
  ),
  anc_horas AS (
    SELECT ROUND(100.0 * (SUM(realizadas) - SUM(est)) / NULLIF(SUM(est), 0))::int AS atual FROM horas_proj
  ),
  anc_espera AS (
    SELECT
      COUNT(*)::int AS aguardando,
      COUNT(*) FILTER (WHERE (v_hoje - created_at::date) > 30)::int AS parados
    FROM prop WHERE status_efetivo = 'enviada'
  ),

  -- ══ Cobertura: o que o painel NÃO sabe ═══════════════════════════════════
  cobertura AS (
    SELECT
      (SELECT MIN(created_at)::date FROM prop) AS desde,
      (SELECT COUNT(*)::int FROM ativos WHERE data_previsao IS NULL) AS projetos_sem_prazo,
      (SELECT COUNT(*)::int FROM prop WHERE status_efetivo <> 'rascunho') AS propostas_sem_historico,
      (SELECT COUNT(*)::int FROM perdas_norm WHERE motivo_padrao IN ('Outro', 'Sem motivo registrado')) AS leads_sem_motivo_padrao
  )

  SELECT jsonb_build_object(
    'ancoras', jsonb_build_object(
      'conversao', jsonb_build_object(
        'valor', (SELECT atual FROM anc_conversao),
        'anterior', (SELECT ant FROM anc_conversao_ant),
        'decididas', (SELECT decididas FROM anc_conversao)
      ),
      'prazo', jsonb_build_object(
        'valor', (SELECT atual FROM anc_prazo),
        'anterior', (SELECT ant FROM anc_prazo_ant)
      ),
      'concluidasSemana', jsonb_build_object(
        'valor', (SELECT atual FROM anc_semana),
        'media', (SELECT media FROM anc_semana)
      ),
      'desvioHoras', jsonb_build_object('valor', (SELECT atual FROM anc_horas)),
      'aguardandoCliente', jsonb_build_object(
        'valor', (SELECT aguardando FROM anc_espera),
        'parados', (SELECT parados FROM anc_espera)
      )
    ),
    'comercial', jsonb_build_object(
      'funil', COALESCE((SELECT items FROM funil), '[]'::jsonb),
      'conversaoMensal', COALESCE((SELECT items FROM conversao_mensal), '[]'::jsonb),
      'motivosPerda', COALESCE((SELECT items FROM motivos), '[]'::jsonb),
      'esperaProposta', COALESCE((SELECT items FROM espera), '[]'::jsonb),
      'origemGanho', COALESCE((SELECT items FROM origens), '[]'::jsonb)
    ),
    'entrega', jsonb_build_object(
      'semaforo', (SELECT jsonb_build_object(
        'noPrazo', no_prazo, 'risco', risco, 'estourado', estourado, 'semPrazo', sem_prazo
      ) FROM semaforo),
      'statusAtivos', COALESCE((SELECT items FROM status_ativos), '[]'::jsonb),
      'pontualidadeMensal', COALESCE((SELECT items FROM pontualidade), '[]'::jsonb),
      'atrasoPorDisciplina', COALESCE((SELECT items FROM atraso_disciplina), '[]'::jsonb),
      'prazos15Dias', COALESCE((SELECT items FROM prazos_15), '[]'::jsonb)
    ),
    'produtividade', jsonb_build_object(
      'throughputSemanal', COALESCE((SELECT items FROM throughput), '[]'::jsonb),
      'horasPorProjeto', COALESCE((SELECT items FROM horas), '[]'::jsonb),
      'cargaEquipe', COALESCE((SELECT items FROM carga), '[]'::jsonb),
      'filaAprovacao', COALESCE((SELECT items FROM aprovacoes), '[]'::jsonb)
    ),
    'cobertura', (SELECT jsonb_build_object(
      'desde', desde,
      'projetosSemPrazo', projetos_sem_prazo,
      'propostasSemHistorico', propostas_sem_historico,
      'leadsSemMotivoPadrao', leads_sem_motivo_padrao
    ) FROM cobertura)
  ) INTO v_result;

  RETURN v_result;
END;
$fn$;

COMMENT ON FUNCTION public.get_painel_gestao() IS
  'SPEC 092: agrega o painel de gestão do /inicio (comercial, entrega, produtividade) numa chamada. SECURITY INVOKER: o RLS filtra a empresa. Nunca retorna dado monetário.';

REVOKE ALL ON FUNCTION public.get_painel_gestao() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_painel_gestao() TO authenticated;
