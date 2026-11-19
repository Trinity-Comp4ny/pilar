-- pgTAP: cérebro de reuniões no Ultra (SPEC 169, PR 1).
--
-- Só ultra admin com MFA lê; admin de empresa e anon não leem nem gravam nada; o ultra
-- admin muda apenas tipo_corrigido (reuniao) e removido (reuniao_insight).

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(13);

SET LOCAL session_replication_role = 'replica';

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES
  ('a9690000-0000-0000-0000-0000000000a0', 'Pilar interna', NULL, TRUE, '{}'::jsonb),
  ('a9690000-0000-0000-0000-0000000000c0', 'Escritório Cliente', NULL, TRUE, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role, last_sign_in_at)
VALUES
  ('a9690000-0000-0000-0000-00000000a001', 'ultra@cerebro.test', '{}'::jsonb, 'authenticated', 'authenticated', now()),
  ('a9690000-0000-0000-0000-00000000c001', 'dono@cerebro.test', '{}'::jsonb, 'authenticated', 'authenticated', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed)
VALUES
  ('a9690000-0000-0000-0000-00000000a001', 'a9690000-0000-0000-0000-0000000000a0', 'Ultra', 'Admin',
   'ultra@cerebro.test', 'ultra_admin', TRUE),
  ('a9690000-0000-0000-0000-00000000c001', 'a9690000-0000-0000-0000-0000000000c0', 'Dona', 'Cliente',
   'dono@cerebro.test', 'admin', TRUE)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, empresa_id = EXCLUDED.empresa_id;

INSERT INTO public.reuniao (id, titulo, ocorreu_em, tipo, origem_contato)
VALUES ('a9690000-0000-0000-0000-0000000000d1', 'Reunião sintética', now(), 'discovery', 'indicacao');

INSERT INTO public.reuniao_insight (id, reuniao_id, categoria, texto, citacao)
VALUES ('a9690000-0000-0000-0000-0000000000e1', 'a9690000-0000-0000-0000-0000000000d1',
        'dor', 'Medição manual', 'perdemos tempo conferindo medição');

INSERT INTO public.compromisso (reuniao_id, prometido_por, descricao)
VALUES ('a9690000-0000-0000-0000-0000000000d1', 'pilar', 'Enviar proposta');

SET LOCAL session_replication_role = 'origin';

CREATE OR REPLACE FUNCTION test_cerebro_auth(p_user_id uuid, p_aal text DEFAULT 'aal2')
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated', 'aal', p_aal)::text, true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

SELECT is(
  (SELECT count(*)::integer FROM pg_class c
   WHERE c.relnamespace = 'public'::regnamespace
     AND c.relname IN ('reuniao', 'reuniao_insight', 'reuniao_segmento', 'compromisso')
     AND c.relrowsecurity),
  4, 'as quatro tabelas do cérebro têm RLS ligada');

SELECT ok(
  NOT has_table_privilege('anon', 'public.reuniao', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.reuniao', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.reuniao_insight', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.compromisso', 'UPDATE'),
  'anon não lê e ninguém logado insere pela API');

-- Admin de empresa cliente
SELECT test_cerebro_auth('a9690000-0000-0000-0000-00000000c001');
SELECT is((SELECT count(*)::integer FROM public.reuniao), 0, 'admin de empresa não vê reuniões');
SELECT is((SELECT count(*)::integer FROM public.reuniao_insight), 0, 'admin de empresa não vê insights');
SELECT is((SELECT count(*)::integer FROM public.compromisso), 0, 'admin de empresa não vê compromissos');
SELECT throws_ok($$SELECT public.cerebro_resumo()$$, '42501', NULL, 'admin de empresa não chama cerebro_resumo');
RESET ROLE;

-- Ultra admin sem MFA
SELECT test_cerebro_auth('a9690000-0000-0000-0000-00000000a001', 'aal1');
SELECT is((SELECT count(*)::integer FROM public.reuniao), 0, 'ultra admin sem MFA não vê reuniões');
RESET ROLE;

-- Ultra admin com MFA
SELECT test_cerebro_auth('a9690000-0000-0000-0000-00000000a001');
SELECT is((SELECT count(*)::integer FROM public.reuniao), 1, 'ultra admin vê a reunião');
SELECT is((public.cerebro_resumo() ->> 'insights')::integer, 1, 'resumo conta o insight');

UPDATE public.reuniao SET tipo_corrigido = 'demo'
WHERE id = 'a9690000-0000-0000-0000-0000000000d1';
SELECT is((SELECT tipo_corrigido FROM public.reuniao), 'demo', 'ultra admin corrige o tipo');

UPDATE public.reuniao_insight SET removido = TRUE
WHERE id = 'a9690000-0000-0000-0000-0000000000e1';
SELECT is((public.cerebro_resumo() ->> 'insights')::integer, 0, 'insight removido sai da contagem');

SELECT throws_ok(
  $$UPDATE public.reuniao SET titulo = 'trocado'$$, '42501', NULL,
  'ultra admin não edita outras colunas da reunião');
SELECT throws_ok(
  $$INSERT INTO public.reuniao (titulo, ocorreu_em) VALUES ('x', now())$$, '42501', NULL,
  'ultra admin não insere pela API');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
