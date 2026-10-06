-- pgTAP: SPEC 102 (notificações de pessoas) e SPEC 103 (link da menção, perfil público).
-- Migration 20261009000000.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(17);

CREATE OR REPLACE FUNCTION pg_temp.como(p_user uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

-- ── Fixture ──────────────────────────────────────────────────────────────────
INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features) VALUES
  ('00000000-0000-0000-0000-0000000a1001', 'Empresa Pessoas Notif', NULL, TRUE, '{"projetos": true}'::jsonb),
  ('00000000-0000-0000-0000-0000000a1002', 'Outra Empresa', NULL, TRUE, '{"projetos": true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

UPDATE public.empresas SET nivel_override = 'ouro', nivel_override_motivo = 'fixture_pre_existente'
WHERE id IN ('00000000-0000-0000-0000-0000000a1001', '00000000-0000-0000-0000-0000000a1002');

SET LOCAL session_replication_role = 'replica';

INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role) VALUES
  ('a1000000-0000-0000-0000-00000000000a', 'admin-pn@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('a1000000-0000-0000-0000-00000000000b', 'larissa-pn@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('a1000000-0000-0000-0000-00000000000c', 'flavio-pn@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed) VALUES
  ('a1000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000a1001', 'Admin', 'PN', 'admin-pn@test.com', 'admin', TRUE),
  ('a1000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000a1001', 'Larissa', 'PN', 'larissa-pn@test.com', 'user', TRUE),
  ('a1000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-0000000a1001', 'Flavio', 'PN', 'flavio-pn@test.com', 'user', TRUE)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, empresa_id = EXCLUDED.empresa_id;

SET LOCAL session_replication_role = 'origin';

INSERT INTO public.pessoas (id, empresa_id, nome, primeiro_nome, sobrenome, email, cargo, profile_id) VALUES
  ('a1000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000a1001', 'Admin PN', 'Admin', 'PN', 'admin-pn@test.com', 'Sócio', 'a1000000-0000-0000-0000-00000000000a'),
  ('a1000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000a1001', 'Larissa PN', 'Larissa', 'PN', 'larissa-pn@test.com', 'Projetista', 'a1000000-0000-0000-0000-00000000000b'),
  ('a1000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000a1001', 'Flavio PN', 'Flavio', 'PN', 'flavio-pn@test.com', 'Engenheiro', 'a1000000-0000-0000-0000-00000000000c'),
  ('a1000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000a1002', 'Pessoa de Fora', 'Pessoa', 'Fora', 'fora-pn@test.com', 'Diretor', NULL);

INSERT INTO public.projetos (id, empresa_id, nome, status)
VALUES ('a1000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000a1001', '367 - Miriam e Nelson', 'Em andamento');

-- Etapa 1 com duas disciplinas paralelas, etapa 2 (Detalhamento), e uma fora do fluxo.
INSERT INTO public.projeto_disciplinas (id, projeto_id, nome, status, ordem_etapa) VALUES
  ('a1000000-0000-0000-0000-0000000001a1', 'a1000000-0000-0000-0000-0000000000f1', 'Elétrica - Projeto', 'Em Andamento', 1),
  ('a1000000-0000-0000-0000-0000000001a2', 'a1000000-0000-0000-0000-0000000000f1', 'Hidráulica - Projeto', 'Em Andamento', 1),
  ('a1000000-0000-0000-0000-0000000001b1', 'a1000000-0000-0000-0000-0000000000f1', 'Elétrica - Detalhamento', 'Não Iniciado', 2),
  ('a1000000-0000-0000-0000-0000000001c1', 'a1000000-0000-0000-0000-0000000000f1', 'Compatibilização', 'Não Iniciado', NULL);

-- ── 1. Responsável de disciplina ─────────────────────────────────────────────
SELECT pg_temp.como('a1000000-0000-0000-0000-00000000000a');

INSERT INTO public.projeto_disciplina_responsaveis (projeto_disciplina_id, pessoa_id) VALUES
  ('a1000000-0000-0000-0000-0000000001a1', 'a1000000-0000-0000-0000-0000000000c1'),
  ('a1000000-0000-0000-0000-0000000001a2', 'a1000000-0000-0000-0000-0000000000c1'),
  ('a1000000-0000-0000-0000-0000000001b1', 'a1000000-0000-0000-0000-0000000000b1'),
  ('a1000000-0000-0000-0000-0000000001c1', 'a1000000-0000-0000-0000-0000000000a1');

SELECT is(
  (SELECT severidade || '|' || link FROM public.notificacoes
   WHERE tipo = 'disciplina_atribuida' AND destinatario_id = 'a1000000-0000-0000-0000-00000000000c'
     AND referencia_id = 'a1000000-0000-0000-0000-0000000001a1'),
  'medium|/projetos/a1000000-0000-0000-0000-0000000000f1?disciplina=a1000000-0000-0000-0000-0000000001a1',
  'Responsável da primeira etapa recebe aviso medium com link para a disciplina'
);

SELECT ok(
  (SELECT severidade = 'low' AND mensagem LIKE '%etapa anterior%' FROM public.notificacoes
   WHERE tipo = 'disciplina_atribuida' AND destinatario_id = 'a1000000-0000-0000-0000-00000000000b'
     AND referencia_id = 'a1000000-0000-0000-0000-0000000001b1'),
  'Responsável de etapa futura recebe aviso low dizendo que espera a etapa anterior'
);

SELECT is(
  (SELECT count(*)::int FROM public.notificacoes
   WHERE tipo = 'disciplina_atribuida' AND destinatario_id = 'a1000000-0000-0000-0000-00000000000a'),
  0, 'Quem se marca sozinho não recebe aviso'
);

-- ── 2. Etapa liberada (trigger, qualquer tela) ───────────────────────────────
SELECT pg_temp.como('a1000000-0000-0000-0000-00000000000c');

UPDATE public.projeto_disciplinas SET status = 'Concluído' WHERE id = 'a1000000-0000-0000-0000-0000000001a1';

SELECT is(
  (SELECT count(*)::int FROM public.notificacoes WHERE tipo = 'proxima_etapa_liberada'
     AND referencia_id = 'a1000000-0000-0000-0000-0000000001b1'),
  0, 'Etapa com disciplina paralela em aberto não libera a seguinte'
);

UPDATE public.projeto_disciplinas SET status = 'Concluído' WHERE id = 'a1000000-0000-0000-0000-0000000001a2';

SELECT is(
  (SELECT count(*)::int FROM public.notificacoes WHERE tipo = 'proxima_etapa_liberada'
     AND referencia_id = 'a1000000-0000-0000-0000-0000000001b1'
     AND destinatario_id = 'a1000000-0000-0000-0000-00000000000b'),
  1, 'Ao fechar a etapa, o responsável da seguinte é avisado'
);

SELECT is(
  (SELECT count(*)::int FROM public.notificacoes WHERE tipo = 'proxima_etapa_liberada'
     AND referencia_id = 'a1000000-0000-0000-0000-0000000001b1'
     AND destinatario_id = 'a1000000-0000-0000-0000-00000000000a'),
  1, 'A gestão operacional também é avisada'
);

SELECT is(
  (SELECT count(*)::int FROM public.notificacoes WHERE tipo = 'proxima_etapa_liberada'
     AND destinatario_id = 'a1000000-0000-0000-0000-00000000000c'),
  0, 'Quem concluiu não é avisado'
);

SELECT ok(
  (SELECT mensagem LIKE 'Flavio PN concluiu Hidráulica - Projeto%' AND link LIKE '%?disciplina=a1000000-0000-0000-0000-0000000001b1'
   FROM public.notificacoes WHERE tipo = 'proxima_etapa_liberada'
     AND destinatario_id = 'a1000000-0000-0000-0000-00000000000b'),
  'Mensagem diz quem concluiu e o link abre a disciplina liberada'
);

-- ── 3. Tarefa atribuída pela coluna e pela ponte, sem duplicar ───────────────
SELECT pg_temp.como('a1000000-0000-0000-0000-00000000000a');

INSERT INTO public.tarefas (id, empresa_id, titulo, status, responsavel_id)
VALUES ('a1000000-0000-0000-0000-0000000002a1', '00000000-0000-0000-0000-0000000a1001', 'Cadastro de cliente', 'a_fazer', 'a1000000-0000-0000-0000-0000000000b1');

INSERT INTO public.tarefa_responsaveis (tarefa_id, pessoa_id, empresa_id)
VALUES ('a1000000-0000-0000-0000-0000000002a1', 'a1000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000a1001');

SELECT is(
  (SELECT count(*)::int FROM public.notificacoes WHERE tipo = 'tarefa_atribuida'
     AND referencia_id = 'a1000000-0000-0000-0000-0000000002a1'),
  1, 'Tarefa com responsavel_id e ponte gera um aviso só'
);

SELECT is(
  (SELECT link FROM public.notificacoes WHERE tipo = 'tarefa_atribuida'
     AND referencia_id = 'a1000000-0000-0000-0000-0000000002a1'),
  '/gestao/tarefas?tarefa=a1000000-0000-0000-0000-0000000002a1',
  'Link da tarefa abre a tarefa'
);

-- ── 4. Menção com link para o comentário, uma notificação por comentário ─────
SELECT pg_temp.como('a1000000-0000-0000-0000-00000000000c');

SELECT public.rpc_notificar_mencao('projeto', 'a1000000-0000-0000-0000-0000000000f1',
  ARRAY['a1000000-0000-0000-0000-0000000000b1']::uuid[], 'Liberado para detalhamento',
  'a1000000-0000-0000-0000-0000000003a1');
SELECT public.rpc_notificar_mencao('projeto', 'a1000000-0000-0000-0000-0000000000f1',
  ARRAY['a1000000-0000-0000-0000-0000000000b1']::uuid[], 'Viu?',
  'a1000000-0000-0000-0000-0000000003a2');

SELECT is(
  (SELECT count(*)::int FROM public.notificacoes WHERE tipo = 'mencao_comentario'
     AND destinatario_id = 'a1000000-0000-0000-0000-00000000000b'),
  2, 'Duas menções em comentários diferentes chegam as duas'
);

SELECT is(
  (SELECT link FROM public.notificacoes WHERE tipo = 'mencao_comentario'
     AND referencia_id = 'a1000000-0000-0000-0000-0000000003a1'),
  '/projetos/a1000000-0000-0000-0000-0000000000f1?comentario=a1000000-0000-0000-0000-0000000003a1#atividades',
  'Link da menção abre as Atividades no comentário'
);

SELECT is(
  public.rpc_notificar_mencao('disciplina', 'a1000000-0000-0000-0000-0000000001b1',
    ARRAY['a1000000-0000-0000-0000-0000000000b1']::uuid[], 'Na disciplina', 'a1000000-0000-0000-0000-0000000003b1'),
  1, 'Menção em disciplina também notifica'
);

SELECT is(
  (SELECT link FROM public.notificacoes WHERE referencia_id = 'a1000000-0000-0000-0000-0000000003b1'),
  '/projetos/a1000000-0000-0000-0000-0000000000f1?disciplina=a1000000-0000-0000-0000-0000000001b1&comentario=a1000000-0000-0000-0000-0000000003b1',
  'Link da menção em disciplina abre a disciplina no comentário'
);

-- ── 5. Perfil público ────────────────────────────────────────────────────────
SELECT pg_temp.como('a1000000-0000-0000-0000-00000000000c');

SELECT is(
  (SELECT nome || '|' || cargo || '|' || jsonb_array_length(disciplinas)
   FROM public.rpc_perfil_publico('a1000000-0000-0000-0000-0000000000b1')),
  'Larissa PN|Projetista|1',
  'Perfil público mostra nome, cargo e a disciplina liberada em que a pessoa trabalha'
);

SELECT is(
  (SELECT count(*)::int FROM public.rpc_perfil_publico('a1000000-0000-0000-0000-0000000000d1')),
  0, 'Pessoa de outra empresa não aparece'
);

SELECT ok(
  NOT has_function_privilege('authenticated', 'public._notificar_proxima_etapa(uuid, uuid)', 'execute'),
  'Helper interno não é executável por authenticated'
);

SELECT * FROM finish();

ROLLBACK;
