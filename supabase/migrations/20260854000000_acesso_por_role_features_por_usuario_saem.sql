-- SPEC 058 / ADR 0029: acesso é role + módulo da empresa. O eixo de permissão
-- por usuário (profiles.features / convites.features, viewer|editor por chave)
-- sai inteiro.
--
-- Motivo: os três caminhos de convite gravavam features '{}' justamente quando o
-- cargo era admin (escritos quando admin tinha bypass), enquanto
-- user_has_feature exigia nível explícito no profile para admin e user. As 76
-- policies em 34 tabelas que dependem dessa função negavam tudo, silenciosamente,
-- para todo admin provisionado pelo ultra-admin. Três empresas em produção
-- ficaram sem acesso a nada (Mawe, LTS, MF Construção).
--
-- Nenhum backfill é necessário: a nova user_has_feature ignora o JSONB, então as
-- contas travadas voltam a funcionar no momento em que esta migration roda.
--
-- ATENÇÃO: contém DROP COLUMN (bloqueia o guard de migration do CI sem
-- ALLOW_DESTRUCTIVE_MIGRATION=true). A perda de dado é o objetivo: o JSONB
-- descartado é o que causou o incidente e não é lido por mais ninguém depois
-- desta migration.

-- =============================================
-- 1. user_has_feature: só empresa + profile
-- =============================================
-- Assinatura preservada de propósito: reescrever 76 policies para tirar um
-- parâmetro é risco desproporcional, e p_min_level fica disponível para um RBAC
-- por role no futuro (ADR 0029, "Consequências").

CREATE OR REPLACE FUNCTION public.user_has_feature(p_feature text, p_min_level text DEFAULT 'viewer'::text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role public.user_role;
  v_empresa_features JSONB;
BEGIN
  IF p_min_level NOT IN ('viewer', 'editor') THEN
    RAISE EXCEPTION 'p_min_level deve ser "viewer" ou "editor"';
  END IF;

  IF NOT (p_feature = ANY (public._feature_catalog())) THEN
    RETURN FALSE;
  END IF;

  SELECT p.role, e.features
  INTO v_role, v_empresa_features
  FROM public.profiles p
  LEFT JOIN public.empresas e ON e.id = p.empresa_id
  WHERE p.id = auth.uid();

  -- Sem profile não há acesso (anon, usuário deletado, token de outro projeto).
  IF v_role IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Ultra admin: bypass total (plataforma, cross-empresa).
  IF v_role = 'ultra_admin' THEN
    RETURN TRUE;
  END IF;

  -- Feature madura (universal) e core não dependem de toggle (ADR 0026).
  -- Feature dormant continua atrás do early access do ultra-admin.
  IF p_feature <> 'dashboard'
     AND NOT (p_feature = ANY (public._universal_features()))
     AND COALESCE((v_empresa_features ->> p_feature)::BOOLEAN, FALSE) = FALSE THEN
    RETURN FALSE;
  END IF;

  -- Membro da empresa: lê e escreve. p_min_level não diferencia mais nada.
  RETURN TRUE;
END;
$function$;

REVOKE ALL ON FUNCTION public.user_has_feature(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_has_feature(text, text) TO authenticated;

-- =============================================
-- 2. Validação e cascade de features por usuário: saem
-- =============================================

DROP TRIGGER IF EXISTS tg_validate_features_subset ON public.profiles;
DROP TRIGGER IF EXISTS validate_profile_features ON public.profiles;
DROP TRIGGER IF EXISTS tg_validate_convite_features_subset ON public.convites;
DROP TRIGGER IF EXISTS validate_convite_features ON public.convites;
DROP TRIGGER IF EXISTS tg_cascade_feature_revocation ON public.empresas;

DROP FUNCTION IF EXISTS public.tg_validate_features_subset();
DROP FUNCTION IF EXISTS public.tg_validate_profile_features();
DROP FUNCTION IF EXISTS public.tg_validate_convite_features();
DROP FUNCTION IF EXISTS public.tg_validate_convite_features_subset();
DROP FUNCTION IF EXISTS public.tg_cascade_feature_revocation();
DROP FUNCTION IF EXISTS public._validate_features_payload(jsonb, uuid);

-- =============================================
-- 3. Auditoria e anti-tampering de profile: sem features
-- =============================================

CREATE OR REPLACE FUNCTION public.tg_audit_profile_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa_id UUID := COALESCE(NEW.empresa_id, OLD.empresa_id);
  v_actor      UUID := COALESCE(auth.uid(), NEW.updated_by, OLD.updated_by);
  v_email      TEXT;
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    SELECT email INTO v_email FROM public.profiles WHERE id = v_actor;

    PERFORM public.insert_audit_log(
      'role_change', 'profiles', OLD.id,
      jsonb_build_object('role', jsonb_build_object('old', OLD.role, 'new', NEW.role)),
      v_actor, v_email,
      jsonb_build_object('empresa_id', v_empresa_id, 'target_email', OLD.email)
    );
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS audit_profile_changes ON public.profiles;
CREATE TRIGGER audit_profile_changes
  AFTER UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_profile_changes();

CREATE OR REPLACE FUNCTION public.tg_prevent_profile_tampering()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- service_role (edge functions, migrations, admin operations) bypassa
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Bloqueia escalada de role por não-admin
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'ultra_admin')
    ) THEN
      RAISE EXCEPTION 'Permissão negada: alteração de role não autorizada';
    END IF;
  END IF;

  -- Bloqueia troca de empresa (cross-tenant)
  IF NEW.empresa_id IS DISTINCT FROM OLD.empresa_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'ultra_admin'
    ) THEN
      RAISE EXCEPTION 'Permissão negada: alteração de empresa_id não autorizada';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- =============================================
-- 4. Convite e mudança de acesso: sem p_features
-- =============================================
-- DROP + CREATE (não CREATE OR REPLACE): trocar a lista de parâmetros criaria
-- overload, e o cliente PostgREST passaria a errar por ambiguidade.

DROP FUNCTION IF EXISTS public.create_convite(text, text, text, jsonb);
DROP FUNCTION IF EXISTS public.create_convite(text, text, text);

CREATE FUNCTION public.create_convite(p_email text, p_cargo text, p_nome text DEFAULT NULL::text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_empresa_id UUID;
  v_cargo public.user_role;
  v_token_plain TEXT;
  v_token_hash TEXT;
BEGIN
  v_empresa_id := public.get_user_empresa_id();

  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem criar convites';
  END IF;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa';
  END IF;

  BEGIN
    v_cargo := p_cargo::public.user_role;
  EXCEPTION WHEN OTHERS THEN
    v_cargo := 'user';
  END;

  -- owner e ultra_admin não são concedidos via convite (escalada vertical):
  -- owner só via set_access_profile por owner/ultra_admin; ultra_admin só via SQL.
  IF v_cargo IN ('ultra_admin', 'owner') THEN
    RAISE EXCEPTION 'ultra_admin/owner não podem ser concedidos via convite';
  END IF;

  -- Invalida convites antigos não usados do mesmo e-mail.
  UPDATE public.convites
  SET usado_em = NOW()
  WHERE email = lower(trim(p_email))
    AND empresa_id = v_empresa_id
    AND usado_em IS NULL;

  v_token_plain := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash := encode(extensions.digest(v_token_plain, 'sha256'), 'hex');

  INSERT INTO public.convites (empresa_id, email, cargo, nome, criado_por, token, token_hash)
  VALUES (v_empresa_id, lower(trim(p_email)), v_cargo, p_nome, auth.uid(), NULL, v_token_hash);

  RETURN v_token_plain;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_convite(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_convite(text, text, text) TO authenticated;

DROP FUNCTION IF EXISTS public.admin_create_convite(uuid, text, text, text, jsonb);
DROP FUNCTION IF EXISTS public.admin_create_convite(uuid, text, text, text);

CREATE FUNCTION public.admin_create_convite(
  p_empresa_id uuid,
  p_email text,
  p_cargo text,
  p_nome text DEFAULT NULL::text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_cargo public.user_role;
  v_token_plain TEXT;
  v_token_hash TEXT;
BEGIN
  IF p_empresa_id IS NULL THEN
    RAISE EXCEPTION 'empresa_id obrigatório';
  END IF;

  BEGIN
    v_cargo := p_cargo::public.user_role;
  EXCEPTION WHEN OTHERS THEN
    v_cargo := 'user';
  END;

  IF v_cargo IN ('ultra_admin', 'owner') THEN
    RAISE EXCEPTION 'ultra_admin/owner não podem ser concedidos via convite';
  END IF;

  UPDATE public.convites
  SET usado_em = NOW()
  WHERE email = lower(trim(p_email))
    AND empresa_id = p_empresa_id
    AND usado_em IS NULL;

  v_token_plain := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash := encode(extensions.digest(v_token_plain, 'sha256'), 'hex');

  INSERT INTO public.convites (empresa_id, email, cargo, nome, token, token_hash)
  VALUES (p_empresa_id, lower(trim(p_email)), v_cargo, p_nome, NULL, v_token_hash);

  RETURN v_token_plain;
END;
$function$;

-- Só service_role (edge function ultra-admin-*) chama; nunca o cliente.
REVOKE ALL ON FUNCTION public.admin_create_convite(uuid, text, text, text) FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.update_user_access(uuid, text, jsonb);
DROP FUNCTION IF EXISTS public.update_user_access(uuid, text);

CREATE FUNCTION public.update_user_access(p_user_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_empresa UUID;
  v_target_empresa UUID;
  v_target_role public.user_role;
  v_new_role public.user_role;
BEGIN
  v_caller_empresa := public.get_user_empresa_id();

  IF NOT (public.has_role('admin') OR public.is_ultra_admin()) THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar acessos';
  END IF;

  SELECT empresa_id, role INTO v_target_empresa, v_target_role
  FROM public.profiles WHERE id = p_user_id;

  IF v_target_empresa IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;

  -- Admin de empresa só pode editar membros da própria empresa
  IF NOT public.is_ultra_admin() AND v_target_empresa <> v_caller_empresa THEN
    RAISE EXCEPTION 'Sem permissão para editar usuário de outra empresa';
  END IF;

  IF v_target_role = 'ultra_admin' THEN
    RAISE EXCEPTION 'Ultra admin só pode ser editado via SQL direto';
  END IF;

  BEGIN
    v_new_role := p_role::public.user_role;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Role inválido: %', p_role;
  END;

  IF v_new_role = 'ultra_admin' THEN
    RAISE EXCEPTION 'Promoção a ultra_admin requer SQL direto';
  END IF;

  IF v_new_role IN ('financeiro', 'marketing', 'operacional') THEN
    v_new_role := 'user';
  END IF;

  UPDATE public.profiles
  SET role = v_new_role,
      updated_at = NOW(),
      updated_by = auth.uid()
  WHERE id = p_user_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.update_user_access(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_user_access(uuid, text) TO authenticated;

-- set_access_profile: perfil de acesso passa a ser só o role (owner /
-- coordenador / colaborador). O preset de features por perfil deixa de existir.
CREATE OR REPLACE FUNCTION public.set_access_profile(p_user_id uuid, p_perfil text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_role   public.user_role;
  v_caller_emp    uuid;
  v_target_emp    uuid;
  v_target_role   public.user_role;
BEGIN
  IF p_perfil NOT IN ('owner', 'coordenador', 'colaborador') THEN
    RAISE EXCEPTION 'Perfil inválido: %', p_perfil USING ERRCODE = '22023';
  END IF;

  SELECT role, empresa_id INTO v_caller_role, v_caller_emp
  FROM public.profiles WHERE id = auth.uid();

  IF v_caller_role IS NULL
     OR v_caller_role NOT IN ('admin', 'owner', 'ultra_admin') THEN
    RAISE EXCEPTION 'Apenas admin/owner podem definir perfis de acesso'
      USING ERRCODE = '42501';
  END IF;

  -- Conceder 'owner' é escalada vertical: exige que o caller JÁ seja owner ou
  -- ultra_admin. Um admin comum NÃO pode cunhar owner (nem promover a si mesmo).
  IF p_perfil = 'owner' AND v_caller_role NOT IN ('owner', 'ultra_admin') THEN
    RAISE EXCEPTION 'Conceder o perfil owner requer ser owner ou ultra_admin'
      USING ERRCODE = '42501';
  END IF;

  SELECT role, empresa_id INTO v_target_role, v_target_emp
  FROM public.profiles WHERE id = p_user_id;

  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado' USING ERRCODE = '22023';
  END IF;

  -- Escopo de empresa (ultra_admin cruza).
  IF v_caller_role <> 'ultra_admin' AND v_target_emp IS DISTINCT FROM v_caller_emp THEN
    RAISE EXCEPTION 'Usuário de outra empresa' USING ERRCODE = '42501';
  END IF;

  -- Não rebaixa/altera ultra_admin por esta via.
  IF v_target_role = 'ultra_admin' THEN
    RAISE EXCEPTION 'Não é possível alterar o perfil de um ultra_admin'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
  SET role = p_perfil::public.user_role
  WHERE id = p_user_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_access_profile(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_access_profile(uuid, text) TO authenticated;

-- =============================================
-- 5. handle_new_user: profile nasce só com role
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

  -- SPEC 049: só o ramo self-serve (sem invite_token) passa terms_accepted
  -- no options.data do signUp(); convite e checkout pego o aceite depois em
  -- /profile-setup, onde já existe sessão pra um insert client-side comum.
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

    -- empresas.features guarda só early access de módulo ainda não lançado
    -- (ADR 0026): o que é universal não depende deste JSONB. O catálogo
    -- hardcoded que estava aqui ligava 'timesheet' e a chave morta
    -- 'planejamento' em toda empresa nova, sem ninguém pedir.
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

    select id into v_plan_id
    from public.pilar_subscription_plans
    where ativo = true
    order by destaque desc, ordem asc
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
    v_first_name := coalesce(v_convite.nome, v_meta_nome, split_part(NEW.email, '@', 1));

    insert into public.profiles (
      id, empresa_id, first_name, email, role, onboarding_completed
    )
    values (
      NEW.id, v_convite.empresa_id, v_first_name, NEW.email, v_convite.cargo, false
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

    v_first_name := coalesce(v_owner_pending.nome, v_meta_nome, split_part(NEW.email, '@', 1));

    insert into public.profiles (
      id, empresa_id, first_name, email, role, onboarding_completed
    )
    values (
      NEW.id, v_empresa_id, v_first_name, NEW.email, 'admin', false
    );

    update public.empresa_owners_pending set usado_em = now() where id = v_owner_pending.id;
    return NEW;
  end if;

  raise exception 'Token de convite inválido ou expirado';
end;
$function$;

-- =============================================
-- 6. As colunas saem
-- =============================================

ALTER TABLE public.profiles DROP COLUMN IF EXISTS features;
ALTER TABLE public.convites DROP COLUMN IF EXISTS features;

-- =============================================
-- 7. Segredo de integração volta a ser protegido por role
-- =============================================
-- Consequência direta de "todo membro é editor no que a empresa tem": duas
-- tabelas guardam credencial, não dado de negócio, e o gate de módulo deixou de
-- ser suficiente para elas. Achado pelos testes pgTAP de RLS ao rodar a nova
-- semântica, não em revisão de código.
--
--  - asaas_config: api_key do gateway de pagamento. Volta a exigir admin/owner.
--  - cliente_portal_accounts: senha_hash e token de sessão do portal. Exige
--    quem administra a operação (admin, owner ou coordenador), além do módulo.

DROP POLICY IF EXISTS asaas_config_admin_select ON public.asaas_config;
CREATE POLICY asaas_config_admin_select ON public.asaas_config
  FOR SELECT
  USING (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'owner'));

DROP POLICY IF EXISTS asaas_config_admin_insert ON public.asaas_config;
CREATE POLICY asaas_config_admin_insert ON public.asaas_config
  FOR INSERT
  WITH CHECK (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'owner'));

DROP POLICY IF EXISTS asaas_config_admin_update ON public.asaas_config;
CREATE POLICY asaas_config_admin_update ON public.asaas_config
  FOR UPDATE
  USING (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'owner'))
  WITH CHECK (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'owner'));

DROP POLICY IF EXISTS asaas_config_admin_delete ON public.asaas_config;
CREATE POLICY asaas_config_admin_delete ON public.asaas_config
  FOR DELETE
  USING (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'owner'));

DROP POLICY IF EXISTS "ClientePortal Manage" ON public.cliente_portal_accounts;
CREATE POLICY "ClientePortal Manage" ON public.cliente_portal_accounts
  FOR ALL
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('portal_cliente', 'editor')
    AND public.has_role('admin', 'owner', 'coordenador')
  )
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('portal_cliente', 'editor')
    AND public.has_role('admin', 'owner', 'coordenador')
  );
