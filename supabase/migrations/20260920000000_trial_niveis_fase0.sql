-- SPEC 098, Fase 0: fecha o vetor de abuso do trial antes do lançamento (ADR 0041).
--
-- Problema real (verificado 08/09): toda assinatura trialing nasce hoje no plano
-- `destaque` (pro, 2M tokens/mês) e o gate_tokens concede essa cota mensal inteira
-- pra qualquer e-mail. Sem CNPJ, sem forma de pagamento, sem teto. Esta migration
-- entrega só a parte bloqueadora do lançamento, sem nenhuma UI nova:
--   1. Toda empresa que já existe HOJE (antes deste deploy) fica marcada como nível
--      Ouro por override "legado" — os níveis completos (Fase 1) ainda não existem,
--      mas quando existirem ninguém que já está dentro cai para Bronze.
--   2. Trial novo nasce no plano ATIVO de menor preço, não no destaque.
--   3. gate_tokens concede ao trial um teto TOTAL fixo (não mensal, não renova) —
--      hoje esse teto é o mesmo pra qualquer trial novo (não há Prata/Ouro ainda,
--      isso é Fase 1); e aplica um circuit breaker diário agregado de todos os
--      trials, sem afetar quem paga nem quem é legado.
--   4. Domínio de e-mail descartável é recusado no cadastro self-serve.
--   5. Contas existentes são marcadas com e-mail confirmado (nenhuma é afetada
--      pela regra nova) e toda escrita de projeto por usuário autenticado passa a
--      exigir e-mail confirmado.
--
-- Fora desta migration (Fase 1+, ver SPEC 098): CNPJ/CPF, capacidade de projeto/
-- obra/usuário por nível, "Ativar plano", retenção pós-trial, aba Trials no
-- ultra-admin. Fora do alcance de QUALQUER migration: ligar "Confirm email" nas
-- configurações de Auth do Supabase Dashboard em staging e produção — `db push`
-- não aplica config de Auth no servidor (só migrations/código; ver comentário do
-- job "Migrations + RLS" no CI). Isso é ação manual do CEO nos dois projetos.

BEGIN;

-- =============================================
-- 1. platform_settings: singleton de configuração da plataforma (não por empresa)
-- =============================================

CREATE TABLE IF NOT EXISTS public.platform_settings (
  id                          text PRIMARY KEY DEFAULT 'default',
  trial_tokens_bronze         bigint NOT NULL DEFAULT 50000,
  trial_ai_daily_cap_tokens   bigint NOT NULL DEFAULT 5000000,
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_settings_singleton CHECK (id = 'default')
);

INSERT INTO public.platform_settings (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY platform_settings_ultra_admin_all ON public.platform_settings
  FOR ALL
  USING (public.is_ultra_admin())
  WITH CHECK (public.is_ultra_admin());

COMMENT ON TABLE public.platform_settings IS
  'Configuração global da plataforma (não multi-tenant). SPEC 098: teto de IA do trial e circuit breaker diário.';

-- =============================================
-- 2. email_dominios_bloqueados: domínio descartável recusado no signup
-- =============================================

CREATE TABLE IF NOT EXISTS public.email_dominios_bloqueados (
  dominio     text PRIMARY KEY,
  motivo      text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_dominios_bloqueados ENABLE ROW LEVEL SECURITY;

CREATE POLICY email_dominios_bloqueados_ultra_admin_all ON public.email_dominios_bloqueados
  FOR ALL
  USING (public.is_ultra_admin())
  WITH CHECK (public.is_ultra_admin());

INSERT INTO public.email_dominios_bloqueados (dominio, motivo) VALUES
  ('mailinator.com', 'descartável'),
  ('guerrillamail.com', 'descartável'),
  ('10minutemail.com', 'descartável'),
  ('tempmail.com', 'descartável'),
  ('yopmail.com', 'descartável'),
  ('sharklasers.com', 'descartável'),
  ('trashmail.com', 'descartável'),
  ('getnada.com', 'descartável'),
  ('dispostable.com', 'descartável'),
  ('throwawaymail.com', 'descartável')
ON CONFLICT (dominio) DO NOTHING;

COMMENT ON TABLE public.email_dominios_bloqueados IS
  'Domínios de e-mail descartável recusados no signup self-serve (SPEC 098). Editável pelo ultra-admin.';

-- =============================================
-- 3. empresas: colunas de nível (usadas de verdade na Fase 1; aqui só o override
--    legado, pra ninguém que já está dentro cair em Bronze quando os níveis
--    passarem a valer).
-- =============================================

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS nivel_override        text CHECK (nivel_override IN ('bronze', 'prata', 'ouro')),
  ADD COLUMN IF NOT EXISTS nivel_override_motivo  text,
  ADD COLUMN IF NOT EXISTS nivel_override_por     uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS nivel_override_em      timestamptz;

COMMENT ON COLUMN public.empresas.nivel_override IS
  'Nível de confiança do trial forçado manualmente (SPEC 098). NULL = deriva de fatos (Fase 1). Toda empresa criada antes do deploy desta migration vira ouro/legado abaixo.';

-- Backfill: toda empresa que já existe agora é legado. Roda uma vez só, aqui;
-- não precisa (e não deve) rodar de novo em deploy futuro.
UPDATE public.empresas
SET nivel_override = 'ouro',
    nivel_override_motivo = 'legado',
    nivel_override_em = now()
WHERE nivel_override IS NULL;

-- =============================================
-- 4. handle_new_user: trial nasce no plano ATIVO de menor preço, não no destaque.
--    Base é a definição vigente (migration 20260904000000_equipe_metas_delegado_
--    e_leads_safe.sql — a última a redefinir esta função). Único trecho que muda
--    é o ORDER BY do SELECT do plano no CENÁRIO 3 (self-serve); todo o resto
--    (nome/sobrenome, telefone, terms_acceptances, convite, checkout pago) fica
--    idêntico ao que está em produção hoje.
--
--    ATENÇÃO pra quem for mexer aqui de novo: NÃO reintroduzir uma versão antiga
--    de handle_new_user (ex.: a de 20260826000000, que insere profiles.features
--    — coluna removida em 20260854000000). Sempre partir da última definição.
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_token          text;
  v_meta_nome      text;
  v_company_name   text;
  v_telefone       text;
  v_email          text;
  v_first_name     text;
  v_last_name      text;
  v_nome_completo  text;
  v_convite        record;
  v_owner_pending  record;
  v_pending_signup record;
  v_empresa_id     uuid;
  v_plan_id        uuid;
  v_terms_accepted boolean;
  v_terms_version  text;
  v_privacy_version text;
begin
  if NEW.email is null or length(trim(NEW.email)) = 0 then
    raise exception 'Cadastro inválido: email ausente';
  end if;

  v_email := lower(trim(NEW.email));
  v_token := NEW.raw_user_meta_data->>'invite_token';

  v_meta_nome := nullif(trim(coalesce(NEW.raw_user_meta_data->>'nome', '')), '');
  if v_meta_nome is not null and length(v_meta_nome) > 200 then
    v_meta_nome := substring(v_meta_nome from 1 for 200);
  end if;

  v_terms_accepted := (NEW.raw_user_meta_data->>'terms_accepted') = 'true';
  v_terms_version := NEW.raw_user_meta_data->>'terms_version';
  v_privacy_version := NEW.raw_user_meta_data->>'privacy_version';

  if v_token is null or length(v_token) = 0 then
    v_company_name := nullif(trim(coalesce(NEW.raw_user_meta_data->>'company_name', '')), '');
    if v_company_name is not null and length(v_company_name) > 200 then
      v_company_name := substring(v_company_name from 1 for 200);
    end if;

    v_telefone := nullif(trim(coalesce(NEW.raw_user_meta_data->>'telefone', '')), '');
    if v_telefone is not null and length(v_telefone) > 40 then
      v_telefone := substring(v_telefone from 1 for 40);
    end if;

    insert into public.empresas (owner_id, nome, features, onboarding_completed)
    values (NEW.id, coalesce(v_company_name, 'Minha empresa'), '{}'::jsonb, false)
    returning id into v_empresa_id;

    v_nome_completo := coalesce(v_meta_nome, split_part(NEW.email, '@', 1));
    v_first_name := split_part(v_nome_completo, ' ', 1);
    if position(' ' in v_nome_completo) > 0 then
      v_last_name := coalesce(nullif(trim(substring(v_nome_completo from position(' ' in v_nome_completo) + 1)), ''), '');
    else
      v_last_name := '';
    end if;

    insert into public.profiles (
      id, empresa_id, first_name, last_name, email, contato, role, onboarding_completed
    )
    values (
      NEW.id, v_empresa_id, v_first_name, v_last_name, NEW.email, v_telefone, 'admin', false
    );

    if v_terms_accepted and v_terms_version is not null and v_privacy_version is not null then
      insert into public.terms_acceptances (user_id, empresa_id, terms_version, privacy_version, source)
      values (NEW.id, v_empresa_id, v_terms_version, v_privacy_version, 'signup');
    end if;

    -- SPEC 098: plano ATIVO de menor preço (Essencial), não mais o destaque
    -- (Profissional). Evita testar com capacidade de um plano e pagar por outro.
    select id into v_plan_id
    from public.pilar_subscription_plans
    where ativo = true
    order by preco_mensal asc
    limit 1;

    if v_plan_id is not null then
      insert into public.pilar_subscriptions (empresa_id, plan_id, status, trial_ends_at)
      values (v_empresa_id, v_plan_id, 'trialing', now() + interval '14 days')
      on conflict (empresa_id) do nothing;
    end if;

    return NEW;
  end if;

  select id, empresa_id, email, cargo, nome
  into v_convite
  from public.convites
  where token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex')
    and email = v_email
    and usado_em is null
    and expira_em > now();

  if v_convite.id is not null then
    v_nome_completo := coalesce(v_convite.nome, v_meta_nome, split_part(NEW.email, '@', 1));
    v_first_name := split_part(v_nome_completo, ' ', 1);
    if position(' ' in v_nome_completo) > 0 then
      v_last_name := coalesce(nullif(trim(substring(v_nome_completo from position(' ' in v_nome_completo) + 1)), ''), '');
    else
      v_last_name := '';
    end if;

    insert into public.profiles (
      id, empresa_id, first_name, last_name, email, role, onboarding_completed
    )
    values (
      NEW.id, v_convite.empresa_id, v_first_name, v_last_name, NEW.email, v_convite.cargo, false
    );

    update public.convites set usado_em = now() where id = v_convite.id;
    return NEW;
  end if;

  select id, email, company_name, nome
  into v_owner_pending
  from public.empresa_owners_pending
  where token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex')
    and email = v_email
    and usado_em is null
    and expira_em > now();

  if v_owner_pending.id is not null then
    select id, payment_status
    into v_pending_signup
    from public.pilar_pending_signups
    where empresa_owner_pending_id = v_owner_pending.id
      and payment_status = 'paid'
    limit 1;

    if v_pending_signup.id is null then
      raise exception 'Cadastro de novo owner sem pagamento confirmado';
    end if;

    insert into public.empresas (owner_id, nome, features, onboarding_completed)
    values (NEW.id, v_owner_pending.company_name, '{}'::jsonb, false)
    returning id into v_empresa_id;

    v_nome_completo := coalesce(v_owner_pending.nome, v_meta_nome, split_part(NEW.email, '@', 1));
    v_first_name := split_part(v_nome_completo, ' ', 1);
    if position(' ' in v_nome_completo) > 0 then
      v_last_name := coalesce(nullif(trim(substring(v_nome_completo from position(' ' in v_nome_completo) + 1)), ''), '');
    else
      v_last_name := '';
    end if;

    insert into public.profiles (
      id, empresa_id, first_name, last_name, email, role, onboarding_completed
    )
    values (
      NEW.id, v_empresa_id, v_first_name, v_last_name, NEW.email, 'admin', false
    );

    update public.empresa_owners_pending set usado_em = now() where id = v_owner_pending.id;
    return NEW;
  end if;

  raise exception 'Token de convite inválido ou expirado';
end;
$function$;

-- =============================================
-- 5. Recusa de domínio de e-mail descartável no signup self-serve. Convite e
--    checkout pago (cenários 1 e 2) não passam por aqui: quem convida já
--    escolheu o e-mail do funcionário, e quem pagou já provou intenção.
-- =============================================

CREATE OR REPLACE FUNCTION public.enforce_dominio_email_permitido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  v_token   text;
  v_dominio text;
BEGIN
  v_token := NEW.raw_user_meta_data->>'invite_token';
  IF v_token IS NOT NULL AND length(v_token) > 0 THEN
    RETURN NEW; -- convite/checkout: fora do escopo do bloqueio de domínio.
  END IF;

  v_dominio := lower(split_part(NEW.email, '@', 2));
  IF EXISTS (SELECT 1 FROM public.email_dominios_bloqueados WHERE dominio = v_dominio) THEN
    RAISE EXCEPTION 'Use o e-mail da sua empresa para criar a conta.'
      USING ERRCODE = 'P0001', HINT = 'dominio_bloqueado';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_dominio_email_permitido ON auth.users;
CREATE TRIGGER trg_enforce_dominio_email_permitido
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_dominio_email_permitido();

-- =============================================
-- 6. E-mail confirmado: contas existentes viram confirmadas na hora (ninguém que
--    já está dentro é afetado); toda escrita de projeto por usuário autenticado
--    passa a exigir e-mail confirmado. Serviço/postgres (cron, ultra-admin,
--    projeto exemplo da Fase 1) não passam por este gate.
-- =============================================

UPDATE auth.users
SET email_confirmed_at = coalesce(email_confirmed_at, created_at, now())
WHERE email_confirmed_at IS NULL;

CREATE OR REPLACE FUNCTION public.enforce_email_confirmado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
BEGIN
  IF auth.role() = 'authenticated' AND NOT EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Confirme seu e-mail para continuar.'
      USING ERRCODE = 'P0001', HINT = 'email_nao_confirmado';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_email_confirmado_projetos ON public.projetos;
CREATE TRIGGER trg_enforce_email_confirmado_projetos
  BEFORE INSERT ON public.projetos
  FOR EACH ROW EXECUTE FUNCTION public.enforce_email_confirmado();

COMMENT ON FUNCTION public.enforce_email_confirmado() IS
  'SPEC 098 Fase 0: exige e-mail confirmado antes de criar projeto, só pra sessão authenticated (service_role/postgres passam direto). Estende-se a mais tabelas na Fase 1 junto com o trigger de capacidade.';

-- =============================================
-- 7. gate_tokens: ramo de trial com teto total fixo (não mensal) + circuit
--    breaker diário agregado. Overload (uuid, uuid) já existe (spec 094):
--    DROP + CREATE, mesma assinatura, pra não duplicar overload (regra da casa).
-- =============================================

DROP FUNCTION IF EXISTS public.gate_tokens(uuid, uuid);

CREATE FUNCTION public.gate_tokens(p_empresa_id uuid, p_user_id uuid DEFAULT NULL)
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

  -- "Trial novo" = trialing e SEM override manual (legado sempre tem override).
  -- Só esse recorte usa o teto fixo do trial e é contado no circuit breaker.
  v_is_trial_novo := (v_status = 'trialing' AND v_nivel_override IS NULL);

  IF v_is_trial_novo THEN
    -- Teto TOTAL fixo do trial, concedido uma vez só (reference sem mês: não
    -- renova, ao contrário do plan_grant mensal de quem paga).
    v_ref_grant := 'trial_grant:' || p_empresa_id;

    IF NOT EXISTS (SELECT 1 FROM public.ai_token_ledger t WHERE t.reference_id = v_ref_grant) THEN
      INSERT INTO public.ai_token_saldo (empresa_id) VALUES (p_empresa_id)
      ON CONFLICT (empresa_id) DO NOTHING;
      PERFORM 1 FROM public.ai_token_saldo s WHERE s.empresa_id = p_empresa_id FOR UPDATE;

      IF NOT EXISTS (SELECT 1 FROM public.ai_token_ledger t WHERE t.reference_id = v_ref_grant) THEN
        SELECT ps.trial_tokens_bronze INTO v_cota FROM public.platform_settings ps WHERE ps.id = 'default';
        v_cota := COALESCE(v_cota, 50000);

        INSERT INTO public.ai_token_ledger (empresa_id, agent_key, source, tokens_delta, reference_id)
        VALUES (p_empresa_id, 'ciclo', 'plan_grant', v_cota, v_ref_grant)
        ON CONFLICT (reference_id) WHERE reference_id IS NOT NULL DO NOTHING;
      END IF;
    END IF;
  ELSE
    -- Comportamento existente (spec 075/094): cota mensal do plano ativo,
    -- idempotente por ciclo, sobra do plano expira na virada.
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

  -- Circuit breaker: gasto agregado do DIA de todos os trials novos (nunca
  -- pagante nem legado), comparado ao teto configurável. Sobrepõe qualquer
  -- outro motivo pra quem é trial novo.
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
         (SELECT t.tokens_delta::bigint FROM public.ai_token_ledger t WHERE t.reference_id = v_ref_grant),
         v_motivo
  FROM public.ai_token_saldo s
  WHERE s.empresa_id = p_empresa_id;
END;
$$;

REVOKE ALL ON FUNCTION public.gate_tokens(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gate_tokens(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gate_tokens(uuid, uuid) TO service_role;

COMMIT;
