-- pgTAP: SPEC 131 (@all nos comentários), migration 20261110000000.
--
-- @all avisa todo perfil ativo da empresa do autor, menos o autor; quem também foi
-- marcado pelo nome recebe uma só notificação; membro desativado e outra empresa ficam de fora.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(8);

CREATE OR REPLACE FUNCTION pg_temp.como(p_user uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

-- ── Fixture ──────────────────────────────────────────────────────────────────
INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features) VALUES
  ('00000000-0000-0000-0000-0000000a2001', 'Empresa Mencao Todos', NULL, TRUE, '{"projetos": true}'::jsonb),
  ('00000000-0000-0000-0000-0000000a2002', 'Outra Empresa Mencao', NULL, TRUE, '{"projetos": true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

SET LOCAL session_replication_role = 'replica';

INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role) VALUES
  ('a2000000-0000-0000-0000-00000000000a', 'autor-mt@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('a2000000-0000-0000-0000-00000000000b', 'maria-mt@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('a2000000-0000-0000-0000-00000000000c', 'socio-mt@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('a2000000-0000-0000-0000-00000000000d', 'saiu-mt@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('a2000000-0000-0000-0000-00000000000e', 'fora-mt@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed, desativado_em) VALUES
  ('a2000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000a2001', 'Autor', 'MT', 'autor-mt@test.com', 'user', TRUE, NULL),
  ('a2000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000a2001', 'Maria', 'MT', 'maria-mt@test.com', 'user', TRUE, NULL),
  -- Sócio admin sem linha em pessoas: o @all alcança pelo perfil.
  ('a2000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-0000000a2001', 'Socio', 'MT', 'socio-mt@test.com', 'admin', TRUE, NULL),
  ('a2000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-0000000a2001', 'Saiu', 'MT', 'saiu-mt@test.com', 'user', TRUE, now()),
  ('a2000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-0000000a2002', 'Fora', 'MT', 'fora-mt@test.com', 'user', TRUE, NULL)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, empresa_id = EXCLUDED.empresa_id, desativado_em = EXCLUDED.desativado_em;

SET LOCAL session_replication_role = 'origin';

INSERT INTO public.pessoas (id, empresa_id, nome, primeiro_nome, sobrenome, email, cargo, profile_id) VALUES
  ('a2000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000a2001', 'Autor MT', 'Autor', 'MT', 'autor-mt@test.com', 'Engenheiro', 'a2000000-0000-0000-0000-00000000000a'),
  ('a2000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000a2001', 'Maria MT', 'Maria', 'MT', 'maria-mt@test.com', 'Projetista', 'a2000000-0000-0000-0000-00000000000b');

INSERT INTO public.projetos (id, empresa_id, nome, status)
VALUES ('a2000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000a2001', '400 - Projeto Mencao', 'Em andamento');

SELECT pg_temp.como('a2000000-0000-0000-0000-00000000000a');

-- ── @all ─────────────────────────────────────────────────────────────────────
SELECT is(
  public.rpc_notificar_mencao('projeto', 'a2000000-0000-0000-0000-0000000000f1',
    '{}'::uuid[], 'Reunião amanhã às 9h', 'a2000000-0000-0000-0000-0000000003a1', true),
  2,
  '@all avisa os membros ativos da empresa, menos o autor (Maria e o sócio sem linha em pessoas)'
);

SELECT is(
  (SELECT count(*)::int FROM public.notificacoes WHERE tipo = 'mencao_comentario'
     AND referencia_id = 'a2000000-0000-0000-0000-0000000003a1'
     AND destinatario_id IN ('a2000000-0000-0000-0000-00000000000d', 'a2000000-0000-0000-0000-00000000000e', 'a2000000-0000-0000-0000-00000000000a')),
  0,
  '@all não avisa membro desativado, outra empresa nem o próprio autor'
);

SELECT is(
  (SELECT titulo FROM public.notificacoes WHERE tipo = 'mencao_comentario'
     AND referencia_id = 'a2000000-0000-0000-0000-0000000003a1'
     AND destinatario_id = 'a2000000-0000-0000-0000-00000000000b'),
  'Autor MT marcou todos em "400 - Projeto Mencao"',
  'O título do @all diz que o autor marcou todos'
);

SELECT is(
  (SELECT link FROM public.notificacoes WHERE tipo = 'mencao_comentario'
     AND referencia_id = 'a2000000-0000-0000-0000-0000000003a1'
     AND destinatario_id = 'a2000000-0000-0000-0000-00000000000c'),
  '/projetos/a2000000-0000-0000-0000-0000000000f1?comentario=a2000000-0000-0000-0000-0000000003a1#atividades',
  'O link do @all abre o comentário, igual à menção individual'
);

-- ── @all + marcação pelo nome: uma notificação só ───────────────────────────
SELECT public.rpc_notificar_mencao('projeto', 'a2000000-0000-0000-0000-0000000000f1',
  ARRAY['a2000000-0000-0000-0000-0000000000b1']::uuid[], '@all e @Maria MT',
  'a2000000-0000-0000-0000-0000000003a2', true);

SELECT is(
  (SELECT count(*)::int FROM public.notificacoes WHERE tipo = 'mencao_comentario'
     AND referencia_id = 'a2000000-0000-0000-0000-0000000003a2'
     AND destinatario_id = 'a2000000-0000-0000-0000-00000000000b'),
  1,
  'Quem é marcado pelo nome e também está no @all recebe uma notificação só'
);

-- ── Sem @all e sem ninguém marcado ──────────────────────────────────────────
SELECT is(
  public.rpc_notificar_mencao('projeto', 'a2000000-0000-0000-0000-0000000000f1',
    '{}'::uuid[], 'Sem marcação', 'a2000000-0000-0000-0000-0000000003a3'),
  0,
  'Sem p_todos e sem mencionados não notifica ninguém (o bundle antigo chama sem p_todos)'
);

SELECT is(
  public.rpc_notificar_mencao('projeto', 'a2000000-0000-0000-0000-0000000000f1',
    ARRAY['a2000000-0000-0000-0000-0000000000b1']::uuid[], 'Só a Maria', 'a2000000-0000-0000-0000-0000000003a4'),
  1,
  'Menção individual segue igual, com 5 argumentos'
);

-- ── Outra empresa não alcança esta ──────────────────────────────────────────
SELECT pg_temp.como('a2000000-0000-0000-0000-00000000000e');

SELECT throws_ok(
  $q$SELECT public.rpc_notificar_mencao('projeto', 'a2000000-0000-0000-0000-0000000000f1', '{}'::uuid[], 'Invasão', NULL, true)$q$,
  'Item não encontrado ou fora da empresa',
  '@all de outra empresa não passa pela checagem de tenant'
);

SELECT * FROM finish();
ROLLBACK;
