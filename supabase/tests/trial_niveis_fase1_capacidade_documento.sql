-- pgTAP: SPEC 098 Fase 1 (migration 20260921000000). Prova nivel_confianca(),
-- limites_empresa(), capacidade real de projetos/obras por nível, projeto de
-- exemplo fora da contagem, gate_tokens por nível (sobe de nível concede só a
-- diferença), e RLS de trial_niveis.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(32);

CREATE OR REPLACE FUNCTION test_set_auth(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

CREATE OR REPLACE FUNCTION test_set_service()
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  PERFORM set_config('role', 'service_role', true);
END; $$;

CREATE OR REPLACE FUNCTION test_set_postgres()
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('role', 'postgres', true);
END; $$;

SELECT test_set_postgres();

-- Seed mínimo de planos (supabase/seed.sql não roda em --no-seed).
INSERT INTO public.pilar_subscription_plans
  (slug, nome, preco_mensal, max_usuarios, max_projetos, tokens_mensais, destaque, ativo, ordem)
VALUES
  ('starter', 'Essencial', 490.00, NULL, 15, 500000, FALSE, TRUE, 1),
  ('pro', 'Profissional', 690.00, NULL, 40, 2000000, TRUE, TRUE, 2),
  ('enterprise', 'Escala', 1290.00, NULL, NULL, 8000000, FALSE, TRUE, 3)
ON CONFLICT (slug) DO UPDATE SET
  preco_mensal = EXCLUDED.preco_mensal, tokens_mensais = EXCLUDED.tokens_mensais,
  destaque = EXCLUDED.destaque, ativo = EXCLUDED.ativo;

-- =============================================
-- Setup: 4 empresas via signup real (sem replica bypass) — Bronze, Prata
-- (documento setado depois), Ouro/legado (override), Ativa (pagante).
-- =============================================

INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role, email_confirmed_at)
VALUES
  ('fb1e1111-0000-0000-0000-00000000000a', 'f1_bronze@empresareal.com.br', jsonb_build_object('company_name', 'F1 Bronze'), 'authenticated', 'authenticated', now()),
  ('fb1e1111-0000-0000-0000-00000000000b', 'f1_prata@empresareal.com.br', jsonb_build_object('company_name', 'F1 Prata'), 'authenticated', 'authenticated', now()),
  ('fb1e1111-0000-0000-0000-00000000000c', 'f1_legado@empresareal.com.br', jsonb_build_object('company_name', 'F1 Legado'), 'authenticated', 'authenticated', now()),
  ('fb1e1111-0000-0000-0000-00000000000d', 'f1_ativa@empresareal.com.br', jsonb_build_object('company_name', 'F1 Ativa'), 'authenticated', 'authenticated', now()),
  ('fb1e1111-0000-0000-0000-00000000000e', 'f1_outra@empresareal.com.br', jsonb_build_object('company_name', 'F1 Outra'), 'authenticated', 'authenticated', now());

UPDATE public.empresas SET cnpj = '11222333000181', documento_tipo = 'cnpj', documento_verificacao = 'verificado', documento_verificado_em = now()
WHERE owner_id = 'fb1e1111-0000-0000-0000-00000000000b';

UPDATE public.empresas SET nivel_override = 'ouro', nivel_override_motivo = 'legado', nivel_override_em = now()
WHERE owner_id = 'fb1e1111-0000-0000-0000-00000000000c';

UPDATE public.pilar_subscriptions SET status = 'active'
WHERE empresa_id = (SELECT id FROM public.empresas WHERE owner_id = 'fb1e1111-0000-0000-0000-00000000000d');

-- =============================================
-- 1. nivel_confianca()
-- =============================================
SELECT is(
  public.nivel_confianca((SELECT id FROM public.empresas WHERE owner_id = 'fb1e1111-0000-0000-0000-00000000000a')),
  'bronze', 'empresa sem documento e sem override: bronze'
);
SELECT is(
  public.nivel_confianca((SELECT id FROM public.empresas WHERE owner_id = 'fb1e1111-0000-0000-0000-00000000000b')),
  'prata', 'empresa com CNPJ verificado: prata'
);
SELECT is(
  public.nivel_confianca((SELECT id FROM public.empresas WHERE owner_id = 'fb1e1111-0000-0000-0000-00000000000c')),
  'ouro', 'empresa com override manual: ouro, mesmo sem documento'
);

-- =============================================
-- 2. limites_empresa(): trial por nível, ouro ilimitado, pagante usa plano.
-- =============================================
SELECT is(
  (SELECT max_projetos FROM public.limites_empresa((SELECT id FROM public.empresas WHERE owner_id = 'fb1e1111-0000-0000-0000-00000000000a'))),
  2, 'Bronze: max_projetos = 2'
);
SELECT is(
  (SELECT max_obras FROM public.limites_empresa((SELECT id FROM public.empresas WHERE owner_id = 'fb1e1111-0000-0000-0000-00000000000a'))),
  1, 'Bronze: max_obras = 1'
);
SELECT is(
  (SELECT max_projetos FROM public.limites_empresa((SELECT id FROM public.empresas WHERE owner_id = 'fb1e1111-0000-0000-0000-00000000000b'))),
  5, 'Prata: max_projetos = 5'
);
SELECT is(
  (SELECT max_projetos FROM public.limites_empresa((SELECT id FROM public.empresas WHERE owner_id = 'fb1e1111-0000-0000-0000-00000000000c'))),
  NULL::integer, 'Ouro/legado: max_projetos ilimitado'
);
SELECT is(
  (SELECT max_projetos FROM public.limites_empresa((SELECT id FROM public.empresas WHERE owner_id = 'fb1e1111-0000-0000-0000-00000000000d'))),
  15, 'Ativa (pagante, plano Essencial): max_projetos = 15, vem do plano'
);

SELECT test_set_auth('fb1e1111-0000-0000-0000-00000000000e');
SELECT throws_ok(
  $$SELECT * FROM public.limites_empresa((SELECT id FROM public.empresas WHERE owner_id = 'fb1e1111-0000-0000-0000-00000000000a'))$$,
  '42501',
  NULL,
  'usuário de uma empresa não pode ler limites_empresa de outra empresa'
);
SELECT test_set_postgres();

-- =============================================
-- 3. Capacidade de projetos: Bronze trava no 3º (exemplo não conta).
-- =============================================
SELECT is(
  (SELECT count(*)::int FROM public.projetos p JOIN public.empresas e ON e.id = p.empresa_id
   WHERE e.owner_id = 'fb1e1111-0000-0000-0000-00000000000a' AND p.exemplo = true),
  1, 'signup self-serve cria 1 projeto de exemplo'
);

SELECT test_set_auth('fb1e1111-0000-0000-0000-00000000000a');
SELECT lives_ok(
  $$INSERT INTO public.projetos (empresa_id, nome)
    VALUES ((SELECT empresa_id FROM public.profiles WHERE id = 'fb1e1111-0000-0000-0000-00000000000a'), 'Projeto Bronze 1')$$,
  'Bronze cria o 1º projeto próprio (exemplo não contou)'
);
SELECT lives_ok(
  $$INSERT INTO public.projetos (empresa_id, nome)
    VALUES ((SELECT empresa_id FROM public.profiles WHERE id = 'fb1e1111-0000-0000-0000-00000000000a'), 'Projeto Bronze 2')$$,
  'Bronze cria o 2º projeto próprio'
);
SELECT throws_ok(
  $$INSERT INTO public.projetos (empresa_id, nome)
    VALUES ((SELECT empresa_id FROM public.profiles WHERE id = 'fb1e1111-0000-0000-0000-00000000000a'), 'Projeto Bronze 3')$$,
  'P0001', 'capacidade:projetos',
  'Bronze trava no 3º projeto ativo'
);

SELECT test_set_postgres();
UPDATE public.projetos SET status = 'Concluído'
WHERE nome = 'Projeto Bronze 2' AND empresa_id = (SELECT empresa_id FROM public.profiles WHERE id = 'fb1e1111-0000-0000-0000-00000000000a');
SELECT test_set_auth('fb1e1111-0000-0000-0000-00000000000a');
SELECT lives_ok(
  $$INSERT INTO public.projetos (empresa_id, nome)
    VALUES ((SELECT empresa_id FROM public.profiles WHERE id = 'fb1e1111-0000-0000-0000-00000000000a'), 'Projeto Bronze 3 (depois de concluir um)')$$,
  'projeto concluído libera vaga: Bronze cria o 3º depois de um Concluído'
);

SELECT test_set_postgres();
INSERT INTO public.projetos (empresa_id, nome, exemplo) VALUES
  ((SELECT id FROM public.empresas WHERE owner_id = 'fb1e1111-0000-0000-0000-00000000000b'), 'Projeto Prata 1', false),
  ((SELECT id FROM public.empresas WHERE owner_id = 'fb1e1111-0000-0000-0000-00000000000b'), 'Projeto Prata 2', false),
  ((SELECT id FROM public.empresas WHERE owner_id = 'fb1e1111-0000-0000-0000-00000000000b'), 'Projeto Prata 3', false),
  ((SELECT id FROM public.empresas WHERE owner_id = 'fb1e1111-0000-0000-0000-00000000000b'), 'Projeto Prata 4', false);
SELECT test_set_auth('fb1e1111-0000-0000-0000-00000000000b');
SELECT lives_ok(
  $$INSERT INTO public.projetos (empresa_id, nome)
    VALUES ((SELECT empresa_id FROM public.profiles WHERE id = 'fb1e1111-0000-0000-0000-00000000000b'), 'Projeto Prata 5')$$,
  'Prata cria o 5º projeto (teto maior que Bronze)'
);
SELECT throws_ok(
  $$INSERT INTO public.projetos (empresa_id, nome)
    VALUES ((SELECT empresa_id FROM public.profiles WHERE id = 'fb1e1111-0000-0000-0000-00000000000b'), 'Projeto Prata 6')$$,
  'P0001', 'capacidade:projetos',
  'Prata trava no 6º projeto ativo'
);

SELECT test_set_postgres();
SELECT lives_ok(
  $$INSERT INTO public.projetos (empresa_id, nome)
    VALUES ((SELECT id FROM public.empresas WHERE owner_id = 'fb1e1111-0000-0000-0000-00000000000c'), 'Projeto Legado sem limite')$$,
  'empresa legada (override ouro) não tem teto de projetos'
);
SELECT lives_ok(
  $$INSERT INTO public.projetos (empresa_id, nome)
    VALUES ((SELECT id FROM public.empresas WHERE owner_id = 'fb1e1111-0000-0000-0000-00000000000c'), 'Projeto Legado 2')$$,
  'segundo projeto também passa livre pra empresa legada'
);
SELECT lives_ok(
  $$INSERT INTO public.projetos (empresa_id, nome)
    VALUES ((SELECT id FROM public.empresas WHERE owner_id = 'fb1e1111-0000-0000-0000-00000000000d'), 'Projeto Ativa (dentro do plano)')$$,
  'empresa ativa (pagante) cria projeto normalmente via service_role/setup'
);

-- =============================================
-- 4. Capacidade de obras: Bronze trava na 2ª (max_obras=1).
-- =============================================
SELECT test_set_auth('fb1e1111-0000-0000-0000-00000000000a');
SELECT lives_ok(
  $$INSERT INTO public.obras (empresa_id, projeto_id, nome)
    VALUES (
      (SELECT empresa_id FROM public.profiles WHERE id = 'fb1e1111-0000-0000-0000-00000000000a'),
      (SELECT id FROM public.projetos WHERE nome = 'Projeto Bronze 1'),
      'Obra Bronze 1'
    )$$,
  'Bronze cria a 1ª obra'
);
SELECT throws_ok(
  $$INSERT INTO public.obras (empresa_id, projeto_id, nome)
    VALUES (
      (SELECT empresa_id FROM public.profiles WHERE id = 'fb1e1111-0000-0000-0000-00000000000a'),
      (SELECT id FROM public.projetos WHERE nome = 'Projeto Bronze 3 (depois de concluir um)'),
      'Obra Bronze 2'
    )$$,
  'P0001', 'capacidade:obras',
  'Bronze trava na 2ª obra ativa (max_obras=1)'
);

-- =============================================
-- 5. gate_tokens por nível: Bronze recebe 50k, sobe pra Prata recebe só a
--    diferença (100k), Ouro/legado e Ativa mantêm cota mensal do plano.
-- =============================================
SELECT test_set_postgres();
DO $$
DECLARE v_empresa uuid;
BEGIN
  SELECT id INTO v_empresa FROM public.empresas WHERE owner_id = 'fb1e1111-0000-0000-0000-00000000000a';
  PERFORM public.gate_tokens(v_empresa);
END $$;
SELECT is(
  (SELECT s.saldo_plano FROM public.ai_token_saldo s JOIN public.empresas e ON e.id = s.empresa_id
   WHERE e.owner_id = 'fb1e1111-0000-0000-0000-00000000000a'),
  50000::bigint, 'trial Bronze recebe 50.000 tokens (trial_niveis, não mais valor fixo da Fase 0)'
);

DO $$
DECLARE v_empresa uuid;
BEGIN
  SELECT id INTO v_empresa FROM public.empresas WHERE owner_id = 'fb1e1111-0000-0000-0000-00000000000b';
  PERFORM public.gate_tokens(v_empresa); -- ainda bronze nesse instante? não, já é prata (CNPJ setado antes)
END $$;
SELECT is(
  (SELECT s.saldo_plano FROM public.ai_token_saldo s JOIN public.empresas e ON e.id = s.empresa_id
   WHERE e.owner_id = 'fb1e1111-0000-0000-0000-00000000000b'),
  150000::bigint, 'empresa já Prata desde o início recebe 150.000 direto (não passa por Bronze)'
);

-- Empresa nova que sobe de Bronze pra Prata NO MEIO do trial: recebe só a diferença.
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role, email_confirmed_at)
VALUES ('fb1e1111-0000-0000-0000-00000000000f', 'f1_sobe@empresareal.com.br', jsonb_build_object('company_name', 'F1 Sobe'), 'authenticated', 'authenticated', now());

DO $$
DECLARE v_empresa uuid;
BEGIN
  SELECT id INTO v_empresa FROM public.empresas WHERE owner_id = 'fb1e1111-0000-0000-0000-00000000000f';
  PERFORM public.gate_tokens(v_empresa); -- Bronze: 50k
END $$;

UPDATE public.empresas SET cnpj = '11444777000161', documento_tipo = 'cnpj', documento_verificacao = 'verificado', documento_verificado_em = now()
WHERE owner_id = 'fb1e1111-0000-0000-0000-00000000000f';

DO $$
DECLARE v_empresa uuid;
BEGIN
  SELECT id INTO v_empresa FROM public.empresas WHERE owner_id = 'fb1e1111-0000-0000-0000-00000000000f';
  PERFORM public.gate_tokens(v_empresa); -- sobe pra Prata: deveria virar 150k no total
END $$;
SELECT is(
  (SELECT s.saldo_plano FROM public.ai_token_saldo s JOIN public.empresas e ON e.id = s.empresa_id
   WHERE e.owner_id = 'fb1e1111-0000-0000-0000-00000000000f'),
  150000::bigint, 'sobe de Bronze (50k) pra Prata (150k): saldo final é 150k, não 200k (concede só a diferença)'
);
SELECT is(
  (SELECT count(*)::int FROM public.ai_token_ledger t JOIN public.empresas e ON e.id = t.empresa_id
   WHERE e.owner_id = 'fb1e1111-0000-0000-0000-00000000000f' AND t.reference_id LIKE 'trial_grant:%'),
  2, 'duas concessões distintas no ledger (bronze e prata), nenhuma duplicada'
);

DO $$
DECLARE v_empresa uuid;
BEGIN
  SELECT id INTO v_empresa FROM public.empresas WHERE owner_id = 'fb1e1111-0000-0000-0000-00000000000c';
  PERFORM public.gate_tokens(v_empresa);
END $$;
SELECT ok(
  (SELECT s.saldo_plano FROM public.ai_token_saldo s JOIN public.empresas e ON e.id = s.empresa_id
   WHERE e.owner_id = 'fb1e1111-0000-0000-0000-00000000000c') > 150000,
  'empresa legada (override ouro) recebe cota mensal do plano, maior que qualquer teto de trial'
);

DO $$
DECLARE v_empresa uuid;
BEGIN
  SELECT id INTO v_empresa FROM public.empresas WHERE owner_id = 'fb1e1111-0000-0000-0000-00000000000d';
  PERFORM public.gate_tokens(v_empresa);
END $$;
SELECT is(
  (SELECT count(*)::int FROM public.ai_token_ledger t JOIN public.empresas e ON e.id = t.empresa_id
   WHERE e.owner_id = 'fb1e1111-0000-0000-0000-00000000000d' AND t.reference_id LIKE 'trial_grant:%'),
  0, 'empresa ativa (pagante) nunca recebe trial_grant'
);

-- =============================================
-- 6. RLS de trial_niveis: leitura pra qualquer autenticado, escrita só ultra_admin.
-- =============================================
SELECT test_set_auth('fb1e1111-0000-0000-0000-00000000000a');
SELECT is(
  (SELECT count(*)::int FROM public.trial_niveis), 3,
  'qualquer autenticado lê os 3 níveis de trial_niveis'
);
-- RLS bloqueada por USING não lança exceção: só afeta 0 linhas, em silêncio.
UPDATE public.trial_niveis SET max_projetos = 999 WHERE nivel = 'bronze';
SELECT is(
  (SELECT max_projetos FROM public.trial_niveis WHERE nivel = 'bronze'),
  2, 'admin comum (não ultra_admin) tenta editar trial_niveis e a linha não muda (RLS bloqueou em silêncio)'
);

SELECT test_set_service();
UPDATE public.profiles SET role = 'ultra_admin' WHERE id = 'fb1e1111-0000-0000-0000-00000000000a';
SELECT test_set_auth('fb1e1111-0000-0000-0000-00000000000a');
SELECT lives_ok(
  $$UPDATE public.trial_niveis SET max_projetos = 3 WHERE nivel = 'bronze'$$,
  'ultra_admin consegue editar trial_niveis'
);
SELECT test_set_postgres();
UPDATE public.trial_niveis SET max_projetos = 2 WHERE nivel = 'bronze'; -- devolve o valor original

-- =============================================
-- 7. CNPJ único entre empresas.
-- =============================================
SELECT throws_ok(
  $$UPDATE public.empresas SET cnpj = '11222333000181' WHERE owner_id = 'fb1e1111-0000-0000-0000-00000000000e'$$,
  '23505', NULL,
  'CNPJ já usado por outra empresa é recusado pelo índice único'
);

-- =============================================
-- 8. gate_tokens: apenas service_role/postgres (regra herdada, checagem de não-regressão).
-- =============================================
SELECT test_set_auth('fb1e1111-0000-0000-0000-00000000000a');
SELECT throws_ok(
  $$SELECT public.gate_tokens((SELECT id FROM public.empresas WHERE owner_id = 'fb1e1111-0000-0000-0000-00000000000a'))$$,
  '42501', NULL,
  'usuário autenticado comum não pode chamar gate_tokens diretamente'
);

SELECT * FROM finish();
ROLLBACK;
