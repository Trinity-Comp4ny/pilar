-- Regressao: RPCs SECURITY DEFINER com operacoes financeiras e administrativas
-- NUNCA devem ser executaveis pela role anon via PostgREST.
-- Inventario verificado contra o Supabase staging em 19/11/2026.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(8);

WITH protegidas(sig, finalidade) AS (
  VALUES
    ('public.admin_create_company_owner(text,text,text)', 'criar owner de empresa'),
    ('public.rpc_criar_aditivo_projeto(uuid,text,text,numeric,uuid,uuid,uuid)', 'criar aditivo com valor'),
    ('public.rpc_prever_cobranca_aditivo(uuid,uuid,date,integer)', 'calcular cobranca de aditivo'),
    ('public.rpc_confirmar_cobranca_aditivo(uuid,jsonb,uuid,date,integer,text)', 'confirmar cobranca e parcelas'),
    ('public.rpc_resumo_aditivos_projeto(uuid)', 'consulta de aditivos e valores'),
    ('public.rpc_converter_proposta_projeto(uuid)', 'converter proposta e gerar financeiro'),
    ('public.ops_saude_empresas()', 'metrica global de operacao'),
    ('public.get_painel_gestao()', 'painel de gestao da empresa')
)
SELECT ok(
  to_regprocedure(sig) IS NOT NULL
    AND NOT COALESCE(has_function_privilege('anon', to_regprocedure(sig), 'EXECUTE'), true),
  finalidade || ': assinatura existente e EXECUTE proibido para anon'
)
FROM protegidas
ORDER BY sig;

SELECT * FROM finish();
ROLLBACK;
