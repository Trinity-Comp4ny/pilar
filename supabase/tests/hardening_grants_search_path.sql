-- pgTAP: trava os dois invariantes fechados pela migration 20260849000000.
--
-- Sem isto, os dois se desfazem em silêncio pelo mesmo mecanismo que já reabriu
-- o vetor de anon 3 vezes: o default privilege do Postgres re-concede em objeto
-- novo criado pelo mesmo dono, e função nova nasce sem search_path fixo a menos
-- que quem escreveu tenha lembrado.
--
-- Complementa (não substitui) o scripts/audit-security.mjs: este teste roda no
-- CI contra um banco novo construído a partir das migrations, o script roda
-- contra o banco REAL de staging e produção. A diferença entre os dois é o que
-- pega drift, tipo migration que não chegou num ambiente.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(3);

-- ---------------------------------------------------------------------------
-- 1. Tabela com RLS e zero policy não pode ter grant pra anon/authenticated
-- ---------------------------------------------------------------------------
-- Proteção por ausência de regra é frágil: basta alguém adicionar uma policy
-- permissiva por um motivo legítimo e o grant aberto passa a valer. Revogar o
-- grant fecha em profundidade, sem depender de nada continuar não existindo.
WITH sem_policy_com_grant AS (
  SELECT c.relname::text AS relname
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relrowsecurity
    AND NOT EXISTS (SELECT 1 FROM pg_policy pol WHERE pol.polrelid = c.oid)
    AND (
      has_table_privilege('anon', c.oid, 'SELECT')
      OR has_table_privilege('authenticated', c.oid, 'SELECT')
    )
)
SELECT is(
  (SELECT COALESCE(array_agg(relname ORDER BY relname), '{}'::text[]) FROM sem_policy_com_grant),
  '{}'::text[],
  'tabela com RLS e zero policy não tem grant de SELECT pra anon/authenticated'
);

-- ---------------------------------------------------------------------------
-- 2. Toda função SECURITY DEFINER tem search_path fixo
-- ---------------------------------------------------------------------------
-- Sem search_path fixo, a função privilegiada usa o do chamador, e um schema
-- temporário com tabela de nome igual captura a referência: a função passa a
-- operar sobre dado do atacante com privilégio de dona.
WITH sem_search_path AS (
  SELECT p.proname || '(' || oidvectortypes(p.proargtypes) || ')' AS sig
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef
    AND (
      p.proconfig IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%'
      )
    )
)
SELECT is(
  (SELECT COALESCE(array_agg(sig ORDER BY sig), '{}'::text[]) FROM sem_search_path),
  '{}'::text[],
  'toda função SECURITY DEFINER do schema public tem search_path fixo'
);

-- ---------------------------------------------------------------------------
-- 3. View sensível declara o modelo de defesa
-- ---------------------------------------------------------------------------
-- View sem security_invoker roda como dona e NÃO herda o RLS de quem chama, ou
-- seja, não tem rede de segurança embaixo. Isso é legítimo quando a view precisa
-- mascarar coluna por papel (pessoas_safe faz isso com CPF, salário, PIX e conta
-- bancária via can_view_folha()), mas aí ela é obrigada a filtrar o tenant
-- explicitamente. Adicionar nome nesta lista exige ler a definição e confirmar
-- o filtro, igual à allowlist de anon_function_grants.sql.
WITH revisada(nome) AS (
  VALUES ('pessoas_safe'), ('projetos_safe')
),
sem_invoker AS (
  SELECT c.relname::text AS relname
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'v'
    AND NOT COALESCE(
      (SELECT option_value::boolean
       FROM pg_options_to_table(c.reloptions)
       WHERE option_name = 'security_invoker'),
      false)
    AND c.relname NOT IN (SELECT nome FROM revisada)
)
SELECT is(
  (SELECT COALESCE(array_agg(relname ORDER BY relname), '{}'::text[]) FROM sem_invoker),
  '{}'::text[],
  'view que roda como dona está na lista revisada à mão'
);

SELECT * FROM finish();

ROLLBACK;
