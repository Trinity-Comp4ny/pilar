-- pgTAP: SPEC 165, planejamento mensal manual do físico-financeiro (obra_planejamento_mes).
-- Migration 20261234120000. Roda como usuário autenticado, para a RLS e as constraints valerem como no app.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(9);

-- ── Fixture: duas empresas, cada uma com um admin ─────────────────────────
INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features) VALUES
  ('00000000-0000-0000-0000-0000000b1651', 'Empresa A 165', NULL, TRUE, '{"obras": true}'::jsonb),
  ('00000000-0000-0000-0000-0000000b1652', 'Empresa B 165', NULL, TRUE, '{"obras": true}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Trial limita a 1 obra; a empresa A precisa de duas.
UPDATE public.empresas SET nivel_override = 'ouro', nivel_override_motivo = 'fixture_pre_existente'
WHERE id = '00000000-0000-0000-0000-0000000b1651';

SET LOCAL session_replication_role = 'replica';
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role) VALUES
  ('b1650000-0000-0000-0000-00000000000a', 'admin-a-165@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('b1650000-0000-0000-0000-00000000000b', 'admin-b-165@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed) VALUES
  ('b1650000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000b1651', 'Admin', 'A', 'admin-a-165@test.com', 'admin', TRUE),
  ('b1650000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000b1652', 'Admin', 'B', 'admin-b-165@test.com', 'admin', TRUE)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, empresa_id = EXCLUDED.empresa_id;
SET LOCAL session_replication_role = 'origin';

INSERT INTO public.obras (id, empresa_id, nome, created_by) VALUES
  ('b1650000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000b1651', 'Obra A1', 'b1650000-0000-0000-0000-00000000000a'),
  ('b1650000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000b1651', 'Obra A2', 'b1650000-0000-0000-0000-00000000000a'),
  ('b1650000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000b1652', 'Obra B1', 'b1650000-0000-0000-0000-00000000000b');

SELECT set_config('request.jwt.claims',
  json_build_object('sub', 'b1650000-0000-0000-0000-00000000000a', 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;

INSERT INTO public.obra_frente (id, empresa_id, obra_id, nome, nivel, parent_id) VALUES
  ('b1650000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000b1651', 'b1650000-0000-0000-0000-0000000000c1', 'Fase A1', 'fase', NULL),
  ('b1650000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000b1651', 'b1650000-0000-0000-0000-0000000000c2', 'Fase A2', 'fase', NULL);

-- ── Escrita válida ──────────────────────────────────────────────────────
SELECT lives_ok(
  $$INSERT INTO public.obra_planejamento_mes (id, empresa_id, obra_id, obra_frente_id, mes, percentual)
    VALUES ('b1650000-0000-0000-0000-000000000a01', '00000000-0000-0000-0000-0000000b1651',
            'b1650000-0000-0000-0000-0000000000c1', 'b1650000-0000-0000-0000-0000000000f1', '2026-11-01', 51.6129)$$,
  'admin grava o percentual de um mês no nó da própria obra'
);

SELECT is(
  (SELECT count(*)::int FROM public.obra_planejamento_mes WHERE obra_id = 'b1650000-0000-0000-0000-0000000000c1'),
  1,
  'a célula gravada aparece na leitura'
);

-- ── Constraints ─────────────────────────────────────────────────────────
SELECT throws_ok(
  $$INSERT INTO public.obra_planejamento_mes (empresa_id, obra_id, obra_frente_id, mes, percentual)
    VALUES ('00000000-0000-0000-0000-0000000b1651', 'b1650000-0000-0000-0000-0000000000c1',
            'b1650000-0000-0000-0000-0000000000f1', '2026-12-15', 10)$$,
  '23514', NULL,
  'mês que não é dia 1 é recusado'
);

SELECT throws_ok(
  $$INSERT INTO public.obra_planejamento_mes (empresa_id, obra_id, obra_frente_id, mes, percentual)
    VALUES ('00000000-0000-0000-0000-0000000b1651', 'b1650000-0000-0000-0000-0000000000c1',
            'b1650000-0000-0000-0000-0000000000f1', '2026-12-01', 100.0001)$$,
  '23514', NULL,
  'percentual acima de 100 é recusado'
);

SELECT throws_ok(
  $$INSERT INTO public.obra_planejamento_mes (empresa_id, obra_id, obra_frente_id, mes, percentual)
    VALUES ('00000000-0000-0000-0000-0000000b1651', 'b1650000-0000-0000-0000-0000000000c1',
            'b1650000-0000-0000-0000-0000000000f1', '2026-11-01', 20)$$,
  '23505', NULL,
  'o mesmo mês do mesmo nó não entra duas vezes'
);

-- ── RLS ────────────────────────────────────────────────────────────────
SELECT throws_ok(
  $$INSERT INTO public.obra_planejamento_mes (empresa_id, obra_id, obra_frente_id, mes, percentual)
    VALUES ('00000000-0000-0000-0000-0000000b1651', 'b1650000-0000-0000-0000-0000000000c1',
            'b1650000-0000-0000-0000-0000000000f2', '2026-12-01', 10)$$,
  '42501', NULL,
  'não dá para pendurar um mês da obra A1 no nó da obra A2'
);

SELECT throws_ok(
  $$INSERT INTO public.obra_planejamento_mes (empresa_id, obra_id, obra_frente_id, mes, percentual)
    VALUES ('00000000-0000-0000-0000-0000000b1652', 'b1650000-0000-0000-0000-0000000000d1',
            'b1650000-0000-0000-0000-0000000000f1', '2026-12-01', 10)$$,
  '42501', NULL,
  'não dá para gravar em nome de outra empresa'
);

SELECT set_config('request.jwt.claims',
  json_build_object('sub', 'b1650000-0000-0000-0000-00000000000b', 'role', 'authenticated')::text, true);

SELECT is(
  (SELECT count(*)::int FROM public.obra_planejamento_mes),
  0,
  'a empresa B não enxerga as células da empresa A'
);

WITH apagadas AS (
  DELETE FROM public.obra_planejamento_mes WHERE id = 'b1650000-0000-0000-0000-000000000a01' RETURNING 1
)
SELECT is((SELECT count(*)::int FROM apagadas), 0, 'a empresa B não apaga célula da empresa A');

SELECT * FROM finish();
ROLLBACK;
