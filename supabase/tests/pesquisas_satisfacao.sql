-- pgTAP: NPS e CES (SPEC 156, migration 20261217000000).

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(7);

CREATE OR REPLACE FUNCTION test_set_auth(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

SELECT set_config('role', 'postgres', true);
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role, email_confirmed_at)
VALUES
  ('f1560000-0000-4000-8000-00000000000a', 'nps_ultra@empresareal.com.br', jsonb_build_object('company_name', 'NPS Ultra'), 'authenticated', 'authenticated', now()),
  ('f1560000-0000-4000-8000-00000000000b', 'nps_um@empresareal.com.br', jsonb_build_object('company_name', 'NPS Um'), 'authenticated', 'authenticated', now()),
  ('f1560000-0000-4000-8000-00000000000c', 'nps_dois@empresareal.com.br', jsonb_build_object('company_name', 'NPS Dois'), 'authenticated', 'authenticated', now());
UPDATE public.profiles SET role = 'ultra_admin' WHERE id = 'f1560000-0000-4000-8000-00000000000a';

SELECT test_set_auth('f1560000-0000-4000-8000-00000000000b');
SELECT lives_ok(
  $$INSERT INTO public.pesquisas_satisfacao (tipo, nota, comentario) VALUES ('nps', 4, 'Falta emitir nota')$$,
  'usuário responde o NPS'
);
SELECT throws_ok(
  $$INSERT INTO public.pesquisas_satisfacao (tipo, nota) VALUES ('nps', 11)$$,
  '23514', NULL,
  'nota fora de 0 a 10 é recusada'
);
SELECT throws_ok(
  $$INSERT INTO public.pesquisas_satisfacao (tipo, nota) VALUES ('ces', 1)$$,
  '23514', NULL,
  'CES sem fluxo é recusado'
);
SELECT lives_ok(
  $$INSERT INTO public.pesquisas_satisfacao (tipo, dispensou, fluxo) VALUES ('ces', true, 'lancamento')$$,
  'dispensar o CES grava sem nota'
);

SELECT test_set_auth('f1560000-0000-4000-8000-00000000000c');
SELECT is((SELECT count(*)::int FROM public.pesquisas_satisfacao), 0, 'outro usuário não vê as respostas alheias');

SELECT test_set_auth('f1560000-0000-4000-8000-00000000000a');
SELECT is((SELECT count(*)::int FROM public.pesquisas_satisfacao), 2, 'ultra admin vê todas');

SELECT set_config('role', 'postgres', true);
SELECT is(
  (SELECT count(*)::int FROM public.notificacoes
   WHERE tipo = 'nps_detrator' AND destinatario_id = 'f1560000-0000-4000-8000-00000000000a'),
  1,
  'detrator avisa o ultra admin'
);

SELECT * FROM finish();
ROLLBACK;
