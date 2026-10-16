-- SPEC 130: agente Produto (adoção por módulo e feedback) e régua de ativação no Clientes.
--
-- 1. ops_produto(): escritórios que mexeram em cada área do produto nos últimos 28 dias e
--    nos 28 anteriores (audit_logs), e o feedback de 30 dias. Mesmo recorte de empresa de
--    ops_saude_empresas (sem interna, sem ultra admin, sem cancelada ou suspensa).
-- 2. _ops_avaliar_contatos(): contato de ativação funciona quando o marco foi atingido
--    (primeiro projeto, segunda pessoa, primeiro lançamento no Financeiro), não só quando
--    alguém entra no sistema.
-- 3. Produto roda toda segunda às 7h07 de Brasília, entre Receita (7h) e Chefe (7h10), para
--    as tarefas da semana entrarem no resumo do mesmo dia.

-- ─── 1. Uso do produto ───────────────────────────────────────────────────────

CREATE FUNCTION public.ops_produto()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resultado jsonb;
BEGIN
  -- Ultra admin pela tela; service role pelo executor dos agentes (ops-agente-run).
  IF NOT (public.is_ultra_admin() OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'Só ultra_admin pode ver o uso do produto' USING ERRCODE = '42501';
  END IF;

  WITH alvo AS (
    SELECT e.id
    FROM public.empresas e
    WHERE e.deleted_at IS NULL
      AND NOT e.interna
      AND e.status NOT IN ('cancelled', 'suspended')
      AND NOT EXISTS (
        SELECT 1 FROM public.profiles pu
        WHERE pu.empresa_id = e.id AND pu.role = 'ultra_admin'
      )
  ),
  -- Mesmo mapa de tabela para área de ops_saude_empresas (SPEC 129).
  escrita AS (
    SELECT l.empresa_id, l.created_at,
      CASE
        WHEN l.target_table LIKE 'projeto%' OR l.target_table IN ('escopos', 'escopo_itens', 'tarefas') THEN 'projetos'
        WHEN l.target_table IN ('lancamentos', 'receitas', 'despesas', 'faturas', 'contas', 'cartoes',
                                'transferencias', 'folha_pagamento') THEN 'financeiro'
        WHEN l.target_table LIKE 'proposta%' THEN 'propostas'
        WHEN l.target_table LIKE 'lead%' THEN 'leads'
        WHEN l.target_table LIKE 'obra%' THEN 'obras'
        WHEN l.target_table = 'clientes' THEN 'clientes'
        WHEN l.target_table = 'pessoas' THEN 'pessoas'
      END AS modulo
    FROM public.audit_logs l
    WHERE l.created_at > now() - interval '56 days'
      AND l.empresa_id IN (SELECT id FROM alvo)
  ),
  por_modulo AS (
    SELECT w.modulo,
      count(DISTINCT w.empresa_id) FILTER (WHERE w.created_at > now() - interval '28 days')::integer AS agora,
      count(DISTINCT w.empresa_id) FILTER (WHERE w.created_at <= now() - interval '28 days')::integer AS antes
    FROM escrita w
    WHERE w.modulo IS NOT NULL
    GROUP BY w.modulo
  ),
  lista AS (
    SELECT unnest(ARRAY['projetos', 'financeiro', 'propostas', 'leads', 'obras', 'clientes', 'pessoas']) AS modulo
  ),
  fb AS (
    SELECT f.tipo, f.status_interno
    FROM public.feature_suggestions f
    WHERE f.created_at > now() - interval '30 days'
      AND f.empresa_id IN (SELECT id FROM alvo)
  )
  SELECT jsonb_build_object(
    'gerado_em', now(),
    'escritorios', (SELECT count(*) FROM alvo),
    'modulos', (
      SELECT jsonb_agg(jsonb_build_object(
               'modulo', li.modulo,
               'empresas_28d', COALESCE(pm.agora, 0),
               'empresas_28d_anteriores', COALESCE(pm.antes, 0))
             ORDER BY li.modulo)
      FROM lista li
      LEFT JOIN por_modulo pm ON pm.modulo = li.modulo
    ),
    'feedback_30d', (
      SELECT jsonb_build_object(
        'total', count(*),
        'bugs', count(*) FILTER (WHERE fb.tipo = 'bug'),
        'sugestoes', count(*) FILTER (WHERE fb.tipo = 'sugestao'),
        'bugs_sem_triagem', count(*) FILTER (WHERE fb.tipo = 'bug' AND fb.status_interno = 'novo'))
      FROM fb
    )
  )
  INTO v_resultado;

  RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.ops_produto() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ops_produto() TO authenticated, service_role;

COMMENT ON FUNCTION public.ops_produto() IS
  'SPEC 130: escritórios por área do produto (28 dias e 28 anteriores) e feedback de 30 dias. Ultra admin ou service role.';

-- ─── 2. Efeito do contato de ativação ────────────────────────────────────────
-- Mesma assinatura da SPEC 129; só ganha os marcos de ativação.

CREATE OR REPLACE FUNCTION public._ops_avaliar_contatos()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n integer;
BEGIN
  WITH alvo AS (
    SELECT a.id, a.empresa_id, a.executada_em,
           a.evidencia ->> 'motivo' AS motivo,
           a.evidencia ->> 'marco' AS marco
    FROM public.ops_acoes a
    WHERE a.status = 'executada'
      AND a.tipo = 'whatsapp'
      AND a.empresa_id IS NOT NULL
      AND a.executada_em < now() - interval '7 days'
      AND NOT COALESCE(a.resultado ? 'efeito', false)
  ),
  avaliado AS (
    SELECT t.id,
      CASE
        WHEN t.motivo = 'teste_vencendo' THEN EXISTS (
          SELECT 1 FROM public.pilar_subscriptions s
          WHERE s.empresa_id = t.empresa_id AND s.status = 'active' AND s.asaas_subscription_id IS NOT NULL)
        WHEN t.motivo = 'pagamento_em_atraso' THEN NOT EXISTS (
          SELECT 1 FROM public.pilar_subscriptions s
          WHERE s.empresa_id = t.empresa_id AND s.status = 'overdue')
        WHEN t.motivo = 'ativacao' AND t.marco = 'primeiro_projeto' THEN EXISTS (
          SELECT 1 FROM public.projetos pr
          WHERE pr.empresa_id = t.empresa_id
            AND COALESCE(pr.exemplo, false) = false
            AND pr.created_at > t.executada_em)
        WHEN t.motivo = 'ativacao' AND t.marco = 'equipe' THEN (
          SELECT count(*) FROM public.profiles p
          WHERE p.empresa_id = t.empresa_id AND p.desativado_em IS NULL) > 1
        WHEN t.motivo = 'ativacao' AND t.marco = 'segundo_modulo' THEN EXISTS (
          SELECT 1 FROM public.audit_logs l
          WHERE l.empresa_id = t.empresa_id
            AND l.created_at > t.executada_em
            AND l.target_table IN ('lancamentos', 'receitas', 'despesas', 'faturas', 'contas', 'cartoes',
                                   'transferencias', 'folha_pagamento'))
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
  'SPEC 129/130: avalia contatos enviados há 7+ dias (o fato que motivou mudou? o marco de ativação foi atingido?). Chamada pelo Chefe de gabinete.';

-- ─── 3. Liga o Produto ───────────────────────────────────────────────────────
-- Toda segunda, 10h07 UTC = 7h07 de Brasília. Tarefa interna, sem mensagem a cliente: N2.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ops-produto') THEN
      PERFORM cron.unschedule('ops-produto');
    END IF;
    PERFORM cron.schedule('ops-produto', '7 10 * * 1', $c$SELECT public.ops_agente_disparar('produto');$c$);
  END IF;
END;
$$;

UPDATE public.ops_agentes
   SET ativo = true, teto_mensal_brl = 30, cron = '7 10 * * 1', fase = 2,
       autonomia = '{"tarefa": "N2"}'::jsonb, updated_at = now()
 WHERE id = 'produto';
