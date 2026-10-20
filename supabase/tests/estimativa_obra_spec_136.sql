-- pgTAP: SPEC 136 / ADR 0063, estimativa de obra (migrations 20261114000000, 20261114000100 e 20261115000100).
-- Roda como usuário autenticado, para a RLS e os triggers valerem como no app.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(29);

-- ── Fixture ──────────────────────────────────────────────────────────────────
INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features) VALUES
  ('00000000-0000-0000-0000-0000000e1361', 'Empresa Estimativa A', NULL, TRUE, '{"obras": true, "estimativa_obra": true}'::jsonb),
  ('00000000-0000-0000-0000-0000000e1362', 'Empresa Estimativa B', NULL, TRUE, '{"obras": true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

SET LOCAL session_replication_role = 'replica';
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role) VALUES
  ('e1360000-0000-0000-0000-00000000000a', 'user-a-136@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('e1360000-0000-0000-0000-00000000000b', 'user-b-136@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('e1360000-0000-0000-0000-00000000000c', 'ultra-136@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed) VALUES
  ('e1360000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000e1361', 'A', '136', 'user-a-136@test.com', 'user', TRUE),
  ('e1360000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000e1362', 'B', '136', 'user-b-136@test.com', 'user', TRUE),
  ('e1360000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-0000000e1361', 'Ultra', '136', 'ultra-136@test.com', 'ultra_admin', TRUE)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, empresa_id = EXCLUDED.empresa_id;
SET LOCAL session_replication_role = 'origin';

INSERT INTO public.clientes (id, empresa_id, nome) VALUES
  ('e1360000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000e1361', 'Cliente A 136'),
  ('e1360000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000e1362', 'Cliente B 136');

-- O teste do segundo fator não pode depender de como o ambiente deixou a configuração.
INSERT INTO public.platform_settings (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;
UPDATE public.platform_settings SET exigir_mfa_ultra_admin = true WHERE id = 'default';

CREATE OR REPLACE FUNCTION pg_temp.como(p_user uuid, p_aal text DEFAULT 'aal1') RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated', 'aal', p_aal)::text, true);
$$;

-- ── Feature ──────────────────────────────────────────────────────────────────
SELECT ok(
  'estimativa_obra' = ANY (public._feature_catalog()),
  'o catálogo de features do banco conhece estimativa_obra'
);

SELECT is(
  (SELECT validado_em FROM public.estimativa_parametros WHERE id = 'default'),
  NULL::timestamptz,
  'os parâmetros semeados nascem como placeholder (validado_em nulo)'
);

SET LOCAL ROLE authenticated;

-- ── CUB: global, só o ultra admin escreve ────────────────────────────────────
SELECT pg_temp.como('e1360000-0000-0000-0000-00000000000a');

SELECT throws_ok(
  $$INSERT INTO public.cub_valores (uf, subtipo, padrao, mes_base, valor_m2, fonte)
    VALUES ('SP', 'R1', 'alto', '2026-09-01', 3350, 'Sinduscon-SP')$$,
  '42501',
  NULL,
  'usuário comum não escreve no CUB'
);

SELECT pg_temp.como('e1360000-0000-0000-0000-00000000000c', 'aal2');

SELECT lives_ok(
  $$INSERT INTO public.cub_valores (uf, subtipo, padrao, mes_base, valor_m2, fonte)
    VALUES ('SP', 'R1', 'alto', '2026-09-01', 3350, 'Sinduscon-SP')$$,
  'ultra admin com segundo fator escreve no CUB'
);

SELECT throws_ok(
  $$INSERT INTO public.cub_valores (uf, subtipo, padrao, mes_base, valor_m2, fonte)
    VALUES ('SP', 'R1', 'alto', '2026-09-15', 3350, 'Sinduscon-SP')$$,
  '23514',
  NULL,
  'o mês-base precisa ser o dia 1'
);

SELECT throws_ok(
  $$INSERT INTO public.cub_valores (uf, subtipo, padrao, mes_base, valor_m2, fonte)
    VALUES ('SP', 'R1', 'alto', '2026-09-01', 4000, 'outra importação')$$,
  '23505',
  NULL,
  'o mesmo UF, subtipo, padrão e mês não duplica'
);

SELECT is(
  (SELECT regime FROM public.cub_valores WHERE uf = 'SP' AND subtipo = 'R1' AND padrao = 'alto' AND mes_base = '2026-09-01'),
  'onerado',
  'sem regime informado, a linha entra como onerado (sem desoneração)'
);

SELECT lives_ok(
  $$INSERT INTO public.cub_valores (uf, subtipo, padrao, mes_base, valor_m2, fonte, regime)
    VALUES ('SP', 'R1', 'alto', '2026-09-01', 3230, 'Sinduscon-SP com desoneração', 'desonerado')$$,
  'o mesmo UF, subtipo, padrão e mês cabe de novo com outro regime'
);

SELECT throws_ok(
  $$INSERT INTO public.cub_valores (uf, subtipo, padrao, mes_base, valor_m2, fonte, regime)
    VALUES ('SP', 'R1', 'normal', '2026-09-01', 2690, 'Sinduscon-SP', 'misto')$$,
  '23514',
  NULL,
  'o regime só aceita onerado ou desonerado'
);

SELECT pg_temp.como('e1360000-0000-0000-0000-00000000000c', 'aal1');

SELECT throws_ok(
  $$INSERT INTO public.cub_valores (uf, subtipo, padrao, mes_base, valor_m2, fonte)
    VALUES ('RJ', 'R1', 'alto', '2026-09-01', 3500, 'Sinduscon-Rio')$$,
  '42501',
  NULL,
  'ultra admin sem segundo fator não escreve no CUB'
);

SELECT pg_temp.como('e1360000-0000-0000-0000-00000000000b');

SELECT is(
  (SELECT count(*)::int FROM public.cub_valores WHERE uf = 'SP' AND subtipo = 'R1'),
  2,
  'toda empresa lê o CUB'
);

-- ── Parâmetros: só o ultra admin altera, e mexer nos valores derruba a validação ──
SELECT lives_ok(
  $$UPDATE public.estimativa_parametros SET validado_em = now() WHERE id = 'default'$$,
  'usuário comum tenta validar os parâmetros (a RLS filtra a linha, sem erro)'
);

SELECT is(
  (SELECT validado_em FROM public.estimativa_parametros WHERE id = 'default'),
  NULL::timestamptz,
  'usuário comum não valida os parâmetros'
);

SELECT pg_temp.como('e1360000-0000-0000-0000-00000000000c', 'aal2');

UPDATE public.estimativa_parametros SET validado_em = now() WHERE id = 'default';

SELECT is(
  (SELECT validado_por FROM public.estimativa_parametros WHERE id = 'default'),
  'e1360000-0000-0000-0000-00000000000c'::uuid,
  'validar grava quem validou'
);

UPDATE public.estimativa_parametros
   SET parametros = jsonb_set(parametros, '{adm_padrao}', '10')
 WHERE id = 'default';

SELECT is(
  (SELECT validado_em FROM public.estimativa_parametros WHERE id = 'default'),
  NULL::timestamptz,
  'mudar um valor derruba a validação anterior'
);

-- ── Estimativas: isolamento entre empresas ───────────────────────────────────
SELECT pg_temp.como('e1360000-0000-0000-0000-00000000000a');

SELECT lives_ok(
  $$INSERT INTO public.estimativas_obra (id, empresa_id, nome, cliente_id, ficha)
    VALUES ('e1360000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000e1361', 'Residência A',
            'e1360000-0000-0000-0000-0000000000c1', '{"tipo": "residencial"}'::jsonb)$$,
  'usuário cria estimativa na própria empresa'
);

SELECT throws_ok(
  $$INSERT INTO public.estimativas_obra (empresa_id, nome, ficha)
    VALUES ('00000000-0000-0000-0000-0000000e1362', 'Invasão', '{}'::jsonb)$$,
  '42501',
  NULL,
  'usuário não cria estimativa em outra empresa'
);

SELECT throws_ok(
  $$INSERT INTO public.estimativas_obra (empresa_id, nome, cliente_id, ficha)
    VALUES ('00000000-0000-0000-0000-0000000e1361', 'Cliente alheio', 'e1360000-0000-0000-0000-0000000000c2', '{}'::jsonb)$$,
  '42501',
  NULL,
  'estimativa não liga a cliente de outra empresa'
);

SELECT pg_temp.como('e1360000-0000-0000-0000-00000000000b');

SELECT is(
  (SELECT count(*)::int FROM public.estimativas_obra),
  0,
  'outra empresa não enxerga a estimativa'
);

-- ── Versões: numeradas pelo banco e imutáveis ────────────────────────────────
SELECT pg_temp.como('e1360000-0000-0000-0000-00000000000a');

INSERT INTO public.estimativa_obra_versoes (estimativa_id, empresa_id, versao, ficha, premissas, resultado)
VALUES ('e1360000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000e1361', 99,
        '{"tipo": "residencial"}'::jsonb, '{}'::jsonb, '{"provavel": 1}'::jsonb);
INSERT INTO public.estimativa_obra_versoes (estimativa_id, empresa_id, ficha, premissas, resultado, nota)
VALUES ('e1360000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000e1361',
        '{"tipo": "residencial"}'::jsonb, '{}'::jsonb, '{"provavel": 2}'::jsonb, 'padrão alto');

SELECT results_eq(
  $$SELECT versao FROM public.estimativa_obra_versoes ORDER BY versao$$,
  ARRAY[1, 2],
  'o banco numera as versões em sequência, ignorando o número que o client mandar'
);

SELECT is(
  (SELECT versao_atual FROM public.estimativas_obra WHERE id = 'e1360000-0000-0000-0000-0000000000e1'),
  2,
  'a estimativa aponta para a última versão'
);

SELECT lives_ok(
  $$UPDATE public.estimativa_obra_versoes SET resultado = '{"provavel": 9}'::jsonb$$,
  'update direto numa versão não derruba nada (a RLS filtra todas as linhas)'
);

SELECT lives_ok(
  $$DELETE FROM public.estimativa_obra_versoes$$,
  'delete direto numa versão não derruba nada (a RLS filtra todas as linhas)'
);

SELECT is(
  (SELECT count(*)::int FROM public.estimativa_obra_versoes),
  2,
  'as duas versões continuam lá depois do delete direto'
);

SELECT is(
  (SELECT resultado->>'provavel' FROM public.estimativa_obra_versoes WHERE versao = 1),
  '1',
  'a versão 1 continua com o resultado original depois do update direto'
);

SELECT throws_ok(
  $$INSERT INTO public.estimativa_obra_versoes (estimativa_id, empresa_id, ficha, premissas, resultado)
    VALUES ('e1360000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000e1362',
            '{}'::jsonb, '{}'::jsonb, '{}'::jsonb)$$,
  '42501',
  NULL,
  'versão não grava com empresa diferente da do usuário'
);

SELECT pg_temp.como('e1360000-0000-0000-0000-00000000000b');

SELECT is(
  (SELECT count(*)::int FROM public.estimativa_obra_versoes),
  0,
  'outra empresa não enxerga as versões'
);

-- ── Excluir a estimativa apaga as versões ────────────────────────────────────
SELECT pg_temp.como('e1360000-0000-0000-0000-00000000000a');

DELETE FROM public.estimativas_obra WHERE id = 'e1360000-0000-0000-0000-0000000000e1';

SELECT is(
  (SELECT count(*)::int FROM public.estimativa_obra_versoes),
  0,
  'excluir a estimativa leva as versões junto'
);

-- ── Anônimo não toca em nada ─────────────────────────────────────────────────
RESET ROLE;
SET LOCAL ROLE anon;

SELECT throws_ok(
  $$SELECT count(*) FROM public.cub_valores$$,
  '42501',
  NULL,
  'anônimo não lê o CUB'
);

RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
