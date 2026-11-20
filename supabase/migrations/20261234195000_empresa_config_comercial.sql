-- SPEC 168: parâmetros comerciais da empresa para a calculadora de margem da proposta.
-- Uma linha por empresa: alíquota efetiva de imposto, margem mínima/alvo e taxas dos meios
-- de recebimento (PIX, boleto, cartão por faixa de parcelas). É dinheiro: só quem tem
-- can_view_financeiro() lê ou grava (ADR 0046), sempre dentro da própria empresa.

CREATE TABLE IF NOT EXISTS public.empresa_config_comercial (
  empresa_id uuid PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,
  aliquota_imposto_pct numeric(5,2) NOT NULL DEFAULT 0
    CHECK (aliquota_imposto_pct >= 0 AND aliquota_imposto_pct < 100),
  margem_minima_pct numeric(5,2) NOT NULL DEFAULT 15
    CHECK (margem_minima_pct >= 0 AND margem_minima_pct < 100),
  margem_alvo_pct numeric(5,2) NOT NULL DEFAULT 30
    CHECK (margem_alvo_pct >= 0 AND margem_alvo_pct < 100),
  -- [{ id, nome, taxa_pct, faixas?: { "1": 2.5, "2": 4 } }]
  meios_recebimento jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(meios_recebimento) = 'array'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.empresa_config_comercial ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS empresa_config_comercial_select ON public.empresa_config_comercial;
CREATE POLICY empresa_config_comercial_select ON public.empresa_config_comercial
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id() AND public.can_view_financeiro());

DROP POLICY IF EXISTS empresa_config_comercial_insert ON public.empresa_config_comercial;
CREATE POLICY empresa_config_comercial_insert ON public.empresa_config_comercial
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id() AND public.can_view_financeiro());

DROP POLICY IF EXISTS empresa_config_comercial_update ON public.empresa_config_comercial;
CREATE POLICY empresa_config_comercial_update ON public.empresa_config_comercial
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id() AND public.can_view_financeiro())
  WITH CHECK (empresa_id = public.get_user_empresa_id() AND public.can_view_financeiro());

CREATE OR REPLACE FUNCTION public.touch_empresa_config_comercial()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_empresa_config_comercial_touch ON public.empresa_config_comercial;
CREATE TRIGGER trg_empresa_config_comercial_touch
  BEFORE UPDATE ON public.empresa_config_comercial
  FOR EACH ROW EXECUTE FUNCTION public.touch_empresa_config_comercial();
