-- pgTAP: Google Agenda (SPEC 164, migration 20261224000000).
-- Cobre: cada pessoa lê só as próprias reuniões; a conexão (token) não é legível por
-- ninguém logado; o status devolve só a conexão de quem chama; o lembrete sai uma vez,
-- só para o dono e só do que começa em até 30 minutos.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(9);

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

-- Ana: reunião em 20 min (avisa), outra em 2 h (não avisa ainda), uma de dia inteiro (nunca).
-- Bia: reunião em 20 min, mas sem conexão (não avisa).
INSERT INTO public.agenda_eventos_google (id, empresa_id, usuario_id, google_evento_id, titulo, inicio, fim, dia_inteiro, link_reuniao)
VALUES
  ('a1640000-0000-0000-0000-00000000e001', 'a1640000-0000-0000-0000-0000000000a1', 'a1640000-0000-0000-0000-000000000001',
   'g1', 'Reunião com a VRZ', now() + interval '20 minutes', now() + interval '80 minutes', false, 'https://meet.google.com/abc'),
  ('a1640000-0000-0000-0000-00000000e002', 'a1640000-0000-0000-0000-0000000000a1', 'a1640000-0000-0000-0000-000000000001',
   'g2', 'Mais tarde', now() + interval '2 hours', now() + interval '3 hours', false, NULL),
  ('a1640000-0000-0000-0000-00000000e003', 'a1640000-0000-0000-0000-0000000000a1', 'a1640000-0000-0000-0000-000000000001',
   'g3', 'Feriado', now() + interval '10 minutes', now() + interval '1 day', true, NULL),
  ('a1640000-0000-0000-0000-00000000e004', 'a1640000-0000-0000-0000-0000000000a1', 'a1640000-0000-0000-0000-000000000002',
   'g4', 'Da Bia', now() + interval '20 minutes', now() + interval '1 hour', false, NULL);

-- Lembretes (roda como o cron: dono das funções).
SELECT is(public.agenda_gerar_lembretes(), 1, 'só a reunião da Ana em até 30 min gera aviso');
SELECT is(public.agenda_gerar_lembretes(), 0, 'segunda rodada não repete o aviso');
SELECT is(
  (SELECT link FROM public.notificacoes
    WHERE destinatario_id = 'a1640000-0000-0000-0000-000000000001' AND tipo = 'reuniao_em_breve'),
  'https://meet.google.com/abc',
  'o aviso leva a sala da reunião, na categoria agenda'
);

-- Leitura como a Ana.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"a1640000-0000-0000-0000-000000000001","role":"authenticated"}', true);

SELECT is((SELECT count(*)::int FROM public.agenda_eventos_google), 3, 'Ana lê só as próprias reuniões');
SELECT is((SELECT conectado FROM public.get_google_agenda_status()), true, 'status: Ana está conectada');
SELECT is((SELECT google_email FROM public.get_google_agenda_status()), 'ana@gmail.test', 'status traz a conta da Ana');
SELECT throws_ok('SELECT * FROM public.google_agenda_conexoes', '42501', NULL, 'ninguém logado lê a tabela de conexões');
SELECT throws_ok('SELECT public.agenda_gerar_lembretes()', '42501', NULL, 'usuário não dispara lembretes');

-- Leitura como a Bia.
SELECT set_config('request.jwt.claims', '{"sub":"a1640000-0000-0000-0000-000000000002","role":"authenticated"}', true);
SELECT is((SELECT conectado FROM public.get_google_agenda_status()), false, 'status: Bia não está conectada');

RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
