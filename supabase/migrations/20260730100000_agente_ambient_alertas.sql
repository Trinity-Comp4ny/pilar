-- Agente ambient (spec 007, Fase 3 — determinístico, ZERO LLM).
--
-- Varre os dados de cada empresa e materializa os achados na tabela `alertas`
-- (que o sino AlertsBell + o hook useAlertas já consomem). Roda via pg_cron; a
-- tela apenas LÊ o resultado, então não há custo de LLM nem processamento no
-- carregamento da página. É o "agente que trabalha de madrugada e deixa a lista
-- pronta" — pendências, vencidos e atrasos aparecem sem o usuário perguntar.
--
-- Dedup: NÃO recria um alerta que já existe NÃO LIDO para a mesma referência+tipo,
-- então rodar o cron várias vezes não empilha duplicatas. Quando o item é resolvido
-- (conta paga, prazo cumprido) ele sai do filtro e nenhum alerta novo é gerado.

-- 1. Ampliar os tipos permitidos (o CHECK atual não cobre prazo de projeto/disciplina).
ALTER TABLE public.alertas DROP CONSTRAINT IF EXISTS alertas_tipo_check;
ALTER TABLE public.alertas
  ADD CONSTRAINT alertas_tipo_check CHECK (
    tipo = ANY (ARRAY[
      'horas_excedidas', 'pagamento_atrasado', 'superalocacao', 'margem_baixa',
      'marco_proximo', 'orcamento_excedido', 'vencimento_proximo', 'recebimento_baixo',
      'prazo_estourado', 'disciplina_atrasada'
    ])
  );

-- 2. A varredura. SECURITY DEFINER: roda no cron (sem usuário) e insere para todas
-- as empresas; RLS não se aplica ao owner. Retorna quantos alertas foram criados.
CREATE OR REPLACE FUNCTION public.gerar_alertas_ambient()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hoje date := current_date;
  v_em7  date := current_date + 7;
  v_total integer := 0;
  v_n integer;
  fmt text := 'FM999999990.00'; -- valor simples (ponto decimal), sem risco de locale
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

  -- Contas a vencer nos próximos 7 dias (despesa e receita) → vencimento próximo (médio).
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

  -- Projetos com prazo estourado (previsão passou, não concluído, ainda ativo).
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

  -- Disciplinas de projeto atrasadas (data-fim passou, não concluída).
  INSERT INTO public.alertas (empresa_id, tipo, severidade, titulo, mensagem, referencia_tipo, referencia_id)
  SELECT p.empresa_id, 'disciplina_atrasada', 'high',
         'Disciplina atrasada: ' || d.nome || ' (' || p.nome || ')',
         'A entrega desta disciplina era ' || to_char(d.data_fim, 'DD/MM/YYYY') || '.',
         'disciplina', d.id
  FROM public.projeto_disciplinas d
  JOIN public.projetos p ON p.id = d.projeto_id
  WHERE p.deleted_at IS NULL AND d.data_fim IS NOT NULL AND d.data_fim < v_hoje
    AND COALESCE(d.status, '') <> 'Concluído'
    AND NOT EXISTS (SELECT 1 FROM public.alertas a WHERE a.tipo = 'disciplina_atrasada' AND a.referencia_id = d.id AND a.lido = false);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_total := v_total + v_n;

  RETURN v_total;
END;
$$;

-- Só o cron/owner executa a varredura (não exposta a anon/authenticated).
REVOKE ALL ON FUNCTION public.gerar_alertas_ambient() FROM PUBLIC;

-- 3. Agenda diária via pg_cron (idempotente). Função no próprio banco → o cron
-- chama direto, sem edge/HTTP. Se pg_cron não existir (local), só avisa.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron indisponível — rode SELECT gerar_alertas_ambient() manualmente ou agende no Dashboard.';
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'gerar-alertas-ambient') THEN
    PERFORM cron.unschedule('gerar-alertas-ambient');
  END IF;
  -- 06:00 UTC (~03:00 BRT): o usuário abre de manhã e os achados já estão prontos.
  PERFORM cron.schedule('gerar-alertas-ambient', '0 6 * * *', 'SELECT public.gerar_alertas_ambient();');
  RAISE NOTICE 'Cron gerar-alertas-ambient agendado: 06:00 UTC diário.';
END;
$$;
