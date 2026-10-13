-- pgTAP: SPEC 111, cronograma da obra em quatro níveis (fase > etapa > serviço >
-- tarefa). Migration 20261021000000. Roda como usuário autenticado, para a RLS e
-- os triggers valerem como no app.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(14);

-- ── Fixture ──────────────────────────────────────────────────────────────────
INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features) VALUES
  ('00000000-0000-0000-0000-0000000b1101', 'Empresa Cronograma 111', NULL, TRUE, '{"obras": true}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Trial limita a 1 obra; a fixture precisa de duas.
UPDATE public.empresas SET nivel_override = 'ouro', nivel_override_motivo = 'fixture_pre_existente'
WHERE id = '00000000-0000-0000-0000-0000000b1101';

SET LOCAL session_replication_role = 'replica';
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role) VALUES
  ('b1100000-0000-0000-0000-00000000000a', 'admin-111@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed) VALUES
  ('b1100000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000b1101', 'Admin', '111', 'admin-111@test.com', 'admin', TRUE)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, empresa_id = EXCLUDED.empresa_id;
SET LOCAL session_replication_role = 'origin';

INSERT INTO public.pessoas (id, empresa_id, nome, primeiro_nome, sobrenome, email, cargo, profile_id) VALUES
  ('b1100000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000b1101', 'Ana 111', 'Ana', '111', 'ana-111@test.com', 'Engenheira', NULL),
  ('b1100000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000b1101', 'Bruno 111', 'Bruno', '111', 'bruno-111@test.com', 'Mestre de obras', NULL);

INSERT INTO public.obras (id, empresa_id, nome, created_by) VALUES
  ('b1100000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000b1101', 'Obra A', 'b1100000-0000-0000-0000-00000000000a'),
  ('b1100000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000b1101', 'Obra B', 'b1100000-0000-0000-0000-00000000000a');

SELECT set_config('request.jwt.claims',
  json_build_object('sub', 'b1100000-0000-0000-0000-00000000000a', 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;

-- ── Cascata válida ───────────────────────────────────────────────────────────
INSERT INTO public.obra_frente (id, empresa_id, obra_id, nome, nivel, parent_id) VALUES
  ('b1100000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000b1101', 'b1100000-0000-0000-0000-0000000000c1', 'Estrutura', 'fase', NULL),
  ('b1100000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000b1101', 'b1100000-0000-0000-0000-0000000000c1', 'Fundação', 'etapa', 'b1100000-0000-0000-0000-0000000000f1'),
  ('b1100000-0000-0000-0000-000000000051', '00000000-0000-0000-0000-0000000b1101', 'b1100000-0000-0000-0000-0000000000c1', 'Sapatas', 'servico', 'b1100000-0000-0000-0000-0000000000e1');

SELECT lives_ok(
  $$INSERT INTO public.tarefas (id, empresa_id, obra_id, obra_frente_id, titulo, responsavel_id)
    VALUES ('b1100000-0000-0000-0000-000000000071', '00000000-0000-0000-0000-0000000b1101',
            'b1100000-0000-0000-0000-0000000000c1', 'b1100000-0000-0000-0000-000000000051',
            'Concretar S1', 'b1100000-0000-0000-0000-0000000000a1')$$,
  'tarefa entra no serviço'
);

-- ── Nível errado é recusado ──────────────────────────────────────────────────
SELECT throws_ok(
  $$INSERT INTO public.obra_frente (empresa_id, obra_id, nome, nivel, parent_id)
    VALUES ('00000000-0000-0000-0000-0000000b1101', 'b1100000-0000-0000-0000-0000000000c1',
            'Errado', 'servico', 'b1100000-0000-0000-0000-0000000000f1')$$,
  '23514', 'Serviço precisa estar dentro de uma etapa',
  'serviço direto sob fase é recusado'
);
SELECT throws_ok(
  $$INSERT INTO public.obra_frente (empresa_id, obra_id, nome, nivel, parent_id)
    VALUES ('00000000-0000-0000-0000-0000000b1101', 'b1100000-0000-0000-0000-0000000000c1',
            'Errado', 'fase', 'b1100000-0000-0000-0000-0000000000f1')$$,
  '23514', NULL,
  'fase dentro de outro item é recusada'
);
SELECT throws_ok(
  $$INSERT INTO public.obra_frente (empresa_id, obra_id, nome, nivel, parent_id)
    VALUES ('00000000-0000-0000-0000-0000000b1101', 'b1100000-0000-0000-0000-0000000000c2',
            'Outra obra', 'servico', 'b1100000-0000-0000-0000-0000000000e1')$$,
  '23514', 'O item pai precisa ser da mesma obra',
  'pai de outra obra é recusado'
);
SELECT throws_ok(
  $$UPDATE public.obra_frente SET nivel = 'servico' WHERE id = 'b1100000-0000-0000-0000-0000000000e1'$$,
  '23514', 'O nível de um item do cronograma não pode mudar',
  'nível não muda depois de criado'
);
SELECT throws_ok(
  $$INSERT INTO public.tarefas (empresa_id, obra_id, obra_frente_id, titulo)
    VALUES ('00000000-0000-0000-0000-0000000b1101', 'b1100000-0000-0000-0000-0000000000c1',
            'b1100000-0000-0000-0000-0000000000f1', 'Na fase')$$,
  '23514', 'Tarefa fica dentro de um serviço, não direto na fase',
  'tarefa direto na fase é recusada'
);

-- ── Código antigo é normalizado, não quebra ──────────────────────────────────
INSERT INTO public.obra_frente (id, empresa_id, obra_id, nome)
VALUES ('b1100000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000b1101',
        'b1100000-0000-0000-0000-0000000000c2', 'Alvenaria');

SELECT is(
  (SELECT p.nivel || ':' || p.nome FROM public.obra_frente e
     JOIN public.obra_frente p ON p.id = e.parent_id
    WHERE e.id = 'b1100000-0000-0000-0000-0000000000e2'),
  'fase:Geral',
  'etapa criada sem fase vai para a fase "Geral" da obra'
);

INSERT INTO public.tarefas (id, empresa_id, obra_id, obra_frente_id, titulo)
VALUES ('b1100000-0000-0000-0000-000000000072', '00000000-0000-0000-0000-0000000b1101',
        'b1100000-0000-0000-0000-0000000000c2', 'b1100000-0000-0000-0000-0000000000e2', 'Na etapa');

SELECT is(
  (SELECT s.nivel || ':' || s.nome || ':' || (s.parent_id = 'b1100000-0000-0000-0000-0000000000e2')::text
     FROM public.tarefas t JOIN public.obra_frente s ON s.id = t.obra_frente_id
    WHERE t.id = 'b1100000-0000-0000-0000-000000000072'),
  'servico:Geral:true',
  'tarefa criada na etapa vai para o serviço "Geral" da etapa'
);

INSERT INTO public.tarefas (empresa_id, obra_id, obra_frente_id, titulo)
VALUES ('00000000-0000-0000-0000-0000000b1101', 'b1100000-0000-0000-0000-0000000000c2',
        'b1100000-0000-0000-0000-0000000000e2', 'Outra na etapa');

SELECT is(
  (SELECT count(*)::int FROM public.obra_frente
    WHERE parent_id = 'b1100000-0000-0000-0000-0000000000e2' AND nome = 'Geral'),
  1,
  'segunda tarefa na etapa reusa o mesmo serviço "Geral"'
);

-- ── Ponte de responsáveis (filtro "Minhas" da gestão de tarefas) ─────────────
SELECT ok(
  EXISTS (SELECT 1 FROM public.tarefa_responsaveis
           WHERE tarefa_id = 'b1100000-0000-0000-0000-000000000071'
             AND pessoa_id = 'b1100000-0000-0000-0000-0000000000a1'),
  'responsável da tarefa da obra entra na ponte'
);

UPDATE public.tarefas SET responsavel_id = 'b1100000-0000-0000-0000-0000000000b1'
 WHERE id = 'b1100000-0000-0000-0000-000000000071';

SELECT is(
  (SELECT array_agg(pessoa_id ORDER BY pessoa_id) FROM public.tarefa_responsaveis
    WHERE tarefa_id = 'b1100000-0000-0000-0000-000000000071'),
  ARRAY['b1100000-0000-0000-0000-0000000000b1'::uuid],
  'trocar o responsável troca a linha na ponte'
);

-- Gestão de tarefas grava coluna e depois apaga e regrava a ponte: sem conflito.
SELECT lives_ok(
  $$DELETE FROM public.tarefa_responsaveis WHERE tarefa_id = 'b1100000-0000-0000-0000-000000000071';
    INSERT INTO public.tarefa_responsaveis (tarefa_id, pessoa_id, empresa_id) VALUES
      ('b1100000-0000-0000-0000-000000000071', 'b1100000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000b1101'),
      ('b1100000-0000-0000-0000-000000000071', 'b1100000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000b1101')$$,
  'regravar a ponte como a gestão de tarefas faz continua funcionando'
);

-- ── Excluir fase ─────────────────────────────────────────────────────────────
DELETE FROM public.obra_frente WHERE id = 'b1100000-0000-0000-0000-0000000000f1';

SELECT is(
  (SELECT count(*)::int FROM public.obra_frente WHERE obra_id = 'b1100000-0000-0000-0000-0000000000c1'),
  0,
  'excluir a fase leva etapas e serviços abaixo dela'
);
SELECT ok(
  (SELECT obra_frente_id IS NULL FROM public.tarefas WHERE id = 'b1100000-0000-0000-0000-000000000071'),
  'a tarefa continua na obra, sem serviço'
);

SELECT * FROM finish();

ROLLBACK;
