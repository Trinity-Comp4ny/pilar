-- Remove RPCs mortas do portal de propostas (auditoria 2026-07-14).
--
-- get_portal_propostas e portal_atualizar_status_proposta (criadas em
-- 20260429000000_portal_propostas_rpc.sql) leem de public.portal_tokens, que foi
-- derrubada por 20260429600000_drop_legacy_token_portal.sql. As funções seguem
-- existentes e com GRANT EXECUTE a anon, então dão erro em runtime se chamadas e
-- ainda expõem superfície a anon sem necessidade. Nenhum caller no app (só no
-- types.ts gerado). O portal usa cliente_portal_accounts + get_cliente_projeto_detail.

DROP FUNCTION IF EXISTS public.get_portal_propostas(text);
DROP FUNCTION IF EXISTS public.portal_atualizar_status_proposta(text, uuid, text);
