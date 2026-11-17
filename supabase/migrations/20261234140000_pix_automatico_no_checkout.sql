-- Pix Automático no checkout da assinatura do Pilar (ADR 0028, SPEC 053).
-- O signup guarda o id da autorização criada no Asaas; as renovações seguem pelo
-- asaas_subscription_id, que o webhook preenche quando a autorização fica ativa.

alter table public.pilar_pending_signups
  add column if not exists asaas_pix_authorization_id text;

create index if not exists idx_pilar_pending_signups_pix_authorization
  on public.pilar_pending_signups (asaas_pix_authorization_id)
  where asaas_pix_authorization_id is not null;

alter table public.pilar_pending_signups
  drop constraint if exists pilar_pending_signups_billing_type_check;

alter table public.pilar_pending_signups
  add constraint pilar_pending_signups_billing_type_check
  check (billing_type in ('CREDIT_CARD', 'PIX', 'BOLETO', 'PIX_AUTOMATICO'));
