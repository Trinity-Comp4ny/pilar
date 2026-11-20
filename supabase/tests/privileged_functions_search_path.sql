-- Endurecimento por regressao: roles expostos nao podem criar objetos em
-- public, e RPCs SECURITY DEFINER de cobranca devem pin-ar search_path.
-- Testes do schema local com ROLLBACK; nao alteram grants.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(7);

SELECT ok(NOT has_schema_privilege('anon', 'public', 'CREATE'),
  'anon nao consegue criar objetos no schema public');
SELECT ok(NOT has_schema_privilege('authenticated', 'public', 'CREATE'),
  'authenticated nao consegue criar objetos no schema public');

WITH funcoes(nome, assinatura) AS (
  VALUES
    ('admin_create_company_owner', 'public.admin_create_company_owner(text,text,text)'),
    ('rpc_criar_aditivo_projeto', 'public.rpc_criar_aditivo_projeto(uuid,text,text,numeric,uuid,uuid,uuid)'),
    ('rpc_prever_cobranca_aditivo', 'public.rpc_prever_cobranca_aditivo(uuid,uuid,date,integer)'),
    ('rpc_confirmar_cobranca_aditivo', 'public.rpc_confirmar_cobranca_aditivo(uuid,jsonb,uuid,date,integer,text)'),
    ('rpc_resumo_aditivos_projeto', 'public.rpc_resumo_aditivos_projeto(uuid)')
)
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.oid = to_regprocedure(assinatura)
      AND p.prosecdef
      AND EXISTS (
        SELECT 1 FROM unnest(p.proconfig) AS x(setting)
        WHERE x.setting = 'search_path=public'
      )
  ),
  nome || ': SECURITY DEFINER com search_path definido'
)
FROM funcoes ORDER BY nome;

SELECT * FROM finish();
ROLLBACK;
