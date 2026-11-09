-- pgTAP: trava duas regras de higiene de schema fechadas pelas migrations
-- 20261031000000 (índice em FK) e 20261031000100 (search_path fixo).
--
-- Sem teste, as duas se desfazem sozinhas: cada tabela nova com FK e cada função nova
-- nascem sem índice e sem search_path a menos que quem escreveu lembre (foi assim que os
-- advisors de produção chegaram a 135 FKs sem índice e 26 funções mutáveis).

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(2);

-- 1. Toda FK do schema public tem índice cobrindo as colunas, exceto as de auditoria para
--    auth.users com NO ACTION (created_by, updated_by...): ninguém filtra por elas e o
--    custo de escrita não paga. FK para `users` com CASCADE/SET NULL precisa de índice.
SELECT is(
  (SELECT COALESCE(array_agg(rel.relname || '.' || con.conname ORDER BY rel.relname, con.conname), '{}'::text[])
   FROM pg_constraint con
   JOIN pg_class rel ON rel.oid = con.conrelid
   JOIN pg_namespace n ON n.oid = rel.relnamespace
   JOIN pg_class pai ON pai.oid = con.confrelid
   JOIN pg_namespace np ON np.oid = pai.relnamespace
   WHERE n.nspname = 'public'
     AND con.contype = 'f'
     AND NOT (con.confdeltype = 'a' AND np.nspname = 'auth' AND pai.relname = 'users')
     AND NOT EXISTS (
       SELECT 1 FROM pg_index i
       WHERE i.indrelid = con.conrelid
         AND i.indisvalid
         AND (i.indkey::int2[])[0:cardinality(con.conkey) - 1] = con.conkey
     )),
  '{}'::text[],
  'toda FK do public tem índice (exceto auditoria NO ACTION para auth.users)'
);

-- 2. Toda função do app (não de extensão) no schema public tem search_path fixo.
SELECT is(
  (SELECT COALESCE(array_agg(p.oid::regprocedure::text ORDER BY p.oid::regprocedure::text), '{}'::text[])
   FROM pg_proc p
   JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
     AND (p.proconfig IS NULL
          OR NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%'))),
  '{}'::text[],
  'toda função do public tem search_path fixo'
);

SELECT * FROM finish();
ROLLBACK;
