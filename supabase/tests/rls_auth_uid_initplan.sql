-- pgTAP: catraca dos advisors de performance corrigidos em 20261016000000.
--
-- 1. auth.uid()/auth.jwt()/auth.role()/current_setting() em policy só dentro de
--    (SELECT ...): direto, o Postgres reavalia a função linha a linha (advisor
--    auth_rls_initplan). Escreva `user_id = (SELECT auth.uid())`.
-- 2. Nenhum índice duplicado (mesma tabela, colunas, opclass, expressão e predicado).

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(2);

SELECT is(
  (SELECT COALESCE(array_agg(tablename || '.' || policyname ORDER BY 1), '{}'::text[])
   FROM pg_policies
   WHERE schemaname = 'public'
     AND (coalesce(qual, '') || ' ' || coalesce(with_check, ''))
         ~ '(?<!SELECT )(auth\.(uid|jwt|role|email)\(\)|current_setting\()'),
  '{}'::text[],
  'policy chama auth.uid() e afins só dentro de (SELECT ...)'
);

SELECT is(
  (SELECT COALESCE(array_agg(nomes ORDER BY nomes), '{}'::text[]) FROM (
     SELECT string_agg(i.relname, ' = ' ORDER BY i.relname) AS nomes
     FROM pg_index x
     JOIN pg_class i ON i.oid = x.indexrelid
     JOIN pg_class t ON t.oid = x.indrelid
     WHERE t.relnamespace = 'public'::regnamespace
     GROUP BY x.indrelid, x.indkey::text, x.indclass::text,
              coalesce(pg_get_expr(x.indexprs, x.indrelid), ''),
              coalesce(pg_get_expr(x.indpred, x.indrelid), '')
     HAVING count(*) > 1
   ) d),
  '{}'::text[],
  'nenhum índice duplicado em public'
);

SELECT * FROM finish();

ROLLBACK;
