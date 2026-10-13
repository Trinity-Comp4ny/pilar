-- pgTAP: pedido de exportação de dados avisa o encarregado (migration 20261023000000).
-- Cobre: (1) o trigger existe na tabela, (2) a função de trigger não é executável por
-- ninguém, (3) o INSERT do pedido não falha quando o aviso não tem como sair (sem
-- segredos no Vault): o pedido fica gravado.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(4);

SELECT has_trigger(
  'public', 'data_export_requests', 'trg_notify_data_export_request',
  'data_export_requests tem o trigger de aviso ao encarregado'
);

SELECT ok(
  NOT has_function_privilege('authenticated', 'public.notify_data_export_request()', 'EXECUTE'),
  'authenticated não executa a função de trigger'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.notify_data_export_request()', 'EXECUTE'),
  'anon não executa a função de trigger'
);

-- Usuário de teste e pedido: sem segredos de teste no Vault, o trigger só registra
-- NOTICE e o INSERT segue.
INSERT INTO auth.users (id, email, aud, role)
VALUES ('00000000-0000-4000-8000-00000000e001', 'lgpd-export@pgtap.test', 'authenticated', 'authenticated');

INSERT INTO public.data_export_requests (user_id) VALUES ('00000000-0000-4000-8000-00000000e001');

SELECT is(
  (SELECT status FROM public.data_export_requests WHERE user_id = '00000000-0000-4000-8000-00000000e001'),
  'pending',
  'pedido de exportação fica gravado mesmo quando o aviso é pulado'
);

SELECT * FROM finish();
ROLLBACK;
