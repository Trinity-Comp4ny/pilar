-- pgTAP: migration 20261012000000. Token do cartão fora do alcance de
-- authenticated (sem quebrar nivel_confianca), crons que faltavam agendados e
-- ops_saude_crons só para service_role.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(11);

-- =============================================
-- 1. Grants por coluna
-- =============================================

SELECT ok(
  NOT has_column_privilege('authenticated', 'public.pilar_subscriptions', 'asaas_credit_card_token', 'SELECT'),
  'authenticated não lê o token do cartão'
);

SELECT is(
  (SELECT count(*)::int
     FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'pilar_subscriptions'
      AND c.column_name <> 'asaas_credit_card_token'
      AND NOT has_column_privilege('authenticated', 'public.pilar_subscriptions', c.column_name, 'SELECT')),
  0,
  'authenticated lê toda coluna menos o token (coluna nova sem GRANT reprova aqui)'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.pilar_subscriptions', 'SELECT'),
  'anon não lê assinatura'
);

-- =============================================
-- 2. nivel_confianca continua funcionando como authenticated
-- =============================================

INSERT INTO public.pilar_subscription_plans
  (slug, nome, preco_mensal, max_usuarios, max_projetos, tokens_mensais, destaque, ativo, ordem)
VALUES ('starter', 'Essencial', 490.00, NULL, 15, 500000, FALSE, TRUE, 1)
ON CONFLICT (slug) DO UPDATE SET ativo = TRUE;

INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role, email_confirmed_at)
VALUES ('10500000-0000-0000-0000-000000000001', 'prontidao_cartao@empresareal.com.br',
        jsonb_build_object('company_name', 'Prontidao Cartao'), 'authenticated', 'authenticated', now());

UPDATE public.pilar_subscriptions s
   SET asaas_credit_card_token = 'tok_teste'
  FROM public.profiles p
 WHERE p.id = '10500000-0000-0000-0000-000000000001' AND s.empresa_id = p.empresa_id;

SELECT ok(
  (SELECT s.cartao_cadastrado FROM public.pilar_subscriptions s
     JOIN public.profiles p ON p.empresa_id = s.empresa_id
    WHERE p.id = '10500000-0000-0000-0000-000000000001'),
  'cartao_cadastrado reflete o token'
);

SELECT set_config('request.jwt.claims',
  json_build_object('sub', '10500000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;

SELECT is(
  public.nivel_confianca((SELECT empresa_id FROM public.profiles WHERE id = '10500000-0000-0000-0000-000000000001')),
  'ouro',
  'nivel_confianca como authenticated: cartão cadastrado = ouro'
);

SELECT is(
  (SELECT cartao_cadastrado FROM public.pilar_subscriptions LIMIT 1),
  true,
  'authenticated lê cartao_cadastrado da própria assinatura'
);

SELECT throws_ok(
  $$SELECT asaas_credit_card_token FROM public.pilar_subscriptions$$,
  '42501',
  NULL,
  'select do token como authenticated é negado'
);

SELECT throws_ok(
  $$SELECT public.ops_saude_crons()$$,
  '42501',
  NULL,
  'authenticated não executa ops_saude_crons'
);

RESET ROLE;
SELECT set_config('request.jwt.claims', '', true);

-- =============================================
-- 3. Crons e saúde
-- =============================================

SELECT ok(
  public.ops_saude_crons() ? 'secrets_faltando',
  'ops_saude_crons devolve a lista de secrets faltando'
);

-- pg_cron só existe nos projetos remotos: localmente/CI a checagem vira
-- "não se aplica" em vez de erro de parse.
CREATE OR REPLACE FUNCTION pg_temp.job_agendado(p_nome text, p_schedule text)
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE v boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RETURN true;
  END IF;
  EXECUTE 'SELECT EXISTS (SELECT 1 FROM cron.job WHERE jobname = $1 AND schedule = $2)' INTO v USING p_nome, p_schedule;
  RETURN v;
END; $$;

SELECT ok(pg_temp.job_agendado('reverificar-documentos-daily', '45 6 * * *'), 'reverificar-documentos-daily agendado');
SELECT ok(pg_temp.job_agendado('renova-ciclo-tokens', '5 3 1 * *'), 'renova-ciclo-tokens agendado no dia 1');

SELECT * FROM finish();
ROLLBACK;
