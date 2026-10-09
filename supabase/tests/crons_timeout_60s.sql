-- pgTAP: migration 20261017000000. Todo disparo de cron por pg_net espera até
-- 60s pela edge function (o padrão de 5s registrava timeout na cobrança real).

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(5);

SELECT ok(pg_get_functiondef('public.trial_expiry_disparar()'::regprocedure) LIKE '%timeout_milliseconds := 60000%', 'trial_expiry_disparar espera 60s');
SELECT ok(pg_get_functiondef('public.notificacoes_email_disparar(text)'::regprocedure) LIKE '%timeout_milliseconds := 60000%', 'notificacoes_email_disparar espera 60s');
SELECT ok(pg_get_functiondef('public.guardiao_margem_disparar()'::regprocedure) LIKE '%timeout_milliseconds := 60000%', 'guardiao_margem_disparar espera 60s');
SELECT ok(pg_get_functiondef('public.retencao_pos_trial_disparar()'::regprocedure) LIKE '%timeout_milliseconds := 60000%', 'retencao_pos_trial_disparar espera 60s');
SELECT ok(pg_get_functiondef('public.reverificar_documentos_disparar()'::regprocedure) LIKE '%timeout_milliseconds := 60000%', 'reverificar_documentos_disparar espera 60s');

SELECT * FROM finish();
ROLLBACK;
