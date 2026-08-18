-- Achado real, 17/08: os dois cenários de handle_new_user() que criam um dono de
-- empresa (self-serve trial e checkout pago) inserem o profile com
-- role='admin', features='{}'::jsonb. user_has_feature() só dá bypass total pra
-- role='owner'/'ultra_admin' — 'admin' precisa de nível granular por feature no
-- próprio perfil. Como a coluna nunca é populada, TODO signup desde 13/07
-- (primeira empresa afetada encontrada) fica com um dono que loga, vê o
-- dashboard, mas o RLS bloqueia leitura/escrita em leads, clientes, projetos,
-- propostas, receitas, despesas, pessoas, categorias, contas, faturas, metas,
-- folha, escopos — quase toda tabela de negócio (~35 policies checam
-- user_has_feature()).
--
-- Fix: features do profile passa a espelhar exatamente as features da empresa
-- que acabou de ser criada (mesmo objeto, nível 'editor' pra cada uma marcada
-- true) — é o que uma conta provisionada manualmente (VRZ, BM3) sempre teve.
-- NÃO muda role pra 'owner': role='admin' é usado em várias checagens de UI
-- (ex.: PrivateRoute.isAdmin) que não deveriam mudar de comportamento aqui;
-- o problema real é só a feature list vazia, não o role.

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

  -- Editor em cada módulo que a empresa recém-criada tem habilitado. Mesmo
  -- catálogo hardcoded usado no INSERT de empresas logo abaixo, nos dois
  -- cenários (trial e owner pago) — dono da empresa sempre entra com acesso
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

-- Backfill: contas já criadas pelo trigger quebrado. Alvo preciso — só quem É
-- o owner_id registrado na própria empresa (identifica exatamente os dois
-- cenários acima, não um admin convidado normalmente por outra pessoa) E
-- ainda está com features vazio (não sobrescreve quem já ganhou permissão
-- manual desde então).
UPDATE public.profiles p
SET features = jsonb_build_object(
  'dashboard', 'editor', 'relatorios', 'editor', 'leads', 'editor', 'propostas', 'editor',
  'clientes', 'editor', 'projetos', 'editor', 'planejamento', 'editor', 'timesheet', 'editor',
  'mapa', 'editor', 'financeiro', 'editor', 'pessoas', 'editor', 'metas', 'editor',
  'portal_cliente', 'editor'
)
FROM public.empresas e
WHERE e.id = p.empresa_id
  AND e.owner_id = p.id
  AND p.role = 'admin'
  AND p.features = '{}'::jsonb;
