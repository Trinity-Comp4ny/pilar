-- pgTAP: _ops_sinais_saude() (SPEC 105). Contagens por componente numa janela, e só o
-- service_role chama (a regra geral do prefixo "_" está em funcoes_internas_grants.sql).

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(7);

SELECT ok(
  NOT has_function_privilege('authenticated', 'public._ops_sinais_saude(interval, interval)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public._ops_sinais_saude(interval, interval)', 'EXECUTE'),
  'usuário e anônimo não chamam _ops_sinais_saude'
);
SELECT ok(
  has_function_privilege('service_role', 'public._ops_sinais_saude(interval, interval)', 'EXECUTE'),
  'service_role chama _ops_sinais_saude'
);

-- Cenário: tabelas zeradas dentro da transação, depois um pouco de cada coisa.
DELETE FROM public.email_envios;
DELETE FROM public.pilar_checkout_webhook_logs;
DELETE FROM public.agent_runs;
DELETE FROM public.jobs;

INSERT INTO public.empresas (id, nome, onboarding_completed)
VALUES ('00000000-0000-0000-0000-0000000005a1', 'Empresa sinais pgtap', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.email_envios (classe, tipo, destinatario, assunto, status, created_at)
VALUES
  ('plataforma', 'pgtap', 'a@pgtap.test', 'ok', 'enviado', now() - interval '10 minutes'),
  ('plataforma', 'pgtap', 'b@pgtap.test', 'falha', 'falhou', now() - interval '5 minutes'),
  ('plataforma', 'pgtap', 'c@pgtap.test', 'antigo', 'falhou', now() - interval '3 hours');

INSERT INTO public.pilar_checkout_webhook_logs (event, processed, error, created_at)
VALUES
  ('PAYMENT_CONFIRMED', true, NULL, now() - interval '20 minutes'),
  ('PAYMENT_CONFIRMED', false, 'assinatura não encontrada', now() - interval '2 minutes');

INSERT INTO public.agent_runs (empresa_id, agent_type, status, updated_at)
VALUES
  ('00000000-0000-0000-0000-0000000005a1', 'pgtap', 'failed', now() - interval '1 minute'),
  ('00000000-0000-0000-0000-0000000005a1', 'pgtap', 'executed', now() - interval '30 minutes');

SELECT is(
  (public._ops_sinais_saude() -> 'emails' ->> 'ok')::int || '/' || (public._ops_sinais_saude() -> 'emails' ->> 'falhas'),
  '1/1',
  'e-mails: conta só a janela de 1 h (a falha de 3 h atrás fica fora)'
);
SELECT is(
  (public._ops_sinais_saude() -> 'pagamentos' ->> 'falhas')::int,
  1,
  'pagamentos: webhook com erro conta como falha'
);
SELECT ok(
  (public._ops_sinais_saude() -> 'pagamentos' ->> 'ultima_falha')::timestamptz
    > (public._ops_sinais_saude() -> 'pagamentos' ->> 'ultimo_ok')::timestamptz,
  'pagamentos: devolve horário da última falha e do último sucesso'
);
SELECT is(
  (public._ops_sinais_saude() -> 'ia' ->> 'ok')::int || '/' || (public._ops_sinais_saude() -> 'ia' ->> 'falhas'),
  '1/1',
  'ia: agentes executados e falhos'
);
SELECT ok(
  (public._ops_sinais_saude() -> 'crons') ? 'disponivel',
  'crons: informa se o pg_cron existe neste banco'
);

SELECT * FROM finish();

ROLLBACK;
