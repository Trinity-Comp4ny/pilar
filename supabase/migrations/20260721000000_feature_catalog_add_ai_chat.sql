-- Adiciona 'ai_chat' (módulo Agentes) ao catálogo de features do backend.
--
-- Gap: o catálogo do front (src/lib/features.ts) já tinha 'ai_chat', mas
-- _feature_catalog() no banco não. Como _validate_features_payload() valida
-- profiles.features contra esse catálogo, gravar ai_chat no perfil era rejeitado
-- ('Feature desconhecida: ai_chat'). Consequência em produção: só admin
-- (que bypassa profiles.features) conseguia usar Agentes; owner/coordenador/
-- colaborador ficavam travados porque o backend recusava a escrita da feature.

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
    'ai_chat'
  ];
$function$;
