-- Onboarding guiado: meta-estado por usuário (dispensou, terminou, tours vistos,
-- seções recolhidas). O PROGRESSO dos passos NÃO vive aqui: é derivado de contagem
-- de entidades reais (fonte única, sem drift). Aqui fica só o que o usuário decidiu.
--
-- Escrita via RPC set_onboarding_state (merge raso server-side), para não depender do
-- cliente montar o objeto inteiro e evitar clobber entre abas. A RPC toca apenas a
-- coluna onboarding_state, então passa pelo trigger enforce_profile_immutable_fields
-- (que só guarda role / empresa_id / onboarding_completed).

alter table public.profiles
  add column if not exists onboarding_state jsonb not null default '{}'::jsonb;

comment on column public.profiles.onboarding_state is
  'Meta-estado do onboarding guiado do próprio usuário: { dismissed, completed_at, tours_seen[], collapsed_sections[] }. Progresso dos passos é derivado de contagem, não gravado aqui.';

create or replace function public.set_onboarding_state(patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  merged jsonb;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  update public.profiles
     set onboarding_state = coalesce(onboarding_state, '{}'::jsonb) || coalesce(patch, '{}'::jsonb)
   where id = uid
   returning onboarding_state into merged;

  return merged;
end;
$$;

revoke execute on function public.set_onboarding_state(jsonb) from public;
grant execute on function public.set_onboarding_state(jsonb) to authenticated;
