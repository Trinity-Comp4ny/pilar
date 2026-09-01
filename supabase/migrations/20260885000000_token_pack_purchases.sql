-- Motor de tokens, Fase 3 (SPEC 077): compra avulsa de pacote de tokens via Asaas
-- Sistema B (plataforma). Constrói sobre a fundação da 20260867000000 (ADR 0035).

CREATE TABLE IF NOT EXISTS public.pilar_token_pack_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  quantidade_pacotes integer NOT NULL CHECK (quantidade_pacotes > 0 AND quantidade_pacotes <= 20),
  -- Snapshot no momento da compra: mudança futura de tamanho/preço do pacote
  -- (DECISOES.md) não distorce compras já feitas.
  tokens_pacote bigint NOT NULL DEFAULT 500000,
  valor_centavos integer NOT NULL,
  billing_type text NOT NULL CHECK (billing_type IN ('CREDIT_CARD', 'PIX', 'BOLETO')),
  asaas_payment_id text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'failed', 'canceled')),
  payment_metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pilar_token_pack_purchases_asaas_payment
  ON public.pilar_token_pack_purchases (asaas_payment_id)
  WHERE asaas_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pilar_token_pack_purchases_empresa
  ON public.pilar_token_pack_purchases (empresa_id, created_at DESC);

ALTER TABLE public.pilar_token_pack_purchases ENABLE ROW LEVEL SECURITY;

-- Transparência de compra pra própria empresa; escrita só por service_role
-- (as duas edge functions da Fase 3), mesmo padrão de pilar_pending_signups.
DROP POLICY IF EXISTS "token_pack_purchases_select" ON public.pilar_token_pack_purchases;
CREATE POLICY "token_pack_purchases_select" ON public.pilar_token_pack_purchases
  FOR SELECT USING (empresa_id = public.get_user_empresa_id());

REVOKE ALL ON TABLE public.pilar_token_pack_purchases FROM anon;
