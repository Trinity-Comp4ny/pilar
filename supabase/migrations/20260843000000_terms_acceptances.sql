-- SPEC 049: aceite explícito dos Termos de Uso + Política de Privacidade.
-- Tabela append-only (mesmo padrão de audit_logs): nenhuma policy de
-- UPDATE/DELETE pra authenticated, só INSERT/SELECT da própria linha.
--
-- Duas origens de escrita:
--   - 'signup': o trigger handle_new_user() grava direto quando
--     raw_user_meta_data->>'terms_accepted' = 'true' (self-serve em /cadastro,
--     que passa isso no options.data do supabase.auth.signUp()).
--   - 'profile_setup': insert client-side comum (RLS de baixo cobre), pra
--     quem nunca viu o checkbox de /cadastro (Google OAuth, convite de
--     empresa, dono criado via checkout): todo mundo passa por
--     /profile-setup antes de usar o produto (PrivateRoute).

CREATE TABLE IF NOT EXISTS public.terms_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
  terms_version TEXT NOT NULL,
  privacy_version TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('signup', 'profile_setup')),
  accepted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS terms_acceptances_user_id_idx ON public.terms_acceptances(user_id);

ALTER TABLE public.terms_acceptances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Terms Acceptances Insert Own" ON public.terms_acceptances;
CREATE POLICY "Terms Acceptances Insert Own" ON public.terms_acceptances
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Terms Acceptances Select Own" ON public.terms_acceptances;
CREATE POLICY "Terms Acceptances Select Own" ON public.terms_acceptances
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Sem policy de UPDATE/DELETE para authenticated: registro imutável.
-- handle_new_user() é SECURITY DEFINER e já escreve em profiles/empresas
-- ignorando RLS pelo mesmo mecanismo; o INSERT desta tabela dentro dele
-- segue a mesma regra sem precisar de policy extra.

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
  v_owner_features jsonb;
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

  -- Editor em cada módulo que a empresa recém-criada tem habilitado. Mesmo
  -- catálogo hardcoded usado no INSERT de empresas logo abaixo, nos dois
  -- cenários (trial e owner pago); dono da empresa sempre entra com acesso
  -- total ao que foi habilitado, igual toda conta provisionada manualmente.
  v_owner_features := jsonb_build_object(
    'dashboard', 'editor', 'relatorios', 'editor', 'leads', 'editor', 'propostas', 'editor',
    'clientes', 'editor', 'projetos', 'editor', 'planejamento', 'editor', 'timesheet', 'editor',
    'mapa', 'editor', 'financeiro', 'editor', 'pessoas', 'editor', 'metas', 'editor',
    'portal_cliente', 'editor'
  );

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

    v_nome_completo := coalesce(v_meta_nome, split_part(NEW.email, '@', 1));
    v_first_name := split_part(v_nome_completo, ' ', 1);
    if position(' ' in v_nome_completo) > 0 then
      v_last_name := coalesce(nullif(trim(substring(v_nome_completo from position(' ' in v_nome_completo) + 1)), ''), '');
    else
      v_last_name := '';
    end if;

    insert into public.profiles (
      id, empresa_id, first_name, last_name, email, contato, role, features, onboarding_completed
    )
    values (
      NEW.id, v_empresa_id, v_first_name, v_last_name, NEW.email, v_telefone, 'admin', v_owner_features, false
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
      NEW.id, v_empresa_id, v_first_name, NEW.email, 'admin', v_owner_features, false
    );

    update public.empresa_owners_pending set usado_em = now() where id = v_owner_pending.id;
    return NEW;
  end if;

  raise exception 'Token de convite inválido ou expirado';
end;
$function$;
