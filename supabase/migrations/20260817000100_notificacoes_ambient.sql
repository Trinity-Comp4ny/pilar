-- Central de notificações · Fase 3 (spec 029): varredura diária roteada por
-- destinatário. Porta os achados de gerar_alertas_ambient() para o modelo por
-- usuário (spec 029/ADR 0015) e adiciona os "em 7 dias" de projeto/disciplina e o
-- passo de obra atrasado. Cada achado vira notificação só para quem é responsável
-- por ele + a gestão; financeiro só para quem pode ver dinheiro (ADR 0005).
--
-- gerar_alertas_ambient() (tabela `alertas`) fica DORMENTE: o cron passa a chamar
-- este gerador; a tabela `alertas` guarda o histórico (o dashboard ainda a lê até
-- ser migrado — fora do escopo desta fase).

BEGIN;

-- ---------------------------------------------------------------------------
-- Helpers de destinatário. SECURITY DEFINER para ler pessoas/profiles sem RLS;
-- rodam dentro do gerador (que também é definer). REVOKE de PUBLIC.
-- Retornam SEMPRE um array (vazio se ninguém), nunca NULL.
-- ---------------------------------------------------------------------------

-- Gestão: donos e administradores da empresa (has_role admin ≈ owner, ADR 0005).
CREATE OR REPLACE FUNCTION public._notif_gestao(p_empresa uuid)
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(array_agg(id), '{}')
  FROM public.profiles
  WHERE empresa_id = p_empresa AND role IN ('owner', 'admin');
$$;

-- Quem pode ver financeiro: todos menos coordenador/colaborador (espelha
-- can_view_financeiro). Já engloba a gestão.
CREATE OR REPLACE FUNCTION public._notif_ve_financeiro(p_empresa uuid)
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(array_agg(id), '{}')
  FROM public.profiles
  WHERE empresa_id = p_empresa AND role IS NOT NULL AND role NOT IN ('coordenador', 'colaborador');
$$;

-- Responsáveis de uma disciplina (só quem tem conta).
CREATE OR REPLACE FUNCTION public._notif_resp_disciplina(p_disciplina uuid)
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(array_agg(DISTINCT pe.profile_id), '{}')
  FROM public.projeto_disciplina_responsaveis r
  JOIN public.pessoas pe ON pe.id = r.pessoa_id
  WHERE r.projeto_disciplina_id = p_disciplina AND pe.profile_id IS NOT NULL;
$$;

-- Responsáveis de um projeto = união dos responsáveis das suas disciplinas
-- (projetos não têm responsável próprio).
CREATE OR REPLACE FUNCTION public._notif_resp_projeto(p_projeto uuid)
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(array_agg(DISTINCT pe.profile_id), '{}')
  FROM public.projeto_disciplinas d
  JOIN public.projeto_disciplina_responsaveis r ON r.projeto_disciplina_id = d.id
  JOIN public.pessoas pe ON pe.id = r.pessoa_id
  WHERE d.projeto_id = p_projeto AND pe.profile_id IS NOT NULL;
$$;

-- Responsáveis de uma tarefa: o primário (responsavel_id) + a ponte multi-resp.
CREATE OR REPLACE FUNCTION public._notif_resp_tarefa(p_tarefa uuid)
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(array_agg(DISTINCT pid), '{}') FROM (
    SELECT pe.profile_id AS pid
      FROM public.tarefas t JOIN public.pessoas pe ON pe.id = t.responsavel_id
      WHERE t.id = p_tarefa AND pe.profile_id IS NOT NULL
    UNION
    SELECT pe.profile_id
      FROM public.tarefa_responsaveis tr JOIN public.pessoas pe ON pe.id = tr.pessoa_id
      WHERE tr.tarefa_id = p_tarefa AND pe.profile_id IS NOT NULL
  ) s;
$$;

REVOKE ALL ON FUNCTION public._notif_gestao(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._notif_ve_financeiro(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._notif_resp_disciplina(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._notif_resp_projeto(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._notif_resp_tarefa(uuid) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- Varredura. Itera os achados e chama notificar() por achado; notificar já
-- deduplica (não empilha não-lida) e respeita a preferência do destinatário.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gerar_notificacoes_ambient()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.gerar_notificacoes_ambient() FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- Reagenda o cron: o job diário passa a gerar NOTIFICAÇÕES (por destinatário).
-- gerar_alertas_ambient() continua existindo, mas sai do cron (dormente).
-- Guardado por pg_cron (indisponível no CI local): só avisa se faltar.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron indisponível — rode SELECT gerar_notificacoes_ambient() manualmente ou agende no Dashboard.';
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'gerar-alertas-ambient') THEN
    PERFORM cron.unschedule('gerar-alertas-ambient');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'gerar-notificacoes-ambient') THEN
    PERFORM cron.unschedule('gerar-notificacoes-ambient');
  END IF;
  -- 06:00 UTC (~03:00 BRT): o usuário abre de manhã e os achados já estão prontos.
  PERFORM cron.schedule('gerar-notificacoes-ambient', '0 6 * * *', 'SELECT public.gerar_notificacoes_ambient();');
  RAISE NOTICE 'Cron gerar-notificacoes-ambient agendado: 06:00 UTC diário.';
END;
$$;

COMMIT;
