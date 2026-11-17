-- pgTAP: bloqueio de escrita com assinatura suspensa (migration 20261234150000).
-- empresa_assinatura_suspensa() + enforce_empresa_nao_leitura() estendido.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(12);

CREATE OR REPLACE FUNCTION test_set_auth(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

CREATE OR REPLACE FUNCTION test_set_postgres()
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('role', 'postgres', true);
END; $$;

CREATE OR REPLACE FUNCTION test_set_service()
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  PERFORM set_config('role', 'service_role', true);
END; $$;

SELECT test_set_postgres();

INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role, email_confirmed_at)
VALUES
  ('fce02222-0000-0000-0000-00000000000a', 'sus_cancelada@empresareal.com.br', jsonb_build_object('company_name', 'SUS Cancelada'), 'authenticated', 'authenticated', now()),
  ('fce02222-0000-0000-0000-00000000000b', 'sus_periodo@empresareal.com.br', jsonb_build_object('company_name', 'SUS Periodo'), 'authenticated', 'authenticated', now()),
  ('fce02222-0000-0000-0000-00000000000c', 'sus_atraso@empresareal.com.br', jsonb_build_object('company_name', 'SUS Atraso'), 'authenticated', 'authenticated', now()),
  ('fce02222-0000-0000-0000-00000000000d', 'sus_ativa@empresareal.com.br', jsonb_build_object('company_name', 'SUS Ativa'), 'authenticated', 'authenticated', now());

-- A: cancelada com periodo encerrado. B: cancelada com periodo pago ainda correndo.
-- C: em atraso. D: ativa. Upsert (nao UPDATE): o teste nao depende de o cadastro ja
-- ter criado a linha de assinatura.
-- O banco de teste nao traz plano: cria um (a transacao e revertida no fim).
INSERT INTO public.pilar_subscription_plans (slug, nome, preco_mensal)
VALUES ('teste-bloqueio-suspensa', 'Teste bloqueio', 100)
ON CONFLICT (slug) DO NOTHING;

CREATE OR REPLACE FUNCTION test_assinatura(p_owner uuid, p_status text, p_fim timestamptz)
RETURNS VOID LANGUAGE sql AS $f$
  INSERT INTO public.pilar_subscriptions (empresa_id, plan_id, status, current_period_end)
  SELECT e.id, (SELECT id FROM public.pilar_subscription_plans WHERE slug = 'teste-bloqueio-suspensa'), p_status, p_fim
    FROM public.empresas e WHERE e.owner_id = p_owner
  ON CONFLICT (empresa_id) DO UPDATE SET status = EXCLUDED.status, current_period_end = EXCLUDED.current_period_end;
$f$;

SELECT test_assinatura('fce02222-0000-0000-0000-00000000000a', 'canceled', now() - interval '1 day');
SELECT test_assinatura('fce02222-0000-0000-0000-00000000000b', 'canceled', now() + interval '10 days');
SELECT test_assinatura('fce02222-0000-0000-0000-00000000000c', 'overdue', NULL);
SELECT test_assinatura('fce02222-0000-0000-0000-00000000000d', 'active', NULL);

-- 0: o setup gravou a assinatura da empresa A como cancelada.
SELECT is(
  (SELECT status FROM public.pilar_subscriptions WHERE empresa_id = (SELECT id FROM public.empresas WHERE owner_id = 'fce02222-0000-0000-0000-00000000000a')),
  'canceled',
  'setup: assinatura da empresa A esta cancelada'
);

-- 1-4: a funcao decide por status.
SELECT ok(public.empresa_assinatura_suspensa((SELECT id FROM public.empresas WHERE owner_id = 'fce02222-0000-0000-0000-00000000000a')),
  'cancelada com periodo encerrado esta suspensa');
SELECT ok(NOT public.empresa_assinatura_suspensa((SELECT id FROM public.empresas WHERE owner_id = 'fce02222-0000-0000-0000-00000000000b')),
  'cancelada com periodo pago correndo NAO esta suspensa');
SELECT ok(NOT public.empresa_assinatura_suspensa((SELECT id FROM public.empresas WHERE owner_id = 'fce02222-0000-0000-0000-00000000000c')),
  'em atraso NAO esta suspensa (so avisa)');
SELECT ok(NOT public.empresa_assinatura_suspensa(gen_random_uuid()),
  'empresa sem linha de assinatura NAO esta suspensa');

-- 5-6: empresa suspensa nao escreve (INSERT e UPDATE), mas le.
SELECT test_set_auth('fce02222-0000-0000-0000-00000000000a');
SELECT throws_ok(
  $$INSERT INTO public.projetos (empresa_id, nome) VALUES (
    (SELECT id FROM public.empresas WHERE owner_id = 'fce02222-0000-0000-0000-00000000000a'), 'Projeto bloqueado'
  )$$,
  'P0001', 'empresa_assinatura_suspensa',
  'INSERT em projetos e recusado com a assinatura cancelada e vencida'
);
SELECT throws_ok(
  format(
    $$UPDATE public.projetos SET nome = 'renomeado' WHERE id = %L$$,
    (SELECT id FROM public.projetos WHERE empresa_id = (SELECT id FROM public.empresas WHERE owner_id = 'fce02222-0000-0000-0000-00000000000a') LIMIT 1)
  ),
  'P0001', 'empresa_assinatura_suspensa',
  'UPDATE em projetos e recusado com a assinatura suspensa'
);
SELECT lives_ok(
  $$SELECT count(*) FROM public.projetos WHERE empresa_id = (SELECT id FROM public.empresas WHERE owner_id = 'fce02222-0000-0000-0000-00000000000a')$$,
  'SELECT continua liberado com a assinatura suspensa'
);

-- 8: cancelada dentro do periodo pago escreve normalmente.
SELECT test_set_auth('fce02222-0000-0000-0000-00000000000b');
SELECT lives_ok(
  $$INSERT INTO public.projetos (empresa_id, nome) VALUES (
    (SELECT id FROM public.empresas WHERE owner_id = 'fce02222-0000-0000-0000-00000000000b'), 'Projeto no periodo pago'
  )$$,
  'cancelada com periodo pago correndo continua escrevendo'
);

-- 9: ativa escreve.
SELECT test_set_auth('fce02222-0000-0000-0000-00000000000d');
SELECT lives_ok(
  $$INSERT INTO public.projetos (empresa_id, nome) VALUES (
    (SELECT id FROM public.empresas WHERE owner_id = 'fce02222-0000-0000-0000-00000000000d'), 'Projeto ativo'
  )$$,
  'empresa ativa escreve normalmente'
);

-- 10: service_role passa direto mesmo suspensa (webhook, cron, reativacao).
SELECT test_set_service();
SELECT lives_ok(
  $$INSERT INTO public.projetos (empresa_id, nome) VALUES (
    (SELECT id FROM public.empresas WHERE owner_id = 'fce02222-0000-0000-0000-00000000000a'), 'Via service_role'
  )$$,
  'service_role escreve mesmo com a assinatura suspensa'
);

-- 11: pilar_subscriptions fica fora da trava (a reativacao nao pode travar).
SELECT test_set_postgres();
SELECT ok(
  NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_enforce_empresa_nao_leitura' AND tgrelid = 'public.pilar_subscriptions'::regclass),
  'pilar_subscriptions segue fora da trava'
);

SELECT * FROM finish();
ROLLBACK;
