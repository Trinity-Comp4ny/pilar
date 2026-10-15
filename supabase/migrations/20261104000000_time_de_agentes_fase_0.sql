-- SPEC 126 Fase 0 (ADR 0060): time de agentes de operação no Ultra, sem LLM.
--
-- Quatro tabelas da operação da Pilar (não de tenant): agentes, execuções, ações e
-- métricas diárias. Leitura só para ultra admin com MFA (is_ultra_admin); escrita só
-- pelo service role nas Edge Functions das fases seguintes. Nenhuma policy de escrita.
--
-- Duas RPCs dão os números das fichas Receita e Clientes. O número sai daqui, nunca do
-- modelo: na fase 1 o agente recebe esta mesma resposta e só escreve o briefing.
-- Só metadado de uso e cobrança: nenhum valor financeiro, cliente ou projeto de tenant.

-- ─── Tabelas ────────────────────────────────────────────────────────────────

CREATE TABLE public.ops_agentes (
  id              text PRIMARY KEY,
  nome            text NOT NULL,
  missao          text NOT NULL,
  ordem           smallint NOT NULL,
  fase            smallint NOT NULL CHECK (fase BETWEEN 0 AND 3),
  ativo           boolean NOT NULL DEFAULT false,
  cron            text,
  modelo          text,
  autonomia       jsonb NOT NULL DEFAULT '{}'::jsonb,
  teto_mensal_brl numeric(10, 2),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ops_agentes IS
  'SPEC 126: agentes de operação da Pilar (receita, clientes, marketing...). Não é dado de tenant.';

CREATE TABLE public.ops_execucoes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_id   text NOT NULL REFERENCES public.ops_agentes (id),
  gatilho     text NOT NULL CHECK (gatilho IN ('cron', 'evento', 'manual')),
  inicio      timestamptz NOT NULL DEFAULT now(),
  fim         timestamptz,
  status      text NOT NULL DEFAULT 'rodando'
              CHECK (status IN ('rodando', 'ok', 'falhou', 'pausada_teto')),
  sinais      jsonb,
  briefing    jsonb,
  descartes   jsonb,
  tokens_in   integer,
  tokens_out  integer,
  custo_brl   numeric(10, 4),
  erro        text
);

CREATE INDEX ops_execucoes_agente_inicio_idx ON public.ops_execucoes (agente_id, inicio DESC);

CREATE TABLE public.ops_acoes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_id        text NOT NULL REFERENCES public.ops_agentes (id),
  execucao_id      uuid REFERENCES public.ops_execucoes (id) ON DELETE SET NULL,
  tipo             text NOT NULL
                   CHECK (tipo IN ('email', 'whatsapp', 'tarefa', 'issue', 'conteudo', 'alerta')),
  empresa_id       uuid REFERENCES public.empresas (id) ON DELETE SET NULL,
  titulo           text NOT NULL,
  rascunho         jsonb,
  evidencia        jsonb NOT NULL,
  prioridade       smallint NOT NULL DEFAULT 2 CHECK (prioridade BETWEEN 1 AND 3),
  prazo            timestamptz,
  status           text NOT NULL DEFAULT 'pendente'
                   CHECK (status IN ('pendente', 'aprovada', 'editada', 'descartada', 'executada', 'falhou')),
  editada          boolean NOT NULL DEFAULT false,
  motivo_descarte  text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  decidida_em      timestamptz,
  executada_em     timestamptz,
  resultado        jsonb
);

CREATE INDEX ops_acoes_pendentes_idx ON public.ops_acoes (agente_id, prazo) WHERE status = 'pendente';
CREATE INDEX ops_acoes_execucao_idx ON public.ops_acoes (execucao_id);
CREATE INDEX ops_acoes_empresa_idx ON public.ops_acoes (empresa_id);

CREATE TABLE public.ops_metricas_diarias (
  data         date NOT NULL,
  fonte        text NOT NULL,
  chave        text NOT NULL,
  dimensao     text NOT NULL DEFAULT '',
  valor        numeric NOT NULL,
  recebido_em  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (data, fonte, chave, dimensao)
);

COMMENT ON TABLE public.ops_metricas_diarias IS
  'SPEC 126: agregados diários por fonte (pilar, posthog, sentry, instagram, linkedin, meta_ads, gsc, psi). Upsert idempotente por (data, fonte, chave, dimensao).';

-- ─── RLS: só leitura, só ultra admin ─────────────────────────────────────────

ALTER TABLE public.ops_agentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_execucoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_acoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_metricas_diarias ENABLE ROW LEVEL SECURITY;

CREATE POLICY ops_agentes_ultra_select ON public.ops_agentes
  FOR SELECT TO authenticated USING ((SELECT public.is_ultra_admin()));
CREATE POLICY ops_execucoes_ultra_select ON public.ops_execucoes
  FOR SELECT TO authenticated USING ((SELECT public.is_ultra_admin()));
CREATE POLICY ops_acoes_ultra_select ON public.ops_acoes
  FOR SELECT TO authenticated USING ((SELECT public.is_ultra_admin()));
CREATE POLICY ops_metricas_diarias_ultra_select ON public.ops_metricas_diarias
  FOR SELECT TO authenticated USING ((SELECT public.is_ultra_admin()));

REVOKE ALL ON public.ops_agentes, public.ops_execucoes, public.ops_acoes, public.ops_metricas_diarias
  FROM anon, authenticated;
GRANT SELECT ON public.ops_agentes, public.ops_execucoes, public.ops_acoes, public.ops_metricas_diarias
  TO authenticated;

-- ─── O time ──────────────────────────────────────────────────────────────────

INSERT INTO public.ops_agentes (id, nome, missao, ordem, fase, autonomia) VALUES
  ('chefe', 'Chefe de gabinete', 'Junta as áreas, ordena a fila e manda o resumo do dia.', 1, 2, '{}'),
  ('receita', 'Receita', 'Fazer cada teste promissor virar pagante e nenhum pagamento escapar.', 2, 1,
    '{"email": "N1", "whatsapp": "N1", "tarefa": "N2"}'),
  ('clientes', 'Clientes', 'Manter cada escritório ativo, ouvido e com o problema resolvido.', 3, 1,
    '{"email": "N1", "whatsapp": "N1", "tarefa": "N2"}'),
  ('marketing', 'Marketing', 'Mostrar o que traz cadastro ativado, não curtida.', 4, 2, '{"conteudo": "N1"}'),
  ('produto', 'Produto e analytics', 'Dizer o que é usado, o que é ignorado e onde o usuário trava.', 5, 2,
    '{"tarefa": "N2"}'),
  ('qualidade', 'Qualidade', 'Ordenar erro por cliente afetado e não deixar regressão passar.', 6, 2,
    '{"issue": "N1", "tarefa": "N2"}'),
  ('financas', 'Finanças da Pilar', 'MRR, custo de IA e infra, margem e fôlego de caixa.', 7, 3, '{}');

-- ─── Nota de saúde (pura, testável) ──────────────────────────────────────────
-- Pesos no playbook docs/operacao/agentes/clientes.md. Mudou aqui, muda lá.
--   acesso (até 35): último acesso de qualquer usuário da empresa
--   uso (até 30): semanas com alteração de dado nas últimas 4 (audit_logs), 7,5 cada
--   projetos ativos (até 20) e usuários ativos em 14 dias (até 15)
--   penalidades: feedback sem resposta há 24 h+ (-10), pagamento em atraso (-20)

CREATE FUNCTION public._ops_nota_saude(
  p_dias_sem_acesso     integer,
  p_semanas_ativas      integer,
  p_projetos_ativos     integer,
  p_usuarios_ativos_14d integer,
  p_feedback_aberto     integer,
  p_em_atraso           boolean
)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT GREATEST(0, LEAST(100, (
      CASE
        WHEN p_dias_sem_acesso IS NULL THEN 0
        WHEN p_dias_sem_acesso <= 1 THEN 35
        WHEN p_dias_sem_acesso <= 3 THEN 28
        WHEN p_dias_sem_acesso <= 7 THEN 18
        WHEN p_dias_sem_acesso <= 14 THEN 8
        ELSE 0
      END
    + LEAST(GREATEST(COALESCE(p_semanas_ativas, 0), 0), 4) * 7.5
    + CASE WHEN p_projetos_ativos >= 3 THEN 20 WHEN p_projetos_ativos >= 1 THEN 10 ELSE 0 END
    + CASE WHEN p_usuarios_ativos_14d >= 2 THEN 15 WHEN p_usuarios_ativos_14d = 1 THEN 8 ELSE 0 END
    - CASE WHEN COALESCE(p_feedback_aberto, 0) > 0 THEN 10 ELSE 0 END
    - CASE WHEN p_em_atraso THEN 20 ELSE 0 END
  )::integer));
$$;

REVOKE EXECUTE ON FUNCTION public._ops_nota_saude(integer, integer, integer, integer, integer, boolean)
  FROM PUBLIC, anon, authenticated;

-- ─── Saúde por empresa (ficha Clientes) ──────────────────────────────────────
-- Fora: empresa arquivada, suspensa, excluída, e a que tem ultra admin (é a da Pilar).

CREATE FUNCTION public.ops_saude_empresas()
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
  IF NOT public.is_ultra_admin() THEN
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

REVOKE ALL ON FUNCTION public.ops_saude_empresas() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ops_saude_empresas() TO authenticated;

COMMENT ON FUNCTION public.ops_saude_empresas() IS
  'SPEC 126: nota de saúde 0 a 100 por empresa cliente (acesso, uso, projetos, usuários, feedback, atraso). Só ultra_admin executa.';

-- ─── Receita (ficha Receita e Central) ───────────────────────────────────────
-- Cadastro = empresa criada no período. Ativada = tem projeto real (não exemplo).
-- Pagante = assinatura active com assinatura no Asaas. MRR = preço do plano no ciclo
-- (anual dividido por 12). Origem = UTM que o /cadastro grava no dono da empresa.

CREATE FUNCTION public.ops_receita(p_dias integer DEFAULT 30)
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
  IF NOT public.is_ultra_admin() THEN
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

REVOKE ALL ON FUNCTION public.ops_receita(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ops_receita(integer) TO authenticated;

COMMENT ON FUNCTION public.ops_receita(integer) IS
  'SPEC 126: funil cadastro, ativação e pagante no período e no anterior, MRR, testes vencendo em 48 h, atrasos e conversão por UTM. Só ultra_admin executa.';
