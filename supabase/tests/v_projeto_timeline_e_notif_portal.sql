-- pgTAP: v_projeto_timeline (migration 20260931000000) e o bloco de notificação de
-- eventos do portal em gerar_notificacoes_ambient() (migration 20260932000000).
-- Cobre spec 093 PR2: proposta aceita / entrega aprovada / revisão solicitada aparecem
-- na timeline, notificam o responsável da disciplina (ou caem no fallback por role
-- quando não há responsável), e não duplicam numa segunda varredura.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(10);

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES ('00000000-0000-0000-0000-00000000f0aa', 'Empresa Timeline', NULL, TRUE,
  '{"projetos": true, "propostas": true, "portal_cliente": true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

SET LOCAL session_replication_role = 'replica';

INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES
  ('77777777-0000-0000-0000-00000000f001', 'tl_owner@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('77777777-0000-0000-0000-00000000f002', 'tl_resp@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

SET LOCAL session_replication_role = 'origin';

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed)
VALUES
  ('77777777-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000f0aa', 'TL', 'Owner', 'tl_owner@test.com', 'owner', TRUE),
  ('77777777-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-00000000f0aa', 'TL', 'Resp', 'tl_resp@test.com', 'coordenador', TRUE)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

INSERT INTO public.pessoas (id, empresa_id, profile_id, nome, primeiro_nome, sobrenome, cpf, email, telefone)
VALUES ('88888888-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000f0aa',
  '77777777-0000-0000-0000-00000000f002', 'TL Responsável', 'TL', 'Responsável', '000.000.000-01', 'tl_resp@test.com', '11999990000');

INSERT INTO public.clientes (id, empresa_id, nome, contato, email)
VALUES ('99999999-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000f0aa', 'Cliente Timeline', 'Fulano', 'cliente@test.com');

-- Projeto A: tem responsável de disciplina definido.
INSERT INTO public.projetos (id, empresa_id, cliente_id, nome, status)
VALUES ('eeeeeeee-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000f0aa',
  '99999999-0000-0000-0000-00000000f001', 'Projeto com responsável', 'Em andamento');

INSERT INTO public.projeto_disciplinas (id, projeto_id, nome, status)
VALUES ('ffffffff-0000-0000-0000-00000000f001', 'eeeeeeee-0000-0000-0000-00000000f001', 'Estrutural', 'Em Andamento');

INSERT INTO public.projeto_disciplina_responsaveis (projeto_disciplina_id, pessoa_id)
VALUES ('ffffffff-0000-0000-0000-00000000f001', '88888888-0000-0000-0000-00000000f001');

-- Projeto B: SEM responsável definido (testa o fallback por role).
INSERT INTO public.projetos (id, empresa_id, cliente_id, nome, status)
VALUES ('eeeeeeee-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-00000000f0aa',
  '99999999-0000-0000-0000-00000000f001', 'Projeto sem responsável', 'Em andamento');

-- Evento 1: proposta aceita (projeto B, sem responsável de disciplina).
INSERT INTO public.propostas (id, empresa_id, cliente_id, projeto_id, titulo, status)
VALUES ('aaaaaaaa-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000f0aa',
  '99999999-0000-0000-0000-00000000f001', 'eeeeeeee-0000-0000-0000-00000000f002', 'Proposta X', 'aceita');

-- Evento 2: entrega aprovada, ligada à disciplina do projeto A (tem responsável).
INSERT INTO public.portal_entregas (id, empresa_id, projeto_id, projeto_disciplina_id, titulo, status, respondido_em)
VALUES ('bbbbbbbb-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000f0aa',
  'eeeeeeee-0000-0000-0000-00000000f001', 'ffffffff-0000-0000-0000-00000000f001', 'Planta baixa', 'aprovado', now());

-- Evento 3: revisão de entrega solicitada, ligada à mesma disciplina.
INSERT INTO public.portal_entregas (id, empresa_id, projeto_id, projeto_disciplina_id, titulo, status, resposta_cliente, respondido_em)
VALUES ('cccccccc-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000f0aa',
  'eeeeeeee-0000-0000-0000-00000000f001', 'ffffffff-0000-0000-0000-00000000f001', 'Corte AA', 'revisao_solicitada',
  'Falta cotar o pé-direito', now());

-- =============================================
-- Teste 1-3: os três eventos aparecem na view
-- =============================================
SELECT is(
  (SELECT count(*)::int FROM public.v_projeto_timeline
    WHERE projeto_id = 'eeeeeeee-0000-0000-0000-00000000f002' AND tipo = 'portal_proposta_aprovada'),
  1,
  'proposta aceita aparece na timeline do projeto B'
);

SELECT is(
  (SELECT disciplina_nome FROM public.v_projeto_timeline
    WHERE tipo = 'portal_entrega_aprovada' AND projeto_id = 'eeeeeeee-0000-0000-0000-00000000f001'),
  'Estrutural',
  'entrega aprovada aparece com o nome da disciplina vinculada'
);

SELECT is(
  (SELECT detalhe FROM public.v_projeto_timeline
    WHERE tipo = 'portal_entrega_revisao_solicitada' AND projeto_id = 'eeeeeeee-0000-0000-0000-00000000f001'),
  'Falta cotar o pé-direito',
  'revisão solicitada leva o texto do cliente como detalhe'
);

-- =============================================
-- Teste 4-5: notificação roteia para o responsável da disciplina (projeto A)
-- =============================================
SELECT gerar_notificacoes_ambient();

SELECT is(
  (SELECT count(*)::int FROM public.notificacoes
    WHERE destinatario_id = '77777777-0000-0000-0000-00000000f002'
      AND tipo = 'portal_entrega_aprovada' AND referencia_id = 'bbbbbbbb-0000-0000-0000-00000000f001'),
  1,
  'responsável da disciplina é notificado da entrega aprovada'
);

SELECT is(
  (SELECT count(*)::int FROM public.notificacoes
    WHERE destinatario_id = '77777777-0000-0000-0000-00000000f002'
      AND tipo = 'portal_entrega_revisao_solicitada' AND referencia_id = 'cccccccc-0000-0000-0000-00000000f001'),
  1,
  'responsável da disciplina é notificado da revisão solicitada'
);

-- =============================================
-- Teste 6: fallback por role quando não há responsável (projeto B)
-- =============================================
SELECT is(
  (SELECT count(*)::int FROM public.notificacoes
    WHERE destinatario_id = '77777777-0000-0000-0000-00000000f001'
      AND tipo = 'portal_proposta_aprovada' AND referencia_id = 'aaaaaaaa-0000-0000-0000-00000000f001'),
  1,
  'owner é notificado da proposta aceita quando não há responsável de disciplina'
);

-- =============================================
-- Teste 7: mensagem carrega o texto do cliente
-- =============================================
-- Nota: o coordenador responsável também é alcançado por _notif_gestao_operacional
-- (que inclui 'coordenador'), então este evento gera 2 linhas (uma por destinatário);
-- filtra por destinatario_id para pegar exatamente uma.
SELECT is(
  (SELECT mensagem FROM public.notificacoes
    WHERE tipo = 'portal_entrega_revisao_solicitada' AND referencia_id = 'cccccccc-0000-0000-0000-00000000f001'
      AND destinatario_id = '77777777-0000-0000-0000-00000000f002'),
  'Falta cotar o pé-direito',
  'notificação de revisão solicitada leva o texto do cliente na mensagem'
);

-- =============================================
-- Teste 8-9: segunda varredura não duplica (evento pontual, não estado)
-- =============================================
SELECT gerar_notificacoes_ambient();

SELECT is(
  (SELECT count(*)::int FROM public.notificacoes
    WHERE tipo = 'portal_entrega_aprovada' AND referencia_id = 'bbbbbbbb-0000-0000-0000-00000000f001'),
  2, -- owner (gestão operacional) + TL Resp (responsável da disciplina, sem duplicar por já ser coordenador)
  'segunda varredura não duplica a notificação de entrega aprovada'
);

SELECT is(
  (SELECT count(*)::int FROM public.notificacoes
    WHERE tipo = 'portal_proposta_aprovada' AND referencia_id = 'aaaaaaaa-0000-0000-0000-00000000f001'),
  2, -- owner + TL Resp (coordenador, alcançado via _notif_gestao_operacional mesmo sem responsável de disciplina)
  'segunda varredura não duplica a notificação de proposta aceita'
);

-- =============================================
-- Teste 10: mudança de status do projeto vira evento na timeline (trigger)
-- =============================================
UPDATE public.projetos SET status = 'Concluído' WHERE id = 'eeeeeeee-0000-0000-0000-00000000f002';

SELECT is(
  (SELECT detalhe FROM public.v_projeto_timeline
    WHERE tipo = 'status_alterado' AND projeto_id = 'eeeeeeee-0000-0000-0000-00000000f002'),
  'Em andamento → Concluído',
  'mudança de status do projeto vira evento status_alterado na timeline'
);

SELECT * FROM finish();

ROLLBACK;
