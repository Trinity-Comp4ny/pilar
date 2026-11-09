-- pgTAP: resumo da semana do portal (SPEC 135, fase C, BEZ-57, migration 20261117000000).
-- Cobre: a tabela só é do service role (anon e authenticated sem grant), RLS ligada, limite de
-- tamanho do texto e remoção junto com a obra.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(7);

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES ('00000000-0000-0000-0000-0000000e6aaa', 'Empresa Resumo Semana', NULL, TRUE, '{"obras": true}'::jsonb)
ON CONFLICT (id) DO NOTHING;

SET LOCAL session_replication_role = 'replica';
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES ('77777777-0000-0000-0000-0000000e6a01', 'resumo_semana@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
SET LOCAL session_replication_role = 'origin';

INSERT INTO public.obras (id, empresa_id, nome, status, created_by)
VALUES ('00000000-0000-0000-0000-0000000e6b01', '00000000-0000-0000-0000-0000000e6aaa', 'Obra Resumo', 'planejada',
        '77777777-0000-0000-0000-0000000e6a01')
ON CONFLICT (id) DO NOTHING;

SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.obra_resumo_semana'::regclass),
  true,
  'RLS ligada em obra_resumo_semana'
);
SELECT is(
  has_table_privilege('anon', 'public.obra_resumo_semana', 'SELECT')
    OR has_table_privilege('authenticated', 'public.obra_resumo_semana', 'SELECT')
    OR has_table_privilege('authenticated', 'public.obra_resumo_semana', 'INSERT'),
  false,
  'anon e authenticated não leem nem escrevem a tabela'
);
SELECT is(
  has_table_privilege('service_role', 'public.obra_resumo_semana', 'INSERT'),
  true,
  'o service role (edge) escreve'
);

SELECT lives_ok(
  $$INSERT INTO public.obra_resumo_semana (obra_id, empresa_id, fonte_hash, texto)
    VALUES ('00000000-0000-0000-0000-0000000e6b01', '00000000-0000-0000-0000-0000000e6aaa', 'abc', 'Laje concretada.')$$,
  'grava o resumo'
);
SELECT throws_ok(
  $$INSERT INTO public.obra_resumo_semana (obra_id, empresa_id, fonte_hash, texto)
    VALUES ('00000000-0000-0000-0000-0000000e6b01', '00000000-0000-0000-0000-0000000e6aaa', 'def', 'Outro resumo.')$$,
  '23505',
  NULL,
  'a obra só tem um resumo guardado (chave primária)'
);

DELETE FROM public.obra_resumo_semana;
SELECT throws_ok(
  $$INSERT INTO public.obra_resumo_semana (obra_id, empresa_id, fonte_hash, texto)
    VALUES ('00000000-0000-0000-0000-0000000e6b01', '00000000-0000-0000-0000-0000000e6aaa', 'def', repeat('x', 601))$$,
  '23514',
  NULL,
  'texto acima de 600 caracteres é recusado'
);

INSERT INTO public.obra_resumo_semana (obra_id, empresa_id, fonte_hash, texto)
VALUES ('00000000-0000-0000-0000-0000000e6b01', '00000000-0000-0000-0000-0000000e6aaa', 'abc', 'Laje concretada.');
DELETE FROM public.obras WHERE id = '00000000-0000-0000-0000-0000000e6b01';
SELECT is(
  (SELECT count(*)::int FROM public.obra_resumo_semana WHERE obra_id = '00000000-0000-0000-0000-0000000e6b01'),
  0,
  'o resumo some junto com a obra'
);

SELECT * FROM finish();
ROLLBACK;
