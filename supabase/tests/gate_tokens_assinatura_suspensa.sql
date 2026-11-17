-- pgTAP: gate_tokens bloqueia IA com assinatura suspensa (migration 20261234170000).
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;
SELECT plan(3);

SELECT set_config('role', 'postgres', true);
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role, email_confirmed_at)
VALUES
  ('fce03333-0000-0000-0000-00000000000a', 'gate_susp@empresareal.com.br', jsonb_build_object('company_name', 'Gate Susp'), 'authenticated', 'authenticated', now()),
  ('fce03333-0000-0000-0000-00000000000b', 'gate_ativa@empresareal.com.br', jsonb_build_object('company_name', 'Gate Ativa'), 'authenticated', 'authenticated', now());

INSERT INTO public.pilar_subscription_plans (slug, nome, preco_mensal)
VALUES ('teste-gate-suspensa', 'Teste gate', 100) ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.pilar_subscriptions (empresa_id, plan_id, status, current_period_end)
SELECT e.id, (SELECT id FROM public.pilar_subscription_plans WHERE slug = 'teste-gate-suspensa'),
       CASE e.owner_id WHEN 'fce03333-0000-0000-0000-00000000000a' THEN 'canceled' ELSE 'active' END,
       CASE e.owner_id WHEN 'fce03333-0000-0000-0000-00000000000a' THEN now() - interval '1 day' ELSE NULL END
  FROM public.empresas e WHERE e.owner_id IN ('fce03333-0000-0000-0000-00000000000a', 'fce03333-0000-0000-0000-00000000000b')
ON CONFLICT (empresa_id) DO UPDATE SET status = EXCLUDED.status, current_period_end = EXCLUDED.current_period_end;

SELECT is(
  (SELECT bloqueado_motivo FROM public.gate_tokens((SELECT id FROM public.empresas WHERE owner_id = 'fce03333-0000-0000-0000-00000000000a'))),
  'assinatura_suspensa', 'empresa cancelada e vencida: IA bloqueada');
SELECT isnt(
  (SELECT bloqueado_motivo FROM public.gate_tokens((SELECT id FROM public.empresas WHERE owner_id = 'fce03333-0000-0000-0000-00000000000b'))),
  'assinatura_suspensa', 'empresa ativa: nao bloqueia por assinatura');
SELECT ok(
  has_function_privilege('service_role', 'public.empresa_assinatura_suspensa(uuid)', 'EXECUTE'),
  'service_role pode consultar a suspensao (crons de e-mail)');

SELECT * FROM finish();
ROLLBACK;
