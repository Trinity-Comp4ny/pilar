-- SPEC 129 (melhorias do Time de agentes, a partir da primeira semana em staging).
--
-- 1. Empresa interna ou de teste (`empresas.interna`) sai de todo número de cliente: saúde,
--    receita e funil por UTM. Em staging, "Empresa Retest" e "Teste Tokenizacao" viravam
--    escritório em risco e pediam WhatsApp.
-- 2. Saúde ganha profundidade de uso (módulos mexidos em 28 dias), tendência (nota de 7 dias
--    atrás, do retrato diário) e estágio (onboarding, adoção, maduro).
-- 3. Resultado do contato: 7 dias depois de marcado como enviado, o banco confere se o fato
--    que motivou o contato mudou (teste virou pagante, atraso foi pago, escritório voltou).

ALTER TABLE public.empresas ADD COLUMN interna boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.empresas.interna IS
  'SPEC 129: empresa da equipe ou de teste. Fica fora dos números de cliente do Time (saúde, receita, funil por UTM). Só ultra admin marca.';

CREATE FUNCTION public.ops_marcar_empresa_interna(p_empresa_id uuid, p_interna boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_ultra_admin() THEN
    RAISE EXCEPTION 'Só ultra_admin marca empresa interna' USING ERRCODE = '42501';
  END IF;
  UPDATE public.empresas SET interna = p_interna, updated_at = now() WHERE id = p_empresa_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empresa não encontrada' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.ops_marcar_empresa_interna(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ops_marcar_empresa_interna(uuid, boolean) TO authenticated;

-- ─── Saúde v2 (muda o retorno: DROP e CREATE) ────────────────────────────────

DROP FUNCTION public.ops_saude_empresas();

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
  criada_em          timestamptz,
  modulos_usados     integer,
  nota_7d            integer,
  estagio            text
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
      AND NOT e.interna
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
  -- Profundidade de uso: em quantas áreas do produto a empresa mexeu nos últimos 28 dias.
  modulos AS (
    SELECT l.empresa_id,
           count(DISTINCT CASE
             WHEN l.target_table LIKE 'projeto%' OR l.target_table IN ('escopos', 'escopo_itens', 'tarefas') THEN 'projetos'
             WHEN l.target_table IN ('lancamentos', 'receitas', 'despesas', 'faturas', 'contas', 'cartoes',
                                     'transferencias', 'folha_pagamento') THEN 'financeiro'
             WHEN l.target_table LIKE 'proposta%' THEN 'propostas'
             WHEN l.target_table LIKE 'lead%' THEN 'leads'
             WHEN l.target_table LIKE 'obra%' THEN 'obras'
             WHEN l.target_table = 'clientes' THEN 'clientes'
             WHEN l.target_table = 'pessoas' THEN 'pessoas'
           END)::integer AS usados
    FROM public.audit_logs l
    WHERE l.created_at > now() - interval '28 days'
      AND l.empresa_id IN (SELECT id FROM alvo)
    GROUP BY l.empresa_id
  ),
  -- Nota de 7 dias atrás, do retrato diário que o agente Clientes grava (tendência).
  antes AS (
    SELECT m.dimensao::uuid AS empresa_id, m.valor::integer AS nota
    FROM public.ops_metricas_diarias m
    WHERE m.fonte = 'pilar' AND m.chave = 'nota_saude' AND m.data = current_date - 7
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
      own.contato AS dono_telefone,
      COALESCE(md.usados, 0) AS modulos,
      an.nota AS nota_antes
    FROM alvo a
    LEFT JOIN acesso ac ON ac.empresa_id = a.id
    LEFT JOIN uso u ON u.empresa_id = a.id
    LEFT JOIN proj pj ON pj.empresa_id = a.id
    LEFT JOIN fb f ON f.empresa_id = a.id
    LEFT JOIN sub sb ON sb.empresa_id = a.id
    LEFT JOIN public.profiles own ON own.id = a.owner_id
    LEFT JOIN modulos md ON md.empresa_id = a.id
    LEFT JOIN antes an ON an.empresa_id = a.id
  )
  SELECT
    b.id, b.nome, b.situacao,
    n.nota,
    CASE WHEN n.nota >= 70 THEN 'saudavel' WHEN n.nota >= 40 THEN 'atencao' ELSE 'risco' END,
    b.ultimo, b.dias, b.semanas, b.projetos, b.usuarios, b.ativos_14d, b.feedback, b.atraso,
    b.dono_nome, b.dono_telefone, b.created_at,
    b.modulos, b.nota_antes,
    -- Estágio pela idade da conta: primeiras 2 semanas, até 2 meses, depois disso.
    CASE WHEN b.created_at > now() - interval '14 days' THEN 'onboarding'
         WHEN b.created_at > now() - interval '60 days' THEN 'adocao'
         ELSE 'maduro' END
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
  'SPEC 126/129: nota de saúde 0 a 100 por empresa cliente, com módulos usados, nota de 7 dias atrás e estágio. Fora empresa interna. Ultra admin ou service role.';

-- ─── Receita e funil sem empresa interna ─────────────────────────────────────

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
      AND NOT e.interna
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


CREATE OR REPLACE FUNCTION public._ops_funil_por_utm(p_desde date, p_ate date)
RETURNS TABLE (
  dia           date,
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  utm_content   text,
  cadastros     integer,
  ativados      integer,
  pagantes      integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH emp AS (
    SELECT e.id,
           (e.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS dia,
           u.raw_user_meta_data -> 'origem' AS origem
    FROM public.empresas e
    LEFT JOIN auth.users u ON u.id = e.owner_id
    WHERE e.deleted_at IS NULL
      AND NOT e.interna
      AND (e.created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_desde AND p_ate
      -- A empresa da própria Pilar (a do ultra admin) não é cadastro de marketing.
      AND NOT EXISTS (
        SELECT 1 FROM public.profiles pu WHERE pu.empresa_id = e.id AND pu.role = 'ultra_admin'
      )
  ),
  marcada AS (
    SELECT emp.*,
           EXISTS (
             SELECT 1 FROM public.projetos pr
             WHERE pr.empresa_id = emp.id AND pr.deleted_at IS NULL AND COALESCE(pr.exemplo, false) = false
           ) AS ativada,
           EXISTS (
             SELECT 1 FROM public.pilar_subscriptions s
             WHERE s.empresa_id = emp.id AND s.status = 'active' AND s.asaas_subscription_id IS NOT NULL
           ) AS pagante
    FROM emp
  )
  SELECT
    m.dia,
    COALESCE(NULLIF(m.origem ->> 'utm_source', ''), ''),
    COALESCE(NULLIF(m.origem ->> 'utm_medium', ''), ''),
    COALESCE(NULLIF(m.origem ->> 'utm_campaign', ''), ''),
    COALESCE(NULLIF(m.origem ->> 'utm_content', ''), ''),
    count(*)::integer,
    count(*) FILTER (WHERE m.ativada)::integer,
    count(*) FILTER (WHERE m.pagante)::integer
  FROM marcada m
  GROUP BY 1, 2, 3, 4, 5
  ORDER BY 1, 2, 3, 4, 5;
$$;

-- ─── Resultado do contato ────────────────────────────────────────────────────
-- Ação de WhatsApp enviada há 7 dias ou mais, ainda sem avaliação: o fato mudou?
--   teste_vencendo        -> a empresa virou pagante
--   pagamento_em_atraso   -> a assinatura saiu de overdue
--   sem_acesso, queda_de_uso -> alguém da empresa entrou depois do envio
-- Grava resultado.efeito ('funcionou' | 'nao_funcionou') e resultado.avaliado_em.

CREATE FUNCTION public._ops_avaliar_contatos()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n integer;
BEGIN
  WITH alvo AS (
    SELECT a.id, a.empresa_id, a.executada_em, a.evidencia ->> 'motivo' AS motivo
    FROM public.ops_acoes a
    WHERE a.status = 'executada'
      AND a.tipo = 'whatsapp'
      AND a.empresa_id IS NOT NULL
      AND a.executada_em < now() - interval '7 days'
      AND NOT COALESCE(a.resultado ? 'efeito', false)
  ),
  avaliado AS (
    SELECT t.id,
      CASE t.motivo
        WHEN 'teste_vencendo' THEN EXISTS (
          SELECT 1 FROM public.pilar_subscriptions s
          WHERE s.empresa_id = t.empresa_id AND s.status = 'active' AND s.asaas_subscription_id IS NOT NULL)
        WHEN 'pagamento_em_atraso' THEN NOT EXISTS (
          SELECT 1 FROM public.pilar_subscriptions s
          WHERE s.empresa_id = t.empresa_id AND s.status = 'overdue')
        ELSE EXISTS (
          SELECT 1 FROM public.profiles p
          JOIN auth.users u ON u.id = p.id
          WHERE p.empresa_id = t.empresa_id
            AND GREATEST(u.last_sign_in_at,
                         (SELECT max(se.refreshed_at) FROM auth.sessions se WHERE se.user_id = u.id)) > t.executada_em)
      END AS funcionou
    FROM alvo t
  )
  UPDATE public.ops_acoes a
     SET resultado = COALESCE(a.resultado, '{}'::jsonb)
                     || jsonb_build_object('efeito', CASE WHEN v.funcionou THEN 'funcionou' ELSE 'nao_funcionou' END,
                                           'avaliado_em', now())
    FROM avaliado v
   WHERE a.id = v.id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION public._ops_avaliar_contatos() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._ops_avaliar_contatos() TO service_role;

COMMENT ON FUNCTION public._ops_avaliar_contatos() IS
  'SPEC 129: avalia contatos enviados há 7+ dias (o fato que motivou mudou?). Chamada pelo Chefe de gabinete.';
