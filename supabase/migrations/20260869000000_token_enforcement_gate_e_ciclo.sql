-- Motor de tokens, Fase 2 (SPEC 075): cota mensal por plano, concessão de ciclo
-- idempotente e gate de saldo. Constrói sobre a fundação da 20260867000000 (ADR 0035).

-- =============================================
-- 1. Cota de tokens por plano (hipótese; calibrar com a Fase 0 antes de vender)
-- =============================================

ALTER TABLE public.pilar_subscription_plans
  ADD COLUMN IF NOT EXISTS tokens_mensais bigint;

UPDATE public.pilar_subscription_plans SET tokens_mensais = 500000  WHERE slug = 'starter'    AND tokens_mensais IS NULL;
UPDATE public.pilar_subscription_plans SET tokens_mensais = 2000000 WHERE slug = 'pro'        AND tokens_mensais IS NULL;
UPDATE public.pilar_subscription_plans SET tokens_mensais = 8000000 WHERE slug = 'enterprise' AND tokens_mensais IS NULL;

-- =============================================
-- 2. Source novo 'plan_expire': sobra do balde do plano expira na virada do ciclo
-- =============================================

ALTER TABLE public.ai_token_ledger DROP CONSTRAINT IF EXISTS ai_token_ledger_source_check;
ALTER TABLE public.ai_token_ledger DROP CONSTRAINT IF EXISTS ai_token_ledger_delta_sinal;

ALTER TABLE public.ai_token_ledger
  ADD CONSTRAINT ai_token_ledger_source_check CHECK (
    source IN ('usage', 'plan_grant', 'plan_expire', 'purchase', 'adjustment', 'refund')
  );

ALTER TABLE public.ai_token_ledger
  ADD CONSTRAINT ai_token_ledger_delta_sinal CHECK (
    (source IN ('usage', 'plan_expire') AND tokens_delta < 0)
    OR (source IN ('plan_grant', 'purchase', 'refund') AND tokens_delta > 0)
    OR (source = 'adjustment' AND tokens_delta <> 0)
  );

-- Trigger ganha a rota do plan_expire (balde do plano, sem clamp: o delta é exato).
CREATE OR REPLACE FUNCTION public.tg_aplicar_delta_no_saldo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.ai_token_saldo (empresa_id)
  VALUES (NEW.empresa_id)
  ON CONFLICT (empresa_id) DO NOTHING;

  IF NEW.source = 'usage' THEN
    -- Débito em cascata: consome saldo_plano até zerar; o excedente (inclusive
    -- overdraft da chamada em voo) cai em saldo_comprado. tokens_delta < 0 aqui.
    UPDATE public.ai_token_saldo s
    SET saldo_plano = GREATEST(s.saldo_plano + NEW.tokens_delta, 0),
        saldo_comprado = s.saldo_comprado + LEAST(s.saldo_plano + NEW.tokens_delta, 0),
        updated_at = now()
    WHERE s.empresa_id = NEW.empresa_id;
  ELSIF NEW.source IN ('plan_grant', 'plan_expire') THEN
    UPDATE public.ai_token_saldo s
    SET saldo_plano = s.saldo_plano + NEW.tokens_delta,
        updated_at = now()
    WHERE s.empresa_id = NEW.empresa_id;
  ELSE
    -- purchase / adjustment / refund mexem no balde comprado.
    UPDATE public.ai_token_saldo s
    SET saldo_comprado = s.saldo_comprado + NEW.tokens_delta,
        updated_at = now()
    WHERE s.empresa_id = NEW.empresa_id;
  END IF;

  RETURN NEW;
END;
$$;

-- =============================================
-- 3. gate_tokens: garante o ciclo corrente (idempotente por mês) e devolve o saldo
-- =============================================
-- Chamada pelas edge functions ANTES do modelo (gate 402) e pelo pg_cron mensal
-- (renova o saldo mesmo sem uso; agendamento é manual por ambiente, ver spec 075).
-- Idempotência: reference_id 'plan_grant:<empresa>:<AAAA-MM>' com unique parcial
-- já existente no ledger — a segunda chamada do mês é no-op.

CREATE OR REPLACE FUNCTION public.gate_tokens(p_empresa_id uuid)
RETURNS TABLE (saldo_plano bigint, saldo_comprado bigint, cota_ciclo bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ciclo text := to_char(now(), 'YYYY-MM');
  v_ref_grant text;
  v_cota bigint;
  v_sobra bigint;
BEGIN
  -- Edge functions (service_role), migrations/cron/testes (postgres).
  IF auth.role() <> 'service_role' AND current_user <> 'postgres' THEN
    RAISE EXCEPTION 'gate_tokens: apenas service_role pode executar'
      USING ERRCODE = '42501';
  END IF;

  v_ref_grant := 'plan_grant:' || p_empresa_id || ':' || v_ciclo;

  -- Caminho quente sem lock: ciclo já concedido → só devolve o saldo.
  IF NOT EXISTS (SELECT 1 FROM public.ai_token_ledger t WHERE t.reference_id = v_ref_grant) THEN
    -- Serializa concessões concorrentes da mesma empresa e RE-CHECA depois do lock
    -- (double-checked locking): sem isso, duas chamadas na virada do mês passam o IF
    -- juntas e a segunda expiraria a cota que a primeira acabou de conceder.
    INSERT INTO public.ai_token_saldo (empresa_id) VALUES (p_empresa_id)
    ON CONFLICT (empresa_id) DO NOTHING;
    PERFORM 1 FROM public.ai_token_saldo s WHERE s.empresa_id = p_empresa_id FOR UPDATE;

    IF NOT EXISTS (SELECT 1 FROM public.ai_token_ledger t WHERE t.reference_id = v_ref_grant) THEN
      -- Cota do plano da assinatura viva; sem assinatura (empresa antiga/trial manual),
      -- vale a cota do plano de entrada.
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

      -- Sobra do ciclo anterior expira (use-or-lose); balde comprado fica intacto.
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

  RETURN QUERY
  SELECT s.saldo_plano, s.saldo_comprado,
         (SELECT t.tokens_delta::bigint FROM public.ai_token_ledger t WHERE t.reference_id = v_ref_grant)
  FROM public.ai_token_saldo s
  WHERE s.empresa_id = p_empresa_id;
END;
$$;

REVOKE ALL ON FUNCTION public.gate_tokens(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gate_tokens(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gate_tokens(uuid) TO service_role;

-- =============================================
-- 4. Bootstrap: concede o ciclo corrente a todas as empresas existentes
-- =============================================
-- Sem isso, o gate 402 travaria staging inteiro no deploy (saldo zero/negativo do
-- shadow). Idempotente: re-rodar não duplica (reference mensal).

SELECT public.gate_tokens(id) FROM public.empresas;
