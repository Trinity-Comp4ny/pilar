-- pgTAP: perfil do escritório, da pessoa e origem do lead (SPEC 149).
--
-- 1. profiles e empresas têm UPDATE por coluna para authenticated: as colunas novas
--    que o app grava precisam estar no grant (sem isso o onboarding não salva), e
--    empresas.origem precisa ficar fora (só a edge do ultra-admin grava).
-- 2. demo_interesses abre leitura só para ultra admin e não aceita escrita pela API.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(12);

-- 1. Grants por coluna -------------------------------------------------------
SELECT ok(has_column_privilege('authenticated', 'public.profiles', 'funcao', 'UPDATE'),
  'profiles.funcao: a própria pessoa grava no onboarding e na Conta');
SELECT ok(has_column_privilege('authenticated', 'public.profiles', 'linkedin_url', 'UPDATE'),
  'profiles.linkedin_url: a própria pessoa grava');

SELECT ok(has_column_privilege('authenticated', 'public.empresas', 'site', 'UPDATE'),
  'empresas.site: admin grava');
SELECT ok(has_column_privilege('authenticated', 'public.empresas', 'porte', 'UPDATE'),
  'empresas.porte: admin grava');
SELECT ok(has_column_privilege('authenticated', 'public.empresas', 'disciplinas', 'UPDATE'),
  'empresas.disciplinas: admin grava');
SELECT ok(has_column_privilege('authenticated', 'public.empresas', 'como_conheceu', 'UPDATE'),
  'empresas.como_conheceu: o dono responde no onboarding');
SELECT ok(has_column_privilege('authenticated', 'public.empresas', 'objetivo_inicial', 'UPDATE'),
  'empresas.objetivo_inicial: o dono escolhe por onde começar');
SELECT ok(NOT has_column_privilege('authenticated', 'public.empresas', 'origem', 'UPDATE'),
  'empresas.origem: fora do grant, só service_role grava');

-- 2. demo_interesses ----------------------------------------------------------
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.demo_interesses'::regclass),
  'demo_interesses: RLS ligado');
SELECT is(
  (SELECT array_agg(cmd::text ORDER BY cmd) FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'demo_interesses'),
  ARRAY['SELECT'],
  'demo_interesses: só policy de leitura; escrita só por service_role'
);
SELECT ok(
  (SELECT qual FROM pg_policies WHERE schemaname = 'public' AND tablename = 'demo_interesses') LIKE '%is_ultra_admin()%',
  'demo_interesses: leitura condicionada a is_ultra_admin()'
);
SELECT throws_ok(
  $$INSERT INTO public.demo_interesses (canal) VALUES ('<script>-com-mais-de-quarenta-caracteres-no-canal')$$,
  '23514', NULL,
  'demo_interesses: canal acima de 40 caracteres é recusado'
);

SELECT * FROM finish();

ROLLBACK;
