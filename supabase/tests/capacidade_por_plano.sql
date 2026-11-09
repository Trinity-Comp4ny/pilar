-- pgTAP: capacidade por módulo nos planos pagos (migration 20261130000000) e
-- textos de IA em créditos (migration 20261201000000).
--
-- Prova: limites_empresa() devolve obras e leads do plano para assinatura ativa
-- e deixa leads sem limite no trial; o trigger de leads trava na faixa, não
-- conta lead ganho nem excluído e ignora linha de outra empresa; obra trava
-- na faixa do plano; avisar_admin_capacidade fala de plano para quem assina; e
-- o aviso de saldo baixo do sino fala em créditos.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(17);

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

SELECT test_set_postgres();

-- Planos com faixas pequenas de propósito (supabase/seed.sql não roda em
-- --no-seed): 1 obra e 2 leads no Essencial deixam o teste curto.
INSERT INTO public.pilar_subscription_plans
  (slug, nome, preco_mensal, max_usuarios, max_projetos, max_obras, max_leads, tokens_mensais, destaque, ativo, ordem)
VALUES
  ('starter', 'Essencial', 299.00, NULL, 10, 1, 2, 500000, FALSE, TRUE, 1),
  ('pro', 'Profissional', 499.00, NULL, 30, 5, 200, 2000000, TRUE, TRUE, 2),
  ('enterprise', 'Escala', 899.00, NULL, NULL, 15, NULL, 8000000, FALSE, TRUE, 3)
ON CONFLICT (slug) DO UPDATE SET
  preco_mensal = EXCLUDED.preco_mensal, max_projetos = EXCLUDED.max_projetos,
  max_obras = EXCLUDED.max_obras, max_leads = EXCLUDED.max_leads,
  tokens_mensais = EXCLUDED.tokens_mensais, destaque = EXCLUDED.destaque, ativo = EXCLUDED.ativo;

-- Duas empresas pelo signup real: uma vira pagante (plano Essencial), a outra
-- fica no trial.
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role, email_confirmed_at)
VALUES
  ('c0de1111-0000-0000-0000-00000000000a'::uuid, 'cpp_paga@empresareal.com.br', jsonb_build_object('company_name', 'CPP Paga'), 'authenticated', 'authenticated', now()),
  ('c0de1111-0000-0000-0000-00000000000b'::uuid, 'cpp_trial@empresareal.com.br', jsonb_build_object('company_name', 'CPP Trial'), 'authenticated', 'authenticated', now());

UPDATE public.pilar_subscriptions SET status = 'active'
WHERE empresa_id = (SELECT id FROM public.empresas WHERE owner_id = 'c0de1111-0000-0000-0000-00000000000a');

-- =============================================
-- 1. limites_empresa(): plano pago traz obras e leads; trial não limita lead.
-- =============================================
SELECT is(
  (SELECT row(max_obras, max_leads)::text FROM public.limites_empresa(
     (SELECT id FROM public.empresas WHERE owner_id = 'c0de1111-0000-0000-0000-00000000000a'))),
  row(1, 2)::text,
  'pagante: max_obras e max_leads vêm do plano'
);
SELECT is(
  (SELECT max_leads FROM public.limites_empresa(
     (SELECT id FROM public.empresas WHERE owner_id = 'c0de1111-0000-0000-0000-00000000000b'))),
  NULL::integer,
  'trial: leads sem limite'
);

-- =============================================
-- 2. Leads: trava na faixa, ganho e excluído não ocupam vaga.
-- =============================================
SELECT test_set_auth('c0de1111-0000-0000-0000-00000000000a');
SELECT lives_ok(
  $$INSERT INTO public.leads (empresa_id, nome, status)
    VALUES ((SELECT empresa_id FROM public.profiles WHERE id = 'c0de1111-0000-0000-0000-00000000000a'), 'CPP Lead 1', 'Novo')$$,
  'pagante cria o 1º lead'
);
SELECT lives_ok(
  $$INSERT INTO public.leads (empresa_id, nome, status)
    VALUES ((SELECT empresa_id FROM public.profiles WHERE id = 'c0de1111-0000-0000-0000-00000000000a'), 'CPP Lead 2', 'Novo')$$,
  'pagante cria o 2º lead'
);
SELECT throws_ok(
  $$INSERT INTO public.leads (empresa_id, nome, status)
    VALUES ((SELECT empresa_id FROM public.profiles WHERE id = 'c0de1111-0000-0000-0000-00000000000a'), 'CPP Lead 3', 'Novo')$$,
  'P0001', 'capacidade:leads',
  'pagante trava no 3º lead ativo'
);
SELECT lives_ok(
  $$INSERT INTO public.leads (empresa_id, nome, status)
    VALUES ((SELECT empresa_id FROM public.profiles WHERE id = 'c0de1111-0000-0000-0000-00000000000a'), 'CPP Lead ganho', 'Ganho')$$,
  'lead que já nasce ganho não ocupa faixa'
);

SELECT test_set_postgres();
UPDATE public.leads SET deleted_at = now() WHERE nome = 'CPP Lead 1';
SELECT test_set_auth('c0de1111-0000-0000-0000-00000000000a');
SELECT lives_ok(
  $$INSERT INTO public.leads (empresa_id, nome, status)
    VALUES ((SELECT empresa_id FROM public.profiles WHERE id = 'c0de1111-0000-0000-0000-00000000000a'), 'CPP Lead 3', 'Novo')$$,
  'lead excluído libera a vaga'
);

-- =============================================
-- 3. Obras: trava na faixa do plano (antes, pagante não tinha limite de obra).
-- =============================================
SELECT lives_ok(
  $$INSERT INTO public.projetos (empresa_id, nome)
    VALUES ((SELECT empresa_id FROM public.profiles WHERE id = 'c0de1111-0000-0000-0000-00000000000a'), 'CPP Projeto')$$,
  'pagante cria projeto dentro da faixa'
);
SELECT lives_ok(
  $$INSERT INTO public.obras (empresa_id, projeto_id, nome)
    VALUES (
      (SELECT empresa_id FROM public.profiles WHERE id = 'c0de1111-0000-0000-0000-00000000000a'),
      (SELECT id FROM public.projetos WHERE nome = 'CPP Projeto'),
      'CPP Obra 1')$$,
  'pagante cria a 1ª obra'
);
SELECT throws_ok(
  $$INSERT INTO public.obras (empresa_id, projeto_id, nome)
    VALUES (
      (SELECT empresa_id FROM public.profiles WHERE id = 'c0de1111-0000-0000-0000-00000000000a'),
      (SELECT id FROM public.projetos WHERE nome = 'CPP Projeto'),
      'CPP Obra 2')$$,
  'P0001', 'capacidade:obras',
  'pagante trava na 2ª obra ativa (faixa do plano)'
);

-- =============================================
-- 4. Trial não trava lead; linha de outra empresa não passa pelo limite.
-- =============================================
SELECT test_set_auth('c0de1111-0000-0000-0000-00000000000b');
SELECT lives_ok(
  $$INSERT INTO public.leads (empresa_id, nome, status)
    SELECT (SELECT empresa_id FROM public.profiles WHERE id = 'c0de1111-0000-0000-0000-00000000000b'),
           'CPP Trial lead ' || g, 'Novo'
    FROM generate_series(1, 3) g$$,
  'trial cria 3 leads sem limite'
);

-- Superusuário com o JWT do pagante ainda na sessão (caso do rls_security):
-- o trigger não pode pedir os limites da outra empresa.
RESET ROLE;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', 'c0de1111-0000-0000-0000-00000000000a', 'role', 'authenticated')::text, true);
SELECT lives_ok(
  $$INSERT INTO public.leads (empresa_id, nome, status)
    VALUES ((SELECT id FROM public.empresas WHERE owner_id = 'c0de1111-0000-0000-0000-00000000000b'), 'CPP Lead de fora', 'Novo')$$,
  'lead de outra empresa não consulta os limites dela'
);

-- =============================================
-- 5. Aviso ao admin fala de plano para quem assina.
-- =============================================
SELECT test_set_auth('c0de1111-0000-0000-0000-00000000000a');
SELECT cmp_ok(
  public.avisar_admin_capacidade('leads'), '>=', 1,
  'avisar_admin_capacidade aceita leads'
);
SELECT is(
  (SELECT titulo FROM public.notificacoes
    WHERE destinatario_id = 'c0de1111-0000-0000-0000-00000000000a'
      AND tipo = 'capacidade_avisar_admin:leads'
    LIMIT 1),
  'Limite de leads do plano atingido',
  'pagante recebe o aviso de limite do plano, não do período de teste'
);

-- =============================================
-- 6. Grants e textos em créditos.
-- =============================================
SELECT test_set_postgres();
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.enforce_capacidade_leads()', 'EXECUTE'),
  'função do trigger de leads não é executável por authenticated'
);
SELECT ok(
  pg_get_functiondef('public.gerar_notificacoes_ambient()'::regprocedure) LIKE '%Créditos de IA acabando%',
  'aviso de saldo baixo fala em créditos'
);
SELECT ok(
  pg_get_functiondef('public.gerar_notificacoes_ambient()'::regprocedure) NOT LIKE '%tokens de IA neste ciclo%',
  'aviso de saldo baixo não fala mais em tokens'
);

SELECT * FROM finish();
ROLLBACK;
