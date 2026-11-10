-- pgTAP: alerta de acesso novo (SPEC 159, migration 20261217000000).

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
VALUES ('f1590000-0000-4000-8000-00000000000b', 'acesso_novo@empresareal.com.br', jsonb_build_object('company_name', 'Acesso Novo'), 'authenticated', 'authenticated', now());

SELECT test_set_auth('f1590000-0000-4000-8000-00000000000b');
SELECT is(public.registrar_dispositivo('f1590000-0000-4000-8000-0000000000d1', 'Chrome no Windows'), false, 'primeiro navegador não alerta');
SELECT is(public.registrar_dispositivo('f1590000-0000-4000-8000-0000000000d1', 'Chrome no Windows'), false, 'mesmo navegador não alerta');
SELECT is(public.registrar_dispositivo('f1590000-0000-4000-8000-0000000000d2', 'Safari no iPhone'), true, 'segundo navegador alerta');
SELECT throws_ok(
  $$INSERT INTO public.usuario_dispositivos (user_id, dispositivo_id) VALUES ('f1590000-0000-4000-8000-00000000000b', gen_random_uuid())$$,
  '42501', NULL,
  'registrar só pela RPC'
);

SELECT set_config('role', 'postgres', true);
SELECT is(
  (SELECT count(*)::int FROM public.notificacoes WHERE tipo = 'acesso_novo' AND destinatario_id = 'f1590000-0000-4000-8000-00000000000b'),
  1,
  'um alerta para o dono da conta'
);
-- Lido no app, o alerta continua na fila de e-mail.
UPDATE public.notificacoes SET lido_em = now(), created_at = now() - interval '1 minute' WHERE tipo = 'acesso_novo';
SELECT ok(
  EXISTS (SELECT 1 FROM public.notificacoes_pendentes_email('imediato') WHERE titulo = 'Novo acesso à sua conta'),
  'alerta lido segue para o e-mail imediato'
);

SELECT * FROM finish();
ROLLBACK;
