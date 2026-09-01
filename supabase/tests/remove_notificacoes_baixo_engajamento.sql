-- pgTAP: notificações removidas por baixo engajamento (migration 20260893000000)
--
-- Guarda de regressão: confirma que rpc_notificar_projeto_status e o trigger de
-- disciplina_atribuida realmente sumiram (não voltam por acidente numa migration
-- futura que redefina algo próximo) e que atribuir um responsável a uma disciplina
-- não gera mais notificação nenhuma.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(4);

SELECT hasnt_function('public', 'rpc_notificar_projeto_status', ARRAY['uuid', 'text'],
  'rpc_notificar_projeto_status não existe mais');
SELECT hasnt_function('public', 'tg_notificar_disciplina_atribuida', ARRAY[]::text[],
  'tg_notificar_disciplina_atribuida não existe mais');
SELECT hasnt_trigger('public', 'projeto_disciplina_responsaveis', 'trg_notificar_disciplina_atribuida',
  'trigger de disciplina_atribuida não existe mais');

-- Fixture mínima pra provar, na prática, que atribuir responsável não notifica mais.
INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES ('00000000-0000-0000-0000-0000000fe001', 'Empresa Remove Notif', NULL, TRUE, '{"projetos": true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

INSERT INTO public.projetos (id, empresa_id, nome, status)
VALUES ('ffffffff-0000-0000-0000-0000000fe001', '00000000-0000-0000-0000-0000000fe001', 'Projeto Sem Notif', 'Em andamento');

INSERT INTO public.projeto_disciplinas (id, projeto_id, nome, status)
VALUES ('dddddddd-0000-0000-0000-0000000fe001', 'ffffffff-0000-0000-0000-0000000fe001', 'Estrutural', 'Planejamento');

SET LOCAL session_replication_role = 'replica';
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES ('77777777-0000-0000-0000-0000000fe001', 'resp-remove-notif@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
SET LOCAL session_replication_role = 'origin';

INSERT INTO public.pessoas (id, empresa_id, nome, primeiro_nome, sobrenome, email, profile_id)
VALUES ('99999999-0000-0000-0000-0000000fe001', '00000000-0000-0000-0000-0000000fe001', 'Responsável Teste', 'Responsável', 'Teste', 'resp-remove-notif@test.com', '77777777-0000-0000-0000-0000000fe001');

INSERT INTO public.projeto_disciplina_responsaveis (projeto_disciplina_id, pessoa_id)
VALUES ('dddddddd-0000-0000-0000-0000000fe001', '99999999-0000-0000-0000-0000000fe001');

SELECT is(
  (SELECT count(*)::integer FROM public.notificacoes WHERE tipo = 'disciplina_atribuida'
    AND referencia_id = 'dddddddd-0000-0000-0000-0000000fe001'),
  0,
  'Atribuir responsável a uma disciplina não gera mais notificação'
);

SELECT * FROM finish();

ROLLBACK;
