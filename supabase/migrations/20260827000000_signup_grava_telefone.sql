-- Spec 039 (ajuste): o cadastro self-serve agora coleta o celular. Grava esse
-- telefone em profiles.contato no CENÁRIO 3, para o onboarding (ProfileSetup) já
-- vir com o campo preenchido e o dono não redigitar. Cenários 1 (convite) e 2
-- (checkout) seguem sem telefone no metadata do form, então não mudam.
--
-- Invariantes de segurança inalteradas: empresa sempre nova, role 'admin' fixo,
-- features fixadas no servidor, nada de tenant/role vindo do metadata.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
declare
  v_token          text;
  v_meta_nome      text;
  v_company_name   text;
  v_telefone       text;
  v_email          text;
  v_first_name     text;
  v_convite        record;
  v_owner_pending  record;
  v_pending_signup record;
  v_empresa_id     uuid;
  v_plan_id        uuid;
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

  -- ===========================================================================
  -- CENÁRIO 3: SELF-SERVE (sem convite/token). Empresa NOVA + admin + trial 14d.
  -- ===========================================================================
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
    values (
      NEW.id,
      coalesce(v_company_name, 'Minha empresa'),
      jsonb_build_object(
        'dashboard', true, 'relatorios', true, 'leads', true, 'propostas', true,
        'clientes', true, 'projetos', true, 'planejamento', true, 'timesheet', true,
        'mapa', true, 'financeiro', true, 'pessoas', true, 'metas', true,
        'portal_cliente', true, 'ai_hub', false, 'capacidade', false, 'templates', false
      ),
      false
    )
    returning id into v_empresa_id;

    v_first_name := coalesce(v_meta_nome, split_part(NEW.email, '@', 1));

    insert into public.profiles (
      id, empresa_id, first_name, email, contato, role, features, onboarding_completed
    )
    values (
      NEW.id, v_empresa_id, v_first_name, NEW.email, v_telefone, 'admin', '{}'::jsonb, false
    );

    -- Trial de 14 dias no plano padrão (o em destaque; senão o de menor ordem ativo).
    -- Sem plano ativo, a empresa nasce sem subscription (o gate de pagamento libera).
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

  -- ===========================================================================
  -- CENÁRIO 1: FUNCIONÁRIO CONVIDADO (inalterado)
  -- ===========================================================================
  select id, empresa_id, email, cargo, nome, features
  into v_convite
  from public.convites
  where token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex')
    and email = v_email
    and usado_em is null
    and expira_em > now();

  if v_convite.id is not null then
    v_first_name := coalesce(v_convite.nome, v_meta_nome, split_part(NEW.email, '@', 1));

    insert into public.profiles (
      id, empresa_id, first_name, email, role, features, onboarding_completed
    )
    values (
      NEW.id, v_convite.empresa_id, v_first_name, NEW.email,
      v_convite.cargo, coalesce(v_convite.features, '{}'::jsonb), false
    );

    update public.convites set usado_em = now() where id = v_convite.id;
    return NEW;
  end if;

  -- ===========================================================================
  -- CENÁRIO 2: NOVO OWNER (checkout pago) (inalterado)
  -- ===========================================================================
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
    values (
      NEW.id,
      v_owner_pending.company_name,
      jsonb_build_object(
        'dashboard', true, 'relatorios', true, 'leads', true, 'propostas', true,
        'clientes', true, 'projetos', true, 'planejamento', true, 'timesheet', true,
        'mapa', true, 'financeiro', true, 'pessoas', true, 'metas', true,
        'portal_cliente', true, 'ai_hub', false, 'capacidade', false, 'templates', false
      ),
      false
    )
    returning id into v_empresa_id;

    v_first_name := coalesce(v_owner_pending.nome, v_meta_nome, split_part(NEW.email, '@', 1));

    insert into public.profiles (
      id, empresa_id, first_name, email, role, features, onboarding_completed
    )
    values (
      NEW.id, v_empresa_id, v_first_name, NEW.email, 'admin', '{}'::jsonb, false
    );

    update public.empresa_owners_pending set usado_em = now() where id = v_owner_pending.id;
    return NEW;
  end if;

  raise exception 'Token de convite inválido ou expirado';
end;
$function$;
