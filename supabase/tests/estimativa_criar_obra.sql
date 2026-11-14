-- pgTAP: SPEC 136, requisito 11 (BEZ-19), criar a obra a partir da estimativa (migration 20261228000100).
-- Roda como usuário autenticado, para a RLS e os triggers (capacidade, hierarquia do cronograma) valerem como no app.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(14);

-- ── Fixture ──────────────────────────────────────────────────────────────────
INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features) VALUES
  ('00000000-0000-0000-0000-0000000b1901', 'Empresa Criar Obra A', NULL, TRUE, '{"obras": true, "estimativa_obra": true}'::jsonb),
  ('00000000-0000-0000-0000-0000000b1902', 'Empresa Criar Obra B', NULL, TRUE, '{"obras": true, "estimativa_obra": true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

SET LOCAL session_replication_role = 'replica';
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role) VALUES
  ('b1900000-0000-0000-0000-00000000000a', 'user-a-b19@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('b1900000-0000-0000-0000-00000000000b', 'user-b-b19@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed) VALUES
  ('b1900000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000b1901', 'A', 'B19', 'user-a-b19@test.com', 'admin', TRUE),
  ('b1900000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000b1902', 'B', 'B19', 'user-b-b19@test.com', 'admin', TRUE)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, empresa_id = EXCLUDED.empresa_id;
SET LOCAL session_replication_role = 'origin';

INSERT INTO public.clientes (id, empresa_id, nome) VALUES
  ('b1900000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000b1901', 'Cliente A B19');

INSERT INTO public.estimativas_obra (id, empresa_id, nome, cliente_id, ficha, created_by) VALUES
  ('b1900000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000b1901', 'Casa A',
   'b1900000-0000-0000-0000-0000000000c1', '{"tipo": "residencial"}'::jsonb, 'b1900000-0000-0000-0000-00000000000a');

CREATE OR REPLACE FUNCTION pg_temp.como(p_user uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

-- Cronograma de duas fases: 3 etapas (uma sem previsto) e 3 serviços. Previsto total = 1.500,50.
CREATE TEMP TABLE arvore AS SELECT $json$
[
  {"nome": "Fundação", "inicio": "2026-12-01", "fim": "2027-01-31", "etapas": [
    {"nome": "Fundação", "inicio": "2026-12-01", "fim": "2027-01-15", "previsto": 1000.25,
     "servicos": [{"nome": "Escavação", "inicio": "2026-12-01", "fim": "2026-12-10"},
                  {"nome": "Estacas e blocos", "inicio": "2026-12-11", "fim": "2027-01-15"}]},
    {"nome": "Impermeabilização", "inicio": "2027-01-16", "fim": "2027-01-31", "previsto": 500.25, "servicos": []}
  ]},
  {"nome": "Instalações", "inicio": "2027-02-01", "fim": "2027-03-31", "etapas": [
    {"nome": "Automação residencial", "inicio": "2027-02-01", "fim": "2027-03-31", "previsto": 0,
     "servicos": [{"nome": "Programação", "inicio": "2027-03-01", "fim": "2027-03-31"}]}
  ]}
]
$json$::jsonb AS fases;
GRANT SELECT ON arvore TO authenticated;

SET LOCAL ROLE authenticated;

-- ── Isolamento ──────────────────────────────────────────────────────────────
SELECT pg_temp.como('b1900000-0000-0000-0000-00000000000b');

SELECT throws_ok(
  $$SELECT public.criar_obra_da_estimativa('b1900000-0000-0000-0000-0000000000e1', '{"nome": "Invasão"}',
    (SELECT fases FROM arvore))$$,
  'P0002',
  'Estimativa não encontrada',
  'outra empresa não cria obra a partir da estimativa'
);

-- ── Validação na fronteira: tudo ou nada ─────────────────────────────────────
SELECT pg_temp.como('b1900000-0000-0000-0000-00000000000a');

SELECT throws_ok(
  $$SELECT public.criar_obra_da_estimativa('b1900000-0000-0000-0000-0000000000e1', '{"nome": "Casa A"}',
    '[{"nome": "Fase", "etapas": [{"nome": "", "previsto": 10}]}]')$$,
  '23514',
  NULL,
  'etapa sem nome é recusada'
);

SELECT throws_ok(
  $$SELECT public.criar_obra_da_estimativa('b1900000-0000-0000-0000-0000000000e1', '{"nome": "Casa A"}',
    '[{"nome": "Fase", "etapas": [{"nome": "Etapa", "previsto": -1}]}]')$$,
  '23514',
  NULL,
  'previsto negativo é recusado'
);

SELECT throws_ok(
  $$SELECT public.criar_obra_da_estimativa('b1900000-0000-0000-0000-0000000000e1', '{"nome": "  "}',
    (SELECT fases FROM arvore))$$,
  '23514',
  NULL,
  'obra sem nome é recusada'
);

SELECT is(
  (SELECT count(*) FROM public.obras WHERE empresa_id = '00000000-0000-0000-0000-0000000b1901'),
  0::bigint,
  'nada fica gravado quando a criação falha'
);

-- ── Criação ─────────────────────────────────────────────────────────────────
SELECT lives_ok(
  $$SELECT public.criar_obra_da_estimativa('b1900000-0000-0000-0000-0000000000e1',
    '{"nome": "Casa A", "cep": "24020-000", "cidade": "Niterói", "localizacao": "Rua da Conceição, Niterói, RJ",
      "taxa_administracao_pct": 12, "data_inicio_prevista": "2026-12-01", "data_fim_prevista": "2027-03-31"}',
    (SELECT fases FROM arvore))$$,
  'cria a obra a partir da estimativa'
);

SELECT results_eq(
  $$SELECT nome, cep, cidade, cliente_id, modelo_cobranca, taxa_administracao_pct, data_inicio_prevista,
           data_fim_prevista, status
      FROM public.obras WHERE empresa_id = '00000000-0000-0000-0000-0000000b1901'$$,
  $$VALUES ('Casa A'::text, '24020-000'::text, 'Niterói'::text, 'b1900000-0000-0000-0000-0000000000c1'::uuid,
            'administracao'::text, 12.00::numeric(5,2), '2026-12-01'::date, '2027-03-31'::date, 'planejada'::text)$$,
  'a obra leva nome, local, cliente, taxa de administração e datas da estimativa'
);

SELECT results_eq(
  $$SELECT nivel, count(*) FROM public.obra_frente f
      JOIN public.obras o ON o.id = f.obra_id
     WHERE o.empresa_id = '00000000-0000-0000-0000-0000000b1901'
     GROUP BY nivel ORDER BY nivel$$,
  $$VALUES ('etapa'::text, 3::bigint), ('fase'::text, 2::bigint), ('servico'::text, 3::bigint)$$,
  'o cronograma vira a árvore fase > etapa > serviço'
);

SELECT is(
  (SELECT count(*) FROM public.obra_frente s
     JOIN public.obra_frente e ON e.id = s.parent_id AND e.nivel = 'etapa'
     JOIN public.obra_frente f ON f.id = e.parent_id AND f.nivel = 'fase'
    WHERE s.nivel = 'servico' AND s.empresa_id = '00000000-0000-0000-0000-0000000b1901'),
  3::bigint,
  'todo serviço fica dentro de uma etapa, e toda etapa dentro de uma fase'
);

SELECT is(
  (SELECT data_inicio FROM public.obra_frente
    WHERE nome = 'Estacas e blocos' AND empresa_id = '00000000-0000-0000-0000-0000000b1901'),
  '2026-12-11'::date,
  'as datas do cronograma da estimativa vão para a obra'
);

SELECT results_eq(
  $$SELECT count(*), sum(valor_previsto) FROM public.obra_orcamento_etapa
     WHERE empresa_id = '00000000-0000-0000-0000-0000000b1901'$$,
  $$VALUES (2::bigint, 1500.50::numeric)$$,
  'o previsto vai para as etapas; etapa sem previsto não ganha linha'
);

SELECT results_eq(
  $$SELECT e.status, e.obra_id = o.id FROM public.estimativas_obra e
      JOIN public.obras o ON o.empresa_id = e.empresa_id
     WHERE e.id = 'b1900000-0000-0000-0000-0000000000e1'$$,
  $$VALUES ('virou_obra'::text, true)$$,
  'a estimativa passa a "virou obra" e guarda o vínculo'
);

SELECT throws_ok(
  $$SELECT public.criar_obra_da_estimativa('b1900000-0000-0000-0000-0000000000e1', '{"nome": "De novo"}',
    (SELECT fases FROM arvore))$$,
  '23505',
  'Esta estimativa já virou obra',
  'a mesma estimativa não vira obra duas vezes'
);

RESET ROLE;

SELECT ok(
  NOT has_function_privilege('anon', 'public.criar_obra_da_estimativa(uuid, jsonb, jsonb)', 'EXECUTE'),
  'anônimo não executa criar_obra_da_estimativa'
);

SELECT * FROM finish();
ROLLBACK;
