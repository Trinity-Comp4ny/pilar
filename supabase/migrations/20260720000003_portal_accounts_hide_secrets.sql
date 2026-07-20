-- ACH-RLS-05: cliente_portal_accounts expõe senha_hash e token_sessao (token de
-- sessão ativo) num select=* para staff autenticado. Combinado com ACH-RLS-01,
-- permitia roubo de sessão de portal. RLS não faz filtro por coluna, então
-- revogamos o privilégio de SELECT dessas duas colunas para authenticated/anon.
-- Edge functions (invite/reset) usam service_role e seguem lendo tudo.
-- Nenhum código client-side lê essas colunas (só id/email/cliente_id/ativo).

REVOKE SELECT (senha_hash, token_sessao) ON public.cliente_portal_accounts FROM authenticated;
REVOKE SELECT (senha_hash, token_sessao) ON public.cliente_portal_accounts FROM anon;
