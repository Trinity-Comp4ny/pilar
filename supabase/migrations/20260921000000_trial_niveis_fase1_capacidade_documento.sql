-- SPEC 098, Fase 1: capacidade por nível de confiança (Bronze/Prata/Ouro) e
-- verificação de documento (CNPJ/CPF). Depende da Fase 0 (migration
-- 20260920000000_trial_niveis_fase0.sql: nivel_override, email_confirmado,
-- teto fixo de tokens do trial).
--
-- Esta migration entrega a parte de BANCO da Fase 1 (requisitos 1-9, 24 da
-- SPEC 098): tabela `trial_niveis`, `nivel_confianca()`, `limites_empresa()`,
-- capacidade real de projetos/obras/usuários por nível, projeto de exemplo
-- fora da contagem, colunas de documento em `empresas` e o índice único de
-- CNPJ. A verificação de CNPJ via BrasilAPI é a edge function
-- `verificar-documento` (fora desta migration); front (DesbloqueioNivel,
-- "Ativar plano", aba Trials) fica pra depois.

BEGIN;

-- =============================================
-- 1. trial_niveis: limites por nível, editáveis sem deploy.
-- =============================================

CREATE TABLE IF NOT EXISTS public.trial_niveis (
  nivel               text PRIMARY KEY CHECK (nivel IN ('bronze', 'prata', 'ouro')),
  max_projetos        integer,        -- NULL = ilimitado
  max_obras           integer,
  max_usuarios        integer,
  tokens_total        bigint,         -- NULL = usa a cota mensal do plano (ramo ouro)
  portal_habilitado   boolean NOT NULL DEFAULT false,
  import_habilitado   boolean NOT NULL DEFAULT false,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trial_niveis ENABLE ROW LEVEL SECURITY;

CREATE POLICY trial_niveis_select_authenticated ON public.trial_niveis
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY trial_niveis_write_ultra_admin ON public.trial_niveis
  FOR INSERT WITH CHECK (public.is_ultra_admin());

CREATE POLICY trial_niveis_update_ultra_admin ON public.trial_niveis
  FOR UPDATE
  USING (public.is_ultra_admin())
  WITH CHECK (public.is_ultra_admin());

CREATE POLICY trial_niveis_delete_ultra_admin ON public.trial_niveis
  FOR DELETE
  USING (public.is_ultra_admin());

INSERT INTO public.trial_niveis (nivel, max_projetos, max_obras, max_usuarios, tokens_total, portal_habilitado, import_habilitado)
VALUES
  ('bronze', 2, 1, 2, 50000, false, false),
  ('prata', 5, 2, 5, 150000, true, true),
  ('ouro', NULL, NULL, 10, NULL, true, true)
ON CONFLICT (nivel) DO NOTHING;

COMMENT ON TABLE public.trial_niveis IS
  'Limites de capacidade por nível de confiança do trial (SPEC 098). Números são hipótese inicial, revisar após os primeiros 20 trials.';

-- Fase 0 criou platform_settings.trial_tokens_bronze como teto único (não
-- havia nível ainda). Agora o teto vem de trial_niveis por nível; a coluna
-- fica sem uso, mas não é dropada aqui (guard de migration destrutiva bloqueia
-- DROP COLUMN sem autorização, e não vale o bypass por uma coluna morta).
COMMENT ON COLUMN public.platform_settings.trial_tokens_bronze IS
  'Obsoleta desde a SPEC 098 Fase 1: teto por nível agora vive em trial_niveis.tokens_total. Não lida por nenhum código; candidata a DROP numa limpeza futura.';

-- =============================================
-- 2. empresas: colunas de documento (CNPJ/CPF) e índice único de CNPJ.
-- =============================================

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS documento_tipo          text CHECK (documento_tipo IN ('cnpj', 'cpf')),
  ADD COLUMN IF NOT EXISTS documento_verificacao    text CHECK (documento_verificacao IN ('verificado', 'pendente', 'sem_verificacao_externa')),
  ADD COLUMN IF NOT EXISTS documento_verificado_em  timestamptz,
  ADD COLUMN IF NOT EXISTS razao_social             text,
  ADD COLUMN IF NOT EXISTS situacao_cadastral        text,
  ADD COLUMN IF NOT EXISTS cnae_principal            text;

COMMENT ON COLUMN public.empresas.documento_verificacao IS
  'verificado = CNPJ confirmado ATIVA na Receita; pendente = BrasilAPI caiu, reverificar; sem_verificacao_externa = CPF (sem API pública gratuita). NULL = nenhum documento informado ainda.';

-- Índice único de CNPJ: defensivo. Se já existir duplicata (dado legado),
-- não bloqueia o deploy — só avisa, pra alguém saneando antes de reaplicar.
DO $$
DECLARE
  v_duplicatas integer;
BEGIN
  SELECT count(*) INTO v_duplicatas FROM (
    SELECT cnpj FROM public.empresas WHERE cnpj IS NOT NULL GROUP BY cnpj HAVING count(*) > 1
  ) d;

  IF v_duplicatas > 0 THEN
    RAISE NOTICE 'SPEC 098 Fase 1: % CNPJ(s) duplicado(s) entre empresas — índice único NÃO criado agora. Resolver manualmente e criar `empresas_cnpj_unico` numa migration futura.', v_duplicatas;
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS empresas_cnpj_unico ON public.empresas (cnpj) WHERE cnpj IS NOT NULL;
  END IF;
END $$;

-- =============================================
-- 3. projetos.exemplo: projeto de demonstração criado no signup, fora da
--    contagem de capacidade (requisito 10).
-- =============================================

ALTER TABLE public.projetos ADD COLUMN IF NOT EXISTS exemplo boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.projetos.exemplo IS
  'Projeto de demonstração criado automaticamente no signup self-serve (SPEC 098). Nunca conta pro limite de capacidade do nível.';

-- =============================================
-- 4. nivel_confianca: deriva de fatos, nunca um estado guardado à parte.
--    SECURITY INVOKER de propósito — a RLS de `empresas` (cada um só vê a
--    própria linha, exceto ultra_admin) já escopa o acesso sem duplicar
--    lógica aqui. Fase 1 só distingue bronze/prata por conta própria; ouro
--    só existe hoje via override manual (legado ou liberação do ultra-admin).
--    Forma de pagamento (Fase 2) entra como mais um WHEN, sem quebrar nada.
-- =============================================

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
  'Nível de confiança do trial (SPEC 098): bronze, prata ou ouro. Deriva de empresas.nivel_override e documento; nunca um estado gravado à parte.';

-- =============================================
-- 5. limites_empresa: capacidade real, por assinatura ativa (plano + override
--    já existentes da spec 052) ou por nível de trial (trial_niveis). SECURITY
--    DEFINER porque cruza pilar_subscriptions/pilar_subscription_plans/
--    trial_niveis; por isso valida a própria autorização (chamador só vê a
--    própria empresa, exceto service_role/postgres/ultra_admin).
-- =============================================

CREATE OR REPLACE FUNCTION public.limites_empresa(p_empresa_id uuid)
RETURNS TABLE (
  max_projetos       integer,
  max_obras          integer,
  max_usuarios       integer,
  tokens_total       bigint,
  portal_habilitado  boolean,
  import_habilitado  boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status           text;
  v_nivel             text;
  v_plan_max_projetos integer;
  v_plan_max_usuarios integer;
  v_override_projetos integer;
  v_override_usuarios integer;
BEGIN
  -- Nota: current_user NÃO serve aqui pra distinguir "chamado por sessão de
  -- usuário" de "chamado por service_role/postgres": dentro de uma função
  -- SECURITY DEFINER, current_user é sempre o DONO da função (o autor da
  -- migration), nunca quem chamou. auth.role() lê de request.jwt.claims (GUC
  -- de sessão, imune a essa troca de privilégio), então é o único sinal
  -- confiável: 'authenticated' = sessão de usuário de verdade; NULL/
  -- 'service_role' = migration, cron ou edge com service role.
  IF auth.role() = 'authenticated' THEN
    IF p_empresa_id IS DISTINCT FROM public.get_user_empresa_id() AND NOT public.is_ultra_admin() THEN
      RAISE EXCEPTION 'Sem permissão para ver limites de outra empresa' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT s.status INTO v_status FROM public.pilar_subscriptions s WHERE s.empresa_id = p_empresa_id;

  IF v_status = 'active' THEN
    SELECT p.max_projetos, p.max_usuarios INTO v_plan_max_projetos, v_plan_max_usuarios
    FROM public.pilar_subscriptions s
    JOIN public.pilar_subscription_plans p ON p.id = s.plan_id
    WHERE s.empresa_id = p_empresa_id;

    SELECT e.max_projetos_override, e.max_usuarios_override INTO v_override_projetos, v_override_usuarios
    FROM public.empresas e WHERE e.id = p_empresa_id;

    RETURN QUERY SELECT
      COALESCE(v_override_projetos, v_plan_max_projetos),
      NULL::integer, -- obras: incluído sem limite pra pagante hoje (PRICING.md item 7)
      COALESCE(v_override_usuarios, v_plan_max_usuarios),
      NULL::bigint,  -- IA de pagante é responsabilidade do gate_tokens (cota mensal do plano)
      true, true;
    RETURN;
  END IF;

  v_nivel := public.nivel_confianca(p_empresa_id);

  IF v_nivel = 'ouro' THEN
    -- Override manual (legado ou liberado pelo ultra-admin): mesma capacidade
    -- de um pagante, sem trava nenhuma.
    RETURN QUERY SELECT NULL::integer, NULL::integer, NULL::integer, NULL::bigint, true, true;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT t.max_projetos, t.max_obras, t.max_usuarios, t.tokens_total, t.portal_habilitado, t.import_habilitado
  FROM public.trial_niveis t
  WHERE t.nivel = v_nivel;
END;
$$;

REVOKE ALL ON FUNCTION public.limites_empresa(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.limites_empresa(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.limites_empresa(uuid) IS
  'Capacidade real da empresa (SPEC 098): plano+override se assinatura active, trial_niveis se trialing, ilimitado se ouro. NULL em qualquer coluna = sem limite.';

-- =============================================
-- 6. Triggers de capacidade: projetos e obras. Só pra sessão `authenticated`
--    (service_role/postgres — cron, import, ultra-admin, projeto exemplo do
--    signup — passam direto, mesmo padrão do gate de e-mail confirmado da
--    Fase 0). "Ativo" segue a convenção já usada pelos agentes ambient:
--    projeto = status NOT IN ('Concluído','Cancelado'); obra = status <>
--    'concluida'. Trigger em vez de mexer em create_projeto_completo, que
--    tem 3 overloads ativos em produção.
-- =============================================

CREATE OR REPLACE FUNCTION public.enforce_capacidade_projetos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max   integer;
  v_count integer;
BEGIN
  IF auth.role() <> 'authenticated' OR NEW.exemplo THEN
    RETURN NEW;
  END IF;

  SELECT max_projetos INTO v_max FROM public.limites_empresa(NEW.empresa_id);
  IF v_max IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.projetos p
  WHERE p.empresa_id = NEW.empresa_id
    AND p.deleted_at IS NULL
    AND p.exemplo = false
    AND p.status NOT IN ('Concluído', 'Cancelado');

  IF v_count >= v_max THEN
    RAISE EXCEPTION 'capacidade:projetos' USING ERRCODE = 'P0001', HINT = v_max::text;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_capacidade_projetos ON public.projetos;
CREATE TRIGGER trg_enforce_capacidade_projetos
  BEFORE INSERT ON public.projetos
  FOR EACH ROW EXECUTE FUNCTION public.enforce_capacidade_projetos();

CREATE OR REPLACE FUNCTION public.enforce_capacidade_obras()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max   integer;
  v_count integer;
BEGIN
  IF auth.role() <> 'authenticated' THEN
    RETURN NEW;
  END IF;

  SELECT max_obras INTO v_max FROM public.limites_empresa(NEW.empresa_id);
  IF v_max IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.obras o
  WHERE o.empresa_id = NEW.empresa_id
    AND o.deleted_at IS NULL
    AND o.status <> 'concluida';

  IF v_count >= v_max THEN
    RAISE EXCEPTION 'capacidade:obras' USING ERRCODE = 'P0001', HINT = v_max::text;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_capacidade_obras ON public.obras;
CREATE TRIGGER trg_enforce_capacidade_obras
  BEFORE INSERT ON public.obras
  FOR EACH ROW EXECUTE FUNCTION public.enforce_capacidade_obras();

-- =============================================
-- 7. gate_tokens: teto do trial passa a vir de trial_niveis (por nível real),
--    não mais do valor fixo único da Fase 0. Ouro (override) continua na cota
--    mensal do plano, igual pagante. DROP + CREATE (mesma assinatura, regra
--    da casa pra função com overload).
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

-- =============================================
-- 8. handle_new_user: projeto de exemplo criado junto com a empresa no
--    self-serve (requisito 10), fora da contagem de capacidade (exemplo=true).
--    Único trecho novo; resto da função idêntico ao da Fase 0.
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

    -- SPEC 098 Fase 1: projeto de exemplo, fora da contagem de capacidade
    -- (exemplo=true), pra mostrar margem/orçamento funcionando na hora.
    insert into public.projetos (empresa_id, nome, status, exemplo)
    values (v_empresa_id, 'Projeto de exemplo', 'Planejamento', true);

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

COMMIT;
