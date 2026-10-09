-- pgTAP: funções internas não são executáveis por usuário logado nem por anon.
--
-- O anon_function_grants.sql cobre o anon. Este cobre o authenticated, que no Supabase
-- também ganha EXECUTE em toda função nova de public. Duas regras:
--   1. SECURITY DEFINER com prefixo "_" é interna por convenção: nunca para anon nem
--      authenticated. Função nova com "_" que precise ser chamada pelo front está com
--      o nome errado.
--   2. A lista nomeada (sem "_" por motivo histórico) idem, e as chamadas por Edge
--      Function continuam executáveis pelo service_role.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(3);

SELECT is(
  (SELECT COALESCE(array_agg(p.proname || '(' || oidvectortypes(p.proargtypes) || ')' ORDER BY 1), '{}'::text[])
   FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.prokind = 'f'
     AND p.prosecdef
     AND p.proname LIKE '\_%'
     AND pg_get_function_result(p.oid) <> 'trigger'
     AND (has_function_privilege('authenticated', p.oid, 'EXECUTE')
          OR has_function_privilege('anon', p.oid, 'EXECUTE'))),
  '{}'::text[],
  'nenhuma SECURITY DEFINER com prefixo _ é executável por anon ou authenticated'
);

SELECT is(
  (SELECT COALESCE(array_agg(f ORDER BY f), '{}'::text[])
   FROM unnest(ARRAY[
     'regenerate_convite_token(uuid)',
     'portal_aprovar_proposta_atomica(uuid, uuid)',
     'check_rate_limit(text, text, integer, integer)',
     'notificar(uuid, uuid[], text, text, text, text, text, text, uuid, text, timestamptz)',
     'find_or_create_fatura(uuid, date)',
     'recalc_disciplina_status_por_checklist(uuid)',
     'recalc_grupo_parcela_status(uuid)',
     'rpc_atualizar_status_atrasados()',
     'gerar_alertas_ambient()',
     'gerar_notificacoes_ambient()',
     'cleanup_expired_pending_signups()',
     'rate_limit_cleanup()'
   ]) AS f
   WHERE has_function_privilege('authenticated', ('public.' || f)::regprocedure, 'EXECUTE')
      OR has_function_privilege('anon', ('public.' || f)::regprocedure, 'EXECUTE')),
  '{}'::text[],
  'funções internas nomeadas não são executáveis por anon ou authenticated'
);

SELECT is(
  (SELECT COALESCE(array_agg(f ORDER BY f), '{}'::text[])
   FROM unnest(ARRAY[
     '_campo_create_account(uuid, uuid, text, text, text, uuid)',
     '_campo_create_account_convite(uuid, uuid, text, text, text, uuid)',
     '_campo_registrar_foto(text, uuid, text)',
     '_portal_create_account_convite(uuid, uuid, text, text, text, uuid)',
     '_portal_reset_password_convite(uuid, text)',
     'regenerate_convite_token(uuid)',
     'portal_aprovar_proposta_atomica(uuid, uuid)',
     'check_rate_limit(text, text, integer, integer)'
   ]) AS f
   WHERE NOT has_function_privilege('service_role', ('public.' || f)::regprocedure, 'EXECUTE')),
  '{}'::text[],
  'funções chamadas por Edge Function seguem executáveis pelo service_role'
);

SELECT * FROM finish();

ROLLBACK;
