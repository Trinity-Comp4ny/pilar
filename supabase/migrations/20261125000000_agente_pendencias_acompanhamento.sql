-- SPEC 146: agente de acompanhamento. Tudo que está em aberto vira pendência com idade,
-- dono da área e ação sugerida, derivada por regra a cada varredura.
--
-- 1. agente_pendencias: uma linha por (empresa, chave). A chave é tipo + registro, então a
--    mesma parcela vencida é UMA pendência por dias, não uma notificação por dia.
-- 2. agente_pendencias_detectar(): fonte única das regras (SQL puro, sem IA). Fatos vêm daqui.
-- 3. agente_pendencias_varrer(): upsert dos achados; o que a regra deixou de achar fecha
--    sozinho ('condicao_sumiu'); adiada vencida volta a abrir.
-- 4. agente_pendencias_atualizar(): varredura da empresa de quem chama (abrir a aba).
-- 5. cron diário 06:25 UTC (depois do ambient 06:00 e do guardião 06:15).
--
-- O sino (notificacoes) continua sendo o aviso de evento. Aqui é o estado: o que segue em
-- aberto e há quanto tempo.
--
-- 0. Achado da investigação (30/10/2026): os quatro laços financeiros de
--    gerar_notificacoes_ambient() leem receitas/despesas sem `deleted_at IS NULL`.
--    Em produção, 129 dos 139 avisos de "recebimento atrasado" dos últimos 30 dias
--    apontavam para receita já excluída. Corrige o gerador e arquiva os avisos-fantasma.

-- ---------------------------------------------------------------------------
-- 0. Sino: ignorar receita e despesa excluídas
-- ---------------------------------------------------------------------------
CREATE FUNCTION pg_temp.sub(p_def text, p_de text, p_para text, p_esperado integer)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_achou integer := (length(p_def) - length(replace(p_def, p_de, ''))) / length(p_de);
BEGIN
  IF v_achou <> p_esperado THEN
    RAISE EXCEPTION 'SPEC 146: esperava % ocorrência(s) de [%], achei %', p_esperado, p_de, v_achou;
  END IF;
  RETURN replace(p_def, p_de, p_para);
END;
$$;

DO $ambient$
DECLARE
  v_def text := pg_get_functiondef('public.gerar_notificacoes_ambient()'::regprocedure);
BEGIN
  v_def := pg_temp.sub(v_def,
    $x$WHERE d.status = 'Pendente' AND d.is_fatura_payment = false$x$,
    $x$WHERE d.deleted_at IS NULL AND d.status = 'Pendente' AND d.is_fatura_payment = false$x$, 2);
  v_def := pg_temp.sub(v_def,
    $x$WHERE r.status = 'Pendente' AND r.data_vencimento$x$,
    $x$WHERE r.deleted_at IS NULL AND r.status = 'Pendente' AND r.data_vencimento$x$, 2);
  EXECUTE v_def;
END;
$ambient$;

UPDATE public.notificacoes n
   SET arquivada_em = COALESCE(n.arquivada_em, now()), lido_em = COALESCE(n.lido_em, now())
 WHERE n.arquivada_em IS NULL
   AND (
     (n.referencia_tipo = 'receita' AND EXISTS (
        SELECT 1 FROM public.receitas r WHERE r.id = n.referencia_id AND r.deleted_at IS NOT NULL))
     OR (n.referencia_tipo = 'despesa' AND EXISTS (
        SELECT 1 FROM public.despesas d WHERE d.id = n.referencia_id AND d.deleted_at IS NOT NULL))
   );

-- ---------------------------------------------------------------------------
-- 1. Tabela
-- ---------------------------------------------------------------------------
CREATE TABLE public.agente_pendencias (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo              text NOT NULL,
  area              text NOT NULL
                      CHECK (area IN ('financeiro', 'prazos', 'orcamento', 'obra', 'planejamento', 'comercial')),
  severidade        text NOT NULL DEFAULT 'medium'
                      CHECK (severidade IN ('low', 'medium', 'high', 'critical')),
  chave             text NOT NULL,
  referencia_tipo   text,
  referencia_id     uuid,
  projeto_id        uuid REFERENCES public.projetos(id) ON DELETE CASCADE,
  titulo            text NOT NULL,
  detalhe           text,
  dados             jsonb NOT NULL DEFAULT '{}'::jsonb,
  link              text,
  acao_sugerida     text,
  vence_em          date,
  status            text NOT NULL DEFAULT 'aberta'
                      CHECK (status IN ('aberta', 'adiada', 'dispensada', 'resolvida')),
  adiada_ate        date,
  primeira_deteccao timestamptz NOT NULL DEFAULT now(),
  ultima_deteccao   timestamptz NOT NULL DEFAULT now(),
  resolvida_em      timestamptz,
  resolvida_motivo  text CHECK (resolvida_motivo IN ('condicao_sumiu')),
  UNIQUE (empresa_id, chave)
);

COMMENT ON TABLE public.agente_pendencias IS
  'SPEC 146. Pendências de acompanhamento derivadas por regra (agente_pendencias_detectar). Escrita só por funções SECURITY DEFINER; o usuário só adia ou dispensa.';
COMMENT ON COLUMN public.agente_pendencias.dados IS
  'Fatos da regra (valor, vencimento, dias, projeto, cliente). O front formata; nada aqui vem de modelo de IA.';
COMMENT ON COLUMN public.agente_pendencias.acao_sugerida IS
  'Operação do chat que resolve (marcar_recebido, marcar_pago, preparar_aditivo) ou NULL quando a ação é abrir o registro.';

CREATE INDEX idx_agente_pendencias_fila
  ON public.agente_pendencias (empresa_id, status, severidade, primeira_deteccao);
CREATE INDEX idx_agente_pendencias_projeto
  ON public.agente_pendencias (projeto_id) WHERE projeto_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Quem enxerga cada área (mesmos gates das tabelas de origem)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.agente_pendencia_visivel(p_area text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT CASE p_area
    WHEN 'financeiro' THEN public.can_view_financeiro() AND public.user_has_feature('financeiro', 'viewer')
    WHEN 'orcamento'  THEN public.can_view_financeiro() AND public.user_has_feature('projetos', 'viewer')
    WHEN 'obra'       THEN public.user_has_feature('obras', 'viewer')
    WHEN 'comercial'  THEN public.user_has_feature('leads', 'viewer')
    ELSE public.user_has_feature('projetos', 'viewer')
  END;
$$;

ALTER TABLE public.agente_pendencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY agente_pendencias_select ON public.agente_pendencias
  FOR SELECT TO authenticated USING (
    empresa_id = public.get_user_empresa_id()
    AND public.agente_pendencia_visivel(area)
  );

CREATE POLICY agente_pendencias_update ON public.agente_pendencias
  FOR UPDATE TO authenticated USING (
    empresa_id = public.get_user_empresa_id()
    AND public.agente_pendencia_visivel(area)
  ) WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.agente_pendencia_visivel(area)
  );

-- O usuário só mexe em status e adiada_ate (adiar e dispensar); o resto é do agente.
REVOKE ALL ON public.agente_pendencias FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.agente_pendencias TO authenticated;
GRANT UPDATE (status, adiada_ate) ON public.agente_pendencias TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Regras. SECURITY DEFINER porque o cron varre todas as empresas; só service_role chama.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.agente_pendencias_detectar(p_empresa uuid DEFAULT NULL)
RETURNS TABLE (
  empresa_id      uuid,
  tipo            text,
  area            text,
  severidade      text,
  chave           text,
  referencia_tipo text,
  referencia_id   uuid,
  projeto_id      uuid,
  titulo          text,
  detalhe         text,
  dados           jsonb,
  link            text,
  acao_sugerida   text,
  vence_em        date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH
  hoje AS (SELECT current_date AS d),
  proj_ativo AS (
    SELECT p.*
    FROM public.projetos p
    WHERE p.deleted_at IS NULL
      AND p.status IN ('Planejamento', 'Execução', 'Em andamento', 'Revisão')
      AND (p_empresa IS NULL OR p.empresa_id = p_empresa)
  ),
  achados AS (
    -- ── Financeiro: parcelas e contas ─────────────────────────────────────
    SELECT r.empresa_id,
      'recebimento_atrasado'::text AS tipo, 'financeiro'::text AS area,
      CASE WHEN h.d - r.data_vencimento > 30 THEN 'critical'
           WHEN h.d - r.data_vencimento > 7 THEN 'high' ELSE 'medium' END AS severidade,
      r.id AS ref_id, 'receita'::text AS ref_tipo, r.projeto_id,
      'Recebimento atrasado: ' || r.descricao AS titulo,
      'Venceu em ' || to_char(r.data_vencimento, 'DD/MM/YYYY') || ', há ' || (h.d - r.data_vencimento) || ' dia(s)'
        || COALESCE(' · ' || pr.nome, '') AS detalhe,
      jsonb_build_object(
        'valor', r.valor, 'vencimento', r.data_vencimento, 'dias_atraso', h.d - r.data_vencimento,
        'parcela_numero', r.parcela_numero, 'parcela_total', r.parcela_total,
        'projeto_nome', pr.nome, 'cliente_nome', c.nome) AS dados,
      '/gestao/financeiro'::text AS link, 'marcar_recebido'::text AS acao, r.data_vencimento AS vence_em
    FROM public.receitas r
    CROSS JOIN hoje h
    LEFT JOIN public.projetos pr ON pr.id = r.projeto_id
    LEFT JOIN public.clientes c ON c.id = r.cliente_id
    WHERE r.deleted_at IS NULL AND r.status IN ('Pendente', 'Atrasado') AND r.data_vencimento < h.d
      AND (p_empresa IS NULL OR r.empresa_id = p_empresa)

    UNION ALL
    SELECT r.empresa_id, 'a_receber_proximo', 'financeiro', 'medium',
      r.id, 'receita', r.projeto_id,
      'A receber em breve: ' || r.descricao,
      'Vence em ' || to_char(r.data_vencimento, 'DD/MM/YYYY') || ' (' || (r.data_vencimento - h.d) || ' dia(s))'
        || COALESCE(' · ' || pr.nome, ''),
      jsonb_build_object(
        'valor', r.valor, 'vencimento', r.data_vencimento, 'dias_para_vencer', r.data_vencimento - h.d,
        'parcela_numero', r.parcela_numero, 'parcela_total', r.parcela_total,
        'projeto_nome', pr.nome, 'cliente_nome', c.nome),
      '/gestao/financeiro', NULL, r.data_vencimento
    FROM public.receitas r
    CROSS JOIN hoje h
    LEFT JOIN public.projetos pr ON pr.id = r.projeto_id
    LEFT JOIN public.clientes c ON c.id = r.cliente_id
    WHERE r.deleted_at IS NULL AND r.status = 'Pendente'
      AND r.data_vencimento >= h.d AND r.data_vencimento <= h.d + 7
      AND (p_empresa IS NULL OR r.empresa_id = p_empresa)

    UNION ALL
    SELECT d.empresa_id, 'pagamento_atrasado', 'financeiro', 'critical',
      d.id, 'despesa', d.projeto_id,
      'Pagamento atrasado: ' || d.descricao,
      'Venceu em ' || to_char(d.data_vencimento, 'DD/MM/YYYY') || ', há ' || (h.d - d.data_vencimento) || ' dia(s)'
        || COALESCE(' · ' || f.nome, ''),
      jsonb_build_object(
        'valor', d.valor, 'vencimento', d.data_vencimento, 'dias_atraso', h.d - d.data_vencimento,
        'parcela_numero', d.parcela_numero, 'parcela_total', d.parcela_total,
        'projeto_nome', pr.nome, 'fornecedor_nome', f.nome),
      '/gestao/financeiro', 'marcar_pago', d.data_vencimento
    FROM public.despesas d
    CROSS JOIN hoje h
    LEFT JOIN public.projetos pr ON pr.id = d.projeto_id
    LEFT JOIN public.fornecedores f ON f.id = d.fornecedor_id
    WHERE d.deleted_at IS NULL AND d.is_fatura_payment = false
      AND d.status IN ('Pendente', 'Atrasado') AND d.data_vencimento < h.d
      AND (p_empresa IS NULL OR d.empresa_id = p_empresa)

    UNION ALL
    SELECT d.empresa_id, 'a_pagar_proximo', 'financeiro', 'medium',
      d.id, 'despesa', d.projeto_id,
      'A pagar em breve: ' || d.descricao,
      'Vence em ' || to_char(d.data_vencimento, 'DD/MM/YYYY') || ' (' || (d.data_vencimento - h.d) || ' dia(s))'
        || COALESCE(' · ' || f.nome, ''),
      jsonb_build_object(
        'valor', d.valor, 'vencimento', d.data_vencimento, 'dias_para_vencer', d.data_vencimento - h.d,
        'parcela_numero', d.parcela_numero, 'parcela_total', d.parcela_total,
        'projeto_nome', pr.nome, 'fornecedor_nome', f.nome),
      '/gestao/financeiro', 'marcar_pago', d.data_vencimento
    FROM public.despesas d
    CROSS JOIN hoje h
    LEFT JOIN public.projetos pr ON pr.id = d.projeto_id
    LEFT JOIN public.fornecedores f ON f.id = d.fornecedor_id
    WHERE d.deleted_at IS NULL AND d.is_fatura_payment = false AND d.status = 'Pendente'
      AND d.data_vencimento >= h.d AND d.data_vencimento <= h.d + 7
      AND (p_empresa IS NULL OR d.empresa_id = p_empresa)

    UNION ALL
    SELECT m.empresa_id, 'marco_a_faturar', 'financeiro',
      CASE WHEN m.data_prevista < h.d THEN 'high' ELSE 'medium' END,
      m.id, 'marco', m.projeto_id,
      'Marco a faturar: ' || m.nome,
      CASE WHEN m.data_prevista < h.d
        THEN 'Previsto para ' || to_char(m.data_prevista, 'DD/MM/YYYY') || ', ainda sem faturar'
        ELSE 'Previsto para ' || to_char(m.data_prevista, 'DD/MM/YYYY') END || ' · ' || p.nome,
      jsonb_build_object('valor', m.valor, 'data_prevista', m.data_prevista, 'projeto_nome', p.nome),
      '/projetos/' || p.id, NULL, m.data_prevista
    FROM public.marcos_faturamento m
    JOIN public.projetos p ON p.id = m.projeto_id AND p.deleted_at IS NULL
    CROSS JOIN hoje h
    WHERE m.deleted_at IS NULL AND m.data_faturada IS NULL AND m.data_prevista IS NOT NULL
      AND m.data_prevista <= h.d + 7 AND COALESCE(m.status, '') <> 'Faturado'
      AND (p_empresa IS NULL OR m.empresa_id = p_empresa)

    -- ── Prazos: projeto e disciplina ──────────────────────────────────────
    UNION ALL
    SELECT p.empresa_id, 'projeto_atrasado', 'prazos',
      CASE WHEN h.d - p.data_previsao > 30 THEN 'high' ELSE 'medium' END,
      p.id, 'projeto', p.id,
      'Projeto atrasado: ' || p.nome,
      'Previsão era ' || to_char(p.data_previsao, 'DD/MM/YYYY') || ', há ' || (h.d - p.data_previsao) || ' dia(s)',
      jsonb_build_object('data_previsao', p.data_previsao, 'dias_atraso', h.d - p.data_previsao, 'projeto_nome', p.nome),
      '/projetos/' || p.id, NULL, p.data_previsao
    FROM proj_ativo p
    CROSS JOIN hoje h
    WHERE p.data_final IS NULL AND p.data_previsao < h.d

    UNION ALL
    SELECT p.empresa_id, 'projeto_prazo_proximo', 'prazos',
      CASE WHEN p.data_previsao - h.d <= 3 THEN 'high' ELSE 'medium' END,
      p.id, 'projeto', p.id,
      'Prazo próximo: ' || p.nome,
      'Entrega em ' || to_char(p.data_previsao, 'DD/MM/YYYY') || ' (' || (p.data_previsao - h.d) || ' dia(s))',
      jsonb_build_object('data_previsao', p.data_previsao, 'dias_para_vencer', p.data_previsao - h.d, 'projeto_nome', p.nome),
      '/projetos/' || p.id, NULL, p.data_previsao
    FROM proj_ativo p
    CROSS JOIN hoje h
    WHERE p.data_final IS NULL AND p.data_previsao >= h.d AND p.data_previsao <= h.d + 14

    UNION ALL
    SELECT d.empresa_id, 'disciplina_atrasada', 'prazos',
      CASE WHEN h.d - d.data_fim > 14 THEN 'high' ELSE 'medium' END,
      d.id, 'disciplina', d.projeto_id,
      'Disciplina atrasada: ' || d.nome || ' (' || d.projeto_nome || ')',
      'Prazo era ' || to_char(d.data_fim, 'DD/MM/YYYY') || ', há ' || (h.d - d.data_fim) || ' dia(s)',
      jsonb_build_object('disciplina_nome', d.nome, 'projeto_nome', d.projeto_nome,
        'data_fim', d.data_fim, 'dias_atraso', h.d - d.data_fim),
      '/projetos/' || d.projeto_id, NULL, d.data_fim
    FROM (
      SELECT pd.id, pd.nome, pd.data_fim, pd.data_fim_real, pd.status, pd.projeto_id, p.empresa_id, p.nome AS projeto_nome
      FROM public.projeto_disciplinas pd
      JOIN proj_ativo p ON p.id = pd.projeto_id
    ) d
    CROSS JOIN hoje h
    WHERE d.data_fim < h.d AND d.data_fim_real IS NULL
      AND lower(COALESCE(d.status, '')) NOT IN ('concluído', 'concluido', 'pausada')

    UNION ALL
    SELECT d.empresa_id, 'disciplina_prazo_proximo', 'prazos', 'low',
      d.id, 'disciplina', d.projeto_id,
      'Prazo da disciplina: ' || d.nome || ' (' || d.projeto_nome || ')',
      'Entrega em ' || to_char(d.data_fim, 'DD/MM/YYYY') || ' (' || (d.data_fim - h.d) || ' dia(s))',
      jsonb_build_object('disciplina_nome', d.nome, 'projeto_nome', d.projeto_nome,
        'data_fim', d.data_fim, 'dias_para_vencer', d.data_fim - h.d),
      '/projetos/' || d.projeto_id, NULL, d.data_fim
    FROM (
      SELECT pd.id, pd.nome, pd.data_fim, pd.data_fim_real, pd.status, pd.projeto_id, p.empresa_id, p.nome AS projeto_nome
      FROM public.projeto_disciplinas pd
      JOIN proj_ativo p ON p.id = pd.projeto_id
    ) d
    CROSS JOIN hoje h
    WHERE d.data_fim >= h.d AND d.data_fim <= h.d + 7 AND d.data_fim_real IS NULL
      AND lower(COALESCE(d.status, '')) NOT IN ('concluído', 'concluido', 'pausada')

    -- ── Orçamento ─────────────────────────────────────────────────────────
    UNION ALL
    SELECT p.empresa_id, 'orcamento_ausente', 'orcamento', 'low',
      p.id, 'projeto', p.id,
      'Sem orçamento por disciplina: ' || p.nome,
      'Sem orçamento, o guardião de margem não consegue avisar quando as despesas passarem do previsto',
      jsonb_build_object('projeto_nome', p.nome, 'valor_contrato', p.valor_contrato),
      '/projetos/' || p.id || '#escopo', NULL, NULL::date
    FROM proj_ativo p
    WHERE COALESCE(p.valor_contrato, 0) > 0
      AND NOT EXISTS (
        SELECT 1 FROM public.projeto_orcamento_fases f
        WHERE f.projeto_id = p.id AND f.deleted_at IS NULL AND COALESCE(f.custo_estimado, 0) > 0
      )

    UNION ALL
    SELECT p.empresa_id, 'orcamento_acima_do_contrato', 'orcamento', 'high',
      p.id, 'projeto', p.id,
      'Orçamento maior que o contrato: ' || p.nome,
      'O custo orçado passa do valor do contrato: o projeto nasce com margem negativa',
      jsonb_build_object('projeto_nome', p.nome, 'valor_contrato', p.valor_contrato,
        'custo_orcado', o.custo_orcado, 'diferenca', o.custo_orcado - p.valor_contrato),
      '/projetos/' || p.id || '#escopo', NULL, NULL::date
    FROM proj_ativo p
    JOIN LATERAL (
      SELECT SUM(f.custo_estimado) AS custo_orcado
      FROM public.projeto_orcamento_fases f
      WHERE f.projeto_id = p.id AND f.deleted_at IS NULL
    ) o ON true
    WHERE COALESCE(p.valor_contrato, 0) > 0 AND COALESCE(o.custo_orcado, 0) > p.valor_contrato

    UNION ALL
    SELECT e.empresa_id, 'orcamento_estourado', 'orcamento', 'high',
      e.projeto_id, 'projeto', e.projeto_id,
      'Despesas acima do orçamento: ' || e.nome,
      'As despesas passaram do orçado e ainda não há aditivo em aberto',
      jsonb_build_object('projeto_nome', e.nome, 'custo_orcado', e.custo_orcado,
        'despesas_diretas', e.despesas_diretas, 'excedente', e.despesas_diretas - e.custo_orcado),
      '/projetos/' || e.projeto_id || '#escopo', 'preparar_aditivo', NULL::date
    FROM public.projetos_com_escopo_estourado() e
    WHERE (p_empresa IS NULL OR e.empresa_id = p_empresa)

    -- ── Obra ──────────────────────────────────────────────────────────────
    UNION ALL
    SELECT t.empresa_id, 'tarefa_obra_atrasada', 'obra',
      CASE WHEN h.d - t.prazo > 7 THEN 'high' ELSE 'medium' END,
      t.id, 'tarefa', o.projeto_id,
      'Tarefa da obra atrasada: ' || t.titulo,
      'Prazo era ' || to_char(t.prazo, 'DD/MM/YYYY') || ', há ' || (h.d - t.prazo) || ' dia(s) · ' || o.nome,
      jsonb_build_object('tarefa_titulo', t.titulo, 'obra_nome', o.nome, 'obra_id', o.id,
        'prazo', t.prazo, 'dias_atraso', h.d - t.prazo, 'status', t.status),
      '/obras/' || o.id, NULL, t.prazo
    FROM public.tarefas t
    JOIN public.obras o ON o.id = t.obra_id AND o.deleted_at IS NULL AND o.status <> 'concluida'
    CROSS JOIN hoje h
    WHERE t.status <> 'concluida' AND t.prazo < h.d
      AND (p_empresa IS NULL OR t.empresa_id = p_empresa)

    UNION ALL
    SELECT t.empresa_id, 'tarefa_obra_vencendo', 'obra', 'medium',
      t.id, 'tarefa', o.projeto_id,
      'Tarefa da obra vence em breve: ' || t.titulo,
      'Prazo em ' || to_char(t.prazo, 'DD/MM/YYYY') || ' (' || (t.prazo - h.d) || ' dia(s)) · ' || o.nome,
      jsonb_build_object('tarefa_titulo', t.titulo, 'obra_nome', o.nome, 'obra_id', o.id,
        'prazo', t.prazo, 'dias_para_vencer', t.prazo - h.d, 'status', t.status),
      '/obras/' || o.id, NULL, t.prazo
    FROM public.tarefas t
    JOIN public.obras o ON o.id = t.obra_id AND o.deleted_at IS NULL AND o.status <> 'concluida'
    CROSS JOIN hoje h
    WHERE t.status <> 'concluida' AND t.prazo >= h.d AND t.prazo <= h.d + 3
      AND (p_empresa IS NULL OR t.empresa_id = p_empresa)

    UNION ALL
    SELECT o.empresa_id, 'obra_atrasada', 'obra', 'high',
      o.id, 'obra', o.projeto_id,
      'Obra atrasada: ' || o.nome,
      'Fim previsto em ' || to_char(o.data_fim_prevista, 'DD/MM/YYYY') || ', há ' || (h.d - o.data_fim_prevista) || ' dia(s)',
      jsonb_build_object('obra_nome', o.nome, 'data_fim_prevista', o.data_fim_prevista,
        'dias_atraso', h.d - o.data_fim_prevista),
      '/obras/' || o.id, NULL, o.data_fim_prevista
    FROM public.obras o
    CROSS JOIN hoje h
    WHERE o.deleted_at IS NULL AND o.status IN ('planejada', 'em_andamento')
      AND o.data_fim_real IS NULL AND o.data_fim_prevista < h.d
      AND (p_empresa IS NULL OR o.empresa_id = p_empresa)

    -- ── Planejamento: o que ainda falta definir ───────────────────────────
    UNION ALL
    SELECT p.empresa_id, 'projeto_sem_prazo', 'planejamento', 'low',
      p.id, 'projeto', p.id,
      'Projeto sem prazo de entrega: ' || p.nome,
      'Sem previsão não há como avisar atraso nem prazo próximo',
      jsonb_build_object('projeto_nome', p.nome),
      '/projetos/' || p.id, NULL, NULL::date
    FROM proj_ativo p
    WHERE p.data_previsao IS NULL AND p.data_final IS NULL

    UNION ALL
    SELECT o.empresa_id, 'obra_sem_cronograma', 'planejamento', 'low',
      o.id, 'obra', o.projeto_id,
      'Obra sem cronograma: ' || o.nome,
      'Nenhuma frente de serviço cadastrada, então não há passos para acompanhar',
      jsonb_build_object('obra_nome', o.nome),
      '/obras/' || o.id, NULL, NULL::date
    FROM public.obras o
    WHERE o.deleted_at IS NULL AND o.status IN ('planejada', 'em_andamento')
      AND (p_empresa IS NULL OR o.empresa_id = p_empresa)
      AND NOT EXISTS (SELECT 1 FROM public.obra_frente f WHERE f.obra_id = o.id)

    -- ── Comercial ─────────────────────────────────────────────────────────
    UNION ALL
    SELECT l.empresa_id, 'lead_previsao_vencida', 'comercial', 'medium',
      l.id, 'lead', NULL::uuid,
      'Lead com previsão vencida: ' || l.nome,
      'Fechamento previsto para ' || to_char(l.previsao_fechamento, 'DD/MM/YYYY') || ', ainda em ' || COALESCE(l.status, 'aberto'),
      jsonb_build_object('lead_nome', l.nome, 'previsao_fechamento', l.previsao_fechamento,
        'dias_atraso', h.d - l.previsao_fechamento::date, 'status', l.status),
      '/gestao/leads', NULL, l.previsao_fechamento::date
    FROM public.leads l
    CROSS JOIN hoje h
    WHERE l.deleted_at IS NULL AND COALESCE(l.status, '') NOT IN ('Ganho', 'Perdido')
      AND l.previsao_fechamento IS NOT NULL AND l.previsao_fechamento::date < h.d
      AND (p_empresa IS NULL OR l.empresa_id = p_empresa)
  )
  SELECT DISTINCT ON (a.empresa_id, a.tipo || ':' || a.ref_id::text)
    a.empresa_id, a.tipo, a.area, a.severidade,
    a.tipo || ':' || a.ref_id::text,
    a.ref_tipo, a.ref_id, a.projeto_id, a.titulo, a.detalhe, a.dados, a.link, a.acao, a.vence_em
  FROM achados a
  ORDER BY a.empresa_id, a.tipo || ':' || a.ref_id::text;
$$;

REVOKE ALL ON FUNCTION public.agente_pendencias_detectar(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agente_pendencias_detectar(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 4. Varredura: grava o que a regra achou, fecha o que sumiu
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.agente_pendencias_varrer(p_empresa uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_inicio    timestamptz := clock_timestamp();
  v_achadas   integer;
  v_fechadas  integer;
  v_reabertas integer;
BEGIN
  INSERT INTO public.agente_pendencias AS ap (
    empresa_id, tipo, area, severidade, chave, referencia_tipo, referencia_id, projeto_id,
    titulo, detalhe, dados, link, acao_sugerida, vence_em, primeira_deteccao, ultima_deteccao
  )
  SELECT d.empresa_id, d.tipo, d.area, d.severidade, d.chave, d.referencia_tipo, d.referencia_id, d.projeto_id,
         d.titulo, d.detalhe, d.dados, d.link, d.acao_sugerida, d.vence_em, v_inicio, v_inicio
  FROM public.agente_pendencias_detectar(p_empresa) d
  ON CONFLICT (empresa_id, chave) DO UPDATE SET
    area = EXCLUDED.area,
    severidade = EXCLUDED.severidade,
    projeto_id = EXCLUDED.projeto_id,
    titulo = EXCLUDED.titulo,
    detalhe = EXCLUDED.detalhe,
    dados = EXCLUDED.dados,
    link = EXCLUDED.link,
    acao_sugerida = EXCLUDED.acao_sugerida,
    vence_em = EXCLUDED.vence_em,
    ultima_deteccao = v_inicio,
    -- Voltou depois de resolvida: é uma ocorrência nova, com idade zerada.
    status = CASE WHEN ap.status = 'resolvida' THEN 'aberta' ELSE ap.status END,
    primeira_deteccao = CASE WHEN ap.status = 'resolvida' THEN v_inicio ELSE ap.primeira_deteccao END,
    adiada_ate = CASE WHEN ap.status = 'resolvida' THEN NULL ELSE ap.adiada_ate END,
    resolvida_em = NULL,
    resolvida_motivo = NULL;
  GET DIAGNOSTICS v_achadas = ROW_COUNT;

  UPDATE public.agente_pendencias
     SET status = 'aberta', adiada_ate = NULL
   WHERE status = 'adiada' AND adiada_ate <= current_date
     AND (p_empresa IS NULL OR empresa_id = p_empresa);
  GET DIAGNOSTICS v_reabertas = ROW_COUNT;

  UPDATE public.agente_pendencias
     SET status = 'resolvida', resolvida_em = now(), resolvida_motivo = 'condicao_sumiu'
   WHERE status IN ('aberta', 'adiada', 'dispensada') AND ultima_deteccao < v_inicio
     AND (p_empresa IS NULL OR empresa_id = p_empresa);
  GET DIAGNOSTICS v_fechadas = ROW_COUNT;

  RETURN jsonb_build_object('achadas', v_achadas, 'fechadas', v_fechadas, 'reabertas', v_reabertas);
END;
$$;

REVOKE ALL ON FUNCTION public.agente_pendencias_varrer(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agente_pendencias_varrer(uuid) TO service_role;

-- Abrir a aba atualiza a fila da empresa de quem abriu. Sem argumento: a empresa vem do
-- perfil, então ninguém dispara varredura de outra. Pula se a fila foi atualizada há pouco.
CREATE OR REPLACE FUNCTION public.agente_pendencias_atualizar()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_empresa uuid := public.get_user_empresa_id();
BEGIN
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'usuário sem empresa' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.agente_pendencias
    WHERE empresa_id = v_empresa AND ultima_deteccao > now() - interval '5 minutes'
  ) THEN
    RETURN jsonb_build_object('pulada', true);
  END IF;

  RETURN public.agente_pendencias_varrer(v_empresa);
END;
$$;

REVOKE ALL ON FUNCTION public.agente_pendencias_atualizar() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agente_pendencias_atualizar() TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Adiar e dispensar (invoker: a RLS de agente_pendencias decide quem pode)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.agente_pendencia_adiar(p_id uuid, p_dias integer)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF p_dias IS NULL OR p_dias < 1 OR p_dias > 30 THEN
    RAISE EXCEPTION 'p_dias deve ficar entre 1 e 30' USING ERRCODE = '22023';
  END IF;
  UPDATE public.agente_pendencias
     SET status = 'adiada', adiada_ate = current_date + p_dias
   WHERE id = p_id AND status IN ('aberta', 'adiada');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'pendência não encontrada' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.agente_pendencia_dispensar(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.agente_pendencias
     SET status = 'dispensada', adiada_ate = NULL
   WHERE id = p_id AND status IN ('aberta', 'adiada');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'pendência não encontrada' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.agente_pendencia_adiar(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.agente_pendencia_dispensar(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agente_pendencia_adiar(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agente_pendencia_dispensar(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. Cron diário com heartbeat. Falha vira heartbeat 'failed' (a UI já distingue
--    "sem achados" de "parou de rodar"), sem derrubar o job.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.agente_pendencias_varrer_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_resultado jsonb;
BEGIN
  v_resultado := public.agente_pendencias_varrer(NULL);
  PERFORM public.registrar_heartbeat_agente('acompanhamento_cron', 'ok', v_resultado);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'agente_pendencias_varrer_cron falhou: %', SQLERRM;
  PERFORM public.registrar_heartbeat_agente('acompanhamento_cron', 'failed', jsonb_build_object('error', SQLERRM));
END;
$$;

REVOKE ALL ON FUNCTION public.agente_pendencias_varrer_cron() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'agente-pendencias-daily') THEN
      PERFORM cron.unschedule('agente-pendencias-daily');
    END IF;
    PERFORM cron.schedule('agente-pendencias-daily', '25 6 * * *', 'SELECT public.agente_pendencias_varrer_cron();');
  END IF;
END;
$$;
