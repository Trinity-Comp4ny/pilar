-- pgTAP: SPEC 098 Fase 2B (migration 20260935000000).
-- nivel_confianca ganha o ramo "ouro se cartão tokenizado"; notificar_ultra_admins
-- e o hardening de RLS em notificacoes (ultra_admin lê notificação de QUALQUER
-- empresa, não só a própria).

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(11);

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

INSERT INTO public.pilar_subscription_plans
  (slug, nome, preco_mensal, preco_anual, max_usuarios, max_projetos, tokens_mensais, destaque, ativo, ordem)
VALUES ('starter', 'Essencial', 490.00, 4900.00, NULL, 15, 500000, FALSE, TRUE, 1)
ON CONFLICT (slug) DO UPDATE SET ativo = TRUE, preco_anual = 4900.00;

-- Duas empresas trial: uma vai ganhar token (sobe a ouro), outra fica bronze
-- pra provar que o ramo novo não vaza pra quem não tokenizou.
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role, email_confirmed_at)
VALUES
  ('fab02222-0000-0000-0000-00000000000a', 'fase2b_token@empresareal.com.br', jsonb_build_object('company_name', 'Fase2B Token'), 'authenticated', 'authenticated', now()),
  ('fab02222-0000-0000-0000-00000000000b', 'fase2b_semtoken@empresareal.com.br', jsonb_build_object('company_name', 'Fase2B Sem Token'), 'authenticated', 'authenticated', now()),
  ('fab02222-0000-0000-0000-00000000000c', 'fase2b_ultra@empresareal.com.br', jsonb_build_object('company_name', 'Fase2B Ultra'), 'authenticated', 'authenticated', now());

-- =============================================
-- 1. nivel_confianca: ramo novo (token tokenizado sobe a ouro).
-- =============================================
UPDATE public.pilar_subscriptions
SET asaas_credit_card_token = 'tok_teste_123', asaas_credit_card_last4 = '4242', asaas_credit_card_brand = 'VISA'
WHERE empresa_id = (SELECT id FROM public.empresas WHERE owner_id = 'fab02222-0000-0000-0000-00000000000a');

SELECT is(
  public.nivel_confianca((SELECT id FROM public.empresas WHERE owner_id = 'fab02222-0000-0000-0000-00000000000a')),
  'ouro',
  'empresa com cartão tokenizado é ouro'
);
SELECT is(
  public.nivel_confianca((SELECT id FROM public.empresas WHERE owner_id = 'fab02222-0000-0000-0000-00000000000b')),
  'bronze',
  'empresa sem token nem documento continua bronze'
);

-- Override manual continua vencendo o token (ordem: override > token > documento > bronze).
UPDATE public.empresas
SET nivel_override = 'bronze', nivel_override_motivo = 'teste override vence token', nivel_override_por = 'fab02222-0000-0000-0000-00000000000c', nivel_override_em = now()
WHERE owner_id = 'fab02222-0000-0000-0000-00000000000a';

SELECT is(
  public.nivel_confianca((SELECT id FROM public.empresas WHERE owner_id = 'fab02222-0000-0000-0000-00000000000a')),
  'bronze',
  'nivel_override vence o token tokenizado (ordem de precedência)'
);

UPDATE public.empresas SET nivel_override = NULL, nivel_override_motivo = NULL WHERE owner_id = 'fab02222-0000-0000-0000-00000000000a';

SELECT is(
  public.nivel_confianca((SELECT id FROM public.empresas WHERE owner_id = 'fab02222-0000-0000-0000-00000000000a')),
  'ouro',
  'limpar o override, o token volta a valer'
);

-- =============================================
-- 2. notificar_ultra_admins + RLS de notificacoes com exceção pra ultra_admin.
-- =============================================
SELECT test_set_service();
UPDATE public.profiles SET role = 'ultra_admin' WHERE id = 'fab02222-0000-0000-0000-00000000000c';

SELECT lives_ok(
  $$SELECT public.notificar_ultra_admins(
    (SELECT id FROM public.empresas WHERE owner_id = 'fab02222-0000-0000-0000-00000000000a'),
    'ativar_plano_bloqueado_carding', 'Teste', 'Mensagem de teste', '/ultra-admin'
  )$$,
  'notificar_ultra_admins roda como service_role'
);

SELECT ok(
  (SELECT count(*) FROM public.notificacoes WHERE destinatario_id = 'fab02222-0000-0000-0000-00000000000c' AND tipo = 'ativar_plano_bloqueado_carding') = 1,
  'notificação foi criada pro ultra_admin'
);

-- O ponto real do hardening: o ultra_admin lendo como ELE MESMO (authenticated,
-- não postgres/service_role) precisa ver essa notificação mesmo ela sendo sobre
-- OUTRA empresa (fab02222-...a), não a própria empresa dele (fab02222-...c).
SELECT test_set_auth('fab02222-0000-0000-0000-00000000000c');
SELECT ok(
  (SELECT count(*) FROM public.notificacoes WHERE destinatario_id = 'fab02222-0000-0000-0000-00000000000c' AND tipo = 'ativar_plano_bloqueado_carding') = 1,
  'ultra_admin enxerga a notificação de outra empresa através de RLS (hardening desta migration)'
);

-- Admin comum (não ultra_admin) da própria empresa não pode disparar a notificação.
SELECT test_set_auth('fab02222-0000-0000-0000-00000000000a');
SELECT throws_ok(
  $$SELECT public.notificar_ultra_admins(
    (SELECT id FROM public.empresas WHERE owner_id = 'fab02222-0000-0000-0000-00000000000a'),
    'teste', 'Teste', 'Teste', NULL
  )$$,
  '42501', NULL,
  'notificar_ultra_admins recusa quem não é service_role'
);

-- =============================================
-- 3. Coluna preservar_dados/estender/etc da Fase 2A continua intacta (smoke,
--    já coberto em ultra_admin_trials.sql — só confere que a migration não
--    quebrou nada ali).
-- =============================================
SELECT has_column('pilar_subscriptions', 'asaas_credit_card_token', 'coluna nova existe');
SELECT has_column('pilar_subscriptions', 'asaas_credit_card_last4', 'coluna nova existe');
SELECT has_table('consentimentos_cobranca', 'tabela de consentimento existe');

SELECT * FROM finish();
ROLLBACK;
