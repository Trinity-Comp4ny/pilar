-- pgTAP: ações do plano de prazo em risco e atualização forçada da fila (SPEC 148, fase 3).
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(12);

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES
  ('a1490000-0000-0000-0000-0000000000a1', 'Empresa A prazo', NULL, TRUE, '{"financeiro": true, "projetos": true}'::jsonb),
  ('a1490000-0000-0000-0000-0000000000b1', 'Empresa B prazo', NULL, TRUE, '{"financeiro": true, "projetos": true}'::jsonb),
  ('a1490000-0000-0000-0000-0000000000c1', 'Empresa C sem projetos', NULL, TRUE, '{"financeiro": true, "projetos": true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

SET LOCAL session_replication_role = 'replica';
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role, email_confirmed_at)
VALUES
  ('a1490000-0000-0000-0000-000000000001', 'a_admin@prazo.test', '{}'::jsonb, 'authenticated', 'authenticated', now()),
  ('a1490000-0000-0000-0000-000000000002', 'c_admin@prazo.test', '{}'::jsonb, 'authenticated', 'authenticated', now()),
  ('a1490000-0000-0000-0000-000000000003', 'b_admin@prazo.test', '{}'::jsonb, 'authenticated', 'authenticated', now())
ON CONFLICT (id) DO NOTHING;
SET LOCAL session_replication_role = 'origin';

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, financeiro_delegado, onboarding_completed)
VALUES
  ('a1490000-0000-0000-0000-000000000001', 'a1490000-0000-0000-0000-0000000000a1', 'A', 'Admin', 'a_admin@prazo.test', 'admin', FALSE, TRUE),
  ('a1490000-0000-0000-0000-000000000002', 'a1490000-0000-0000-0000-0000000000c1', 'C', 'Admin', 'c_admin@prazo.test', 'admin', FALSE, TRUE),
  ('a1490000-0000-0000-0000-000000000003', 'a1490000-0000-0000-0000-0000000000b1', 'B', 'Admin', 'b_admin@prazo.test', 'admin', FALSE, TRUE)
ON CONFLICT (id) DO UPDATE SET empresa_id = EXCLUDED.empresa_id, role = EXCLUDED.role;

DO $$ BEGIN
  PERFORM set_config('request.jwt.claims',
    '{"sub": "a1490000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
END $$;

INSERT INTO public.projetos (id, empresa_id, nome, status, data_previsao, valor_contrato)
VALUES ('a1490000-0000-0000-0000-00000000f001', 'a1490000-0000-0000-0000-0000000000a1', 'Projeto prazo', 'Em andamento', CURRENT_DATE + 5, 50000);
INSERT INTO public.projeto_disciplinas (projeto_id, nome, status, data_fim)
VALUES
  ('a1490000-0000-0000-0000-00000000f001', 'Estrutural', 'Em Andamento', CURRENT_DATE + 3),
  ('a1490000-0000-0000-0000-00000000f001', 'Arquitetônico', 'Concluído', CURRENT_DATE - 2);

CREATE OR REPLACE FUNCTION pg_temp.como(p_user uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

-- Atualização forçada
SELECT pg_temp.como('a1490000-0000-0000-0000-000000000001');
SELECT is((public.agente_pendencias_atualizar()->>'achadas')::int > 0, true, 'primeira atualização varre a empresa');
SELECT is(public.agente_pendencias_atualizar()->>'pulada', 'true', 'segunda, logo em seguida, é pulada');
SELECT is(public.agente_pendencias_atualizar(true)->>'pulada', NULL, 'forçada varre mesmo dentro dos 5 minutos');

-- Avisar responsáveis
SELECT is(public.projeto_prazo_avisar('a1490000-0000-0000-0000-00000000f001'), 1,
  'sem responsável com conta, o aviso vai para a gestão (1 admin)');
RESET ROLE;
SELECT is(
  (SELECT mensagem FROM public.notificacoes WHERE tipo = 'prazo_em_risco' AND referencia_id = 'a1490000-0000-0000-0000-00000000f001' LIMIT 1),
  'Entrega em ' || to_char(CURRENT_DATE + 5, 'DD/MM/YYYY') || '. 1 disciplina(s) ainda aberta(s). Confirme uma data realista de entrega.',
  'a mensagem conta só as disciplinas abertas'
);

SELECT pg_temp.como('a1490000-0000-0000-0000-000000000002');
SELECT throws_ok($$SELECT public.projeto_prazo_avisar('a1490000-0000-0000-0000-00000000f001')$$, 'P0002', NULL,
  'usuário de outra empresa (C) também não avisa a equipe do projeto da A');

SELECT pg_temp.como('a1490000-0000-0000-0000-000000000003');
SELECT throws_ok($$SELECT public.projeto_prazo_avisar('a1490000-0000-0000-0000-00000000f001')$$, 'P0002', NULL,
  'projeto de outra empresa não existe para quem chama');

-- Aditivo de prazo
SELECT pg_temp.como('a1490000-0000-0000-0000-000000000001');
SELECT lives_ok($$SELECT public.projeto_aditivo_prazo_criar('a1490000-0000-0000-0000-00000000f001', 11, 'Hidráulica atrasada')$$,
  'cria o rascunho de aditivo de prazo');
SELECT throws_ok($$SELECT public.projeto_aditivo_prazo_criar('a1490000-0000-0000-0000-00000000f001', 0)$$, '22023', NULL,
  'prazo precisa de pelo menos 1 dia');
SELECT throws_ok($$SELECT public.projeto_aditivo_prazo_criar('a1490000-0000-0000-0000-00000000f001', 400)$$, '22023', NULL,
  'e no máximo 365');
RESET ROLE;
SELECT is(
  (SELECT status || '/' || impacto_prazo_dias || '/' || valor_aditivo || '/' || (created_by IS NOT NULL)::text
   FROM public.escopos WHERE projeto_id = 'a1490000-0000-0000-0000-00000000f001' AND tipo = 'aditivo'),
  'rascunho/11/0/true', 'aditivo nasce rascunho, com 11 dias, valor zero e autor');

SELECT pg_temp.como('a1490000-0000-0000-0000-000000000003');
SELECT throws_ok($$SELECT public.projeto_aditivo_prazo_criar('a1490000-0000-0000-0000-00000000f001', 5)$$, 'P0002', NULL,
  'admin de outra empresa não cria aditivo no projeto da A');

SELECT * FROM finish();
ROLLBACK;
