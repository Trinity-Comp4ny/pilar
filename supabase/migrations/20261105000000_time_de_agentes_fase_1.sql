-- SPEC 126 Fase 1 (ADR 0060): os agentes Receita, Clientes e Chefe de gabinete passam a
-- rodar sozinhos. O executor (Edge Function ops-agente-run) calcula os fatos pelas mesmas
-- RPCs da tela, decide em código quem precisa de contato e pede ao modelo só o texto
-- (briefing e rascunho). Tudo que vai para cliente nasce como ação pendente (N1): quem
-- envia é o ultra admin.

-- ─── Ajustes da fase 0 ───────────────────────────────────────────────────────

-- O preço dos modelos (ai_model_precos) e o ledger são em USD; o painel converte.
ALTER TABLE public.ops_execucoes RENAME COLUMN custo_brl TO custo_usd;

-- Chave natural da ação (ex.: "teste:<empresa>:<vencimento>"). Com ela o cron das 7h e o
-- das 19h não criam duas ações pendentes para o mesmo fato.
ALTER TABLE public.ops_acoes ADD COLUMN chave text;
CREATE UNIQUE INDEX ops_acoes_chave_pendente_uidx
  ON public.ops_acoes (agente_id, chave) WHERE status = 'pendente';

-- ─── Números: também para o executor ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.ops_saude_empresas()
RETURNS TABLE (
  empresa_id         uuid,
  empresa_nome       text,
  situacao_cobranca  text,
  nota               integer,
  faixa              text,
  ultimo_acesso      timestamptz,
  dias_sem_acesso    integer,
  semanas_ativas     integer,
  projetos_ativos    integer,
  usuarios           integer,
  usuarios_ativos_14d integer,
  feedback_aberto    integer,
  em_atraso          boolean,
  contato_nome       text,
  contato_telefone   text,
  criada_em          timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  -- Ultra admin pela tela; service role pelo executor dos agentes (ops-agente-run).
  IF NOT (public.is_ultra_admin() OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'Só ultra_admin pode ver a saúde das empresas' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH alvo AS (
    SELECT e.id, e.nome, e.owner_id, e.created_at
    FROM public.empresas e
    WHERE e.deleted_at IS NULL
      AND e.status NOT IN ('cancelled', 'suspended')
      AND NOT EXISTS (
        SELECT 1 FROM public.profiles pu
        WHERE pu.empresa_id = e.id AND pu.role = 'ultra_admin'
      )
  ),
  acesso_usuario AS (
    SELECT p.empresa_id, p.id AS user_id,
           GREATEST(u.last_sign_in_at, (SELECT max(s.refreshed_at) FROM auth.sessions s WHERE s.user_id = u.id)) AS visto
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE p.empresa_id IN (SELECT id FROM alvo)
      AND p.desativado_em IS NULL
  ),
  acesso AS (
    SELECT a.empresa_id,
           max(a.visto) AS ultimo,
           count(*)::integer AS usuarios,
           count(*) FILTER (WHERE a.visto >= now() - interval '14 days')::integer AS ativos_14d
    FROM acesso_usuario a
    GROUP BY a.empresa_id
  ),
  -- Blocos de 7 dias contados de hoje para trás (0 a 3), não semana do calendário:
  -- 28 dias cruzam até 5 semanas de calendário e a nota passaria de "4 de 4".
  uso AS (
    SELECT l.empresa_id,
           count(DISTINCT floor(extract(epoch FROM (now() - l.created_at)) / 604800))::integer AS semanas
    FROM public.audit_logs l
    WHERE l.created_at > now() - interval '28 days'
      AND l.empresa_id IN (SELECT id FROM alvo)
    GROUP BY l.empresa_id
  ),
  proj AS (
    SELECT pr.empresa_id, count(*)::integer AS ativos
    FROM public.projetos pr
    WHERE pr.deleted_at IS NULL
      AND COALESCE(pr.exemplo, false) = false
      AND pr.status NOT IN ('Concluído', 'Cancelado')
      AND pr.empresa_id IN (SELECT id FROM alvo)
    GROUP BY pr.empresa_id
  ),
  fb AS (
    SELECT f.empresa_id, count(*)::integer AS abertos
    FROM public.feature_suggestions f
    WHERE f.status_interno = 'novo'
      AND f.created_at < now() - interval '24 hours'
      AND f.empresa_id IN (SELECT id FROM alvo)
    GROUP BY f.empresa_id
  ),
  sub AS (
    SELECT DISTINCT ON (s.empresa_id) s.empresa_id, s.status, s.asaas_subscription_id
    FROM public.pilar_subscriptions s
    WHERE s.empresa_id IN (SELECT id FROM alvo)
    ORDER BY s.empresa_id, s.created_at DESC
  ),
  base AS (
    SELECT
      a.id, a.nome, a.created_at,
      CASE
        WHEN sb.empresa_id IS NULL OR (sb.status = 'active' AND sb.asaas_subscription_id IS NULL) THEN 'convidada'
        WHEN sb.status = 'active' THEN 'pagante'
        WHEN sb.status = 'trialing' THEN 'em_teste'
        WHEN sb.status = 'overdue' THEN 'em_atraso'
        WHEN sb.status = 'expired' THEN 'teste_vencido'
        ELSE 'assinatura_cancelada'
      END AS situacao,
      ac.ultimo,
      CASE WHEN ac.ultimo IS NULL THEN NULL
           ELSE floor(extract(epoch FROM (now() - ac.ultimo)) / 86400)::integer END AS dias,
      COALESCE(u.semanas, 0) AS semanas,
      COALESCE(pj.ativos, 0) AS projetos,
      COALESCE(ac.usuarios, 0) AS usuarios,
      COALESCE(ac.ativos_14d, 0) AS ativos_14d,
      COALESCE(f.abertos, 0) AS feedback,
      COALESCE(sb.status = 'overdue', false) AS atraso,
      own.nome AS dono_nome,
      own.contato AS dono_telefone
    FROM alvo a
    LEFT JOIN acesso ac ON ac.empresa_id = a.id
    LEFT JOIN uso u ON u.empresa_id = a.id
    LEFT JOIN proj pj ON pj.empresa_id = a.id
    LEFT JOIN fb f ON f.empresa_id = a.id
    LEFT JOIN sub sb ON sb.empresa_id = a.id
    LEFT JOIN public.profiles own ON own.id = a.owner_id
  )
  SELECT
    b.id, b.nome, b.situacao,
    n.nota,
    CASE WHEN n.nota >= 70 THEN 'saudavel' WHEN n.nota >= 40 THEN 'atencao' ELSE 'risco' END,
    b.ultimo, b.dias, b.semanas, b.projetos, b.usuarios, b.ativos_14d, b.feedback, b.atraso,
    b.dono_nome, b.dono_telefone, b.created_at
  FROM base b
  CROSS JOIN LATERAL (
    SELECT public._ops_nota_saude(b.dias, b.semanas, b.projetos, b.ativos_14d, b.feedback, b.atraso) AS nota
  ) n
  ORDER BY n.nota ASC, b.nome;
END;
$$;


CREATE OR REPLACE FUNCTION public.ops_receita(p_dias integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dias      integer := LEAST(GREATEST(COALESCE(p_dias, 30), 1), 365);
  v_desde     timestamptz := now() - make_interval(days => v_dias);
  v_anterior  timestamptz := now() - make_interval(days => v_dias * 2);
  v_resultado jsonb;
BEGIN
  -- Ultra admin pela tela; service role pelo executor dos agentes (ops-agente-run).
  IF NOT (public.is_ultra_admin() OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'Só ultra_admin pode ver a receita' USING ERRCODE = '42501';
  END IF;

  WITH emp AS (
    SELECT e.id, e.nome, e.created_at, e.owner_id
    FROM public.empresas e
    WHERE e.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.profiles pu WHERE pu.empresa_id = e.id AND pu.role = 'ultra_admin'
      )
  ),
  sub AS (
    SELECT DISTINCT ON (s.empresa_id) s.*
    FROM public.pilar_subscriptions s
    ORDER BY s.empresa_id, s.created_at DESC
  ),
  ativada AS (
    SELECT pr.empresa_id, min(pr.created_at) AS primeiro_projeto, count(*)::integer AS projetos
    FROM public.projetos pr
    WHERE pr.deleted_at IS NULL AND COALESCE(pr.exemplo, false) = false
    GROUP BY pr.empresa_id
  ),
  conversao AS (
    SELECT l.empresa_id, min(l.created_at) AS convertida_em
    FROM public.admin_audit_logs l
    WHERE l.action = 'trial_converted_active'
    GROUP BY l.empresa_id
  ),
  origem AS (
    SELECT e.id AS empresa_id,
           COALESCE(NULLIF(u.raw_user_meta_data -> 'origem' ->> 'utm_source', ''), 'direto') AS fonte,
           COALESCE(NULLIF(u.raw_user_meta_data -> 'origem' ->> 'utm_campaign', ''), '(sem campanha)') AS campanha
    FROM emp e
    LEFT JOIN auth.users u ON u.id = e.owner_id
  ),
  pagantes AS (
    SELECT s.empresa_id, s.billing_cycle, pl.preco_mensal, pl.preco_anual
    FROM sub s
    JOIN emp e ON e.id = s.empresa_id
    LEFT JOIN public.pilar_subscription_plans pl ON pl.id = s.plan_id
    WHERE s.status = 'active' AND s.asaas_subscription_id IS NOT NULL
  ),
  periodo AS (
    SELECT
      count(*) FILTER (WHERE e.created_at >= v_desde) AS cadastros,
      count(*) FILTER (WHERE e.created_at >= v_anterior AND e.created_at < v_desde) AS cadastros_ant,
      count(*) FILTER (WHERE e.created_at >= v_desde AND a.empresa_id IS NOT NULL) AS ativados,
      count(*) FILTER (WHERE e.created_at >= v_anterior AND e.created_at < v_desde AND a.empresa_id IS NOT NULL) AS ativados_ant
    FROM emp e
    LEFT JOIN ativada a ON a.empresa_id = e.id
  )
  SELECT jsonb_build_object(
    'dias', v_dias,
    'gerado_em', now(),
    'cadastros', p.cadastros,
    'cadastros_anterior', p.cadastros_ant,
    'ativados', p.ativados,
    'ativados_anterior', p.ativados_ant,
    'novos_pagantes', (SELECT count(*) FROM conversao c JOIN emp e ON e.id = c.empresa_id WHERE c.convertida_em >= v_desde),
    'novos_pagantes_anterior', (SELECT count(*) FROM conversao c JOIN emp e ON e.id = c.empresa_id
                                 WHERE c.convertida_em >= v_anterior AND c.convertida_em < v_desde),
    'pagantes', (SELECT count(*) FROM pagantes),
    'mrr', (SELECT COALESCE(round(sum(CASE WHEN pg.billing_cycle = 'yearly' THEN COALESCE(pg.preco_anual, 0) / 12
                                          ELSE COALESCE(pg.preco_mensal, 0) END), 2), 0) FROM pagantes pg),
    'em_teste', (SELECT count(*) FROM sub s JOIN emp e ON e.id = s.empresa_id WHERE s.status = 'trialing'),
    'testes_vencendo', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'empresa_id', e.id, 'empresa_nome', e.nome, 'vence_em', s.trial_ends_at,
               'projetos', COALESCE(a.projetos, 0), 'contato_nome', own.nome, 'contato_telefone', own.contato
             ) ORDER BY s.trial_ends_at)
      FROM sub s
      JOIN emp e ON e.id = s.empresa_id
      LEFT JOIN ativada a ON a.empresa_id = e.id
      LEFT JOIN public.profiles own ON own.id = e.owner_id
      WHERE s.status = 'trialing' AND s.trial_ends_at BETWEEN now() AND now() + interval '48 hours'
    ), '[]'::jsonb),
    'em_atraso', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'empresa_id', e.id, 'empresa_nome', e.nome, 'desde', s.updated_at,
               'contato_nome', own.nome, 'contato_telefone', own.contato
             ) ORDER BY s.updated_at)
      FROM sub s
      JOIN emp e ON e.id = s.empresa_id
      LEFT JOIN public.profiles own ON own.id = e.owner_id
      WHERE s.status = 'overdue'
    ), '[]'::jsonb),
    'checkout_pendente', (
      SELECT count(*) FROM public.pilar_pending_signups ps
      WHERE ps.created_at >= v_desde AND ps.paid_at IS NULL
    ),
    'por_origem', COALESCE((
      SELECT jsonb_agg(linha ORDER BY (linha ->> 'cadastros')::integer DESC)
      FROM (
        SELECT jsonb_build_object(
                 'fonte', o.fonte, 'campanha', o.campanha,
                 'cadastros', count(*),
                 'ativados', count(a.empresa_id),
                 'pagantes', count(pg.empresa_id)
               ) AS linha
        FROM emp e
        JOIN origem o ON o.empresa_id = e.id
        LEFT JOIN ativada a ON a.empresa_id = e.id
        LEFT JOIN pagantes pg ON pg.empresa_id = e.id
        WHERE e.created_at >= v_desde
        GROUP BY o.fonte, o.campanha
      ) t
    ), '[]'::jsonb)
  )
  INTO v_resultado
  FROM periodo p;

  RETURN v_resultado;
END;
$$;


-- ─── Decisão sobre a ação (tela) ─────────────────────────────────────────────
-- "enviada": o ultra admin mandou a mensagem (pelo wa.me); grava o texto final e se foi
-- editado, para medir a taxa de aprovação sem edição (ADR 0060). "descartada": não vale.

CREATE FUNCTION public.ops_decidir_acao(
  p_acao_id  uuid,
  p_decisao  text,
  p_texto    text DEFAULT NULL,
  p_motivo   text DEFAULT NULL
)
RETURNS public.ops_acoes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acao public.ops_acoes;
  v_original text;
BEGIN
  IF NOT public.is_ultra_admin() THEN
    RAISE EXCEPTION 'Só ultra_admin decide ações dos agentes' USING ERRCODE = '42501';
  END IF;
  IF p_decisao NOT IN ('enviada', 'descartada') THEN
    RAISE EXCEPTION 'Decisão inválida: %', p_decisao USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_acao FROM public.ops_acoes WHERE id = p_acao_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ação não encontrada' USING ERRCODE = 'P0002';
  END IF;
  IF v_acao.status <> 'pendente' THEN
    RAISE EXCEPTION 'Ação já decidida (%)', v_acao.status USING ERRCODE = '22023';
  END IF;

  v_original := v_acao.rascunho ->> 'texto';

  IF p_decisao = 'enviada' THEN
    UPDATE public.ops_acoes
       SET status = 'executada',
           editada = (NULLIF(trim(p_texto), '') IS NOT NULL AND trim(p_texto) <> COALESCE(v_original, '')),
           rascunho = CASE
             WHEN NULLIF(trim(p_texto), '') IS NULL THEN rascunho
             ELSE jsonb_set(COALESCE(rascunho, '{}'::jsonb), '{texto}', to_jsonb(trim(p_texto)))
           END,
           decidida_em = now(),
           executada_em = now(),
           resultado = jsonb_build_object('por', auth.uid())
     WHERE id = p_acao_id
     RETURNING * INTO v_acao;
  ELSE
    UPDATE public.ops_acoes
       SET status = 'descartada',
           motivo_descarte = NULLIF(trim(p_motivo), ''),
           decidida_em = now(),
           resultado = jsonb_build_object('por', auth.uid())
     WHERE id = p_acao_id
     RETURNING * INTO v_acao;
  END IF;

  RETURN v_acao;
END;
$$;

REVOKE ALL ON FUNCTION public.ops_decidir_acao(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ops_decidir_acao(uuid, text, text, text) TO authenticated;

-- Pausar ou retomar um agente (botão da ficha). Pausado, o cron pula a execução.
CREATE FUNCTION public.ops_definir_agente_ativo(p_agente_id text, p_ativo boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_ultra_admin() THEN
    RAISE EXCEPTION 'Só ultra_admin pausa ou retoma agentes' USING ERRCODE = '42501';
  END IF;
  UPDATE public.ops_agentes SET ativo = p_ativo, updated_at = now() WHERE id = p_agente_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agente não encontrado: %', p_agente_id USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.ops_definir_agente_ativo(text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ops_definir_agente_ativo(text, boolean) TO authenticated;

-- ─── Agendamento ─────────────────────────────────────────────────────────────
-- Mesmo padrão de segredo próprio via Vault de retencao_pos_trial_disparar().

CREATE FUNCTION public.ops_agente_disparar(p_agente_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_url text := public._cron_secret('app_supabase_url');
  v_key text := public._cron_secret('app_cron_secret');
BEGIN
  IF v_url IS NULL OR v_url = '' OR v_key IS NULL OR v_key = '' THEN
    RAISE NOTICE 'ops_agente_disparar: vault secrets ausentes, disparo pulado';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := v_url || '/functions/v1/ops-agente-run',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body    := jsonb_build_object('agente_id', p_agente_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ops_agente_disparar(text) FROM PUBLIC, anon, authenticated;

-- Horário em UTC: 10h = 7h de Brasília. Receita roda também às 19h (22h UTC), porque
-- teste vencendo e checkout parado não esperam o dia seguinte. O Chefe vem depois dos dois.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ops-receita') THEN
      PERFORM cron.unschedule('ops-receita');
    END IF;
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ops-clientes') THEN
      PERFORM cron.unschedule('ops-clientes');
    END IF;
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ops-chefe') THEN
      PERFORM cron.unschedule('ops-chefe');
    END IF;
    PERFORM cron.schedule('ops-receita', '0 10,22 * * *', $c$SELECT public.ops_agente_disparar('receita');$c$);
    PERFORM cron.schedule('ops-clientes', '5 10 * * *', $c$SELECT public.ops_agente_disparar('clientes');$c$);
    PERFORM cron.schedule('ops-chefe', '10 10 * * *', $c$SELECT public.ops_agente_disparar('chefe');$c$);
  END IF;
END;
$$;

-- ─── Liga os três agentes da fase 1 ──────────────────────────────────────────
-- Teto de R$ 30 por mês cada (convertido do custo em USD na mesma referência do painel).
-- O resumo do Chefe é e-mail para o próprio ultra admin: N2 (faz e avisa).

UPDATE public.ops_agentes
   SET ativo = true, teto_mensal_brl = 30, updated_at = now(),
       cron = CASE id WHEN 'receita' THEN '0 10,22 * * *' WHEN 'clientes' THEN '5 10 * * *' ELSE '10 10 * * *' END,
       fase = 1,
       autonomia = CASE id WHEN 'chefe' THEN '{"email": "N2"}'::jsonb ELSE autonomia END
 WHERE id IN ('receita', 'clientes', 'chefe');
