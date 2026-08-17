-- pgTAP: spec 044 — get_finance_stats/chart_mensal/chart_periodo/categorias e a
-- extensão da view lancamentos (Asaas + recorrente/periodicidade). SECURITY INVOKER
-- (mesmo padrão de get_lancamentos_resumo/pagina): a garantia de isolamento vem da
-- RLS de receitas/despesas, não de um check manual — este teste prova que essa
-- garantia realmente segura, não só supõe.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(11);

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES
  ('00000000-0000-0000-0000-00000000fd0a', 'Empresa FinDash A', NULL, TRUE, '{"financeiro": true}'::jsonb),
  ('00000000-0000-0000-0000-00000000fd0b', 'Empresa FinDash B', NULL, TRUE, '{"financeiro": true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

SET LOCAL session_replication_role = 'replica';
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES
  ('aaaaaaaa-fd00-0000-0000-000000000001', 'admin_finda@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('bbbbbbbb-fd00-0000-0000-000000000001', 'admin_findb@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
SET LOCAL session_replication_role = 'origin';

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed, features)
VALUES
  ('aaaaaaaa-fd00-0000-0000-000000000001', '00000000-0000-0000-0000-00000000fd0a', 'Admin', 'A', 'admin_finda@test.com', 'admin', TRUE, '{"financeiro":"editor"}'::jsonb),
  ('bbbbbbbb-fd00-0000-0000-000000000001', '00000000-0000-0000-0000-00000000fd0b', 'Admin', 'B', 'admin_findb@test.com', 'admin', TRUE, '{"financeiro":"editor"}'::jsonb)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

-- Empresa A: 1000 em receita. Empresa B: 9999 em receita (valor bem diferente pra
-- qualquer vazamento aparecer óbvio nos totais).
INSERT INTO public.receitas (id, empresa_id, descricao, valor, status, data_vencimento, data_recebimento)
VALUES
  ('aa0000fd-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000fd0a', 'Receita A', 1000, 'Recebido', '2026-08-01', '2026-08-05'),
  ('bb0000fd-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000fd0b', 'Receita B', 9999, 'Recebido', '2026-08-01', '2026-08-05')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.despesas (id, empresa_id, descricao, valor, status, data_vencimento, data_pagamento)
VALUES
  ('aa1111fd-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000fd0a', 'Despesa A', 400, 'Pago', '2026-08-01', '2026-08-05'),
  ('bb1111fd-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000fd0b', 'Despesa B', 7777, 'Pago', '2026-08-01', '2026-08-05')
ON CONFLICT (id) DO NOTHING;

-- Helper: setar JWT de user autenticado (mesmo padrão de rls_security.sql; cada
-- arquivo de teste roda em transação/conexão própria, não herda do outro).
CREATE OR REPLACE FUNCTION test_set_auth(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated', 'aal', 'aal2')::text,
    true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

SELECT test_set_auth('aaaaaaaa-fd00-0000-0000-000000000001');

-- =============================================
-- get_finance_stats só enxerga a própria empresa
-- =============================================
SELECT is(
  (public.get_finance_stats('2026-08-01','2026-08-31')->>'receitas_total')::numeric,
  1000.00,
  'get_finance_stats: receitas_total é só da Empresa A'
);
SELECT is(
  (public.get_finance_stats('2026-08-01','2026-08-31')->>'despesas_total')::numeric,
  400.00,
  'get_finance_stats: despesas_total é só da Empresa A'
);
SELECT isnt(
  (public.get_finance_stats('2026-08-01','2026-08-31')->>'receitas_total')::numeric,
  9999.00,
  'get_finance_stats: NÃO vaza o valor da Empresa B'
);

-- =============================================
-- get_finance_chart_mensal / categorias / periodo: só a própria empresa
-- =============================================
SELECT is(
  (SELECT receitas FROM public.get_finance_chart_mensal('2026-08-01','2026-08-31')),
  1000.00,
  'get_finance_chart_mensal: só a receita da Empresa A'
);

SELECT is(
  (SELECT COALESCE(SUM(receitas), 0) FROM public.get_finance_chart_periodo('2026-08-01','2026-08-31')),
  1000.00,
  'get_finance_chart_periodo: só a receita da Empresa A'
);

SELECT is(
  (SELECT valor FROM public.get_finance_categorias('receitas','2026-08-01','2026-08-31')),
  1000.00,
  'get_finance_categorias: só a receita da Empresa A'
);

-- =============================================
-- get_lancamentos_pagina (view estendida): Asaas/recorrente só aparecem pro tipo certo
-- e nunca cruzam empresa
-- =============================================
SELECT is(
  (SELECT count(*)::int FROM public.get_lancamentos_pagina()),
  2,
  'get_lancamentos_pagina: só os 2 lançamentos da Empresa A (1 receita + 1 despesa)'
);

SELECT is(
  (SELECT count(*)::int FROM public.get_lancamentos_pagina() WHERE valor = 9999 OR valor = 7777),
  0,
  'get_lancamentos_pagina: nenhum valor da Empresa B aparece'
);

-- Troca pro admin da Empresa B e confere o espelho
SELECT test_set_auth('bbbbbbbb-fd00-0000-0000-000000000001');

SELECT is(
  (public.get_finance_stats('2026-08-01','2026-08-31')->>'receitas_total')::numeric,
  9999.00,
  'get_finance_stats: Empresa B vê só o próprio total (9999), não o da A'
);

-- =============================================
-- View lancamentos: Asaas só populado pra receita, recorrente/periodicidade só p/ despesa
-- (RESET ROLE: checagem estrutural, não depende de RLS/empresa)
-- =============================================
RESET ROLE;
SELECT is(
  (SELECT asaas_payment_id FROM public.lancamentos WHERE tipo = 'despesa' LIMIT 1),
  NULL::text,
  'view lancamentos: asaas_payment_id é sempre NULL pra despesa'
);
SELECT is(
  (SELECT recorrente FROM public.lancamentos WHERE tipo = 'receita' LIMIT 1),
  NULL::boolean,
  'view lancamentos: recorrente é sempre NULL pra receita'
);

SELECT * FROM finish();

ROLLBACK;
