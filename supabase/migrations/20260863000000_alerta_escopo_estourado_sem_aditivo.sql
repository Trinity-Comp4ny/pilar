-- FIN-5 / spec 067: novo tipo de alerta no agente ambient (pg_cron,
-- `gerar_alertas_ambient()`, migration 20260730100000 + 20260730120000) —
-- escopo aprovado estourado por despesas reais, sem aditivo em aberto
-- cobrindo a diferença.
--
-- Achado ao investigar onde os alertas do Radar dos agentes (dashboard)
-- realmente nascem: `rpc_gerar_alertas()` (o gerador mais antigo, por linha)
-- está morto — nenhum lugar do código chama, seu overload (uuid) foi dropado
-- em 20260835000000, e o loop de horas_excedidas quebra em runtime porque
-- consulta `timesheets`, tabela dropada em 20260429000001 (confirmado via
-- pg_get_functiondef no banco local, não só grep). Quem de fato roda hoje via
-- pg_cron e alimenta o Radar é `gerar_alertas_ambient()` — é aqui que este
-- alerta precisa entrar pra ter efeito real.
CREATE OR REPLACE FUNCTION public.gerar_alertas_ambient()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_hoje date := current_date;
  v_em7  date := current_date + 7;
  v_total integer := 0;
  v_n integer;
  fmt text := 'FM999999990.00';
BEGIN
  -- Despesas vencidas → pagamento atrasado (crítico).
  INSERT INTO public.alertas (empresa_id, tipo, severidade, titulo, mensagem, referencia_tipo, referencia_id)
  SELECT d.empresa_id, 'pagamento_atrasado', 'critical',
         'Pagamento vencido: ' || COALESCE(d.descricao, '(sem descrição)'),
         'R$ ' || to_char(d.valor, fmt) || ' venceu em ' || to_char(d.data_vencimento, 'DD/MM/YYYY'),
         'despesa', d.id
  FROM public.despesas d
  WHERE d.status = 'Pendente' AND d.is_fatura_payment = false AND d.data_vencimento < v_hoje
    AND NOT EXISTS (SELECT 1 FROM public.alertas a WHERE a.tipo = 'pagamento_atrasado' AND a.referencia_id = d.id AND a.lido = false);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_total := v_total + v_n;

  -- Receitas vencidas → recebimento (alto).
  INSERT INTO public.alertas (empresa_id, tipo, severidade, titulo, mensagem, referencia_tipo, referencia_id)
  SELECT r.empresa_id, 'recebimento_baixo', 'high',
         'Recebimento vencido: ' || COALESCE(r.descricao, '(sem descrição)'),
         'R$ ' || to_char(r.valor, fmt) || ' deveria ter entrado em ' || to_char(r.data_vencimento, 'DD/MM/YYYY'),
         'receita', r.id
  FROM public.receitas r
  WHERE r.status = 'Pendente' AND r.data_vencimento < v_hoje
    AND NOT EXISTS (SELECT 1 FROM public.alertas a WHERE a.tipo = 'recebimento_baixo' AND a.referencia_id = r.id AND a.lido = false);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_total := v_total + v_n;

  -- A vencer em 7 dias (despesa e receita) → vencimento próximo (médio).
  INSERT INTO public.alertas (empresa_id, tipo, severidade, titulo, mensagem, referencia_tipo, referencia_id)
  SELECT d.empresa_id, 'vencimento_proximo', 'medium',
         'A pagar: ' || COALESCE(d.descricao, '(sem descrição)'),
         'R$ ' || to_char(d.valor, fmt) || ' vence em ' || to_char(d.data_vencimento, 'DD/MM/YYYY'),
         'despesa', d.id
  FROM public.despesas d
  WHERE d.status = 'Pendente' AND d.is_fatura_payment = false AND d.data_vencimento >= v_hoje AND d.data_vencimento <= v_em7
    AND NOT EXISTS (SELECT 1 FROM public.alertas a WHERE a.tipo = 'vencimento_proximo' AND a.referencia_id = d.id AND a.lido = false);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_total := v_total + v_n;

  INSERT INTO public.alertas (empresa_id, tipo, severidade, titulo, mensagem, referencia_tipo, referencia_id)
  SELECT r.empresa_id, 'vencimento_proximo', 'medium',
         'A receber: ' || COALESCE(r.descricao, '(sem descrição)'),
         'R$ ' || to_char(r.valor, fmt) || ' previsto para ' || to_char(r.data_vencimento, 'DD/MM/YYYY'),
         'receita', r.id
  FROM public.receitas r
  WHERE r.status = 'Pendente' AND r.data_vencimento >= v_hoje AND r.data_vencimento <= v_em7
    AND NOT EXISTS (SELECT 1 FROM public.alertas a WHERE a.tipo = 'vencimento_proximo' AND a.referencia_id = r.id AND a.lido = false);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_total := v_total + v_n;

  -- Projetos com prazo estourado.
  INSERT INTO public.alertas (empresa_id, tipo, severidade, titulo, mensagem, referencia_tipo, referencia_id)
  SELECT p.empresa_id, 'prazo_estourado', 'high',
         'Prazo estourado: ' || p.nome,
         'Previsão de entrega era ' || to_char(p.data_previsao, 'DD/MM/YYYY') || ' e o projeto não foi concluído.',
         'projeto', p.id
  FROM public.projetos p
  WHERE p.deleted_at IS NULL AND p.data_previsao IS NOT NULL AND p.data_final IS NULL
    AND p.data_previsao < v_hoje AND p.status NOT IN ('Concluído', 'Cancelado')
    AND NOT EXISTS (SELECT 1 FROM public.alertas a WHERE a.tipo = 'prazo_estourado' AND a.referencia_id = p.id AND a.lido = false);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_total := v_total + v_n;

  -- Disciplinas atrasadas, AGREGADAS por projeto (referência = projeto, para "Abrir" funcionar).
  INSERT INTO public.alertas (empresa_id, tipo, severidade, titulo, mensagem, referencia_tipo, referencia_id)
  SELECT p.empresa_id, 'disciplina_atrasada', 'high',
         CASE WHEN count(*) = 1 THEN 'Disciplina atrasada em ' || p.nome
              ELSE count(*) || ' disciplinas atrasadas em ' || p.nome END,
         'Passou da data de entrega: ' || string_agg(d.nome, ', ') || '.',
         'projeto', p.id
  FROM public.projeto_disciplinas d
  JOIN public.projetos p ON p.id = d.projeto_id
  WHERE p.deleted_at IS NULL AND d.data_fim IS NOT NULL AND d.data_fim < v_hoje
    AND COALESCE(d.status, '') <> 'Concluído'
  GROUP BY p.empresa_id, p.id, p.nome
  HAVING NOT EXISTS (
    SELECT 1 FROM public.alertas a WHERE a.tipo = 'disciplina_atrasada' AND a.referencia_id = p.id AND a.lido = false
  );
  GET DIAGNOSTICS v_n = ROW_COUNT; v_total := v_total + v_n;

  -- Marcos de faturamento a vencer nos próximos 7 dias.
  INSERT INTO public.alertas (empresa_id, tipo, severidade, titulo, mensagem, referencia_tipo, referencia_id)
  SELECT m.empresa_id, 'marco_proximo', 'high',
         'Marco a faturar: ' || m.nome || ' (' || p.nome || ')',
         'R$ ' || to_char(m.valor, fmt) || ' previsto para ' || to_char(m.data_prevista, 'DD/MM/YYYY') || '. Fature para não perder o prazo.',
         'projeto', m.projeto_id
  FROM public.marcos_faturamento m
  JOIN public.projetos p ON p.id = m.projeto_id
  WHERE m.deleted_at IS NULL AND m.data_faturada IS NULL AND m.data_prevista IS NOT NULL
    AND m.data_prevista >= v_hoje AND m.data_prevista <= v_em7 AND COALESCE(m.status, '') <> 'Faturado'
    AND NOT EXISTS (SELECT 1 FROM public.alertas a WHERE a.tipo = 'marco_proximo' AND a.referencia_id = m.id AND a.lido = false);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_total := v_total + v_n;

  -- Projetos ativos com contrato mas SEM despesa lançada (lucro não calculável).
  INSERT INTO public.alertas (empresa_id, tipo, severidade, titulo, mensagem, referencia_tipo, referencia_id)
  SELECT p.empresa_id, 'custo_nao_lancado', 'medium',
         'Lucro não calculável em ' || count(*) || ' projeto(s)',
         count(*) || ' projeto(s) ativo(s) com contrato ainda não têm nenhuma despesa lançada. Sem custo, não dá para saber se estão dando lucro.',
         'projetos', NULL
  FROM public.projetos p
  WHERE p.deleted_at IS NULL AND p.status NOT IN ('Concluído', 'Cancelado') AND COALESCE(p.valor_contrato, 0) > 0
    AND NOT EXISTS (SELECT 1 FROM public.despesas d WHERE d.projeto_id = p.id)
  GROUP BY p.empresa_id
  HAVING count(*) > 0
    AND NOT EXISTS (
      SELECT 1 FROM public.alertas a WHERE a.tipo = 'custo_nao_lancado' AND a.empresa_id = p.empresa_id AND a.lido = false
    );
  GET DIAGNOSTICS v_n = ROW_COUNT; v_total := v_total + v_n;

  -- Guardião de escopo (spec 067, FIN-5): despesas diretas do projeto já
  -- passam o custo estimado do escopo aprovado (original + aditivos
  -- aprovados), e ninguém abriu um aditivo pra cobrir. `custo_orcado > 0`
  -- exige escopo original definido — projeto sem escopo nunca gera este
  -- alerta (nada pra comparar, silêncio é o comportamento seguro).
  INSERT INTO public.alertas (empresa_id, tipo, severidade, titulo, mensagem, referencia_tipo, referencia_id)
  SELECT p.empresa_id, 'orcamento_excedido', 'high',
         'Escopo estourado: ' || p.nome,
         'Despesas já passam do orçado (R$ ' || to_char(desp.total, fmt) || ' de R$ ' || to_char(esc.custo_orcado, fmt) || ') e não há aditivo em análise.',
         'projeto', p.id
  FROM public.projetos p
  LEFT JOIN LATERAL (
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
    AND NOT EXISTS (SELECT 1 FROM public.alertas a WHERE a.tipo = 'orcamento_excedido' AND a.referencia_id = p.id AND a.lido = false);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_total := v_total + v_n;

  RETURN v_total;
END;
$function$;
