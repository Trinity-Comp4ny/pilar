-- Remove portal de token legado — substituído pelo portal autenticado (cliente_portal_accounts)
-- O portal de token nunca teve UI de geração de token no frontend; toda nova sessão
-- usa portal_login + portal_verify_session sobre cliente_portal_accounts.

DROP TABLE IF EXISTS public.portal_tokens CASCADE;

DROP FUNCTION IF EXISTS public.verify_portal_token(text);
