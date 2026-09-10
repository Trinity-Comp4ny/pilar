-- SPEC 098, Fase 2B (requisitos 14-16): "Ativar plano" tokeniza o cartão sem
-- cobrar (via Asaas, ver _shared/asaas-platform.ts::tokenizeCreditCard) e
-- registra o consentimento datado. O trial vira Ouro na hora (nivel_confianca
-- ganha um ramo novo); a cobrança de verdade só acontece no dia 14, pelo
-- trial-expiry-cron, usando o token salvo aqui.

BEGIN;

ALTER TABLE public.pilar_subscriptions
  ADD COLUMN asaas_credit_card_token text,
  ADD COLUMN asaas_credit_card_last4 text,
  ADD COLUMN asaas_credit_card_brand text;

COMMENT ON COLUMN public.pilar_subscriptions.asaas_credit_card_token IS
  'Token de cartão tokenizado sem cobrança via Asaas (SPEC 098 Fase 2B). Presença = trial sobe a Ouro. Nunca o PAN completo, só o token.';

CREATE TABLE public.consentimentos_cobranca (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id            uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id               uuid NOT NULL REFERENCES auth.users(id),
  plan_id               uuid NOT NULL REFERENCES public.pilar_subscription_plans(id),
  valor                 numeric(12,2) NOT NULL,
  primeira_cobranca_em  date NOT NULL,
  texto_versao          text NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.consentimentos_cobranca IS
  'SPEC 098 requisito 14: evidência do opt-out ao ativar o plano (checkbox datado). Append-only, é a prova de que o usuário concordou com a cobrança futura.';

CREATE INDEX idx_consentimentos_cobranca_empresa ON public.consentimentos_cobranca (empresa_id, created_at DESC);

ALTER TABLE public.consentimentos_cobranca ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consentimentos_cobranca_empresa_read"
  ON public.consentimentos_cobranca
  FOR SELECT
  USING (empresa_id = public.get_user_empresa_id() OR public.is_ultra_admin());

-- Append-only: nenhum client escreve direto, só a edge ativar-plano (service_role).
CREATE POLICY "consentimentos_cobranca_no_client_write"
  ON public.consentimentos_cobranca
  FOR INSERT
  WITH CHECK (false);

GRANT SELECT ON public.consentimentos_cobranca TO authenticated;
GRANT SELECT, INSERT ON public.consentimentos_cobranca TO service_role;

-- nivel_confianca ganha o ramo "ouro se há cartão tokenizado", entre o
-- override manual e o documento (ordem da spec: override > forma de
-- pagamento > documento > bronze). CREATE OR REPLACE porque não muda
-- assinatura (mesma SQL STABLE SECURITY INVOKER de 20260921000000).
CREATE OR REPLACE FUNCTION public.nivel_confianca(p_empresa_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT e.nivel_override FROM public.empresas e WHERE e.id = p_empresa_id),
    CASE
      WHEN EXISTS (
        SELECT 1 FROM public.pilar_subscriptions s
        WHERE s.empresa_id = p_empresa_id
          AND s.asaas_credit_card_token IS NOT NULL
      ) THEN 'ouro'
      WHEN EXISTS (
        SELECT 1 FROM public.empresas e
        WHERE e.id = p_empresa_id
          AND e.cnpj IS NOT NULL
          AND e.documento_verificacao IN ('verificado', 'pendente', 'sem_verificacao_externa')
      ) THEN 'prata'
      ELSE 'bronze'
    END
  );
$$;

COMMENT ON FUNCTION public.nivel_confianca(uuid) IS
  'Nível de confiança do trial (SPEC 098): bronze, prata ou ouro. Deriva de empresas.nivel_override, cartão tokenizado (Fase 2B) e documento; nunca um estado gravado à parte.';

-- Requisito 16 (anti-carding): 3 tentativas de tokenização recusadas em 24h
-- avisam o ultra-admin. Só service_role chama (a edge ativar-plano), igual
-- ao padrão de admin_audit_logs — nenhum client insere notificação como se
-- fosse o sistema.
CREATE OR REPLACE FUNCTION public.notificar_ultra_admins(
  p_empresa_id uuid,
  p_tipo       text,
  p_titulo     text,
  p_mensagem   text,
  p_link       text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_destinatarios uuid[];
BEGIN
  SELECT array_agg(p.id) INTO v_destinatarios
  FROM public.profiles p
  WHERE p.role = 'ultra_admin';

  -- notificacoes.empresa_id é NOT NULL: usamos a empresa relacionada ao
  -- evento (ex.: quem foi bloqueada por carding), não uma "empresa da
  -- plataforma" fixa — mantém a notificação rastreável até o caso real.
  RETURN public.notificar(
    p_empresa_id, v_destinatarios, p_tipo, 'sistema', 'high', p_titulo, p_mensagem,
    'empresas', p_empresa_id, p_link
  );
END;
$$;

REVOKE ALL ON FUNCTION public.notificar_ultra_admins(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notificar_ultra_admins(uuid, text, text, text, text) TO service_role;

COMMENT ON FUNCTION public.notificar_ultra_admins(uuid, text, text, text, text) IS
  'SPEC 098 requisito 16: avisa todo ultra_admin sobre um evento de uma empresa (ex.: carding bloqueado). Só service_role executa.';

-- Hardening: notificacoes_select (20260817000000) exige
-- `empresa_id = get_user_empresa_id()`, sem exceção pra ultra_admin — uma
-- notificação endereçada a um ultra_admin sobre a empresa DE OUTRO CLIENTE
-- nunca aparecia no sino dele (a policy comparava contra a empresa do
-- próprio ultra_admin, não a do evento). Bloqueava tanto isto
-- (notificar_ultra_admins) quanto o requisito 9 da spec ("aviso a cada
-- cadastro"), ainda não implementado.
DROP POLICY IF EXISTS notificacoes_select ON public.notificacoes;
CREATE POLICY notificacoes_select ON public.notificacoes
  FOR SELECT USING (
    destinatario_id = auth.uid()
    AND (empresa_id = public.get_user_empresa_id() OR public.is_ultra_admin())
  );

COMMIT;
