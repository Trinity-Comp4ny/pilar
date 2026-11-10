-- pgTAP: prévia de recursos (SPEC 160, migration 20261218000000).

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(5);

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
  ('f1600000-0000-4000-8000-00000000000a', 'previa_ultra@empresareal.com.br', jsonb_build_object('company_name', 'Previa Ultra'), 'authenticated', 'authenticated', now()),
  ('f1600000-0000-4000-8000-00000000000b', 'previa_um@empresareal.com.br', jsonb_build_object('company_name', 'Previa Um'), 'authenticated', 'authenticated', now()),
  ('f1600000-0000-4000-8000-00000000000c', 'previa_dois@empresareal.com.br', jsonb_build_object('company_name', 'Previa Dois'), 'authenticated', 'authenticated', now());
UPDATE public.profiles SET role = 'ultra_admin' WHERE id = 'f1600000-0000-4000-8000-00000000000a';

SELECT test_set_auth('f1600000-0000-4000-8000-00000000000a');
INSERT INTO public.recursos_previa (chave, nome, descricao) VALUES ('teste-ligado', 'Ligado', 'Recurso em prévia');
INSERT INTO public.recursos_previa (chave, nome, descricao, ativo) VALUES ('teste-desligado', 'Desligado', 'Fora do catálogo', false);

SELECT test_set_auth('f1600000-0000-4000-8000-00000000000b');
SELECT is((SELECT count(*)::int FROM public.recursos_previa WHERE chave LIKE 'teste-%'), 1, 'usuário vê só os ativos');
SELECT throws_ok(
  $$INSERT INTO public.recursos_previa (chave, nome, descricao) VALUES ('teste-novo', 'x', 'y')$$,
  '42501', NULL,
  'usuário não cadastra prévia'
);
SELECT lives_ok(
  $$INSERT INTO public.usuario_previas (user_id, chave) VALUES ('f1600000-0000-4000-8000-00000000000b', 'teste-ligado')$$,
  'usuário liga a prévia para si'
);
SELECT throws_ok(
  $$INSERT INTO public.usuario_previas (user_id, chave) VALUES ('f1600000-0000-4000-8000-00000000000c', 'teste-ligado')$$,
  '42501', NULL,
  'não liga em nome de outro'
);

SELECT test_set_auth('f1600000-0000-4000-8000-00000000000c');
SELECT is((SELECT count(*)::int FROM public.usuario_previas), 0, 'não vê a escolha dos outros');

SELECT * FROM finish();
ROLLBACK;
