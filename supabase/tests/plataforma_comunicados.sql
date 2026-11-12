-- pgTAP: comunicados da plataforma (SPEC 157, migration 20261218000000).

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(6);

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
  ('f1570000-0000-4000-8000-00000000000a', 'com_ultra@empresareal.com.br', jsonb_build_object('company_name', 'Com Ultra'), 'authenticated', 'authenticated', now()),
  ('f1570000-0000-4000-8000-00000000000b', 'com_um@empresareal.com.br', jsonb_build_object('company_name', 'Com Um'), 'authenticated', 'authenticated', now()),
  ('f1570000-0000-4000-8000-00000000000c', 'com_dois@empresareal.com.br', jsonb_build_object('company_name', 'Com Dois'), 'authenticated', 'authenticated', now());
UPDATE public.profiles SET role = 'ultra_admin' WHERE id = 'f1570000-0000-4000-8000-00000000000a';

SELECT test_set_auth('f1570000-0000-4000-8000-00000000000b');
SELECT throws_ok(
  $$INSERT INTO public.plataforma_comunicados (titulo, mensagem) VALUES ('x', 'y')$$,
  '42501', NULL,
  'usuário comum não cria comunicado'
);

SELECT test_set_auth('f1570000-0000-4000-8000-00000000000a');
INSERT INTO public.plataforma_comunicados (id, titulo, mensagem)
VALUES ('f1570000-0000-4000-8000-0000000000c1', 'Para todos', 'Mensagem');
INSERT INTO public.plataforma_comunicados (titulo, mensagem, empresa_id)
SELECT 'Só para o escritório um', 'Mensagem', p.empresa_id
FROM public.profiles p WHERE p.id = 'f1570000-0000-4000-8000-00000000000b';
INSERT INTO public.plataforma_comunicados (titulo, mensagem, encerrado_em)
VALUES ('Encerrado', 'Mensagem', now());

SELECT test_set_auth('f1570000-0000-4000-8000-00000000000b');
SELECT is((SELECT count(*)::int FROM public.comunicados_para_mim()), 2, 'escritório um vê o geral e o dele');
SELECT is((SELECT count(*)::int FROM public.plataforma_comunicados), 0, 'tabela fechada para usuário comum');
SELECT public.dispensar_comunicado('f1570000-0000-4000-8000-0000000000c1');
SELECT is((SELECT count(*)::int FROM public.comunicados_para_mim()), 1, 'dispensado não volta');

SELECT test_set_auth('f1570000-0000-4000-8000-00000000000c');
SELECT is((SELECT count(*)::int FROM public.comunicados_para_mim()), 1, 'escritório dois só vê o geral');
SELECT ok(
  NOT has_function_privilege('anon', 'public.comunicados_para_mim()', 'EXECUTE'),
  'anon não lê comunicados'
);

SELECT * FROM finish();
ROLLBACK;
