-- Seed de DESENVOLVIMENTO LOCAL. Não usar em staging/prod.
-- Roda automaticamente em `supabase start` e `supabase db reset`, então o banco
-- local sempre nasce com uma empresa demo e um usuário owner que loga por senha.
--
-- Logins (todos com senha 123456):
--   dev@local.test    → ultra_admin (bypass total, telas de plataforma)
--   admin@local.test  → admin da Empresa Dev (acesso total dentro da empresa)
--   user@local.test   → user comum: SEM financeiro e SEM obras (testa gating)
--
-- Idempotente: se o usuário já existe, não faz nada.

do $$
declare
  v_empresa_id uuid := '00000000-0000-0000-0000-000000000001';
  v_user_id    uuid := '00000000-0000-0000-0000-000000000010';
  v_email      text := 'dev@local.test';
  v_senha      text := '123456';
  v_features   jsonb;
begin
  if exists (select 1 from auth.users where id = v_user_id) then
    return;
  end if;

  -- todas as features ligadas para o ambiente local
  select jsonb_object_agg(f, true) into v_features
  from unnest(public._feature_catalog()) f;

  -- O trigger on_auth_user_created exige invite_token e barra cadastro direto.
  -- Para o seed, desligamos o trigger e montamos user + empresa + profile na mão.
  -- Ordem obrigatória: user antes da empresa (empresas.owner_id -> auth.users).
  alter table auth.users disable trigger on_auth_user_created;

  -- Os campos *_token / *_change precisam ser '' (não NULL): o GoTrue lê como
  -- string e quebra com "Database error querying schema" se vierem NULL.
  insert into auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token,
    email_change, email_change_token_new, email_change_token_current,
    phone_change, phone_change_token, reauthentication_token,
    created_at, updated_at
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_user_id, 'authenticated', 'authenticated', v_email,
    crypt(v_senha, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    '', '', '', '', '', '', '', '',
    now(), now()
  );

  insert into public.empresas (id, nome, owner_id, status, onboarding_completed, features)
  values (v_empresa_id, 'Empresa Dev', v_user_id, 'active', true, v_features);

  -- Login por senha no GoTrue moderno exige a identity de provider 'email'.
  -- auth.identities.email é coluna gerada; vem de identity_data->>'email'.
  insert into auth.identities (
    id, user_id, provider_id, provider, identity_data,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_user_id, v_user_id::text, 'email',
    jsonb_build_object('sub', v_user_id::text, 'email', v_email),
    now(), now(), now()
  );

  alter table auth.users enable trigger on_auth_user_created;

  -- role 'ultra_admin': superadmin com bypass total (is_ultra_admin lê direto de
  -- profiles.role, has_role dá bypass em qualquer verificação, e libera as telas
  -- de plataforma/impersonation no front). profile.features fica vazio de propósito
  -- (o validador de profile trata algumas chaves como nível, ex. mapa=viewer/editor,
  --  então não dá para reusar o payload booleano da empresa aqui). O trigger
  --  tg_protect_ultra_admin barra promoção a ultra_admin via SQL de usuário comum,
  --  mas o seed roda como 'postgres' (conexão direta), que tem bypass.
  insert into public.profiles (
    id, empresa_id, email, first_name, last_name, role, onboarding_completed, features
  ) values (
    v_user_id, v_empresa_id, v_email, 'Dev', 'Local', 'ultra_admin', true, '{}'::jsonb
  );
end $$;

-- Usuários não-ultra da Empresa Dev, para testar o gating de acesso no browser.
-- Mesmo padrão do bloco acima (trigger desligado + auth.users + identity + profile).
do $$
declare
  v_empresa_id uuid := '00000000-0000-0000-0000-000000000001';
  v_senha      text := '123456';
  r record;
begin
  for r in
    select * from (values
      -- id, email, role, features (JSONB por usuário; '{}' = admin dá bypass na empresa)
      ('00000000-0000-0000-0000-000000000011'::uuid, 'admin@local.test', 'admin'::public.user_role,
       '{}'::jsonb, 'Admin', 'Empresa'),
      ('00000000-0000-0000-0000-000000000012'::uuid, 'user@local.test', 'user'::public.user_role,
       '{"projetos":"editor","leads":"editor","propostas":"editor","clientes":"viewer"}'::jsonb,
       'User', 'Comum')
    ) as t(id, email, role, features, first_name, last_name)
  loop
    if exists (select 1 from auth.users where id = r.id) then
      continue;
    end if;

    alter table auth.users disable trigger on_auth_user_created;

    insert into auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token,
      email_change, email_change_token_new, email_change_token_current,
      phone_change, phone_change_token, reauthentication_token,
      created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000',
      r.id, 'authenticated', 'authenticated', r.email,
      crypt(v_senha, gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      '', '', '', '', '', '', '', '',
      now(), now()
    );

    insert into auth.identities (
      id, user_id, provider_id, provider, identity_data,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), r.id, r.id::text, 'email',
      jsonb_build_object('sub', r.id::text, 'email', r.email),
      now(), now(), now()
    );

    alter table auth.users enable trigger on_auth_user_created;

    insert into public.profiles (
      id, empresa_id, email, first_name, last_name, role, onboarding_completed, features
    ) values (
      r.id, v_empresa_id, r.email, r.first_name, r.last_name, r.role, true, r.features
    );
  end loop;
end $$;
