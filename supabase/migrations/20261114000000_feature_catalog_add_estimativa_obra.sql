-- SPEC 136: registra 'estimativa_obra' no catálogo de features do banco.
--
-- _validate_features_payload() valida empresas.features e profiles.features contra
-- _feature_catalog(). Sem a chave, o ultra admin não consegue ligar a feature por
-- empresa ('Feature desconhecida'). Mesmo padrão de 20260824000000. Arquivo separado,
-- com "feature_catalog" no nome, porque o teste de sincronia do front lê o catálogo mais
-- recente por esse nome (src/lib/features.test.ts).
--
-- Opt-in: a chave ausente do JSONB significa desligada (feature-raiz, não sub-feature).

CREATE OR REPLACE FUNCTION public._feature_catalog()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = ''
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
    'obras_conta',
    'estimativa_obra'
  ];
$function$;
