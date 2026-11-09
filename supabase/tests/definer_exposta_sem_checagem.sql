-- pgTAP: função SECURITY DEFINER executável por usuário precisa checar quem chama.
--
-- Contexto (auditoria 2026-10-14): SECURITY DEFINER roda com o privilégio do dono
-- (BYPASSRLS). Exposta a `authenticated` ou `anon` sem checar identidade ou tenant, ela
-- vira porta lateral que ignora toda a RLS. O funcoes_internas_grants.sql cobre o
-- prefixo "_" e uma lista nomeada; este arquivo cobre o caso geral por regra:
--
--   toda SECURITY DEFINER (não-trigger) executável por authenticated ou anon tem que
--   referenciar, no corpo, ao menos um controle de identidade, tenant, papel ou
--   sessão própria (portal/campo). Função nova que não passe nisso reprova o PR:
--   ou ganha a checagem, ou perde o EXECUTE, ou entra na lista de exceções abaixo com
--   o motivo escrito.
--
-- A regra é heurística (olha o texto do corpo): pega o esquecimento, não prova que a
-- checagem está correta. Correção da checagem é coberta pela matriz cross-tenant
-- (cross_tenant_matrix.sql) e pelos testes de cada módulo.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(2);

-- Controles aceitos no corpo da função.
CREATE TEMP TABLE _padrao_checagem AS
SELECT '(auth\.uid|auth\.role|auth\.jwt|get_user_empresa_id|my_empresa_id|is_ultra_admin|has_role|can_view|can_manage|current_effective_role|is_company_admin|user_has_feature|verify_session|token_sessao|_assert|exigir|require|get_user_role|_soft_delete_guard)'::text AS re;

-- Exceções justificadas (nome(args)). Cada linha precisa de motivo.
CREATE TEMP TABLE _excecao (assinatura text PRIMARY KEY, motivo text NOT NULL);
INSERT INTO _excecao VALUES
  ('guard_login_attempt(text)',
   'rate limit do login: por desenho anônimo, só consulta e grava contador por e-mail/IP, sem ler dado de tenant'),
  ('check_convite_rate_limit(uuid)',
   'só conta convites da empresa informada e lança erro de limite, não devolve dado; chamada pela edge invite-user');

-- 1. Nenhuma DEFINER exposta fora da lista deixa de referenciar um controle.
SELECT is(
  (SELECT COALESCE(array_agg(p.proname || '(' || oidvectortypes(p.proargtypes) || ')' ORDER BY p.proname), '{}'::text[])
     FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.prokind = 'f'
      AND p.prosecdef
      AND pg_get_function_result(p.oid) <> 'trigger'
      AND (has_function_privilege('authenticated', p.oid, 'EXECUTE')
           OR has_function_privilege('anon', p.oid, 'EXECUTE'))
      AND p.prosrc !~* (SELECT re FROM _padrao_checagem)
      AND (p.proname || '(' || oidvectortypes(p.proargtypes) || ')') NOT IN (SELECT assinatura FROM _excecao)),
  '{}'::text[],
  'toda SECURITY DEFINER exposta a usuário referencia um controle de identidade ou tenant'
);

-- 2. A lista de exceções não apodrece: toda entrada ainda existe e ainda é necessária
--    (se passou a ter checagem ou perdeu o EXECUTE, sai da lista).
SELECT is(
  (SELECT COALESCE(array_agg(e.assinatura ORDER BY e.assinatura), '{}'::text[])
     FROM _excecao e
    WHERE NOT EXISTS (
      SELECT 1 FROM pg_proc p
       WHERE p.pronamespace = 'public'::regnamespace
         AND p.prosecdef
         AND (p.proname || '(' || oidvectortypes(p.proargtypes) || ')') = e.assinatura
         AND (has_function_privilege('authenticated', p.oid, 'EXECUTE')
              OR has_function_privilege('anon', p.oid, 'EXECUTE'))
         AND p.prosrc !~* (SELECT re FROM _padrao_checagem)
    )),
  '{}'::text[],
  'toda exceção listada ainda existe, ainda é exposta e ainda não tem checagem no corpo'
);

SELECT * FROM finish();

ROLLBACK;
