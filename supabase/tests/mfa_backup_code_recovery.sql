-- pgTAP: código de recuperação desliga o 2FA no servidor (migration
-- 20261014000000). Quem usa o código perdeu o autenticador e está em aal1; o
-- Supabase Auth não deixa o client remover fator verificado nessa sessão, então
-- a própria RPC precisa remover. Roda como authenticated, com o sub no JWT.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(5);

INSERT INTO auth.users (id, instance_id, aud, role, email)
VALUES ('00000000-0000-0000-0000-00000000b0c1', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'mfa.recovery@test.com');

INSERT INTO auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
VALUES (gen_random_uuid(), '00000000-0000-0000-0000-00000000b0c1', 'Authenticator', 'totp', 'verified', now(), now());

INSERT INTO public.mfa_backup_codes (user_id, code_hash)
SELECT '00000000-0000-0000-0000-00000000b0c1', extensions.crypt(c, extensions.gen_salt('bf'))
FROM unnest(ARRAY['AAAA-1111', 'BBBB-2222']) AS c;

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b0c1","role":"authenticated"}', true);

SET LOCAL ROLE authenticated;
SELECT is(public.mfa_consume_backup_code('ZZZZ-9999'), false, 'código errado é recusado');
RESET ROLE;

SELECT is(
  (SELECT count(*)::int FROM auth.mfa_factors WHERE user_id = '00000000-0000-0000-0000-00000000b0c1'),
  1,
  'código errado não mexe no 2FA'
);

SET LOCAL ROLE authenticated;
SELECT is(public.mfa_consume_backup_code(' aaaa-1111 '), true, 'código certo é aceito (normaliza espaço e caixa)');
RESET ROLE;

SELECT is(
  (SELECT count(*)::int FROM auth.mfa_factors WHERE user_id = '00000000-0000-0000-0000-00000000b0c1'),
  0,
  'código certo remove o fator TOTP'
);

SELECT is(
  (SELECT count(*)::int FROM public.mfa_backup_codes
   WHERE user_id = '00000000-0000-0000-0000-00000000b0c1' AND used_at IS NULL),
  0,
  'códigos que sobraram são invalidados'
);

SELECT * FROM finish();

ROLLBACK;
