-- Onda 0 — Portal auth: hashear o token de sessão em TODAS as funções de verificação (Opção A).
--
-- Contexto do bug (2026-07-13): portal_login grava token_sessao = encode(digest(token,'sha256'),'hex')
-- (hasheado) e retorna o token puro, MAS portal_verify_session e as RPCs de dados do portal
-- comparavam token_sessao = p_token (PLAINTEXT) → nunca batiam → todo cliente logava, via "bem-vindo"
-- e era devolvido ao login. Portal 100% inutilizável em produção.
--
-- Fix (seguro): patch in-place. Para cada função que ainda compara plaintext, pega a definição atual
-- (pg_get_functiondef) e substitui só `token_sessao = p_token` por
-- `token_sessao = encode(extensions.digest(p_token,'sha256'),'hex')`, re-executando o CREATE OR REPLACE.
-- Não reescreve o corpo à mão (zero risco de corromper). Idempotente e reversível (troca inversa).
-- Alcança: portal_verify_session, get_cliente_projetos, get_cliente_projeto_detail,
--          portal_get_projeto_disciplinas, portal_get_projeto_full.

do $$
declare
  r record;
  d text;
begin
  for r in
    select oid, proname
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and pg_get_functiondef(oid) ilike '%token_sessao = p_token%'
  loop
    d := replace(
      pg_get_functiondef(r.oid),
      'token_sessao = p_token',
      'token_sessao = encode(extensions.digest(p_token, ''sha256''), ''hex'')'
    );
    execute d;
    raise notice 'portal token hash aplicado em %', r.proname;
  end loop;
end $$;
