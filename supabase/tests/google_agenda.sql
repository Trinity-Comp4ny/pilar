-- pgTAP: Google Agenda (SPEC 164, migration 20261224000000).
-- Cobre: cada pessoa lê só as próprias reuniões; a conexão (token) não é legível por
-- ninguém logado; o status devolve só a conexão de quem chama; o aviso sai uma vez, só
-- para o dono, no padrão dele (10 min) ou no aviso próprio da reunião; cada um muda só o
-- próprio padrão.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(13);

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed)
VALUES ('a1640000-0000-0000-0000-0000000000a1', 'Empresa Agenda', NULL, TRUE)
ON CONFLICT (id) DO NOTHING;

SET LOCAL session_replication_role = 'replica';
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role, email_confirmed_at)
VALUES
  ('a1640000-0000-0000-0000-000000000001', 'ana@agenda.test', '{}'::jsonb, 'authenticated', 'authenticated', now()),
  ('a1640000-0000-0000-0000-000000000002', 'bia@agenda.test', '{}'::jsonb, 'authenticated', 'authenticated', now())
ON CONFLICT (id) DO NOTHING;
SET LOCAL session_replication_role = 'origin';

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed)
VALUES
  ('a1640000-0000-0000-0000-000000000001', 'a1640000-0000-0000-0000-0000000000a1', 'Ana', 'A', 'ana@agenda.test', 'admin', TRUE),
  ('a1640000-0000-0000-0000-000000000002', 'a1640000-0000-0000-0000-0000000000a1', 'Bia', 'B', 'bia@agenda.test', 'user', TRUE)
ON CONFLICT (id) DO UPDATE SET empresa_id = EXCLUDED.empresa_id, role = EXCLUDED.role;

INSERT INTO public.google_agenda_conexoes (usuario_id, empresa_id, google_email, refresh_token_cifrado)
VALUES ('a1640000-0000-0000-0000-000000000001', 'a1640000-0000-0000-0000-0000000000a1', 'ana@gmail.test', 'v1:x:y');

-- Ana (padrão 10 min): reunião em 8 min (avisa), em 20 min sem aviso próprio (ainda não),
-- em 25 min com aviso próprio de 30 (avisa), em 5 min marcada "não avisar" (nunca), dia inteiro (nunca).
-- Bia: reunião em 5 min, mas sem conexão (não avisa).
INSERT INTO public.agenda_eventos_google (id, empresa_id, usuario_id, google_evento_id, titulo, inicio, fim, dia_inteiro, link_reuniao, lembrete_minutos)
VALUES
  ('a1640000-0000-0000-0000-00000000e001', 'a1640000-0000-0000-0000-0000000000a1', 'a1640000-0000-0000-0000-000000000001',
   'g1', 'Reunião com a VRZ', now() + interval '8 minutes', now() + interval '68 minutes', false, 'https://meet.google.com/abc', NULL),
  ('a1640000-0000-0000-0000-00000000e002', 'a1640000-0000-0000-0000-0000000000a1', 'a1640000-0000-0000-0000-000000000001',
   'g2', 'Mais tarde', now() + interval '20 minutes', now() + interval '1 hour', false, NULL, NULL),
  ('a1640000-0000-0000-0000-00000000e005', 'a1640000-0000-0000-0000-0000000000a1', 'a1640000-0000-0000-0000-000000000001',
   'g5', 'Com aviso próprio', now() + interval '25 minutes', now() + interval '1 hour', false, NULL, 30),
  ('a1640000-0000-0000-0000-00000000e006', 'a1640000-0000-0000-0000-0000000000a1', 'a1640000-0000-0000-0000-000000000001',
   'g6', 'Sem aviso', now() + interval '5 minutes', now() + interval '1 hour', false, NULL, -1),
  ('a1640000-0000-0000-0000-00000000e003', 'a1640000-0000-0000-0000-0000000000a1', 'a1640000-0000-0000-0000-000000000001',
   'g3', 'Feriado', now() + interval '5 minutes', now() + interval '1 day', true, NULL, NULL),
  ('a1640000-0000-0000-0000-00000000e004', 'a1640000-0000-0000-0000-0000000000a1', 'a1640000-0000-0000-0000-000000000002',
   'g4', 'Da Bia', now() + interval '5 minutes', now() + interval '1 hour', false, NULL, NULL);

-- Avisos (roda como o cron: dono das funções).
SELECT is(public.agenda_gerar_lembretes(), 2, 'avisa a reunião dentro do padrão de 10 min e a de aviso próprio de 30');
SELECT is(public.agenda_gerar_lembretes(), 0, 'segunda rodada não repete o aviso');
SELECT is(
  (SELECT link FROM public.notificacoes
    WHERE destinatario_id = 'a1640000-0000-0000-0000-000000000001' AND referencia_id = 'a1640000-0000-0000-0000-00000000e001'),
  'https://meet.google.com/abc',
  'o aviso leva a sala da reunião'
);
SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.notificacoes WHERE referencia_id = 'a1640000-0000-0000-0000-00000000e006'),
  'reunião marcada "não avisar" não avisa'
);

-- Leitura como a Ana.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"a1640000-0000-0000-0000-000000000001","role":"authenticated"}', true);

SELECT is((SELECT count(*)::int FROM public.agenda_eventos_google), 5, 'Ana lê só as próprias reuniões');
SELECT is((SELECT conectado FROM public.get_google_agenda_status()), true, 'status: Ana está conectada');
SELECT is((SELECT google_email FROM public.get_google_agenda_status()), 'ana@gmail.test', 'status traz a conta da Ana');
SELECT throws_ok('SELECT * FROM public.google_agenda_conexoes', '42501', NULL, 'ninguém logado lê a tabela de conexões');
SELECT throws_ok('SELECT public.agenda_gerar_lembretes()', '42501', NULL, 'usuário não dispara lembretes');
SELECT is((SELECT lembrete_minutos FROM public.get_google_agenda_status()), 10, 'aviso padrão nasce em 10 minutos');
SELECT public.set_google_agenda_lembrete(30);
SELECT is((SELECT lembrete_minutos FROM public.get_google_agenda_status()), 30, 'Ana muda o próprio aviso padrão');

-- Leitura como a Bia.
SELECT set_config('request.jwt.claims', '{"sub":"a1640000-0000-0000-0000-000000000002","role":"authenticated"}', true);
SELECT is((SELECT conectado FROM public.get_google_agenda_status()), false, 'status: Bia não está conectada');
SELECT throws_ok('SELECT public.set_google_agenda_lembrete(15)', 'P0002', NULL, 'sem conexão não há aviso para mudar');

RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
