-- pgTAP: catraca de catálogo para RLS.
--
-- A matriz cross-tenant (cross_tenant_matrix.sql) varre toda tabela que tem
-- empresa_id E RLS ligada. Uma tabela nova com empresa_id que nascesse sem
-- `ENABLE ROW LEVEL SECURITY` ficaria fora da varredura e vazaria entre empresas
-- sem nenhum teste reprovar. Esta catraca fecha esse buraco olhando o catálogo:
--
--   1. Toda tabela de public com empresa_id tem RLS ligada.
--   2. Toda tabela de public tem RLS ligada (tabela global sem empresa_id também:
--      com RLS e sem policy, ela fica fechada por padrão; aberta, qualquer usuário
--      lê e escreve). Tabela de extensão (ex.: PostGIS) fica de fora.
--
-- RLS ligada sem policy e com grant já é barrada por hardening_grants_search_path.sql.
--
-- Se um dia uma tabela precisar ficar sem RLS, a exceção entra aqui com o motivo escrito.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(2);

WITH tabelas AS (
  SELECT c.oid, c.relname, c.relrowsecurity
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p')
    AND NOT c.relispartition
    -- Tabela criada por extensão não é nossa para proteger aqui.
    AND NOT EXISTS (
      SELECT 1 FROM pg_depend d
      WHERE d.classid = 'pg_class'::regclass AND d.objid = c.oid AND d.deptype = 'e'
    )
),
com_empresa AS (
  SELECT t.* FROM tabelas t
  WHERE EXISTS (
    SELECT 1 FROM pg_attribute a
    WHERE a.attrelid = t.oid AND a.attname = 'empresa_id' AND NOT a.attisdropped
  )
)
SELECT is(
  (SELECT COALESCE(array_agg(relname::text ORDER BY relname), '{}'::text[])
   FROM com_empresa WHERE NOT relrowsecurity),
  '{}'::text[],
  'toda tabela com empresa_id tem RLS ligada'
);

WITH tabelas AS (
  SELECT c.oid, c.relname, c.relrowsecurity
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p')
    AND NOT c.relispartition
    AND NOT EXISTS (
      SELECT 1 FROM pg_depend d
      WHERE d.classid = 'pg_class'::regclass AND d.objid = c.oid AND d.deptype = 'e'
    )
)
SELECT is(
  (SELECT COALESCE(array_agg(relname::text ORDER BY relname), '{}'::text[])
   FROM tabelas WHERE NOT relrowsecurity),
  '{}'::text[],
  'toda tabela de public tem RLS ligada'
);

SELECT * FROM finish();
ROLLBACK;
