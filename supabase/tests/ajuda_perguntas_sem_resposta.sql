-- pgTAP: lacunas da central de ajuda (SPEC 155, migration 20261216000000).
-- O usuário grava só a própria pergunta, com a empresa vinda do perfil; não lê a lista; o ultra
-- admin lê.

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
  ('f1550000-0000-4000-8000-00000000000a', 'ajuda_ultra@empresareal.com.br', jsonb_build_object('company_name', 'Ajuda Ultra'), 'authenticated', 'authenticated', now()),
  ('f1550000-0000-4000-8000-00000000000b', 'ajuda_comum@empresareal.com.br', jsonb_build_object('company_name', 'Ajuda Comum'), 'authenticated', 'authenticated', now());
UPDATE public.profiles SET role = 'ultra_admin' WHERE id = 'f1550000-0000-4000-8000-00000000000a';

SELECT test_set_auth('f1550000-0000-4000-8000-00000000000b');
SELECT lives_ok(
  $$INSERT INTO public.ajuda_perguntas_sem_resposta (texto, rota, origem) VALUES ('como emitir nota fiscal', '/gestao/financeiro', 'agente')$$,
  'usuário grava a própria pergunta'
);
SELECT throws_ok(
  $$INSERT INTO public.ajuda_perguntas_sem_resposta (texto, origem, created_by)
    VALUES ('outra', 'agente', 'f1550000-0000-4000-8000-00000000000a')$$,
  '42501', NULL,
  'não grava pergunta em nome de outro'
);
SELECT is((SELECT count(*)::int FROM public.ajuda_perguntas_sem_resposta), 0, 'usuário comum não lê a lista');

SELECT test_set_auth('f1550000-0000-4000-8000-00000000000a');
SELECT is((SELECT count(*)::int FROM public.ajuda_perguntas_sem_resposta), 1, 'ultra admin lê');
SELECT is(
  (SELECT empresa_id FROM public.ajuda_perguntas_sem_resposta LIMIT 1),
  (SELECT empresa_id FROM public.profiles WHERE id = 'f1550000-0000-4000-8000-00000000000b'),
  'empresa vem do perfil de quem perguntou'
);

SELECT * FROM finish();
ROLLBACK;
