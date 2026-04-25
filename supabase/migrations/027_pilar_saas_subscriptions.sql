-- Migration 027: Pilar SaaS Subscriptions (self-service checkout)
-- Sistema paralelo ao asaas_config/asaas_webhook_logs (B2B). Este é o
-- billing do próprio Pilar (Labrynth cobra assinantes do SaaS).
--
-- Integra com empresa_owners_pending (migration 012) — após pagamento
-- confirmado, inserimos convite lá e handle_new_user cria a empresa.

-- =============================================
-- 1. PLANOS
-- =============================================

CREATE TABLE IF NOT EXISTS public.pilar_subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  preco_mensal NUMERIC(10, 2) NOT NULL,
  preco_anual NUMERIC(10, 2),
  max_usuarios INTEGER,
  max_projetos INTEGER,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  destaque BOOLEAN NOT NULL DEFAULT FALSE,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.pilar_subscription_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plans_public_read" ON public.pilar_subscription_plans;
CREATE POLICY "plans_public_read" ON public.pilar_subscription_plans
  FOR SELECT USING (ativo = TRUE);

GRANT SELECT ON public.pilar_subscription_plans TO anon, authenticated;

-- =============================================
-- 2. SIGNUPS PENDENTES (pré-pagamento/pré-onboarding)
-- =============================================

CREATE TABLE IF NOT EXISTS public.pilar_pending_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  nome TEXT NOT NULL,
  company_name TEXT NOT NULL,
  cpf_cnpj TEXT NOT NULL,
  telefone TEXT,
  plan_id UUID NOT NULL REFERENCES public.pilar_subscription_plans(id),
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')) DEFAULT 'monthly',
  billing_type TEXT NOT NULL CHECK (billing_type IN ('CREDIT_CARD', 'PIX', 'BOLETO')),
  asaas_customer_id TEXT,
  asaas_subscription_id TEXT,
  asaas_payment_id TEXT,
  payment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'paid', 'failed', 'canceled')),
  paid_at TIMESTAMPTZ,
  invite_dispatched_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  empresa_owner_pending_id UUID REFERENCES public.empresa_owners_pending(id) ON DELETE SET NULL,
  payment_metadata JSONB,
  checkout_session_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pilar_pending_signups_email
  ON public.pilar_pending_signups(lower(email));
CREATE INDEX IF NOT EXISTS idx_pilar_pending_signups_session
  ON public.pilar_pending_signups(checkout_session_token);
CREATE INDEX IF NOT EXISTS idx_pilar_pending_signups_asaas_payment
  ON public.pilar_pending_signups(asaas_payment_id) WHERE asaas_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pilar_pending_signups_asaas_subscription
  ON public.pilar_pending_signups(asaas_subscription_id) WHERE asaas_subscription_id IS NOT NULL;

ALTER TABLE public.pilar_pending_signups ENABLE ROW LEVEL SECURITY;
-- sem policies: somente service_role (edge functions)

-- =============================================
-- 3. ASSINATURAS ATIVAS (vinculadas à empresa após onboarding)
-- =============================================

CREATE TABLE IF NOT EXISTS public.pilar_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL UNIQUE REFERENCES public.empresas(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.pilar_subscription_plans(id),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('trialing', 'active', 'overdue', 'canceled', 'expired')),
  billing_cycle TEXT CHECK (billing_cycle IN ('monthly', 'yearly')),
  billing_type TEXT,
  asaas_customer_id TEXT,
  asaas_subscription_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  pending_signup_id UUID REFERENCES public.pilar_pending_signups(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pilar_subscriptions_empresa
  ON public.pilar_subscriptions(empresa_id);
CREATE INDEX IF NOT EXISTS idx_pilar_subscriptions_status
  ON public.pilar_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_pilar_subscriptions_asaas_sub
  ON public.pilar_subscriptions(asaas_subscription_id) WHERE asaas_subscription_id IS NOT NULL;

ALTER TABLE public.pilar_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pilar_subscriptions_empresa_read" ON public.pilar_subscriptions;
CREATE POLICY "pilar_subscriptions_empresa_read" ON public.pilar_subscriptions
  FOR SELECT USING (empresa_id = public.get_user_empresa_id());

GRANT SELECT ON public.pilar_subscriptions TO authenticated;

-- =============================================
-- 4. LOGS DE WEBHOOK (separado do B2B)
-- =============================================

CREATE TABLE IF NOT EXISTS public.pilar_checkout_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event TEXT NOT NULL,
  asaas_payment_id TEXT,
  asaas_subscription_id TEXT,
  pending_signup_id UUID REFERENCES public.pilar_pending_signups(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES public.pilar_subscriptions(id) ON DELETE SET NULL,
  payload JSONB,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pilar_webhook_logs_payment
  ON public.pilar_checkout_webhook_logs(asaas_payment_id);
CREATE INDEX IF NOT EXISTS idx_pilar_webhook_logs_subscription
  ON public.pilar_checkout_webhook_logs(asaas_subscription_id);

ALTER TABLE public.pilar_checkout_webhook_logs ENABLE ROW LEVEL SECURITY;
-- sem policies: somente service_role

-- =============================================
-- 5. TRIGGER updated_at
-- =============================================

CREATE OR REPLACE FUNCTION public.tg_pilar_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_pilar_pending_signups_touch ON public.pilar_pending_signups;
CREATE TRIGGER tr_pilar_pending_signups_touch
  BEFORE UPDATE ON public.pilar_pending_signups
  FOR EACH ROW EXECUTE FUNCTION public.tg_pilar_touch_updated_at();

DROP TRIGGER IF EXISTS tr_pilar_subscriptions_touch ON public.pilar_subscriptions;
CREATE TRIGGER tr_pilar_subscriptions_touch
  BEFORE UPDATE ON public.pilar_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.tg_pilar_touch_updated_at();

-- =============================================
-- 6. LINK automático de subscription à empresa recém-criada
--
-- Quando handle_new_user marca empresa_owners_pending.usado_em, o owner do
-- signup acabou de receber empresa_id. Este trigger procura o pending_signup
-- correspondente (já pago) e cria a pilar_subscription amarrada à empresa.
-- =============================================

CREATE OR REPLACE FUNCTION public.tg_pilar_link_subscription_on_owner_used()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_signup RECORD;
  v_empresa_id UUID;
  v_period_end TIMESTAMPTZ;
BEGIN
  IF NEW.usado_em IS NULL OR OLD.usado_em IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_signup
  FROM public.pilar_pending_signups
  WHERE empresa_owner_pending_id = NEW.id
    AND payment_status = 'paid'
    AND activated_at IS NULL
  LIMIT 1;

  IF v_signup.id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_empresa_id
  FROM public.empresas
  WHERE owner_id = (SELECT id FROM auth.users WHERE lower(email) = lower(NEW.email) LIMIT 1)
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_empresa_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_period_end := CASE
    WHEN v_signup.billing_cycle = 'yearly' THEN NOW() + INTERVAL '1 year'
    ELSE NOW() + INTERVAL '1 month'
  END;

  INSERT INTO public.pilar_subscriptions (
    empresa_id, plan_id, status, billing_cycle, billing_type,
    asaas_customer_id, asaas_subscription_id,
    current_period_start, current_period_end,
    pending_signup_id
  ) VALUES (
    v_empresa_id, v_signup.plan_id, 'active', v_signup.billing_cycle, v_signup.billing_type,
    v_signup.asaas_customer_id, v_signup.asaas_subscription_id,
    COALESCE(v_signup.paid_at, NOW()), v_period_end,
    v_signup.id
  )
  ON CONFLICT (empresa_id) DO NOTHING;

  UPDATE public.pilar_pending_signups
  SET activated_at = NOW()
  WHERE id = v_signup.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_pilar_link_subscription_on_owner_used ON public.empresa_owners_pending;
CREATE TRIGGER tr_pilar_link_subscription_on_owner_used
  AFTER UPDATE OF usado_em ON public.empresa_owners_pending
  FOR EACH ROW EXECUTE FUNCTION public.tg_pilar_link_subscription_on_owner_used();

-- =============================================
-- 7. SEED DOS PLANOS
-- =============================================

INSERT INTO public.pilar_subscription_plans
  (slug, nome, descricao, preco_mensal, preco_anual, max_usuarios, max_projetos, features, destaque, ordem)
VALUES
  (
    'starter',
    'Starter',
    'Pra escritório começando',
    97.00,
    970.00,
    3,
    10,
    '["Dashboard","Projetos","Clientes","Financeiro básico","3 usuários","10 projetos ativos"]'::jsonb,
    FALSE,
    1
  ),
  (
    'pro',
    'Pro',
    'Pra escritório em crescimento',
    197.00,
    1970.00,
    10,
    50,
    '["Tudo do Starter","Portal do Cliente","Propostas","Leads","Relatórios","Mapa de obras","10 usuários","50 projetos ativos"]'::jsonb,
    TRUE,
    2
  ),
  (
    'enterprise',
    'Enterprise',
    'Pra operação completa',
    397.00,
    3970.00,
    NULL,
    NULL,
    '["Tudo do Pro","Usuários ilimitados","Projetos ilimitados","Suporte prioritário","Onboarding assistido"]'::jsonb,
    FALSE,
    3
  )
ON CONFLICT (slug) DO NOTHING;
