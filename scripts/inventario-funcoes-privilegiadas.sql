-- Execute com psql -v ON_ERROR_STOP=1 -f scripts/inventario-funcoes-privilegiadas.sql.
-- Inventário de catálogo: não executa RPCs da aplicação nem lê dados de clientes.
BEGIN READ ONLY;

SELECT n.nspname AS esquema,
       p.proname AS nome,
       pg_catalog.pg_get_function_identity_arguments(p.oid) AS argumentos,
       pg_catalog.pg_get_userbyid(p.proowner) AS proprietario,
       pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE') AS executavel_anon,
       pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE') AS executavel_authenticated,
       pg_catalog.has_function_privilege('service_role', p.oid, 'EXECUTE') AS executavel_service_role,
       (
         SELECT substring(opcao FROM length('search_path=') + 1)
         FROM unnest(p.proconfig) AS config(opcao)
         WHERE opcao LIKE 'search_path=%'
       ) AS search_path_explicito,
       e.extname AS extensao
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
LEFT JOIN pg_catalog.pg_depend d ON d.classid = 'pg_catalog.pg_proc'::regclass AND d.objid = p.oid
  AND d.refclassid = 'pg_catalog.pg_extension'::regclass AND d.deptype = 'e'
LEFT JOIN pg_catalog.pg_extension e ON e.oid = d.refobjid
WHERE n.nspname = 'public' AND p.prosecdef AND p.prokind IN ('f', 'p')
ORDER BY executavel_anon DESC, executavel_authenticated DESC, nome, argumentos;

SELECT c.relname AS view,
       pg_catalog.pg_get_userbyid(c.relowner) AS proprietario,
       coalesce(c.reloptions @> ARRAY['security_invoker=true'], false) AS security_invoker,
       pg_catalog.has_table_privilege('anon', c.oid, 'SELECT') AS leitura_anon,
       pg_catalog.has_table_privilege('authenticated', c.oid, 'SELECT') AS leitura_authenticated
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'v'
  AND c.relname IN ('escopos_safe', 'projetos_safe', 'pessoas_safe', 'leads_safe')
ORDER BY c.relname;

COMMIT;
