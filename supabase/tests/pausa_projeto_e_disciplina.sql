-- pgTAP: pausar projeto e disciplina congela os prazos (SPEC 141, estende a 084).
--
-- Roda como authenticated com o JWT do admin da empresa A (RLS ligada: como
-- superuser a RLS não se aplica). Datas relativas a CURRENT_DATE para o teste
-- não envelhecer. A pausa é "envelhecida" por UPDATE como postgres, porque
-- retomar no mesmo dia desloca 0 dias. O 'vencido' usa pelo menos 2 dias atrás: o resumo conta o dia de São
-- Paulo, que entre 00h e 03h UTC ainda é o dia anterior ao CURRENT_DATE do banco (BEZ-453).

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(31);

-- =====================================================================
-- Fixture: empresa A (admin) e empresa B (admin de fora)
-- =====================================================================
INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES
  ('00000000-0000-0000-0000-0000000141a1', 'Empresa A pausa pgtap', NULL, TRUE, '{"projetos": true}'::jsonb),
  ('00000000-0000-0000-0000-0000000141b1', 'Empresa B pausa pgtap', NULL, TRUE, '{"projetos": true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

SET LOCAL session_replication_role = 'replica';
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role, email_confirmed_at)
VALUES
  ('66666666-0000-0000-0000-000000141001', 'pausa_a_admin@pgtap.test', '{}'::jsonb, 'authenticated', 'authenticated', now()),
  ('66666666-0000-0000-0000-000000141002', 'pausa_b_admin@pgtap.test', '{}'::jsonb, 'authenticated', 'authenticated', now())
ON CONFLICT (id) DO NOTHING;
SET LOCAL session_replication_role = 'origin';

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed)
VALUES
  ('66666666-0000-0000-0000-000000141001', '00000000-0000-0000-0000-0000000141a1', 'A', 'Admin', 'pausa_a_admin@pgtap.test', 'admin', TRUE),
  ('66666666-0000-0000-0000-000000141002', '00000000-0000-0000-0000-0000000141b1', 'B', 'Admin', 'pausa_b_admin@pgtap.test', 'admin', TRUE)
ON CONFLICT (id) DO UPDATE SET empresa_id = EXCLUDED.empresa_id, role = EXCLUDED.role;

DO $$ BEGIN
  PERFORM set_config('request.jwt.claims',
    '{"sub": "66666666-0000-0000-0000-000000141001", "role": "authenticated"}', true);
END $$;

-- P1: projeto vencido com 3 disciplinas abertas e 1 concluída
INSERT INTO public.projetos (id, empresa_id, nome, status, data_previsao)
VALUES ('77777777-0000-0000-0000-000000141001', '00000000-0000-0000-0000-0000000141a1', 'P1 pausa pgtap',
        'Em andamento', CURRENT_DATE - 3);

INSERT INTO public.projeto_disciplinas (id, projeto_id, nome, status, data_inicio, data_fim)
VALUES
  ('88888888-0000-0000-0000-000000141001', '77777777-0000-0000-0000-000000141001', 'Estrutura',  'Em Andamento', CURRENT_DATE - 60, CURRENT_DATE - 8),
  ('88888888-0000-0000-0000-000000141002', '77777777-0000-0000-0000-000000141001', 'Hidráulica', 'Em Andamento', CURRENT_DATE - 40, CURRENT_DATE - 2),
  ('88888888-0000-0000-0000-000000141003', '77777777-0000-0000-0000-000000141001', 'Elétrica',   'Não Iniciado', CURRENT_DATE - 10, CURRENT_DATE + 13),
  ('88888888-0000-0000-0000-000000141004', '77777777-0000-0000-0000-000000141001', 'Fundação',   'Concluído',    CURRENT_DATE - 90, CURRENT_DATE - 40);

CREATE OR REPLACE FUNCTION pg_temp.como(p_user uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

-- =====================================================================
-- A. Antes da pausa: o problema existe (controle)
-- =====================================================================
SELECT pg_temp.como('66666666-0000-0000-0000-000000141001');

SELECT is((public.get_painel_gestao()->'projetos'->'totais'->>'atrasados')::int, 1,
  'controle: projeto vencido conta em atrasados');
SELECT is((public.get_resumo_semanal_fatos()->'disciplinas'->>'atrasadas')::int, 2,
  'controle: disciplinas vencidas contam como atrasadas no resumo');

-- =====================================================================
-- B. Pausar o projeto
-- =====================================================================
SELECT throws_ok(
  $$ SELECT public.rpc_pausar_projeto('77777777-0000-0000-0000-000000141001', '   ') $$,
  'P0001', 'Motivo da pausa é obrigatório', 'pausa sem motivo é recusada');

SELECT pg_temp.como('66666666-0000-0000-0000-000000141002');
SELECT throws_ok(
  $$ SELECT public.rpc_pausar_projeto('77777777-0000-0000-0000-000000141001', 'tentativa de outra empresa') $$,
  'P0001', 'Projeto não encontrado ou sem permissão', 'admin de outra empresa não pausa o projeto');

SELECT pg_temp.como('66666666-0000-0000-0000-000000141001');
SELECT lives_ok(
  $$ SELECT public.rpc_pausar_projeto('77777777-0000-0000-0000-000000141001', 'Cliente suspendeu a obra') $$,
  'pausar projeto com motivo funciona');

SELECT is((SELECT status::text FROM public.projetos WHERE id = '77777777-0000-0000-0000-000000141001'),
  'Paralisado', 'projeto fica Paralisado');

SELECT is((SELECT array_agg(status ORDER BY id) FROM public.projeto_disciplinas
           WHERE projeto_id = '77777777-0000-0000-0000-000000141001'),
  ARRAY['Pausada', 'Pausada', 'Pausada', 'Concluído'],
  'as 3 abertas ficam Pausada e a concluída não muda');

SELECT is((SELECT count(*)::int FROM public.projeto_disciplina_pausas dp
           JOIN public.projeto_pausas pp ON pp.id = dp.projeto_pausa_id
           WHERE pp.projeto_id = '77777777-0000-0000-0000-000000141001' AND dp.retomado_em IS NULL),
  3, 'cada disciplina aberta ganha uma pausa ligada à do projeto');

SELECT is((SELECT status_anterior FROM public.projeto_disciplina_pausas
           WHERE projeto_disciplina_id = '88888888-0000-0000-0000-000000141003'),
  'Não Iniciado', 'a pausa guarda o status de antes');

SELECT throws_ok(
  $$ SELECT public.rpc_pausar_projeto('77777777-0000-0000-0000-000000141001', 'de novo') $$,
  'P0001', 'Projeto já está pausado', 'pausar projeto já pausado é recusado');

SELECT throws_ok(
  $$ SELECT public.rpc_retomar_disciplina('88888888-0000-0000-0000-000000141001') $$,
  'P0001', 'Disciplina pausada junto com o projeto. Retome o projeto.',
  'disciplina pausada com o projeto só volta pelo projeto');

-- =====================================================================
-- C. Congelado: início, resumo e alertas não enxergam
-- =====================================================================
SELECT is((public.get_painel_gestao()->'projetos'->'totais'->>'atrasados')::int, 0,
  'projeto Paralisado não conta em atrasados');
SELECT is(jsonb_array_length(public.get_painel_gestao()->'projetos'->'prazos15Dias'), 0,
  'disciplina pausada sai de "vence em 15 dias"');
SELECT is((public.get_resumo_semanal_fatos()->'disciplinas'->>'atrasadas')::int, 0,
  'disciplina pausada não conta como atrasada no resumo');
SELECT is((public.get_resumo_semanal_fatos()->'projetos'->>'atrasados')::int, 0,
  'projeto pausado não conta como atrasado no resumo');

-- =====================================================================
-- D. Retomar: o prazo anda pelos dias parados
-- =====================================================================
RESET ROLE;
UPDATE public.projeto_pausas SET pausado_em = now() - interval '14 days'
 WHERE projeto_id = '77777777-0000-0000-0000-000000141001';
UPDATE public.projeto_disciplina_pausas SET pausado_em = now() - interval '14 days'
 WHERE projeto_pausa_id IN (SELECT id FROM public.projeto_pausas WHERE projeto_id = '77777777-0000-0000-0000-000000141001');

SELECT pg_temp.como('66666666-0000-0000-0000-000000141001');
SELECT lives_ok(
  $$ SELECT public.rpc_retomar_projeto('77777777-0000-0000-0000-000000141001') $$,
  'retomar projeto funciona');

SELECT is((SELECT status::text FROM public.projetos WHERE id = '77777777-0000-0000-0000-000000141001'),
  'Em andamento', 'projeto volta ao status de antes');

SELECT is((SELECT array_agg(status ORDER BY id) FROM public.projeto_disciplinas
           WHERE projeto_id = '77777777-0000-0000-0000-000000141001'),
  ARRAY['Em Andamento', 'Em Andamento', 'Não Iniciado', 'Concluído'],
  'disciplinas voltam ao status de antes');

SELECT is((SELECT data_fim FROM public.projeto_disciplinas WHERE id = '88888888-0000-0000-0000-000000141001'),
  CURRENT_DATE - 8 + 14, 'data_fim avança 14 dias');

SELECT is((SELECT data_fim FROM public.projeto_disciplinas WHERE id = '88888888-0000-0000-0000-000000141004'),
  CURRENT_DATE - 40, 'disciplina concluída não muda de prazo');

SELECT is((SELECT data_inicio FROM public.projeto_disciplinas WHERE id = '88888888-0000-0000-0000-000000141001'),
  CURRENT_DATE - 60, 'quem já tinha começado mantém o início');

SELECT is((SELECT data_inicio FROM public.projeto_disciplinas WHERE id = '88888888-0000-0000-0000-000000141003'),
  CURRENT_DATE - 10 + 14, 'quem ainda não tinha começado avança o início');

SELECT is((SELECT data_previsao FROM public.projetos WHERE id = '77777777-0000-0000-0000-000000141001'),
  CURRENT_DATE - 3 + 14, 'data_previsao do projeto avança 14 dias');

SELECT throws_ok(
  $$ SELECT public.rpc_retomar_projeto('77777777-0000-0000-0000-000000141001') $$,
  'P0001', 'Não há pausa em aberto para esse projeto', 'retomar sem pausa aberta é recusado');

-- =====================================================================
-- E. Disciplina pausada à parte não anda pela pausa do projeto
-- =====================================================================
RESET ROLE;
INSERT INTO public.projetos (id, empresa_id, nome, status, data_previsao)
VALUES ('77777777-0000-0000-0000-000000141002', '00000000-0000-0000-0000-0000000141a1', 'P2 pausa pgtap',
        'Em andamento', CURRENT_DATE + 30);
INSERT INTO public.projeto_disciplinas (id, projeto_id, nome, status, data_inicio, data_fim)
VALUES
  ('88888888-0000-0000-0000-000000141011', '77777777-0000-0000-0000-000000141002', 'Isolada', 'Em Andamento', CURRENT_DATE - 30, CURRENT_DATE + 5),
  ('88888888-0000-0000-0000-000000141012', '77777777-0000-0000-0000-000000141002', 'Junto',   'Em Andamento', CURRENT_DATE - 30, CURRENT_DATE + 5);

SELECT pg_temp.como('66666666-0000-0000-0000-000000141001');
SELECT public.rpc_pausar_disciplina('88888888-0000-0000-0000-000000141011', 'Aguardando a prefeitura');
SELECT public.rpc_pausar_projeto('77777777-0000-0000-0000-000000141002', 'Cliente em férias');

SELECT is((SELECT count(*)::int FROM public.projeto_disciplina_pausas
           WHERE projeto_disciplina_id = '88888888-0000-0000-0000-000000141011' AND retomado_em IS NULL),
  1, 'disciplina já pausada não ganha segunda pausa do projeto');

RESET ROLE;
UPDATE public.projeto_pausas SET pausado_em = now() - interval '10 days'
 WHERE projeto_id = '77777777-0000-0000-0000-000000141002';
UPDATE public.projeto_disciplina_pausas SET pausado_em = now() - interval '10 days'
 WHERE projeto_pausa_id IN (SELECT id FROM public.projeto_pausas WHERE projeto_id = '77777777-0000-0000-0000-000000141002');

SELECT pg_temp.como('66666666-0000-0000-0000-000000141001');
SELECT public.rpc_retomar_projeto('77777777-0000-0000-0000-000000141002');

SELECT is((SELECT status FROM public.projeto_disciplinas WHERE id = '88888888-0000-0000-0000-000000141011'),
  'Pausada', 'a disciplina pausada à parte continua pausada');
SELECT is((SELECT data_fim FROM public.projeto_disciplinas WHERE id = '88888888-0000-0000-0000-000000141011'),
  CURRENT_DATE + 5, 'e o prazo dela não avança pela pausa do projeto');
SELECT is((SELECT data_fim FROM public.projeto_disciplinas WHERE id = '88888888-0000-0000-0000-000000141012'),
  CURRENT_DATE + 5 + 10, 'a que pausou junto com o projeto avança 10 dias');

-- =====================================================================
-- F. Pausa só da disciplina e mudança de status fora das RPCs
-- =====================================================================
RESET ROLE;
UPDATE public.projeto_disciplina_pausas SET pausado_em = now() - interval '7 days'
 WHERE projeto_disciplina_id = '88888888-0000-0000-0000-000000141011' AND retomado_em IS NULL;

SELECT pg_temp.como('66666666-0000-0000-0000-000000141001');
SELECT public.rpc_retomar_disciplina('88888888-0000-0000-0000-000000141011');
SELECT is((SELECT data_fim FROM public.projeto_disciplinas WHERE id = '88888888-0000-0000-0000-000000141011'),
  CURRENT_DATE + 5 + 7, 'retomar disciplina isolada avança o prazo pelos dias parados');

UPDATE public.projetos SET status = 'Paralisado' WHERE id = '77777777-0000-0000-0000-000000141002';
SELECT alike((SELECT motivo FROM public.projeto_pausas
             WHERE projeto_id = '77777777-0000-0000-0000-000000141002' AND retomado_em IS NULL),
  '%sem motivo registrado%', 'status mudado fora da RPC abre pausa com motivo padrão');

UPDATE public.projetos SET status = 'Em andamento' WHERE id = '77777777-0000-0000-0000-000000141002';
SELECT is((SELECT count(*)::int FROM public.projeto_pausas
           WHERE projeto_id = '77777777-0000-0000-0000-000000141002' AND retomado_em IS NULL),
  0, 'sair de Paralisado fora da RPC fecha a pausa');

SELECT * FROM finish();
ROLLBACK;
