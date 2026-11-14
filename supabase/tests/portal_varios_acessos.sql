-- pgTAP: vários acessos ao portal por cliente (SPEC 164, migration 20261225000000).
-- O mesmo cliente aceita mais de um e-mail; dentro do escritório um e-mail continua sendo
-- de um acesso só.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(3);

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed)
VALUES ('a1650000-0000-0000-0000-0000000000a1', 'Empresa Portal Vários', NULL, TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clientes (id, empresa_id, nome)
VALUES
  ('a1650000-0000-0000-0000-0000000000c1', 'a1650000-0000-0000-0000-0000000000a1', 'João'),
  ('a1650000-0000-0000-0000-0000000000c2', 'a1650000-0000-0000-0000-0000000000a1', 'Outro')
ON CONFLICT (id) DO NOTHING;

SELECT lives_ok(
  $$INSERT INTO public.cliente_portal_accounts (cliente_id, empresa_id, nome, email)
    VALUES ('a1650000-0000-0000-0000-0000000000c1', 'a1650000-0000-0000-0000-0000000000a1', 'João', 'joao@seed.test'),
           ('a1650000-0000-0000-0000-0000000000c1', 'a1650000-0000-0000-0000-0000000000a1', 'Maria, esposa', 'maria@seed.test')$$,
  'o mesmo cliente tem dois acessos'
);

SELECT is(
  (SELECT count(*)::int FROM public.cliente_portal_accounts WHERE cliente_id = 'a1650000-0000-0000-0000-0000000000c1'),
  2,
  'os dois acessos ficam no cliente'
);

SELECT throws_ok(
  $$INSERT INTO public.cliente_portal_accounts (cliente_id, empresa_id, nome, email)
    VALUES ('a1650000-0000-0000-0000-0000000000c2', 'a1650000-0000-0000-0000-0000000000a1', 'Outro', 'maria@seed.test')$$,
  '23505',
  NULL,
  'e-mail que já acessa um cliente não vira acesso de outro no mesmo escritório'
);

SELECT * FROM finish();
ROLLBACK;
