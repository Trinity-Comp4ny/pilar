-- pgTAP: get_titulos_posicao (SPEC 149, fase 3; migration 20261203000000).
-- Os chips de A receber / A pagar contam o conjunto inteiro por vencimento, com a
-- mesma regra do filtro que aplicam, e só da empresa de quem chama (RLS da view).

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(8);

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features, nivel_override, nivel_override_motivo)
VALUES
  ('00000000-0000-0000-0000-0000000f1491', 'Empresa Posição', NULL, TRUE, '{"financeiro": true}'::jsonb, 'ouro', 'fixture_pre_existente'),
  ('00000000-0000-0000-0000-0000000f1492', 'Empresa Vizinha', NULL, TRUE, '{"financeiro": true}'::jsonb, 'ouro', 'fixture_pre_existente')
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

SET LOCAL session_replication_role = 'replica';
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES ('aaaaaaaa-f149-0000-0000-000000000011', 'admin_posicao@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
SET LOCAL session_replication_role = 'origin';

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed)
VALUES ('aaaaaaaa-f149-0000-0000-000000000011', '00000000-0000-0000-0000-0000000f1491', 'Admin', 'Posição', 'admin_posicao@test.com', 'admin', TRUE)
ON CONFLICT (id) DO NOTHING;

-- "Hoje" da função é o de São Paulo.
CREATE TEMP TABLE _h AS SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date AS d;

INSERT INTO public.despesas (empresa_id, descricao, valor, status, data_vencimento, data_pagamento)
SELECT '00000000-0000-0000-0000-0000000f1491', x.descricao, x.valor, x.status::status_financeiro, x.venc, x.pag
FROM _h, LATERAL (VALUES
  ('Vencida 1', 100::numeric, 'Pendente', _h.d - 3, NULL::date),
  ('Vencida 2', 50,  'Atrasado', _h.d - 40, NULL),
  ('Hoje',      70,  'Pendente', _h.d, NULL),
  ('Semana',    30,  'Pendente', _h.d + 7, NULL),
  ('Futuro',    20,  'Pendente', _h.d + 8, NULL),
  ('Paga no mês', 500, 'Pago', date_trunc('month', _h.d)::date, date_trunc('month', _h.d)::date),
  ('Cancelada', 999, 'Cancelado', _h.d - 1, NULL)
) AS x(descricao, valor, status, venc, pag);

-- Receita da mesma empresa e despesa da vizinha não entram na posição de despesas.
INSERT INTO public.receitas (empresa_id, descricao, valor, status, data_vencimento)
SELECT '00000000-0000-0000-0000-0000000f1491', 'Receita vencida', 800, 'Pendente', d - 2 FROM _h;
INSERT INTO public.despesas (empresa_id, descricao, valor, status, data_vencimento)
SELECT '00000000-0000-0000-0000-0000000f1492', 'Despesa da vizinha', 777, 'Pendente', d - 2 FROM _h;

CREATE OR REPLACE FUNCTION test_set_auth(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated', 'aal', 'aal2')::text,
    true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

SELECT test_set_auth('aaaaaaaa-f149-0000-0000-000000000011');

CREATE TEMP TABLE _p AS SELECT public.get_titulos_posicao('despesa') AS j;

SELECT is((SELECT (j->'vencidos'->>'qtd')::int FROM _p), 2, 'vencidos: em aberto com vencimento passado (Pendente ou Atrasado)');
SELECT is((SELECT (j->'vencidos'->>'valor')::numeric FROM _p), 150::numeric, 'vencidos: soma só da própria empresa, sem cancelado');
SELECT is((SELECT (j->'hoje'->>'valor')::numeric FROM _p), 70::numeric, 'hoje: vence hoje');
SELECT is((SELECT (j->'semana'->>'valor')::numeric FROM _p), 30::numeric, 'semana: de amanhã a hoje+7');
SELECT is((SELECT (j->'futuro'->>'valor')::numeric FROM _p), 20::numeric, 'futuro: de hoje+8 em diante');
SELECT is((SELECT (j->'pagos_mes'->>'valor')::numeric FROM _p), 500::numeric, 'pagos no mês: pagos com vencimento no mês');
SELECT is((SELECT (public.get_titulos_posicao('receita')->'vencidos'->>'valor')::numeric), 800::numeric, 'receita: posição separada da despesa');

SELECT throws_ok($$ SELECT public.get_titulos_posicao('transferencia') $$, NULL, 'tipo inválido é recusado');

SELECT * FROM finish();
ROLLBACK;
