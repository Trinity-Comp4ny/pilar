-- Seed de DESENVOLVIMENTO LOCAL. Não usar em staging/prod.
-- Roda automaticamente em `supabase start` e `supabase db reset`, então o banco
-- local sempre nasce com uma empresa demo e um usuário owner que loga por senha.
--
-- Login:  dev@local.test  /  123456
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

  -- profile.features fica vazio: owner enxerga tudo e o gate real mora na empresa.
  -- (o validador de profile trata algumas chaves como nível, ex. mapa=viewer/editor,
  --  então não dá para reusar o payload booleano da empresa aqui.)
  insert into public.profiles (
    id, empresa_id, email, first_name, last_name, role, onboarding_completed, features
  ) values (
    v_user_id, v_empresa_id, v_email, 'Dev', 'Local', 'admin', true, '{}'::jsonb
  );
end $$;
