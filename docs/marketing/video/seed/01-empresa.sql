-- Video demo company (fictional): Atrium Engenharia. Login video@local.test / 123456.
-- Runs as supabase_admin. Idempotent: returns if the user exists.
do $$
declare
  v_emp uuid := 'a1000000-0000-0000-0000-000000000001';
  v_usr uuid := 'a1000000-0000-0000-0000-000000000010';
  v_email text := 'video@local.test';
  v_features jsonb;
begin
  if exists (select 1 from auth.users where id = v_usr) then return; end if;
  select jsonb_object_agg(f, true) into v_features from unnest(public._feature_catalog()) f;
  alter table auth.users disable trigger on_auth_user_created;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change,
    email_change_token_new, email_change_token_current, phone_change, phone_change_token,
    reauthentication_token, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', v_usr, 'authenticated', 'authenticated', v_email,
    crypt('123456', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', '', '', '', '', '', now(), now());
  insert into public.empresas (id, nome, owner_id, status, onboarding_completed, features, cidade, estado, nivel_override, nivel_override_motivo)
  values (v_emp, 'Atrium Engenharia', v_usr, 'active', true, v_features, 'Campinas', 'SP', 'ouro', 'seed de video');
  insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_usr, v_usr::text, 'email', jsonb_build_object('sub', v_usr::text, 'email', v_email), now(), now(), now());
  alter table auth.users enable trigger on_auth_user_created;
  insert into public.profiles (id, empresa_id, email, first_name, last_name, role, onboarding_completed, onboarding_state)
  values (v_usr, v_emp, v_email, 'Marina', 'Prado', 'admin', true, '{"dismissed": true}'::jsonb);
end $$;
