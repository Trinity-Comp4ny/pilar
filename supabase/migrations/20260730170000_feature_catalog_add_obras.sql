-- Adiciona 'obras' (módulo Obras, reaberto — ADR 0011, spec 015) ao catálogo de
-- features do backend.
--
-- Mesmo gap do ai_chat (ver 20260721000000): o catálogo do front
-- (src/lib/features.ts) já tem 'obras', mas _feature_catalog() no banco não.
-- Como _validate_features_payload() valida profiles.features contra esse catálogo,
-- gravar obras no perfil era rejeitado ('Feature desconhecida: obras'), travando
-- owner/coordenador/colaborador (admin bypassa profiles.features).

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
    'obras'
  ];
$function$;
