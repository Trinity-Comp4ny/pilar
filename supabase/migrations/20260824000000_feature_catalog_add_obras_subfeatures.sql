-- Adiciona as sub-features do módulo Obras ao catálogo de features do backend
-- (spec 035, ADR 0019).
--
-- _validate_features_payload() valida empresas.features e profiles.features
-- contra _feature_catalog(). Sem estas chaves, gravar `obras_estoque: false`
-- (desligar uma sub-feature por empresa) seria rejeitado como
-- 'Feature desconhecida'. Mantém o mesmo padrão de 20260730170000 (add obras)
-- e 20260721000000 (add ai_chat).
--
-- Semântica (aplicada no front, ver features.ts): sub-feature só vale se o
-- módulo-pai 'obras' estiver ligado; ausência no JSONB herda o pai (ligado);
-- desligar grava `false` explícito. O gate de dados permanece no nível do
-- módulo ('obras') + empresa_id nas RLS existentes — sub-feature é gate de
-- experiência, não fronteira de dados.

CREATE OR REPLACE FUNCTION public._feature_catalog()
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT ARRAY[
    'dashboard',
    'relatorios',
    'leads',
    'propostas',
    'clientes',
    'projetos',
    'planejamento',
    'timesheet',
    'mapa',
    'financeiro',
    'pessoas',
    'metas',
    'portal_cliente',
    'ai_hub',
    'capacidade',
    'templates',
    'ai_chat',
    'obras',
    'obras_fornecedores',
    'obras_clima',
    'obras_diario',
    'obras_cronograma',
    'obras_cotacoes',
    'obras_estoque',
    'obras_conta'
  ];
$function$;
