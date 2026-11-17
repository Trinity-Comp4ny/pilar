-- gate_tokens: empresa com assinatura suspensa nao usa IA (motivo assinatura_suspensa).
-- Mesma funcao da 20260921000000, com o bloco novo logo apos a leitura do status.

CREATE OR REPLACE FUNCTION public.gate_tokens(p_empresa_id uuid, p_user_id uuid DEFAULT NULL)
RETURNS TABLE (saldo_plano bigint, saldo_comprado bigint, cota_ciclo bigint, bloqueado_motivo text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ciclo             text := to_char(now(), 'YYYY-MM');
  v_ref_grant         text;
  v_cota              bigint;
  v_sobra             bigint;
  v_saldo_plano       bigint;
  v_saldo_comprado    bigint;
  v_limite_usuario    bigint;
  v_consumo_usuario   bigint;
  v_motivo            text;
  v_status            text;
  v_nivel_override    text;
  v_nivel             text;
  v_is_trial_novo     boolean;
  v_gasto_hoje_trials bigint;
  v_teto_diario       bigint;
BEGIN
  IF auth.role() <> 'service_role' AND current_user <> 'postgres' THEN
    RAISE EXCEPTION 'gate_tokens: apenas service_role pode executar'
      USING ERRCODE = '42501';
  END IF;

  SELECT s.status, e.nivel_override
  INTO v_status, v_nivel_override
  FROM public.empresas e
  LEFT JOIN public.pilar_subscriptions s ON s.empresa_id = e.id
  WHERE e.id = p_empresa_id;

  -- Assinatura suspensa (cancelada com periodo vencido, ou expirada): a IA para.
  -- Nao concede ciclo nem mexe no ledger; devolve o saldo atual com o motivo.
  IF public.empresa_assinatura_suspensa(p_empresa_id) THEN
    RETURN QUERY
    SELECT COALESCE(s.saldo_plano, 0)::bigint, COALESCE(s.saldo_comprado, 0)::bigint, 0::bigint, 'assinatura_suspensa'::text
    FROM (SELECT 1) x
    LEFT JOIN public.ai_token_saldo s ON s.empresa_id = p_empresa_id;
    RETURN;
  END IF;

  -- "Trial novo" = trialing e SEM override manual (legado/liberado sempre tem
  -- override). Só esse recorte usa o teto por nível e conta no circuit breaker.
  v_is_trial_novo := (v_status = 'trialing' AND v_nivel_override IS NULL);

  IF v_is_trial_novo THEN
    v_nivel := public.nivel_confianca(p_empresa_id);
    v_ref_grant := 'trial_grant:' || p_empresa_id || ':' || v_nivel;

    IF NOT EXISTS (SELECT 1 FROM public.ai_token_ledger t WHERE t.reference_id = v_ref_grant) THEN
      INSERT INTO public.ai_token_saldo (empresa_id) VALUES (p_empresa_id)
      ON CONFLICT (empresa_id) DO NOTHING;
      PERFORM 1 FROM public.ai_token_saldo s WHERE s.empresa_id = p_empresa_id FOR UPDATE;

      IF NOT EXISTS (SELECT 1 FROM public.ai_token_ledger t WHERE t.reference_id = v_ref_grant) THEN
        SELECT t.tokens_total INTO v_cota FROM public.trial_niveis t WHERE t.nivel = v_nivel;
        v_cota := COALESCE(v_cota, 50000);

        -- Sobe de nível concede só a DIFERENÇA em relação ao que já foi
        -- concedido em níveis anteriores deste mesmo trial (nunca zera nem
        -- duplica o que já estava lá).
        SELECT COALESCE(SUM(tokens_delta), 0) INTO v_sobra
        FROM public.ai_token_ledger t
        WHERE t.empresa_id = p_empresa_id AND t.reference_id LIKE 'trial_grant:' || p_empresa_id || ':%';

        IF v_cota > v_sobra THEN
          INSERT INTO public.ai_token_ledger (empresa_id, agent_key, source, tokens_delta, reference_id)
          VALUES (p_empresa_id, 'ciclo', 'plan_grant', v_cota - v_sobra, v_ref_grant)
          ON CONFLICT (reference_id) WHERE reference_id IS NOT NULL DO NOTHING;
        END IF;
      END IF;
    END IF;
  ELSE
    v_ref_grant := 'plan_grant:' || p_empresa_id || ':' || v_ciclo;

    IF NOT EXISTS (SELECT 1 FROM public.ai_token_ledger t WHERE t.reference_id = v_ref_grant) THEN
      INSERT INTO public.ai_token_saldo (empresa_id) VALUES (p_empresa_id)
      ON CONFLICT (empresa_id) DO NOTHING;
      PERFORM 1 FROM public.ai_token_saldo s WHERE s.empresa_id = p_empresa_id FOR UPDATE;

      IF NOT EXISTS (SELECT 1 FROM public.ai_token_ledger t WHERE t.reference_id = v_ref_grant) THEN
        SELECT p.tokens_mensais INTO v_cota
        FROM public.pilar_subscriptions s
        JOIN public.pilar_subscription_plans p ON p.id = s.plan_id
        WHERE s.empresa_id = p_empresa_id AND s.status IN ('trialing', 'active')
        LIMIT 1;
        IF v_cota IS NULL THEN
          SELECT p.tokens_mensais INTO v_cota
          FROM public.pilar_subscription_plans p
          WHERE p.slug = 'starter';
        END IF;
        v_cota := COALESCE(v_cota, 500000);

        SELECT s.saldo_plano INTO v_sobra FROM public.ai_token_saldo s WHERE s.empresa_id = p_empresa_id;
        IF v_sobra > 0 THEN
          INSERT INTO public.ai_token_ledger (empresa_id, agent_key, source, tokens_delta, reference_id)
          VALUES (p_empresa_id, 'ciclo', 'plan_expire', -v_sobra, 'plan_expire:' || p_empresa_id || ':' || v_ciclo)
          ON CONFLICT (reference_id) WHERE reference_id IS NOT NULL DO NOTHING;
        END IF;

        INSERT INTO public.ai_token_ledger (empresa_id, agent_key, source, tokens_delta, reference_id)
        VALUES (p_empresa_id, 'ciclo', 'plan_grant', v_cota, v_ref_grant)
        ON CONFLICT (reference_id) WHERE reference_id IS NOT NULL DO NOTHING;
      END IF;
    END IF;
  END IF;

  SELECT s.saldo_plano, s.saldo_comprado INTO v_saldo_plano, v_saldo_comprado
  FROM public.ai_token_saldo s WHERE s.empresa_id = p_empresa_id;

  IF v_is_trial_novo THEN
    SELECT ps.trial_ai_daily_cap_tokens INTO v_teto_diario FROM public.platform_settings ps WHERE ps.id = 'default';
    v_teto_diario := COALESCE(v_teto_diario, 5000000);

    SELECT COALESCE(SUM(-t.tokens_delta), 0) INTO v_gasto_hoje_trials
    FROM public.ai_token_ledger t
    JOIN public.empresas e ON e.id = t.empresa_id
    LEFT JOIN public.pilar_subscriptions s ON s.empresa_id = e.id
    WHERE t.source = 'usage'
      AND t.created_at >= date_trunc('day', now())
      AND s.status = 'trialing'
      AND e.nivel_override IS NULL;

    IF v_gasto_hoje_trials >= v_teto_diario THEN
      v_motivo := 'trial_pausado';
    END IF;
  END IF;

  IF v_motivo IS NULL THEN
    IF COALESCE(v_saldo_plano, 0) + COALESCE(v_saldo_comprado, 0) <= 0 THEN
      v_motivo := 'saldo_empresa';
    ELSIF p_user_id IS NOT NULL THEN
      SELECT l.limite_mensal INTO v_limite_usuario
      FROM public.ai_token_limite_usuario l
      WHERE l.empresa_id = p_empresa_id AND l.user_id = p_user_id;

      IF v_limite_usuario IS NOT NULL THEN
        SELECT COALESCE(SUM(t.tokens_input + t.tokens_output), 0) INTO v_consumo_usuario
        FROM public.ai_token_ledger t
        WHERE t.empresa_id = p_empresa_id AND t.user_id = p_user_id
          AND t.source = 'usage' AND t.created_at >= date_trunc('month', now());

        IF v_consumo_usuario >= v_limite_usuario THEN
          v_motivo := 'limite_usuario';
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN QUERY
  SELECT s.saldo_plano, s.saldo_comprado,
         (SELECT SUM(t.tokens_delta)::bigint FROM public.ai_token_ledger t
          WHERE t.reference_id = v_ref_grant OR (v_is_trial_novo AND t.reference_id LIKE 'trial_grant:' || p_empresa_id || ':%')),
         v_motivo
  FROM public.ai_token_saldo s
  WHERE s.empresa_id = p_empresa_id;
END;
$$;

REVOKE ALL ON FUNCTION public.gate_tokens(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gate_tokens(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gate_tokens(uuid, uuid) TO service_role;

-- Os crons de e-mail (service_role) consultam a suspensao por empresa.
GRANT EXECUTE ON FUNCTION public.empresa_assinatura_suspensa(uuid) TO service_role;
