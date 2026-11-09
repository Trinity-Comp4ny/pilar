-- Planos v4 (DECISOES.md, 2026-11-06): preço R$ 299/499/899 e capacidade por
-- módulo. O plano pago deixa de limitar só projetos: passa a limitar projetos,
-- obras e leads ativos.
--
--   Essencial (starter)     10 projetos   2 obras   50 leads
--   Profissional (pro)      30 projetos   5 obras  200 leads
--   Escala (enterprise)     ilimitado    15 obras  ilimitado
--
-- A cota de IA continua em tokens no banco (tokens_mensais 500k/2M/8M); a UI
-- mostra créditos na razão fixa de 1 crédito = 5 mil tokens. Nada muda aqui.
--
-- Só o que vale para assinatura `active` muda. Trial continua em
-- `trial_niveis` (SPEC 098), sem limite de leads.

BEGIN;

-- =============================================
-- 1. Colunas de capacidade por módulo no plano. NULL = sem limite.
-- =============================================

ALTER TABLE public.pilar_subscription_plans
  ADD COLUMN IF NOT EXISTS max_obras integer,
  ADD COLUMN IF NOT EXISTS max_leads integer;

COMMENT ON COLUMN public.pilar_subscription_plans.max_obras IS
  'Obras ativas (status <> concluida) permitidas no plano. NULL = sem limite.';
COMMENT ON COLUMN public.pilar_subscription_plans.max_leads IS
  'Leads ativos (status fora de Ganho/Perdido) permitidos no plano. NULL = sem limite.';

-- =============================================
-- 2. Preço e faixas v4. Slugs internos ficam (identificador estável).
--    Anual = 10x o mensal, a mesma regra das versões anteriores.
-- =============================================

UPDATE public.pilar_subscription_plans
SET preco_mensal = 299.00, preco_anual = 2990.00,
    max_projetos = 10, max_obras = 2, max_leads = 50
WHERE slug = 'starter';

UPDATE public.pilar_subscription_plans
SET preco_mensal = 499.00, preco_anual = 4990.00,
    max_projetos = 30, max_obras = 5, max_leads = 200
WHERE slug = 'pro';

UPDATE public.pilar_subscription_plans
SET preco_mensal = 899.00, preco_anual = 8990.00,
    max_projetos = NULL, max_obras = 15, max_leads = NULL
WHERE slug = 'enterprise';

-- =============================================
-- 3. limites_empresa: assinatura ativa passa a devolver obras e leads do
--    plano, e ganha a coluna max_leads. Mudar o RETURNS TABLE exige DROP +
--    CREATE. O override por empresa (spec 052) continua só para projetos e
--    usuários.
-- =============================================

DROP FUNCTION IF EXISTS public.limites_empresa(uuid);

CREATE FUNCTION public.limites_empresa(p_empresa_id uuid)
RETURNS TABLE (
  max_projetos       integer,
  max_obras          integer,
  max_usuarios       integer,
  tokens_total       bigint,
  portal_habilitado  boolean,
  import_habilitado  boolean,
  max_leads          integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status            text;
  v_nivel             text;
  v_plan_max_projetos integer;
  v_plan_max_obras    integer;
  v_plan_max_leads    integer;
  v_plan_max_usuarios integer;
  v_override_projetos integer;
  v_override_usuarios integer;
BEGIN
  -- auth.role() e não current_user: dentro de SECURITY DEFINER, current_user é
  -- sempre o dono da função (ver migration 20260921000000).
  IF auth.role() = 'authenticated' THEN
    IF p_empresa_id IS DISTINCT FROM public.get_user_empresa_id() AND NOT public.is_ultra_admin() THEN
      RAISE EXCEPTION 'Sem permissão para ver limites de outra empresa' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT s.status INTO v_status FROM public.pilar_subscriptions s WHERE s.empresa_id = p_empresa_id;

  IF v_status = 'active' THEN
    SELECT p.max_projetos, p.max_obras, p.max_leads, p.max_usuarios
      INTO v_plan_max_projetos, v_plan_max_obras, v_plan_max_leads, v_plan_max_usuarios
    FROM public.pilar_subscriptions s
    JOIN public.pilar_subscription_plans p ON p.id = s.plan_id
    WHERE s.empresa_id = p_empresa_id;

    SELECT e.max_projetos_override, e.max_usuarios_override INTO v_override_projetos, v_override_usuarios
    FROM public.empresas e WHERE e.id = p_empresa_id;

    RETURN QUERY SELECT
      COALESCE(v_override_projetos, v_plan_max_projetos),
      v_plan_max_obras,
      COALESCE(v_override_usuarios, v_plan_max_usuarios),
      NULL::bigint,  -- IA de pagante é responsabilidade do gate_tokens (cota mensal do plano)
      true, true,
      v_plan_max_leads;
    RETURN;
  END IF;

  v_nivel := public.nivel_confianca(p_empresa_id);

  IF v_nivel = 'ouro' THEN
    RETURN QUERY SELECT NULL::integer, NULL::integer, NULL::integer, NULL::bigint, true, true, NULL::integer;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT t.max_projetos, t.max_obras, t.max_usuarios, t.tokens_total, t.portal_habilitado, t.import_habilitado,
         NULL::integer
  FROM public.trial_niveis t
  WHERE t.nivel = v_nivel;
END;
$$;

REVOKE ALL ON FUNCTION public.limites_empresa(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.limites_empresa(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.limites_empresa(uuid) IS
  'Capacidade real da empresa: plano (projetos, obras, leads) + override se assinatura active, trial_niveis se trialing, ilimitado se ouro. NULL em qualquer coluna = sem limite.';

-- =============================================
-- 4. Trigger de capacidade de leads, no mesmo molde de projetos e obras:
--    só sessão `authenticated` (agentes, import e service_role passam), e só
--    INSERT. Lead que já nasce ganho ou perdido não ocupa faixa.
-- =============================================

CREATE OR REPLACE FUNCTION public.enforce_capacidade_leads()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max   integer;
  v_count integer;
BEGIN
  -- Lead de outra empresa não é assunto deste gatilho: a RLS de leads já recusa
  -- o INSERT, e consultar os limites de outra empresa daria erro de permissão
  -- antes da RLS (ex.: superusuário com claims de JWT de um usuário na sessão).
  IF auth.role() <> 'authenticated'
     OR NEW.status IN ('Ganho', 'Perdido')
     OR NEW.empresa_id IS DISTINCT FROM public.get_user_empresa_id() THEN
    RETURN NEW;
  END IF;

  SELECT max_leads INTO v_max FROM public.limites_empresa(NEW.empresa_id);
  IF v_max IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.leads l
  WHERE l.empresa_id = NEW.empresa_id
    AND l.deleted_at IS NULL
    AND COALESCE(l.status, '') NOT IN ('Ganho', 'Perdido');

  IF v_count >= v_max THEN
    RAISE EXCEPTION 'capacidade:leads' USING ERRCODE = 'P0001', HINT = v_max::text;
  END IF;

  RETURN NEW;
END;
$$;

-- Função de gatilho não precisa de EXECUTE para ninguém (o Postgres só checa
-- no CREATE TRIGGER); o teste anon_function_grants exige o REVOKE.
REVOKE ALL ON FUNCTION public.enforce_capacidade_leads() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enforce_capacidade_leads ON public.leads;
CREATE TRIGGER trg_enforce_capacidade_leads
  BEFORE INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.enforce_capacidade_leads();

-- =============================================
-- 5. avisar_admin_capacidade: aceita leads e fala de plano quando a empresa
--    já assina (antes o texto era sempre de período de teste).
-- =============================================

CREATE OR REPLACE FUNCTION public.avisar_admin_capacidade(p_recurso text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id    uuid;
  v_nome          text;
  v_titulo        text;
  v_corpo         text;
  v_link          text;
  v_ativa         boolean;
  v_destinatarios uuid[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  IF p_recurso NOT IN ('projetos', 'obras', 'leads', 'usuarios') THEN
    RAISE EXCEPTION 'Recurso inválido' USING ERRCODE = '22023';
  END IF;

  SELECT empresa_id, NULLIF(trim(concat(first_name, ' ', last_name)), '')
    INTO v_empresa_id, v_nome
  FROM public.profiles WHERE id = auth.uid();

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Perfil sem empresa' USING ERRCODE = '22023';
  END IF;

  SELECT array_agg(p.id) INTO v_destinatarios
  FROM public.profiles p
  WHERE p.empresa_id = v_empresa_id AND p.role IN ('admin', 'owner');

  SELECT EXISTS (
    SELECT 1 FROM public.pilar_subscriptions s
    WHERE s.empresa_id = v_empresa_id AND s.status = 'active'
  ) INTO v_ativa;

  IF v_ativa THEN
    v_titulo := 'Limite de ' || p_recurso || ' do plano atingido';
    v_corpo := COALESCE(v_nome, 'Um usuário') || ' tentou criar mais ' || p_recurso ||
      ' do que o plano atual permite. Suba de plano em Configurações, Pagamento, para liberar mais capacidade.';
    v_link := '/billing';
  ELSE
    v_titulo := 'Limite de ' || p_recurso || ' do período de teste atingido';
    v_corpo := COALESCE(v_nome, 'Um usuário') || ' tentou criar mais ' || p_recurso ||
      ' do que o período de teste permite. Informe o CNPJ da empresa ou ative um plano ' ||
      'em Configurações para liberar mais capacidade.';
    v_link := '/configuracoes?tab=empresa';
  END IF;

  RETURN public.notificar(
    v_empresa_id, v_destinatarios,
    'capacidade_avisar_admin:' || p_recurso, 'sistema', 'medium',
    v_titulo, v_corpo,
    'empresas', v_empresa_id, v_link
  );
END;
$$;

REVOKE ALL ON FUNCTION public.avisar_admin_capacidade(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.avisar_admin_capacidade(text) TO authenticated;

COMMIT;
