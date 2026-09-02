-- Spec 090: coordenador virou "gestão de tarefa" na RLS (tarefas_coordenador_ve_tudo), mas o
-- roteamento de notificação ambient só conhecia owner/admin como gestão. Cria um segundo helper
-- pra "gestão operacional" (prazo de projeto/disciplina/obra) sem mexer no helper de gestão
-- financeira (custo_nao_lancado/tokens_baixo continuam owner+admin só). Aproveita a mesma
-- migration pra: (a) tirar _notif_resp_projeto de orcamento_excedido — categoria financeiro não
-- pode vazar valor de orçamento pra responsável de projeto que não vê financeiro — e (b) somar
-- dois blocos novos (obra_atrasada, obra_rdo_atrasado) que nunca existiram: obras.data_fim_prevista
-- e obras.responsavel_id existem desde o MVP (spec 015) e nunca alimentaram notificação nenhuma.
--
-- gerar_notificacoes_ambient() é reproduzida por inteiro a partir da versão vigente
-- (20260889000000_fix_guardiao_escopo_fonte_orcamento.sql) — mesma prática já documentada lá:
-- CREATE OR REPLACE substitui a função inteira, então cada migration que mexe nela carrega o
-- corpo todo, não só o trecho alterado.

BEGIN;

CREATE OR REPLACE FUNCTION public._notif_gestao_operacional(p_empresa uuid)
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(array_agg(id), '{}')
  FROM public.profiles
  WHERE empresa_id = p_empresa AND role IN ('owner', 'admin', 'coordenador');
$$;

REVOKE ALL ON FUNCTION public._notif_gestao_operacional(uuid) FROM PUBLIC;

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

  -- ── Projeto: atrasado e a vencer em 7 dias (gestão OPERACIONAL + responsáveis) ───
  -- (spec 090: coordenador entra aqui, ele já vê tudo na RLS de tarefas)
  FOR rec IN
    SELECT p.id, p.empresa_id, p.nome, p.data_previsao
    FROM public.projetos p
    WHERE p.deleted_at IS NULL AND p.data_previsao IS NOT NULL AND p.data_final IS NULL
      AND p.status NOT IN ('Concluído', 'Cancelado')
      AND p.data_previsao < v_hoje
  LOOP
    v_dest := ARRAY(SELECT DISTINCT unnest(public._notif_gestao_operacional(rec.empresa_id) || public._notif_resp_projeto(rec.id)));
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
    v_dest := ARRAY(SELECT DISTINCT unnest(public._notif_gestao_operacional(rec.empresa_id) || public._notif_resp_projeto(rec.id)));
    v_total := v_total + public.notificar(
      rec.empresa_id, v_dest, 'projeto_prazo_proximo', 'projeto', 'medium',
      'Prazo próximo: ' || rec.nome,
      'A entrega está prevista para ' || to_char(rec.data_previsao, 'DD/MM/YYYY') || '.',
      'projeto', rec.id, '/projetos/' || rec.id);
  END LOOP;

  -- ── Disciplina: atrasada e a vencer em 7 dias (gestão OPERACIONAL + responsáveis) ──
  FOR rec IN
    SELECT d.id, d.projeto_id, d.nome, d.data_fim, p.empresa_id, p.nome AS projeto_nome
    FROM public.projeto_disciplinas d
    JOIN public.projetos p ON p.id = d.projeto_id
    WHERE p.deleted_at IS NULL AND d.data_fim IS NOT NULL AND COALESCE(d.status, '') <> 'Concluído'
      AND d.data_fim < v_hoje
  LOOP
    v_dest := ARRAY(SELECT DISTINCT unnest(public._notif_gestao_operacional(rec.empresa_id) || public._notif_resp_disciplina(rec.id)));
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
    v_dest := ARRAY(SELECT DISTINCT unnest(public._notif_gestao_operacional(rec.empresa_id) || public._notif_resp_disciplina(rec.id)));
    v_total := v_total + public.notificar(
      rec.empresa_id, v_dest, 'disciplina_prazo_proximo', 'disciplina', 'medium',
      'Prazo próximo: ' || rec.nome || ' (' || rec.projeto_nome || ')',
      'A entrega desta disciplina é ' || to_char(rec.data_fim, 'DD/MM/YYYY') || '.',
      'disciplina', rec.id, '/projetos/' || rec.projeto_id);
  END LOOP;

  -- ── Obra: passo (tarefa da obra) com prazo estourado (gestão OPERACIONAL + responsáveis) ──
  FOR rec IN
    SELECT t.id, t.empresa_id, t.titulo, t.prazo, t.obra_id
    FROM public.tarefas t
    WHERE t.obra_id IS NOT NULL AND t.prazo IS NOT NULL AND t.prazo < v_hoje
      AND COALESCE(t.status, '') <> 'concluida'
  LOOP
    v_dest := ARRAY(SELECT DISTINCT unnest(public._notif_gestao_operacional(rec.empresa_id) || public._notif_resp_tarefa(rec.id)));
    v_total := v_total + public.notificar(
      rec.empresa_id, v_dest, 'obra_passo_atrasado', 'obra', 'high',
      'Passo atrasado: ' || rec.titulo,
      'O prazo deste passo da obra era ' || to_char(rec.prazo, 'DD/MM/YYYY') || '.',
      'tarefa', rec.id, '/obras/' || rec.obra_id);
  END LOOP;

  -- ── Obra (spec 090, NOVO): a obra em si atrasada — data_fim_prevista/responsavel_id
  --    existem desde o MVP (spec 015) e nunca alimentaram notificação nenhuma; só o
  --    passo/tarefa vinculado avisava, a obra como um todo ficava muda. ────────────
  FOR rec IN
    SELECT o.id, o.empresa_id, o.nome, o.data_fim_prevista, o.responsavel_id
    FROM public.obras o
    WHERE o.deleted_at IS NULL AND o.data_fim_prevista IS NOT NULL AND o.data_fim_real IS NULL
      AND o.status NOT IN ('concluida', 'paralisada')
      AND o.data_fim_prevista < v_hoje
  LOOP
    v_dest := ARRAY(
      SELECT DISTINCT unnest(
        public._notif_gestao_operacional(rec.empresa_id)
        || COALESCE((SELECT array_agg(pe.profile_id) FROM public.pessoas pe
                      WHERE pe.id = rec.responsavel_id AND pe.profile_id IS NOT NULL), '{}')
      )
    );
    v_total := v_total + public.notificar(
      rec.empresa_id, v_dest, 'obra_atrasada', 'obra', 'high',
      'Obra atrasada: ' || rec.nome,
      'A previsão de conclusão era ' || to_char(rec.data_fim_prevista, 'DD/MM/YYYY') || ' e a obra não foi concluída.',
      'obra', rec.id, '/obras/' || rec.id);
  END LOOP;

  -- ── Obra (spec 090, NOVO): RDO em atraso — obra em andamento há mais de 3 dias sem
  --    diário lançado nos últimos 3 dias (nem nunca lançou nenhum). Janela de 3 dias,
  --    não 7, porque RDO é lançamento diário (ver decisões da spec 090). ─────────────
  FOR rec IN
    SELECT o.id, o.empresa_id, o.nome, o.responsavel_id,
      (SELECT MAX(r.data) FROM public.obra_rdo r WHERE r.obra_id = o.id) AS ultimo_rdo
    FROM public.obras o
    WHERE o.deleted_at IS NULL AND o.status = 'em_andamento'
      AND o.data_inicio_real IS NOT NULL AND o.data_inicio_real <= v_hoje - 3
  LOOP
    CONTINUE WHEN rec.ultimo_rdo IS NOT NULL AND rec.ultimo_rdo >= v_hoje - 3;
    v_dest := ARRAY(
      SELECT DISTINCT unnest(
        public._notif_gestao_operacional(rec.empresa_id)
        || COALESCE((SELECT array_agg(pe.profile_id) FROM public.pessoas pe
                      WHERE pe.id = rec.responsavel_id AND pe.profile_id IS NOT NULL), '{}')
      )
    );
    v_total := v_total + public.notificar(
      rec.empresa_id, v_dest, 'obra_rdo_atrasado', 'obra', 'medium',
      'RDO em atraso: ' || rec.nome,
      CASE WHEN rec.ultimo_rdo IS NULL
        THEN 'Nenhum diário de obra foi lançado ainda.'
        ELSE 'Último diário lançado em ' || to_char(rec.ultimo_rdo, 'DD/MM/YYYY') || '.'
      END,
      'obra', rec.id, '/obras/' || rec.id);
  END LOOP;

  -- ── Completude: projetos ativos com contrato e sem custo lançado (gestão financeira) ──
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

  -- ── Guardião de escopo (spec 067/081, FIN-5; roteamento corrigido spec 090): categoria
  --    financeiro, então só quem vê financeiro (_notif_ve_financeiro) — nunca
  --    _notif_resp_projeto puro, que vazava o valor do orçamento pra responsável de
  --    disciplina que é coordenador/colaborador (sem acesso a financeiro). ─────────────
  FOR rec IN
    SELECT p.id, p.empresa_id, p.nome,
      orc.custo_orcado, desp.total AS despesas_diretas
    FROM public.projetos p
    JOIN LATERAL (
      SELECT SUM(pof.custo_estimado) AS custo_orcado
      FROM public.projeto_orcamento_fases pof
      WHERE pof.projeto_id = p.id AND pof.deleted_at IS NULL
    ) orc ON true
    LEFT JOIN LATERAL (
      SELECT SUM(d.valor) AS total
      FROM public.despesas d
      WHERE d.projeto_id = p.id AND d.deleted_at IS NULL AND d.status IN ('Pago', 'Pendente')
    ) desp ON true
    WHERE p.deleted_at IS NULL AND p.status = 'Em andamento'
      AND COALESCE(orc.custo_orcado, 0) > 0
      AND COALESCE(desp.total, 0) > orc.custo_orcado
      AND NOT EXISTS (
        SELECT 1 FROM public.escopos ea
        WHERE ea.projeto_id = p.id AND ea.deleted_at IS NULL
          AND ea.tipo = 'aditivo' AND ea.status IN ('rascunho', 'pendente_aprovacao')
      )
  LOOP
    v_total := v_total + public.notificar(
      rec.empresa_id, public._notif_ve_financeiro(rec.empresa_id),
      'orcamento_excedido', 'financeiro', 'high',
      'Escopo estourado: ' || rec.nome,
      'Despesas já passam do orçado (R$ ' || to_char(rec.despesas_diretas, fmt) ||
        ' de R$ ' || to_char(rec.custo_orcado, fmt) || ') e não há aditivo em análise.',
      'projeto', rec.id, '/projetos/' || rec.id);
  END LOOP;

  -- ── Motor de tokens (spec 076): saldo abaixo de 10% da cota do ciclo (gestão financeira) ──
  FOR rec IN
    SELECT s.empresa_id,
           (s.saldo_plano + s.saldo_comprado) AS saldo_total,
           COALESCE(
             (SELECT p.tokens_mensais FROM public.pilar_subscriptions sub
              JOIN public.pilar_subscription_plans p ON p.id = sub.plan_id
              WHERE sub.empresa_id = s.empresa_id AND sub.status IN ('trialing', 'active')
              LIMIT 1),
             (SELECT p.tokens_mensais FROM public.pilar_subscription_plans p WHERE p.slug = 'starter'),
             500000
           ) AS cota
    FROM public.ai_token_saldo s
  LOOP
    CONTINUE WHEN rec.cota <= 0 OR rec.saldo_total >= rec.cota * 0.10;
    v_total := v_total + public.notificar(
      rec.empresa_id, public._notif_gestao(rec.empresa_id),
      'tokens_baixo', 'financeiro', 'high',
      'Tokens de IA acabando',
      'Restam ' || rec.saldo_total || ' tokens de IA neste ciclo (menos de 10% da cota). ' ||
        'A renovação acontece no próximo ciclo mensal.',
      'empresa', NULL, NULL);
  END LOOP;

  RETURN v_total;
END;
$$;

COMMIT;
