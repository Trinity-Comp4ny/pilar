-- pgTAP: trava a causa raiz da migration 20260836000000 — nenhuma função SECURITY
-- DEFINER nova ou existente deve nascer/ficar executável por anon sem entrar
-- explicitamente na allowlist abaixo. Sem este teste, o histórico já provou (3 vezes:
-- 20260725000000, 20260810120000, 20260835000000) que o vetor volta a abrir sozinho
-- toda vez que alguém cria uma RPC e esquece de revogar.
--
-- Allowlist tem que ser mantida em sincronia com a de 20260836000000: um item
-- adicionado lá sem espelhar aqui falha o teste (funciona como lembrete), e um item
-- adicionado aqui sem revisão vira brecha silenciosa — então adicionar aqui exige o
-- mesmo cuidado de "por que essa função precisa ser pública" que a migration documenta.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(1);

WITH allowed(sig) AS (
  VALUES
    -- Helpers de RLS (USING/WITH CHECK precisam avaliar pra anon)
    ('get_user_empresa_id()'), ('get_user_empresa_id_text()'), ('get_user_role()'),
    ('has_role(user_role[])'), ('is_company_admin()'), ('is_ultra_admin()'),
    ('my_empresa_id()'), ('can_view_financeiro()'), ('can_view_folha()'),
    ('user_has_feature(text, text)'), ('is_feature_flag_enabled(text)'),
    ('current_effective_role()'), ('current_impersonation()'), ('current_pessoa_id()'),
    ('is_impersonating()'),
    -- Entrypoints pré-autenticação com caller anon real (portal/campo/cliente)
    ('portal_login(text, text)'), ('portal_verify_session(text)'),
    ('portal_verify_session_readonly(text)'), ('portal_change_password(text, text, text)'),
    ('portal_listar_entregas(text, uuid)'), ('portal_aprovar_entrega(text, uuid)'),
    ('portal_solicitar_revisao_entrega(text, uuid, text)'), ('campo_login(text, text)'),
    ('campo_verify_session(text)'), ('campo_trocar_senha(text, text)'),
    ('campo_listar_tarefas(text)'), ('campo_criar_tarefa(text, text)'),
    ('campo_listar_rdos(text, integer)'),
    ('campo_salvar_rdo(text, date, text, text, integer, text, text, text)'),
    ('campo_registrar_tarefa_rdo(text, uuid, uuid, text, text)'),
    ('campo_registrar_medicao(text, uuid, text, numeric, text)'),
    ('get_cliente_projetos(text)'), ('get_cliente_projeto_detail(uuid, text)'),
    ('get_cliente_obras(text)'), ('get_cliente_obra_detail(text, uuid)'),
    ('guard_login_attempt(text)')
),
exposto AS (
  SELECT p.proname || '(' || oidvectortypes(p.proargtypes) || ')' AS sig
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef = true
    AND pg_get_function_result(p.oid) <> 'trigger'
    AND has_function_privilege('anon', p.oid, 'EXECUTE')
    AND (p.proname || '(' || oidvectortypes(p.proargtypes) || ')') NOT IN (SELECT sig FROM allowed)
)
SELECT is(
  (SELECT COALESCE(array_agg(sig ORDER BY sig), '{}'::text[]) FROM exposto),
  '{}'::text[],
  'nenhuma função SECURITY DEFINER fora da allowlist é executável por anon'
);

-- NÃO testamos "função nova nasce sem anon por padrão" aqui: verificado ao vivo
-- (2026-08-17) que uma função criada como `postgres` no schema `public` deste Postgres
-- local nasce com EXECUTE pra PUBLIC mesmo depois de
-- `ALTER DEFAULT PRIVILEGES FOR ROLE postgres ... REVOKE ... FROM PUBLIC` — há um
-- default por trás disso pertencente a `supabase_admin` (o superuser real aqui) que
-- `postgres` não pode alterar. Por isso a trava é este teste (roda no CI a cada PR,
-- pega a função nova sem depender de ALTER DEFAULT PRIVILEGES funcionar), não uma
-- asserção sobre o mecanismo de privilégio padrão do Postgres.

SELECT * FROM finish();

ROLLBACK;
