-- pgTAP: menção sai por e-mail na hora (migration 20261208000000, DECISOES 2026-11-09).
--
-- rpc_notificar_mencao dispara o e-mail sem quebrar quando os secrets do vault faltam;
-- o modo 'mencao' pega só menção, sem a janela de 5 minutos, filtra pelos ids e ignora o
-- padrão da categoria (mas não a preferência explícita); o 'imediato' varre a menção
-- que ficou para trás.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(11);

CREATE OR REPLACE FUNCTION pg_temp.como(p_user uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

-- ── Fixture ──────────────────────────────────────────────────────────────────
INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features) VALUES
  ('00000000-0000-0000-0000-0000000a3001', 'Empresa Mencao Email', NULL, TRUE, '{"projetos": true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

SET LOCAL session_replication_role = 'replica';

INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role) VALUES
  ('a3000000-0000-0000-0000-00000000000a', 'autor-me@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('a3000000-0000-0000-0000-00000000000b', 'maria-me@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('a3000000-0000-0000-0000-00000000000c', 'joao-me@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed) VALUES
  ('a3000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000a3001', 'Autor', 'ME', 'autor-me@test.com', 'user', TRUE),
  ('a3000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000a3001', 'Maria', 'ME', 'maria-me@test.com', 'user', TRUE),
  ('a3000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-0000000a3001', 'Joao', 'ME', 'joao-me@test.com', 'user', TRUE)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, empresa_id = EXCLUDED.empresa_id;

SET LOCAL session_replication_role = 'origin';

INSERT INTO public.pessoas (id, empresa_id, nome, primeiro_nome, sobrenome, email, cargo, profile_id) VALUES
  ('a3000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000a3001', 'Maria ME', 'Maria', 'ME', 'maria-me@test.com', 'Projetista', 'a3000000-0000-0000-0000-00000000000b'),
  ('a3000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000a3001', 'Joao ME', 'Joao', 'ME', 'joao-me@test.com', 'Projetista', 'a3000000-0000-0000-0000-00000000000c');

INSERT INTO public.projetos (id, empresa_id, nome, status)
VALUES ('a3000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000a3001', '500 - Projeto Email', 'Em andamento');

-- João desligou o e-mail de projeto explicitamente.
INSERT INTO public.notificacao_preferencias (user_id, empresa_id, categoria, in_app, email)
VALUES ('a3000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-0000000a3001', 'projeto', TRUE, FALSE)
ON CONFLICT (user_id, categoria) DO UPDATE SET email = FALSE;

-- Pré-existentes: menção de tarefa da Maria há 10 min (tarefa vem com e-mail desligado por
-- padrão) e um alerta high que não é menção, também há 10 min.
INSERT INTO public.notificacoes (id, empresa_id, destinatario_id, tipo, categoria, severidade, titulo, created_at)
VALUES
  ('a3000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000a3001', 'a3000000-0000-0000-0000-00000000000b',
   'mencao_comentario', 'tarefa', 'medium', 'Autor marcou você em "Revisar memorial"', now() - interval '10 minutes'),
  ('a3000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000a3001', 'a3000000-0000-0000-0000-00000000000b',
   'disciplina_atrasada', 'disciplina', 'high', 'Disciplina atrasada', now() - interval '10 minutes');

SELECT pg_temp.como('a3000000-0000-0000-0000-00000000000a');

-- ── Disparo na rpc ───────────────────────────────────────────────────────────
SELECT lives_ok(
  $$ SELECT public.rpc_notificar_mencao('projeto', 'a3000000-0000-0000-0000-0000000000f1',
       ARRAY['a3000000-0000-0000-0000-0000000000b1','a3000000-0000-0000-0000-0000000000c1']::uuid[],
       'Confere a armadura', 'a3000000-0000-0000-0000-0000000003b1', false) $$,
  'menção não quebra quando o disparo do e-mail é pulado (vault sem secrets)'
);

SELECT is(
  (SELECT count(*)::int FROM public.notificacoes WHERE referencia_id = 'a3000000-0000-0000-0000-0000000003b1'),
  2,
  'o sino recebe as duas notificações (Maria e João)'
);

-- ── Seleção no modo 'mencao' ────────────────────────────────────────────────
SELECT ok(
  EXISTS (SELECT 1 FROM public.notificacoes_pendentes_email('mencao') p
          JOIN public.notificacoes n ON n.id = p.notificacao_id
          WHERE n.referencia_id = 'a3000000-0000-0000-0000-0000000003b1'
            AND p.destinatario_id = 'a3000000-0000-0000-0000-00000000000b'),
  'mencao: a menção recém-criada da Maria sai na hora, sem esperar 5 minutos'
);

SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.notificacoes_pendentes_email('mencao')
              WHERE destinatario_id = 'a3000000-0000-0000-0000-00000000000c'),
  'mencao: João desligou o e-mail de projeto, a preferência explícita vence'
);

SELECT ok(
  EXISTS (SELECT 1 FROM public.notificacoes_pendentes_email('mencao') WHERE notificacao_id = 'a3000000-0000-0000-0000-0000000000e1'),
  'mencao: menção em tarefa sai mesmo com tarefa desligada por padrão'
);

SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.notificacoes_pendentes_email('mencao') WHERE notificacao_id = 'a3000000-0000-0000-0000-0000000000e2'),
  'mencao: alerta que não é menção fica de fora'
);

SELECT is(
  (SELECT array_agg(notificacao_id) FROM public.notificacoes_pendentes_email('mencao', ARRAY['a3000000-0000-0000-0000-0000000000e1']::uuid[])),
  ARRAY['a3000000-0000-0000-0000-0000000000e1']::uuid[],
  'mencao com ids: devolve só as notificações pedidas'
);

-- ── Rede de segurança no 'imediato' ─────────────────────────────────────────
SELECT ok(
  EXISTS (SELECT 1 FROM public.notificacoes_pendentes_email('imediato') WHERE notificacao_id = 'a3000000-0000-0000-0000-0000000000e1'),
  'imediato: menção de 10 minutos que não saiu entra na varredura'
);

SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.notificacoes_pendentes_email('imediato') p
              JOIN public.notificacoes n ON n.id = p.notificacao_id
              WHERE n.referencia_id = 'a3000000-0000-0000-0000-0000000003b1'),
  'imediato: menção recém-criada fica com o disparo na hora, não com a varredura'
);

-- ── Permissões e modo inválido ──────────────────────────────────────────────
SELECT throws_ok(
  $$ SELECT * FROM public.notificacoes_pendentes_email('diario') $$,
  'modo inválido: diario (use imediato, semanal ou mencao)',
  'modo desconhecido é recusado com mensagem clara'
);

SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$ SELECT public.notificacoes_email_mencao_disparar(ARRAY['a3000000-0000-0000-0000-0000000000e1']::uuid[]) $$,
  '42501', NULL,
  'usuário logado não chama o disparo direto'
);
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
