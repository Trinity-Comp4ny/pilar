-- =============================================
-- SPEC 104: aviso de novo cadastro ao ultra-admin traz telefone e origem
-- (UTM/referrer que o /cadastro grava em raw_user_meta_data.origem). O
-- primeiro cadastro orgânico (23/09) chegou sem nenhum rastro de canal: o
-- PostHog só grava com consentimento de cookies.
-- Resto da função idêntico ao de 20261010000000.
-- =============================================

BEGIN;

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
  v_trial_dias     integer;
  v_origem         text;
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

    -- SPEC 104: duração do trial vem de platform_settings (padrão 3 dias),
    -- editável sem deploy. Sem a linha de settings, cai no padrão.
    select ps.trial_dias into v_trial_dias from public.platform_settings ps where ps.id = 'default';

    if v_plan_id is not null then
      insert into public.pilar_subscriptions (empresa_id, plan_id, status, trial_ends_at)
      values (v_empresa_id, v_plan_id, 'trialing', now() + make_interval(days => coalesce(v_trial_dias, 3)))
      on conflict (empresa_id) do nothing;
    end if;

    -- Origem gravada pelo /cadastro (UTM da landing ou referrer).
    v_origem := nullif(concat_ws(' / ',
      NEW.raw_user_meta_data->'origem'->>'utm_source',
      NEW.raw_user_meta_data->'origem'->>'utm_medium',
      NEW.raw_user_meta_data->'origem'->>'utm_campaign',
      NEW.raw_user_meta_data->'origem'->>'ref'), '');

    -- SPEC 104 (requisito 9 da SPEC 098): avisa os ultra-admins a cada
    -- cadastro self-serve. Nunca derruba o cadastro se a notificação falhar.
    begin
      perform public.notificar_ultra_admins(
        v_empresa_id,
        'novo_cadastro',
        'Novo cadastro: ' || coalesce(v_company_name, 'Minha empresa'),
        v_nome_completo || ' (' || v_email || coalesce(', ' || v_telefone, '') || ') começou o teste grátis.'
          || coalesce(' Origem: ' || v_origem || '.', ' Origem não informada.'),
        '/ultra-admin'
      );
    exception when others then
      raise warning 'handle_new_user: falha ao notificar ultra-admins (%)', sqlerrm;
    end;

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
