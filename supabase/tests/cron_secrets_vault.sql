-- pgTAP: helper de vault para cron jobs (migration 20260913000000). Cobre:
-- (1) leitura correta do vault, (2) fail-closed sem lançar quando ausente,
-- (3) authenticated não executa o helper nem as funções de disparo.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(6);

-- Limpa qualquer resíduo de outro teste/sessão com o mesmo nome, roda isolado.
DELETE FROM vault.decrypted_secrets WHERE name = 'app_test_secret_pgtap';
SELECT vault.create_secret('valor-de-teste', 'app_test_secret_pgtap', 'pgTAP');

SELECT is(
  public._cron_secret('app_test_secret_pgtap'), 'valor-de-teste',
  '_cron_secret lê o valor certo do vault'
);

SELECT ok(
  public._cron_secret('app_nome_que_nao_existe_pgtap') IS NULL,
  '_cron_secret devolve NULL (não lança) quando o secret não existe'
);

-- Sem secrets configurados, notificacoes_email_disparar não lança (fail-closed).
DELETE FROM vault.decrypted_secrets WHERE name IN ('app_supabase_url', 'app_cron_secret');
SELECT lives_ok(
  $$ SELECT public.notificacoes_email_disparar('imediato') $$,
  'notificacoes_email_disparar não lança quando os secrets do vault estão ausentes'
);

SELECT lives_ok(
  $$ SELECT public.trial_expiry_disparar() $$,
  'trial_expiry_disparar não lança quando os secrets do vault estão ausentes'
);

CREATE OR REPLACE FUNCTION test_set_auth(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

SELECT test_set_auth('77777777-0000-0000-0000-000000009999');
SET ROLE authenticated;

SELECT throws_ok(
  $$ SELECT public._cron_secret('app_supabase_url') $$,
  '42501', NULL,
  'authenticated não executa _cron_secret (permission denied)'
);

SELECT throws_ok(
  $$ SELECT public.guardiao_margem_disparar() $$,
  '42501', NULL,
  'authenticated não executa guardiao_margem_disparar (permission denied)'
);

RESET ROLE;
DELETE FROM vault.decrypted_secrets WHERE name IN ('app_test_secret_pgtap', 'app_supabase_url', 'app_cron_secret');

SELECT * FROM finish();
ROLLBACK;
