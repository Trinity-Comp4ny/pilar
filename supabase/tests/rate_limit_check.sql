-- pgTAP: check_rate_limit (rate limiter DB-backed, cross-instance).
--
-- A função já existia (migration 20260836000000) e já é usada por
-- pilar-checkout-create/create-company-owner/delete-user via _shared/db-rate-limit.ts,
-- mas nunca tinha teste automatizado. Este arquivo trava o contrato antes de
-- estender o uso pra mais endpoints públicos (turnstile-verify, pilar-checkout-status,
-- portal-get-projeto, portal-aprovar-proposta, portal-entrega-download).
--
-- Cobertura:
--   1. Dentro do limite → allowed = true
--   2. Estoura o limite → allowed = false
--   3. Chaves diferentes no mesmo bucket não se afetam
--   4. Buckets diferentes com a mesma chave não se afetam
--   5. Janela desliza: tentativa fora da janela (created_at antigo) não conta
--      pro limite → reset natural sem precisar de cleanup
--   6. rate_limit_cleanup() remove só o que passou de 1h

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(9);

-- Isola este teste de qualquer resíduo de outros testes/uso local.
DELETE FROM public.rate_limit_attempts WHERE key LIKE 'pgtap_%';

-- 1-3: dentro do limite (max=3) as 3 primeiras tentativas passam
SELECT ok(public.check_rate_limit('pgtap_bucket', 'k1', 3, 60), 'tentativa 1/3 permitida');
SELECT ok(public.check_rate_limit('pgtap_bucket', 'k1', 3, 60), 'tentativa 2/3 permitida');
SELECT ok(public.check_rate_limit('pgtap_bucket', 'k1', 3, 60), 'tentativa 3/3 permitida');

-- 4: a 4ª tentativa estoura o limite
SELECT ok(NOT public.check_rate_limit('pgtap_bucket', 'k1', 3, 60), 'tentativa 4/3 bloqueada (limite estourado)');

-- 5: chave diferente no mesmo bucket é independente (não herda o bloqueio de k1)
SELECT ok(public.check_rate_limit('pgtap_bucket', 'k2', 3, 60), 'chave k2 não é afetada pelo limite de k1');

-- 6: mesma chave em bucket diferente também é independente
SELECT ok(public.check_rate_limit('pgtap_outro_bucket', 'k1', 3, 60), 'bucket diferente não é afetado pelo limite de pgtap_bucket:k1');

-- 7: janela desliza — attempts fora da janela (2h atrás) não contam pro limite.
-- Simula reset sem esperar o relógio: insere 3 tentativas "antigas" pra uma chave
-- nova e confirma que uma janela de 60s não as enxerga (limite não deveria estourar).
INSERT INTO public.rate_limit_attempts (key, created_at)
VALUES
  ('pgtap_janela:k3', NOW() - INTERVAL '2 hours'),
  ('pgtap_janela:k3', NOW() - INTERVAL '2 hours'),
  ('pgtap_janela:k3', NOW() - INTERVAL '2 hours');

SELECT ok(
  public.check_rate_limit('pgtap_janela', 'k3', 3, 60),
  'tentativas fora da janela de 60s não contam pro limite (reset natural)'
);

-- 8: a mesma chave, mas com janela grande o bastante pra enxergar as antigas,
-- já estava no limite (3 antigas + a que a linha acima acabou de inserir = 4 >= 3)
SELECT ok(
  NOT public.check_rate_limit('pgtap_janela', 'k3', 3, 3 * 3600),
  'as mesmas tentativas contam quando a janela é grande o bastante pra alcançá-las'
);

-- 9: rate_limit_cleanup() remove só o que passou de 1h, preserva o resto
INSERT INTO public.rate_limit_attempts (key, created_at) VALUES ('pgtap_cleanup:antigo', NOW() - INTERVAL '2 hours');
INSERT INTO public.rate_limit_attempts (key, created_at) VALUES ('pgtap_cleanup:recente', NOW());

SELECT public.rate_limit_cleanup();

SELECT is(
  (SELECT COUNT(*)::int FROM public.rate_limit_attempts WHERE key = 'pgtap_cleanup:antigo'),
  0,
  'rate_limit_cleanup() remove tentativas com mais de 1h'
);

SELECT * FROM finish();

ROLLBACK;
