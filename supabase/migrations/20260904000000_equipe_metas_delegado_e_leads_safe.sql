-- Estende o modelo de delegação do ADR 0034 (hoje só financeiro) para equipe e
-- metas, e fecha um vazamento real de valor em leads (mesma classe do que
-- motivou projetos_safe/pessoas_safe).
--
-- Contexto do pedido: financeiro/equipe/metas são liberados por padrão só pra
-- admin; um coordenador pode receber cada um desses acessos individualmente
-- por concessão explícita do admin (nunca um "user" comum — a concessão exige
-- que o alvo já seja coordenador).

-- ==========================================================================
-- 1. Colunas novas, mesmo padrão de financeiro_delegado: escrita só via RPC.
-- ==========================================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS equipe_delegado boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS metas_delegado boolean NOT NULL DEFAULT false;

-- equipe_delegado/metas_delegado de propósito FORA do GRANT UPDATE de
-- authenticated (a lista de colunas já revogada/reconcedida em
-- 20260870000000 continua valendo: essas duas colunas nunca entram nela).

-- ==========================================================================
-- 2. set_equipe_delegado / set_metas_delegado: mesmo esqueleto de
--    set_financeiro_delegado, com uma regra a mais: só pode conceder (true)
--    para quem já é coordenador. Revogar (false) vale pra qualquer alvo, útil
--    ao rebaixar um coordenador pra user sem deixar o flag órfão.
-- ==========================================================================
DROP FUNCTION IF EXISTS public.set_equipe_delegado(uuid, boolean);
CREATE FUNCTION public.set_equipe_delegado(p_user_id uuid, p_delegado boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_empresa uuid;
  v_target_empresa uuid;
  v_target_role public.user_role;
BEGIN
  IF NOT (public.has_role('admin') OR public.is_ultra_admin()) THEN
    RAISE EXCEPTION 'Apenas administradores podem conceder acesso de equipe'
      USING ERRCODE = '42501';
  END IF;

  v_caller_empresa := public.get_user_empresa_id();

  SELECT empresa_id, role INTO v_target_empresa, v_target_role
  FROM public.profiles WHERE id = p_user_id;

  IF v_target_empresa IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado' USING ERRCODE = '22023';
  END IF;

  IF NOT public.is_ultra_admin() AND v_target_empresa IS DISTINCT FROM v_caller_empresa THEN
    RAISE EXCEPTION 'Sem permissão para editar usuário de outra empresa'
      USING ERRCODE = '42501';
  END IF;

  IF v_target_role = 'ultra_admin' THEN
    RAISE EXCEPTION 'Ultra admin não usa o toggle de acesso de equipe'
      USING ERRCODE = '42501';
  END IF;

  IF p_delegado AND v_target_role <> 'coordenador' THEN
    RAISE EXCEPTION 'Acesso de equipe só pode ser concedido a coordenadores'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
  SET equipe_delegado = p_delegado,
      updated_at = NOW(),
      updated_by = auth.uid()
  WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_equipe_delegado(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_equipe_delegado(uuid, boolean) TO authenticated;

DROP FUNCTION IF EXISTS public.set_metas_delegado(uuid, boolean);
CREATE FUNCTION public.set_metas_delegado(p_user_id uuid, p_delegado boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_empresa uuid;
  v_target_empresa uuid;
  v_target_role public.user_role;
BEGIN
  IF NOT (public.has_role('admin') OR public.is_ultra_admin()) THEN
    RAISE EXCEPTION 'Apenas administradores podem conceder acesso a metas'
      USING ERRCODE = '42501';
  END IF;

  v_caller_empresa := public.get_user_empresa_id();

  SELECT empresa_id, role INTO v_target_empresa, v_target_role
  FROM public.profiles WHERE id = p_user_id;

  IF v_target_empresa IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado' USING ERRCODE = '22023';
  END IF;

  IF NOT public.is_ultra_admin() AND v_target_empresa IS DISTINCT FROM v_caller_empresa THEN
    RAISE EXCEPTION 'Sem permissão para editar usuário de outra empresa'
      USING ERRCODE = '42501';
  END IF;

  IF v_target_role = 'ultra_admin' THEN
    RAISE EXCEPTION 'Ultra admin não usa o toggle de acesso a metas'
      USING ERRCODE = '42501';
  END IF;

  IF p_delegado AND v_target_role <> 'coordenador' THEN
    RAISE EXCEPTION 'Acesso a metas só pode ser concedido a coordenadores'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
  SET metas_delegado = p_delegado,
      updated_at = NOW(),
      updated_by = auth.uid()
  WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_metas_delegado(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_metas_delegado(uuid, boolean) TO authenticated;

-- ==========================================================================
-- 3. set_financeiro_delegado ganha a mesma regra (só concede a coordenador),
--    pra fechar a mesma brecha que a UI já vai deixar de oferecer pra "user".
-- ==========================================================================
DROP FUNCTION IF EXISTS public.set_financeiro_delegado(uuid, boolean);
CREATE FUNCTION public.set_financeiro_delegado(p_user_id uuid, p_delegado boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_empresa uuid;
  v_target_empresa uuid;
  v_target_role public.user_role;
BEGIN
  IF NOT (public.has_role('admin') OR public.is_ultra_admin()) THEN
    RAISE EXCEPTION 'Apenas administradores podem conceder acesso financeiro'
      USING ERRCODE = '42501';
  END IF;

  v_caller_empresa := public.get_user_empresa_id();

  SELECT empresa_id, role INTO v_target_empresa, v_target_role
  FROM public.profiles WHERE id = p_user_id;

  IF v_target_empresa IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado' USING ERRCODE = '22023';
  END IF;

  IF NOT public.is_ultra_admin() AND v_target_empresa IS DISTINCT FROM v_caller_empresa THEN
    RAISE EXCEPTION 'Sem permissão para editar usuário de outra empresa'
      USING ERRCODE = '42501';
  END IF;

  IF v_target_role = 'ultra_admin' THEN
    RAISE EXCEPTION 'Ultra admin não usa o toggle de acesso financeiro'
      USING ERRCODE = '42501';
  END IF;

  IF p_delegado AND v_target_role <> 'coordenador' THEN
    RAISE EXCEPTION 'Acesso financeiro só pode ser concedido a coordenadores'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
  SET financeiro_delegado = p_delegado,
      updated_at = NOW(),
      updated_by = auth.uid()
  WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_financeiro_delegado(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_financeiro_delegado(uuid, boolean) TO authenticated;

-- ==========================================================================
-- 4. Auditoria e anti-tampering: estende os dois triggers de profiles
--    (20260870000000) para equipe_delegado e metas_delegado.
-- ==========================================================================
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

  IF OLD.financeiro_delegado IS DISTINCT FROM NEW.financeiro_delegado THEN
    SELECT email INTO v_email FROM public.profiles WHERE id = v_actor;

    PERFORM public.insert_audit_log(
      'financeiro_delegado_change', 'profiles', OLD.id,
      jsonb_build_object('financeiro_delegado', jsonb_build_object(
        'old', OLD.financeiro_delegado, 'new', NEW.financeiro_delegado
      )),
      v_actor, v_email,
      jsonb_build_object('empresa_id', v_empresa_id, 'target_email', OLD.email)
    );
  END IF;

  IF OLD.equipe_delegado IS DISTINCT FROM NEW.equipe_delegado THEN
    SELECT email INTO v_email FROM public.profiles WHERE id = v_actor;

    PERFORM public.insert_audit_log(
      'equipe_delegado_change', 'profiles', OLD.id,
      jsonb_build_object('equipe_delegado', jsonb_build_object(
        'old', OLD.equipe_delegado, 'new', NEW.equipe_delegado
      )),
      v_actor, v_email,
      jsonb_build_object('empresa_id', v_empresa_id, 'target_email', OLD.email)
    );
  END IF;

  IF OLD.metas_delegado IS DISTINCT FROM NEW.metas_delegado THEN
    SELECT email INTO v_email FROM public.profiles WHERE id = v_actor;

    PERFORM public.insert_audit_log(
      'metas_delegado_change', 'profiles', OLD.id,
      jsonb_build_object('metas_delegado', jsonb_build_object(
        'old', OLD.metas_delegado, 'new', NEW.metas_delegado
      )),
      v_actor, v_email,
      jsonb_build_object('empresa_id', v_empresa_id, 'target_email', OLD.email)
    );
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS audit_profile_changes ON public.profiles;
CREATE TRIGGER audit_profile_changes
  AFTER UPDATE OF role, financeiro_delegado, equipe_delegado, metas_delegado ON public.profiles
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

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'ultra_admin')
    ) THEN
      RAISE EXCEPTION 'Permissão negada: alteração de role não autorizada';
    END IF;
  END IF;

  IF NEW.financeiro_delegado IS DISTINCT FROM OLD.financeiro_delegado THEN
    IF NOT EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'ultra_admin')
    ) THEN
      RAISE EXCEPTION 'Permissão negada: alteração de acesso financeiro não autorizada';
    END IF;
  END IF;

  IF NEW.equipe_delegado IS DISTINCT FROM OLD.equipe_delegado THEN
    IF NOT EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'ultra_admin')
    ) THEN
      RAISE EXCEPTION 'Permissão negada: alteração de acesso de equipe não autorizada';
    END IF;
  END IF;

  IF NEW.metas_delegado IS DISTINCT FROM OLD.metas_delegado THEN
    IF NOT EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'ultra_admin')
    ) THEN
      RAISE EXCEPTION 'Permissão negada: alteração de acesso a metas não autorizada';
    END IF;
  END IF;

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

-- ==========================================================================
-- 5. leads_safe: mesmo padrão de projetos_safe. Mascara valor_estimado pra
--    quem não tem can_view_financeiro(). Achado em QA: tela de Leads mostrava
--    valor pra qualquer membro com o módulo, sem checar financeiro (a RLS de
--    leads é só por feature de módulo, nunca foi por papel).
-- ==========================================================================
DROP VIEW IF EXISTS public.leads_safe;

CREATE VIEW public.leads_safe WITH (security_barrier = true) AS
SELECT
  l.id,
  l.empresa_id,
  l.created_by,
  l.nome,
  l.sobrenome,
  l.email,
  l.contato,
  l.status,
  l.origem,
  l.cliente_id,
  l.motivo_perda,
  l.convertido_em,
  l.responsavel_id,
  l.previsao_fechamento,
  l.empresa_lead,
  l.cnpj,
  l.notas,
  l.deleted_at,
  l.created_at,
  l.updated_at,
  public.can_view_financeiro() AS pode_ver_valor,
  CASE WHEN public.can_view_financeiro() THEN l.valor_estimado END AS valor_estimado
FROM public.leads l
WHERE l.empresa_id = public.get_user_empresa_id()
  AND l.deleted_at IS NULL
  AND public.user_has_feature('leads', 'viewer');

GRANT SELECT ON public.leads_safe TO authenticated;

COMMENT ON VIEW public.leads_safe IS
  'Leitura segura de leads: valor_estimado só com can_view_financeiro(); senão NULL. Multi-tenant + soft-delete + feature viewer replicados no WHERE. Escritas continuam em public.leads.';

-- ==========================================================================
-- 7. can_view_financeiro/can_view_folha ficam cegas a "ver como": usam
--    has_role(), que lê profiles.role DIRETO, nunca current_effective_role().
--    Achado em QA em prod: admin faz "ver como Usuário", a sidebar esconde
--    Financeiro (client usa effectiveRole), mas projetos_safe, leads_safe,
--    pessoas_safe (folha) e as RPCs de rentabilidade continuam devolvendo
--    valor real, porque a máscara do banco confia no role real do admin.
--
--    Mesmo fix que 20260819000000 já aplicou em profiles/empresas/audit_logs/
--    disciplinas: trocar o lookup de role por current_effective_role(). Lista
--    ('admin','ultra_admin','owner') replica exatamente o que has_role('admin')
--    já cobria (ultra_admin sempre bypassa, owner é admin de fato), só que
--    agora respeitando o target_role de uma sessão de impersonation ativa.
--
--    financeiro_delegado continua lido do profile REAL, sem trocar: é
--    concessão pontual do próprio usuário (ADR 0034), não papel simulável.
-- ==========================================================================
CREATE OR REPLACE FUNCTION public.can_view_financeiro()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_effective_role() IN ('admin', 'ultra_admin', 'owner')
    OR COALESCE(
      (SELECT financeiro_delegado FROM public.profiles WHERE id = auth.uid()),
      FALSE
    );
$$;

CREATE OR REPLACE FUNCTION public.can_view_folha()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_effective_role() IN ('admin', 'ultra_admin', 'owner');
$$;

-- ==========================================================================
-- 6. handle_new_user: achado em QA. O ramo self-serve já separa nome
--    completo em first_name/last_name (v_nome_completo + split_part), mas os
--    ramos de convite e de owner via checkout gravavam o nome inteiro em
--    first_name só, last_name ficava NULL. Por isso quem aceitava um convite
--    via UsersAccessManager (campo único "Nome completo") via o nome e
--    sobrenome juntos no mesmo campo em /profile-setup. Mesma lógica de
--    split do ramo self-serve, replicada nos outros dois.
-- ==========================================================================
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
