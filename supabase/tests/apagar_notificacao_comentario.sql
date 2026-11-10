-- pgTAP: comentário apagado leva junto a notificação de menção (migration 20261212000000).
--
-- Só apaga quando o comentário já saiu do jsonb do item, só na empresa de quem chama, e não
-- toca em notificação de outro comentário.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(6);

CREATE OR REPLACE FUNCTION pg_temp.como(p_user uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

-- ── Fixture ──────────────────────────────────────────────────────────────────
INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features) VALUES
  ('00000000-0000-0000-0000-0000000a3001', 'Empresa Apaga Coment', NULL, TRUE, '{"projetos": true}'::jsonb),
  ('00000000-0000-0000-0000-0000000a3002', 'Outra Empresa Apaga', NULL, TRUE, '{"projetos": true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

SET LOCAL session_replication_role = 'replica';

INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role) VALUES
  ('a3000000-0000-0000-0000-00000000000a', 'autor-ac@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('a3000000-0000-0000-0000-00000000000b', 'maria-ac@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('a3000000-0000-0000-0000-00000000000e', 'fora-ac@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed) VALUES
  ('a3000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000a3001', 'Autor', 'AC', 'autor-ac@test.com', 'user', TRUE),
  ('a3000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000a3001', 'Maria', 'AC', 'maria-ac@test.com', 'user', TRUE),
  ('a3000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-0000000a3002', 'Fora', 'AC', 'fora-ac@test.com', 'user', TRUE)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, empresa_id = EXCLUDED.empresa_id;

SET LOCAL session_replication_role = 'origin';

INSERT INTO public.pessoas (id, empresa_id, nome, primeiro_nome, sobrenome, email, cargo, profile_id) VALUES
  ('a3000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000a3001', 'Maria AC', 'Maria', 'AC', 'maria-ac@test.com', 'Projetista', 'a3000000-0000-0000-0000-00000000000b');

-- Dois comentários com menção à Maria: c1 e c2.
INSERT INTO public.projetos (id, empresa_id, nome, status, comentarios) VALUES (
  'a3000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000a3001', '401 - Projeto Apaga', 'Em andamento',
  '[{"id": "a3000000-0000-0000-0000-0000000003c1", "texto": "@Maria AC olha", "autor": "Autor AC", "data": "2026-11-10T10:00:00Z"},
    {"id": "a3000000-0000-0000-0000-0000000003c2", "texto": "@Maria AC e isto", "autor": "Autor AC", "data": "2026-11-10T10:05:00Z"}]'::jsonb
);

SELECT pg_temp.como('a3000000-0000-0000-0000-00000000000a');
SELECT public.rpc_notificar_mencao('projeto', 'a3000000-0000-0000-0000-0000000000f1',
  ARRAY['a3000000-0000-0000-0000-0000000000b1']::uuid[], '@Maria AC olha', 'a3000000-0000-0000-0000-0000000003c1', false);
SELECT public.rpc_notificar_mencao('projeto', 'a3000000-0000-0000-0000-0000000000f1',
  ARRAY['a3000000-0000-0000-0000-0000000000b1']::uuid[], '@Maria AC e isto', 'a3000000-0000-0000-0000-0000000003c2', false);

-- ── Comentário ainda de pé: recusa ───────────────────────────────────────────
SELECT throws_ok(
  $$ SELECT public.rpc_apagar_notificacoes_comentario('projeto', 'a3000000-0000-0000-0000-0000000000f1', 'a3000000-0000-0000-0000-0000000003c1') $$,
  'P0001',
  'O comentário ainda existe: apague o comentário antes da notificação',
  'Não apaga notificação de comentário que segue nas Atividades'
);

-- ── Comentário c1 sai do jsonb ───────────────────────────────────────────────
UPDATE public.projetos
   SET comentarios = '[{"id": "a3000000-0000-0000-0000-0000000003c2", "texto": "@Maria AC e isto", "autor": "Autor AC", "data": "2026-11-10T10:05:00Z"}]'::jsonb
 WHERE id = 'a3000000-0000-0000-0000-0000000000f1';

-- Outra empresa não alcança o item.
SELECT pg_temp.como('a3000000-0000-0000-0000-00000000000e');
SELECT throws_ok(
  $$ SELECT public.rpc_apagar_notificacoes_comentario('projeto', 'a3000000-0000-0000-0000-0000000000f1', 'a3000000-0000-0000-0000-0000000003c1') $$,
  'P0001',
  'Item não encontrado ou fora da empresa',
  'Quem é de outra empresa não apaga notificação daqui'
);

SELECT pg_temp.como('a3000000-0000-0000-0000-00000000000a');
SELECT is(
  public.rpc_apagar_notificacoes_comentario('projeto', 'a3000000-0000-0000-0000-0000000000f1', 'a3000000-0000-0000-0000-0000000003c1'),
  1,
  'Comentário apagado: a notificação da Maria sai junto'
);

SELECT is(
  (SELECT count(*)::int FROM public.notificacoes WHERE referencia_id = 'a3000000-0000-0000-0000-0000000003c1'),
  0,
  'Nenhuma notificação aponta mais para o comentário apagado'
);

SELECT is(
  (SELECT count(*)::int FROM public.notificacoes WHERE referencia_id = 'a3000000-0000-0000-0000-0000000003c2'),
  1,
  'A notificação do outro comentário continua'
);

SELECT throws_ok(
  $$ SELECT public.rpc_apagar_notificacoes_comentario('obra', 'a3000000-0000-0000-0000-0000000000f1', 'a3000000-0000-0000-0000-0000000003c1') $$,
  'P0001',
  'Tipo de entidade inválido: obra',
  'Tipo de item fora da lista é recusado'
);

SELECT * FROM finish();
ROLLBACK;
