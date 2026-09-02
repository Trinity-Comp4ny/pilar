-- profiles.avatar_url existe no schema há tempo mas nunca foi escrito. Login/
-- signup via Google devolve a foto no raw_user_meta_data (chave avatar_url ou
-- picture, dependendo da versão do provider); passamos a gravá-la no profile
-- nos 3 cenários do handle_new_user. Login por email/senha não tem foto: fica
-- NULL e o avatar cai para iniciais (AvatarStack). Login Google subsequente
-- (usuário já existente) é sincronizado no client, em AuthCallback.tsx, já que
-- o trigger só roda em INSERT de auth.users.
--
-- Base = handle_new_user() da migration 20260854000000 (spec 058: sem
-- profiles.features/convites.features, empresas.features sempre '{}'::jsonb)
-- + terms_acceptances da 20260843000000 (spec 049). Só soma avatar_url.

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
  v_last_name      text;
  v_nome_completo  text;
  v_avatar_url     text;
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

  v_avatar_url := nullif(
    trim(coalesce(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')),
    ''
  );
  if v_avatar_url is not null and length(v_avatar_url) > 2048 then
    v_avatar_url := substring(v_avatar_url from 1 for 2048);
  end if;

  -- SPEC 049: só o ramo self-serve (sem invite_token) passa terms_accepted
  -- no options.data do signUp(); convite e checkout pego o aceite depois em
  -- /profile-setup, onde já existe sessão pra um insert client-side comum.
  v_terms_accepted := (NEW.raw_user_meta_data->>'terms_accepted') = 'true';
  v_terms_version := NEW.raw_user_meta_data->>'terms_version';
  v_privacy_version := NEW.raw_user_meta_data->>'privacy_version';

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

    -- empresas.features guarda só early access de módulo ainda não lançado
    -- (ADR 0026): o que é universal não depende deste JSONB.
    insert into public.empresas (owner_id, nome, features, onboarding_completed)
    values (NEW.id, coalesce(v_company_name, 'Minha empresa'), '{}'::jsonb, false)
    returning id into v_empresa_id;

    -- Self-serve coleta o nome num campo só. Quebra em first/last (primeiro token e
    -- o resto) para o onboarding já vir preenchido e o dono só confirmar o sobrenome.
    v_nome_completo := coalesce(v_meta_nome, split_part(NEW.email, '@', 1));
    v_first_name := split_part(v_nome_completo, ' ', 1);
    if position(' ' in v_nome_completo) > 0 then
      v_last_name := coalesce(nullif(trim(substring(v_nome_completo from position(' ' in v_nome_completo) + 1)), ''), '');
    else
      v_last_name := '';
    end if;

    -- profiles.last_name é NOT NULL DEFAULT '' (migration 20260429500000): sem
    -- sobrenome, grava string vazia, nunca NULL (senão o INSERT viola a constraint).
    insert into public.profiles (
      id, empresa_id, first_name, last_name, email, contato, avatar_url, role, onboarding_completed
    )
    values (
      NEW.id, v_empresa_id, v_first_name, v_last_name, NEW.email, v_telefone, v_avatar_url, 'admin', false
    );

    if v_terms_accepted and v_terms_version is not null and v_privacy_version is not null then
      insert into public.terms_acceptances (user_id, empresa_id, terms_version, privacy_version, source)
      values (NEW.id, v_empresa_id, v_terms_version, v_privacy_version, 'signup');
    end if;

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
  -- CENÁRIO 1: FUNCIONÁRIO CONVIDADO (inalterado, exceto avatar_url)
  -- ===========================================================================
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
      id, empresa_id, first_name, email, avatar_url, role, onboarding_completed
    )
    values (
      NEW.id, v_convite.empresa_id, v_first_name, NEW.email, v_avatar_url, v_convite.cargo, false
    );

    update public.convites set usado_em = now() where id = v_convite.id;
    return NEW;
  end if;

  -- ===========================================================================
  -- CENÁRIO 2: NOVO OWNER (checkout pago) (inalterado, exceto avatar_url)
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
    values (NEW.id, v_owner_pending.company_name, '{}'::jsonb, false)
    returning id into v_empresa_id;

    v_first_name := coalesce(v_owner_pending.nome, v_meta_nome, split_part(NEW.email, '@', 1));

    insert into public.profiles (
      id, empresa_id, first_name, email, avatar_url, role, onboarding_completed
    )
    values (
      NEW.id, v_empresa_id, v_first_name, NEW.email, v_avatar_url, 'admin', false
    );

    update public.empresa_owners_pending set usado_em = now() where id = v_owner_pending.id;
    return NEW;
  end if;

  raise exception 'Token de convite inválido ou expirado';
end;
$function$;
