-- pgTAP: todo mundo da empresa VÊ as tarefas de todos; editar segue restrito.
-- Migration 20261029000000. Roda como usuário autenticado, para a RLS valer.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(7);

CREATE OR REPLACE FUNCTION pg_temp.como(p_user uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

-- ── Fixture ──────────────────────────────────────────────────────────────────
INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features) VALUES
  ('00000000-0000-0000-0000-0000000c1001', 'Empresa Tarefas Visiveis', NULL, TRUE, '{}'::jsonb),
  ('00000000-0000-0000-0000-0000000c1002', 'Outra Empresa Tarefas', NULL, TRUE, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

SET LOCAL session_replication_role = 'replica';
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role) VALUES
  ('c1000000-0000-0000-0000-00000000000b', 'larissa-tv@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('c1000000-0000-0000-0000-00000000000c', 'flavio-tv@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed) VALUES
  ('c1000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000c1001', 'Larissa', 'TV', 'larissa-tv@test.com', 'user', TRUE),
  ('c1000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-0000000c1001', 'Flavio', 'TV', 'flavio-tv@test.com', 'user', TRUE)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, empresa_id = EXCLUDED.empresa_id;
SET LOCAL session_replication_role = 'origin';

INSERT INTO public.pessoas (id, empresa_id, nome, primeiro_nome, sobrenome, email, cargo, profile_id) VALUES
  ('c1000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000c1001', 'Larissa TV', 'Larissa', 'TV', 'larissa-tv@test.com', 'Projetista', 'c1000000-0000-0000-0000-00000000000b'),
  ('c1000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000c1001', 'Flavio TV', 'Flavio', 'TV', 'flavio-tv@test.com', 'Engenheiro', 'c1000000-0000-0000-0000-00000000000c');

-- t1: do Flavio. t2: sem responsável, criada pelo Flavio. t3: de outra empresa.
INSERT INTO public.tarefas (id, empresa_id, titulo, responsavel_id, created_by) VALUES
  ('c1000000-0000-0000-0000-000000000071', '00000000-0000-0000-0000-0000000c1001', 'Tarefa do Flavio', 'c1000000-0000-0000-0000-0000000000c1', 'c1000000-0000-0000-0000-00000000000c'),
  ('c1000000-0000-0000-0000-000000000072', '00000000-0000-0000-0000-0000000c1001', 'Tarefa sem responsável', NULL, 'c1000000-0000-0000-0000-00000000000c');
INSERT INTO public.tarefas (id, empresa_id, titulo, created_by) VALUES
  ('c1000000-0000-0000-0000-000000000073', '00000000-0000-0000-0000-0000000c1002', 'Tarefa de fora', 'c1000000-0000-0000-0000-00000000000c');
INSERT INTO public.tarefa_responsaveis (tarefa_id, pessoa_id, empresa_id) VALUES
  ('c1000000-0000-0000-0000-000000000071', 'c1000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000c1001')
ON CONFLICT (tarefa_id, pessoa_id) DO NOTHING;

-- ── Larissa (usuário comum, sem vínculo com as tarefas) ──────────────────────
SELECT pg_temp.como('c1000000-0000-0000-0000-00000000000b');
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*)::int FROM public.tarefas WHERE id IN ('c1000000-0000-0000-0000-000000000071', 'c1000000-0000-0000-0000-000000000072')),
  2,
  'usuário comum vê tarefa de outro e tarefa sem responsável'
);
SELECT is(
  (SELECT count(*)::int FROM public.tarefas WHERE id = 'c1000000-0000-0000-0000-000000000073'),
  0,
  'não vê tarefa de outra empresa'
);
SELECT is(
  (SELECT count(*)::int FROM public.tarefa_responsaveis WHERE tarefa_id = 'c1000000-0000-0000-0000-000000000071'),
  1,
  'vê quem são os responsáveis, para filtrar por pessoa'
);
SELECT is_empty(
  $$UPDATE public.tarefas SET titulo = 'Alterada' WHERE id = 'c1000000-0000-0000-0000-000000000071' RETURNING id$$,
  'ver não é editar: não altera tarefa de outro'
);
SELECT is_empty(
  $$DELETE FROM public.tarefas WHERE id = 'c1000000-0000-0000-0000-000000000071' RETURNING id$$,
  'ver não é editar: não exclui tarefa de outro'
);

-- ── Flavio (criador e responsável) ───────────────────────────────────────────
RESET ROLE;
SELECT pg_temp.como('c1000000-0000-0000-0000-00000000000c');
SET LOCAL ROLE authenticated;

SELECT isnt_empty(
  $$UPDATE public.tarefas SET titulo = 'Do Flavio, editada' WHERE id = 'c1000000-0000-0000-0000-000000000071' RETURNING id$$,
  'responsável e criador continua editando a própria tarefa'
);
SELECT is(
  (SELECT count(*)::int FROM public.tarefas WHERE id = 'c1000000-0000-0000-0000-000000000073'),
  0,
  'também não vê tarefa de outra empresa'
);

SELECT * FROM finish();
ROLLBACK;
