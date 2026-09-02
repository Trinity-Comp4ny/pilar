-- FIN-5 / spec 067, correção: o alerta de "escopo estourado sem aditivo" foi
-- adicionado em 20260863000000 dentro de gerar_alertas_ambient() — mas essa
-- função foi aposentada em 20260817000100 (cron reagendado pra
-- gerar_notificacoes_ambient(), confirmado ativo em produção via MCP
-- read-only: job "gerar-alertas-ambient" desagendado, "gerar-notificacoes-ambient"
-- ativo). O bloco antigo em gerar_alertas_ambient() fica como está (a própria
-- migration de 17/08 já deixa a função dormente de propósito, não é desta
-- mudança limpar); esta migration adiciona o alerta na função que de fato
-- roda, usando o mecanismo de notificação por destinatário (notificar()).
CREATE OR REPLACE FUNCTION public.gerar_notificacoes_ambient()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_hoje date := current_date;
  v_em7  date := current_date + 7;
  v_total integer := 0;
  fmt text := 'FM999999990.00';
  rec record;
  v_dest uuid[];
BEGIN
  -- ── Financeiro (só quem vê dinheiro) ─────────────────────────────────────
  FOR rec IN
    SELECT d.id, d.empresa_id, d.descricao, d.valor, d.data_vencimento
    FROM public.despesas d
    WHERE d.status = 'Pendente' AND d.is_fatura_payment = false AND d.data_vencimento < v_hoje
  LOOP
    v_total := v_total + public.notificar(
      rec.empresa_id, public._notif_ve_financeiro(rec.empresa_id),
      'pagamento_atrasado', 'financeiro', 'critical',
      'Pagamento vencido: ' || COALESCE(rec.descricao, '(sem descrição)'),
      'R$ ' || to_char(rec.valor, fmt) || ' venceu em ' || to_char(rec.data_vencimento, 'DD/MM/YYYY'),
      'despesa', rec.id, '/gestao/financeiro');
  END LOOP;

  FOR rec IN
    SELECT r.id, r.empresa_id, r.descricao, r.valor, r.data_vencimento
    FROM public.receitas r
    WHERE r.status = 'Pendente' AND r.data_vencimento < v_hoje
  LOOP
    v_total := v_total + public.notificar(
      rec.empresa_id, public._notif_ve_financeiro(rec.empresa_id),
      'recebimento_atrasado', 'financeiro', 'high',
      'Recebimento vencido: ' || COALESCE(rec.descricao, '(sem descrição)'),
      'R$ ' || to_char(rec.valor, fmt) || ' deveria ter entrado em ' || to_char(rec.data_vencimento, 'DD/MM/YYYY'),
      'receita', rec.id, '/gestao/financeiro');
  END LOOP;

  FOR rec IN
    SELECT d.id, d.empresa_id, d.descricao, d.valor, d.data_vencimento
    FROM public.despesas d
    WHERE d.status = 'Pendente' AND d.is_fatura_payment = false
      AND d.data_vencimento >= v_hoje AND d.data_vencimento <= v_em7
  LOOP
    v_total := v_total + public.notificar(
      rec.empresa_id, public._notif_ve_financeiro(rec.empresa_id),
      'vencimento_proximo', 'financeiro', 'medium',
      'A pagar: ' || COALESCE(rec.descricao, '(sem descrição)'),
      'R$ ' || to_char(rec.valor, fmt) || ' vence em ' || to_char(rec.data_vencimento, 'DD/MM/YYYY'),
      'despesa', rec.id, '/gestao/financeiro');
  END LOOP;

  FOR rec IN
    SELECT r.id, r.empresa_id, r.descricao, r.valor, r.data_vencimento
    FROM public.receitas r
    WHERE r.status = 'Pendente' AND r.data_vencimento >= v_hoje AND r.data_vencimento <= v_em7
  LOOP
    v_total := v_total + public.notificar(
      rec.empresa_id, public._notif_ve_financeiro(rec.empresa_id),
      'vencimento_proximo', 'financeiro', 'medium',
      'A receber: ' || COALESCE(rec.descricao, '(sem descrição)'),
      'R$ ' || to_char(rec.valor, fmt) || ' previsto para ' || to_char(rec.data_vencimento, 'DD/MM/YYYY'),
      'receita', rec.id, '/gestao/financeiro');
  END LOOP;

  FOR rec IN
    SELECT m.id, m.empresa_id, m.nome, m.valor, m.data_prevista, m.projeto_id, p.nome AS projeto_nome
    FROM public.marcos_faturamento m
    JOIN public.projetos p ON p.id = m.projeto_id
    WHERE m.deleted_at IS NULL AND m.data_faturada IS NULL AND m.data_prevista IS NOT NULL
      AND m.data_prevista >= v_hoje AND m.data_prevista <= v_em7 AND COALESCE(m.status, '') <> 'Faturado'
  LOOP
    v_total := v_total + public.notificar(
      rec.empresa_id, public._notif_ve_financeiro(rec.empresa_id),
      'marco_proximo', 'financeiro', 'high',
      'Marco a faturar: ' || rec.nome || ' (' || rec.projeto_nome || ')',
      'R$ ' || to_char(rec.valor, fmt) || ' previsto para ' || to_char(rec.data_prevista, 'DD/MM/YYYY') || '. Fature para não perder o prazo.',
      'marco', rec.id, '/projetos/' || rec.projeto_id);
  END LOOP;

  -- ── Projeto: atrasado e a vencer em 7 dias (gestão + responsáveis) ───────
  FOR rec IN
    SELECT p.id, p.empresa_id, p.nome, p.data_previsao
    FROM public.projetos p
    WHERE p.deleted_at IS NULL AND p.data_previsao IS NOT NULL AND p.data_final IS NULL
      AND p.status NOT IN ('Concluído', 'Cancelado')
      AND p.data_previsao < v_hoje
  LOOP
    v_dest := ARRAY(SELECT DISTINCT unnest(public._notif_gestao(rec.empresa_id) || public._notif_resp_projeto(rec.id)));
    v_total := v_total + public.notificar(
      rec.empresa_id, v_dest, 'projeto_atrasado', 'projeto', 'high',
      'Prazo estourado: ' || rec.nome,
      'A previsão de entrega era ' || to_char(rec.data_previsao, 'DD/MM/YYYY') || ' e o projeto não foi concluído.',
      'projeto', rec.id, '/projetos/' || rec.id);
  END LOOP;

  FOR rec IN
    SELECT p.id, p.empresa_id, p.nome, p.data_previsao
    FROM public.projetos p
    WHERE p.deleted_at IS NULL AND p.data_previsao IS NOT NULL AND p.data_final IS NULL
      AND p.status NOT IN ('Concluído', 'Cancelado')
      AND p.data_previsao >= v_hoje AND p.data_previsao <= v_em7
  LOOP
    v_dest := ARRAY(SELECT DISTINCT unnest(public._notif_gestao(rec.empresa_id) || public._notif_resp_projeto(rec.id)));
    v_total := v_total + public.notificar(
      rec.empresa_id, v_dest, 'projeto_prazo_proximo', 'projeto', 'medium',
      'Prazo próximo: ' || rec.nome,
      'A entrega está prevista para ' || to_char(rec.data_previsao, 'DD/MM/YYYY') || '.',
      'projeto', rec.id, '/projetos/' || rec.id);
  END LOOP;

  -- ── Disciplina: atrasada e a vencer em 7 dias (gestão + responsáveis) ────
  FOR rec IN
    SELECT d.id, d.projeto_id, d.nome, d.data_fim, p.empresa_id, p.nome AS projeto_nome
    FROM public.projeto_disciplinas d
    JOIN public.projetos p ON p.id = d.projeto_id
    WHERE p.deleted_at IS NULL AND d.data_fim IS NOT NULL AND COALESCE(d.status, '') <> 'Concluído'
      AND d.data_fim < v_hoje
  LOOP
    v_dest := ARRAY(SELECT DISTINCT unnest(public._notif_gestao(rec.empresa_id) || public._notif_resp_disciplina(rec.id)));
    v_total := v_total + public.notificar(
      rec.empresa_id, v_dest, 'disciplina_atrasada', 'disciplina', 'high',
      'Disciplina atrasada: ' || rec.nome || ' (' || rec.projeto_nome || ')',
      'A entrega desta disciplina era ' || to_char(rec.data_fim, 'DD/MM/YYYY') || '.',
      'disciplina', rec.id, '/projetos/' || rec.projeto_id);
  END LOOP;

  FOR rec IN
    SELECT d.id, d.projeto_id, d.nome, d.data_fim, p.empresa_id, p.nome AS projeto_nome
    FROM public.projeto_disciplinas d
    JOIN public.projetos p ON p.id = d.projeto_id
    WHERE p.deleted_at IS NULL AND d.data_fim IS NOT NULL AND COALESCE(d.status, '') <> 'Concluído'
      AND d.data_fim >= v_hoje AND d.data_fim <= v_em7
  LOOP
    v_dest := ARRAY(SELECT DISTINCT unnest(public._notif_gestao(rec.empresa_id) || public._notif_resp_disciplina(rec.id)));
    v_total := v_total + public.notificar(
      rec.empresa_id, v_dest, 'disciplina_prazo_proximo', 'disciplina', 'medium',
      'Prazo próximo: ' || rec.nome || ' (' || rec.projeto_nome || ')',
      'A entrega desta disciplina é ' || to_char(rec.data_fim, 'DD/MM/YYYY') || '.',
      'disciplina', rec.id, '/projetos/' || rec.projeto_id);
  END LOOP;

  -- ── Obra: passo (tarefa da obra) com prazo estourado (gestão + responsáveis) ──
  FOR rec IN
    SELECT t.id, t.empresa_id, t.titulo, t.prazo, t.obra_id
    FROM public.tarefas t
    WHERE t.obra_id IS NOT NULL AND t.prazo IS NOT NULL AND t.prazo < v_hoje
      AND COALESCE(t.status, '') <> 'concluida'
  LOOP
    v_dest := ARRAY(SELECT DISTINCT unnest(public._notif_gestao(rec.empresa_id) || public._notif_resp_tarefa(rec.id)));
    v_total := v_total + public.notificar(
      rec.empresa_id, v_dest, 'obra_passo_atrasado', 'obra', 'high',
      'Passo atrasado: ' || rec.titulo,
      'O prazo deste passo da obra era ' || to_char(rec.prazo, 'DD/MM/YYYY') || '.',
      'tarefa', rec.id, '/obras/' || rec.obra_id);
  END LOOP;

  -- ── Completude: projetos ativos com contrato e sem custo lançado (gestão) ──
  FOR rec IN
    SELECT p.empresa_id, count(*) AS qtd
    FROM public.projetos p
    WHERE p.deleted_at IS NULL AND p.status NOT IN ('Concluído', 'Cancelado')
      AND COALESCE(p.valor_contrato, 0) > 0
      AND NOT EXISTS (SELECT 1 FROM public.despesas d WHERE d.projeto_id = p.id)
    GROUP BY p.empresa_id
  LOOP
    v_total := v_total + public.notificar(
      rec.empresa_id, public._notif_gestao(rec.empresa_id),
      'custo_nao_lancado', 'financeiro', 'medium',
      'Lucro não calculável em ' || rec.qtd || ' projeto(s)',
      rec.qtd || ' projeto(s) ativo(s) com contrato ainda não têm nenhuma despesa lançada. Sem custo, não dá para saber se estão dando lucro.',
      'projetos', NULL, '/gestao/financeiro');
  END LOOP;

  -- ── Guardião de escopo (spec 067, FIN-5): despesas diretas do projeto já
  --    passam o custo estimado do escopo aprovado (original + aditivos
  --    aprovados), sem aditivo em rascunho/pendente cobrindo a diferença.
  --    `custo_orcado > 0` exige escopo original definido — projeto sem
  --    escopo nunca notifica (nada pra comparar). Destinatários: gestão +
  --    responsáveis do projeto, mesmo padrão de projeto_atrasado.
  FOR rec IN
    SELECT p.id, p.empresa_id, p.nome,
      esc.custo_orcado, desp.total AS despesas_diretas
    FROM public.projetos p
    JOIN LATERAL (
      SELECT SUM(e.custo_estimado) AS custo_orcado
      FROM public.escopos e
      WHERE e.projeto_id = p.id AND e.deleted_at IS NULL
        AND (e.tipo = 'original' OR (e.tipo = 'aditivo' AND e.status = 'aprovado'))
    ) esc ON true
    LEFT JOIN LATERAL (
      SELECT SUM(d.valor) AS total
      FROM public.despesas d
      WHERE d.projeto_id = p.id AND d.deleted_at IS NULL AND d.status IN ('Pago', 'Pendente')
    ) desp ON true
    WHERE p.deleted_at IS NULL AND p.status = 'Em andamento'
      AND COALESCE(esc.custo_orcado, 0) > 0
      AND COALESCE(desp.total, 0) > esc.custo_orcado
      AND NOT EXISTS (
        SELECT 1 FROM public.escopos ea
        WHERE ea.projeto_id = p.id AND ea.deleted_at IS NULL
          AND ea.tipo = 'aditivo' AND ea.status IN ('rascunho', 'pendente_aprovacao')
      )
  LOOP
    v_dest := ARRAY(SELECT DISTINCT unnest(public._notif_gestao(rec.empresa_id) || public._notif_resp_projeto(rec.id)));
    v_total := v_total + public.notificar(
      rec.empresa_id, v_dest, 'orcamento_excedido', 'financeiro', 'high',
      'Escopo estourado: ' || rec.nome,
      'Despesas já passam do orçado (R$ ' || to_char(rec.despesas_diretas, fmt) ||
        ' de R$ ' || to_char(rec.custo_orcado, fmt) || ') e não há aditivo em análise.',
      'projeto', rec.id, '/projetos/' || rec.id);
  END LOOP;

  RETURN v_total;
END;
$$;
