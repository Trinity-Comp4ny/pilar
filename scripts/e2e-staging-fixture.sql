-- Estado garantido da empresa do usuário de E2E em STAGING (admin-e2e@pilar.test).
-- Roda no job "E2E → staging" do ci.yml antes dos specs. Idempotente.
--
-- Por que existe: o trial da empresa de teste venceu em 31/08/2026 e o app passou
-- a mostrar "Acesso suspenso" em toda rota. Os specs que só conferiam URL seguiram
-- verdes olhando a tela de bloqueio, e os que clicavam falharam assim que voltaram
-- a rodar (07/10). Fixture de teste não pode depender do relógio do produto.
--
-- Só toca na empresa cujo perfil tem esse e-mail. Nunca rodar em produção: o job
-- que chama isto só existe no ambiente Staging.
do $$
declare
  v_empresa_id uuid;
begin
  select empresa_id into v_empresa_id
  from public.profiles
  where email = 'admin-e2e@pilar.test';

  if v_empresa_id is null then
    raise exception 'Usuário de E2E admin-e2e@pilar.test não existe neste banco.';
  end if;

  -- Assinatura ativa sem fim próximo: nem trial, nem suspensão, nem modo leitura.
  update public.pilar_subscriptions
  set status = 'active',
      current_period_end = now() + interval '10 years'
  where empresa_id = v_empresa_id
    and (status <> 'active' or current_period_end is null or current_period_end < now() + interval '1 year');

  update public.empresas
  set leitura_desde = null
  where id = v_empresa_id
    and leitura_desde is not null;

  -- Sem trava de capacidade de trial (SPEC 098), igual ao seed local.
  update public.empresas
  set nivel_override = 'ouro',
      nivel_override_motivo = 'fixture de E2E em staging'
  where id = v_empresa_id
    and nivel_override is distinct from 'ouro';

  -- Tour e checklist de onboarding interceptam clique (ver scripts/seed-local.sql).
  update public.profiles
  set onboarding_state = onboarding_state || '{"dismissed": true}'::jsonb
  where empresa_id = v_empresa_id
    and coalesce((onboarding_state->>'dismissed')::boolean, false) = false;
end $$;
