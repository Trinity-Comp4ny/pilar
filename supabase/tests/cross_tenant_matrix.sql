-- pgTAP: matriz de isolamento cross-tenant (auditoria de segurança de 2026-10-14)
--
-- Roda via: supabase test db  (pgtap habilitado no Postgres local)
--
-- Por que este arquivo existe: a auditoria de segurança pediu uma "matriz com duas
-- empresas, usuários comuns e admin, cobrindo ler/criar/alterar/excluir". Em vez de
-- uma rodada manual de pentest (vale só no dia), a matriz vira teste no CI: toda
-- tabela com empresa_id é varrida a cada PR, e qualquer policy nova que vaze entre
-- empresas reprova o merge.
--
-- O que cobre:
--   1. LEITURA cross-tenant: nenhum papel de A enxerga linha de B, em TODA tabela
--      com empresa_id e RLS (varredura genérica pelo catálogo).
--   2. ESCRITA cross-tenant: admin de A não altera nem exclui linha de B nas tabelas
--      de negócio centrais.
--   3. CATRACA de catálogo: nenhuma policy de tabela multi-tenant com predicado
--      aberto (qual/with_check = true) em SELECT/UPDATE/DELETE/ALL.
--   4. CATRACA de privilégio: colunas de plataforma de `empresas` nunca são
--      graváveis por usuário comum.
--
-- Papel efetivo: set_config('role','authenticated') troca o role de verdade (o
-- `postgres` local é BYPASSRLS; sem a troca, a RLS não se aplica e o teste daria
-- falso verde). Ver nota em [[feedback_pgtap_superuser_nao_aplica_rls]].

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(14);

-- =============================================================================
-- Setup: Empresa A e B, com todas as features ligadas, e usuários por papel.
-- =============================================================================
SET LOCAL session_replication_role = 'replica'; -- bypassa triggers de signup/FK no seed

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES
  ('aa000000-0000-0000-0000-0000000000a0', 'Empresa A', NULL, TRUE,
   '{"financeiro":true,"leads":true,"projetos":true,"clientes":true,"propostas":true,"pessoas":true,"metas":true,"templates":true,"portal_cliente":true}'::jsonb),
  ('bb000000-0000-0000-0000-0000000000b0', 'Empresa B', NULL, TRUE,
   '{"financeiro":true,"leads":true,"projetos":true,"clientes":true,"propostas":true,"pessoas":true,"metas":true,"templates":true,"portal_cliente":true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features, onboarding_completed = TRUE;

INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES
  ('aa000000-0000-0000-0000-00000000a001', 'user_a@xtest.com',  '{}'::jsonb, 'authenticated', 'authenticated'),
  ('aa000000-0000-0000-0000-00000000a002', 'coord_a@xtest.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('aa000000-0000-0000-0000-00000000a003', 'admin_a@xtest.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('bb000000-0000-0000-0000-00000000b003', 'admin_b@xtest.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed)
VALUES
  ('aa000000-0000-0000-0000-00000000a001', 'aa000000-0000-0000-0000-0000000000a0', 'User',  'A', 'user_a@xtest.com',  'user',        TRUE),
  ('aa000000-0000-0000-0000-00000000a002', 'aa000000-0000-0000-0000-0000000000a0', 'Coord', 'A', 'coord_a@xtest.com', 'coordenador', TRUE),
  ('aa000000-0000-0000-0000-00000000a003', 'aa000000-0000-0000-0000-0000000000a0', 'Admin', 'A', 'admin_a@xtest.com', 'admin',       TRUE),
  ('bb000000-0000-0000-0000-00000000b003', 'bb000000-0000-0000-0000-0000000000b0', 'Admin', 'B', 'admin_b@xtest.com', 'admin',       TRUE)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, empresa_id = EXCLUDED.empresa_id;

-- Dados da Empresa B nas tabelas de negócio centrais (o alvo que A nunca deve tocar).
INSERT INTO public.clientes (id, empresa_id, nome, contato, email)
VALUES ('bbced000-0000-0000-0000-0000000000b1', 'bb000000-0000-0000-0000-0000000000b0', 'Cliente B', 'b@b.com', 'b@b.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.projetos (id, empresa_id, nome, cliente_id, codigo_projeto)
VALUES ('bbced000-0000-0000-0000-0000000000b2', 'bb000000-0000-0000-0000-0000000000b0', 'Projeto B', 'bbced000-0000-0000-0000-0000000000b1', 'PRJ-B-X')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.leads (id, empresa_id, nome)
VALUES ('bbced000-0000-0000-0000-0000000000b3', 'bb000000-0000-0000-0000-0000000000b0', 'Lead B')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.pessoas (id, empresa_id, nome, email, primeiro_nome, sobrenome)
VALUES ('bbced000-0000-0000-0000-0000000000b4', 'bb000000-0000-0000-0000-0000000000b0', 'Pessoa B', 'pessoab@b.com', 'Pessoa', 'B')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.receitas (id, empresa_id, descricao, valor, status, data_vencimento, projeto_id, cliente_id)
VALUES ('bbced000-0000-0000-0000-0000000000b5', 'bb000000-0000-0000-0000-0000000000b0', 'Receita B', 9999, 'Pendente', CURRENT_DATE,
        'bbced000-0000-0000-0000-0000000000b2', 'bbced000-0000-0000-0000-0000000000b1')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.despesas (id, empresa_id, descricao, valor, status, data_vencimento)
VALUES ('bbced000-0000-0000-0000-0000000000b6', 'bb000000-0000-0000-0000-0000000000b0', 'Despesa B', 8888, 'Pendente', CURRENT_DATE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.contas (id, empresa_id, nome, banco, saldo_inicial)
VALUES ('bbced000-0000-0000-0000-0000000000b7', 'bb000000-0000-0000-0000-0000000000b0', 'Conta B', 'Banco B', 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.propostas (id, empresa_id, titulo, status)
VALUES ('bbced000-0000-0000-0000-0000000000b8', 'bb000000-0000-0000-0000-0000000000b0', 'Proposta B', 'enviada')
ON CONFLICT (id) DO NOTHING;

SET LOCAL session_replication_role = 'origin';

-- =============================================================================
-- Helpers
-- =============================================================================
CREATE OR REPLACE FUNCTION test_set_auth(p_user_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

-- Conta, com os privilégios de quem chama (SECURITY INVOKER = RLS do caller ativa),
-- quantas tabelas com empresa_id + RLS deixam VER ao menos uma linha da empresa alvo.
-- Zero = isolamento de leitura íntegro. `profiles` entra: B tem o admin B lá.
CREATE OR REPLACE FUNCTION test_read_leak_count(p_alvo uuid)
RETURNS int LANGUAGE plpgsql AS $$
DECLARE r record; n int; leaks int := 0;
BEGIN
  FOR r IN
    SELECT c.relname AS tbl
    FROM pg_class c
    JOIN pg_namespace ns ON ns.oid = c.relnamespace
    JOIN information_schema.columns col
      ON col.table_name = c.relname AND col.table_schema = 'public' AND col.column_name = 'empresa_id'
    WHERE ns.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
    ORDER BY 1
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE empresa_id = %L', r.tbl, p_alvo) INTO n;
    IF n > 0 THEN
      RAISE NOTICE 'LEITURA CROSS-TENANT: % expôs % linha(s) da empresa alvo', r.tbl, n;
      leaks := leaks + 1;
    END IF;
  END LOOP;
  RETURN leaks;
END; $$;

-- =============================================================================
-- 1. LEITURA cross-tenant: nenhum papel de A enxerga linha de B
-- =============================================================================
SELECT test_set_auth('aa000000-0000-0000-0000-00000000a001'); -- user A
SELECT is(test_read_leak_count('bb000000-0000-0000-0000-0000000000b0'), 0,
  'user A: zero tabelas expõem linhas da Empresa B');
RESET ROLE;

SELECT test_set_auth('aa000000-0000-0000-0000-00000000a002'); -- coordenador A
SELECT is(test_read_leak_count('bb000000-0000-0000-0000-0000000000b0'), 0,
  'coordenador A: zero tabelas expõem linhas da Empresa B');
RESET ROLE;

SELECT test_set_auth('aa000000-0000-0000-0000-00000000a003'); -- admin A
SELECT is(test_read_leak_count('bb000000-0000-0000-0000-0000000000b0'), 0,
  'admin A: zero tabelas expõem linhas da Empresa B');
RESET ROLE;

-- Alguns alvos explícitos (legível no diff quando quebra; o sweep acima já cobre tudo).
SELECT test_set_auth('aa000000-0000-0000-0000-00000000a003'); -- admin A
SELECT is((SELECT count(*)::int FROM public.clientes WHERE id = 'bbced000-0000-0000-0000-0000000000b1'), 0,
  'admin A não lê cliente da Empresa B');
SELECT is((SELECT count(*)::int FROM public.receitas WHERE id = 'bbced000-0000-0000-0000-0000000000b5'), 0,
  'admin A não lê receita da Empresa B');
SELECT is((SELECT count(*)::int FROM public.propostas WHERE id = 'bbced000-0000-0000-0000-0000000000b8'), 0,
  'admin A não lê proposta da Empresa B');
RESET ROLE;

-- =============================================================================
-- 2. ESCRITA cross-tenant: admin A não altera nem exclui linha de B
--    (UPDATE/DELETE que a RLS filtra afetam 0 linhas, sem erro)
-- =============================================================================
SELECT test_set_auth('aa000000-0000-0000-0000-00000000a003'); -- admin A

SELECT lives_ok(
  $$UPDATE public.clientes SET nome = 'HACKED' WHERE id = 'bbced000-0000-0000-0000-0000000000b1'$$,
  'admin A: UPDATE em cliente de B não levanta erro (mas não acerta linha)');

SELECT lives_ok(
  $$UPDATE public.receitas SET valor = 1 WHERE id = 'bbced000-0000-0000-0000-0000000000b5'$$,
  'admin A: UPDATE em receita de B não levanta erro');

SELECT lives_ok(
  $$DELETE FROM public.leads WHERE id = 'bbced000-0000-0000-0000-0000000000b3'$$,
  'admin A: DELETE em lead de B não levanta erro');

RESET ROLE;

-- Como postgres (bypassa RLS): confirma que nada de B foi de fato alterado/apagado.
SELECT is((SELECT nome FROM public.clientes WHERE id = 'bbced000-0000-0000-0000-0000000000b1'), 'Cliente B',
  'cliente de B intacto após UPDATE cross-tenant de A');
SELECT is((SELECT valor FROM public.receitas WHERE id = 'bbced000-0000-0000-0000-0000000000b5'), 9999::numeric,
  'receita de B intacta após UPDATE cross-tenant de A');
SELECT is((SELECT count(*)::int FROM public.leads WHERE id = 'bbced000-0000-0000-0000-0000000000b3'), 1,
  'lead de B intacto após DELETE cross-tenant de A');

-- =============================================================================
-- 3. CATRACA de catálogo: nenhuma policy de leitura/escrita aberta (true) em
--    tabela multi-tenant. INSERT WITH CHECK (true) é rastreado à parte
--    (agent_actions/ai_usage_logs, service_role) e fica fora deste gate.
-- =============================================================================
SELECT is(
  (SELECT count(*)::int
     FROM pg_policies p
     JOIN information_schema.columns col
       ON col.table_name = p.tablename AND col.table_schema = 'public' AND col.column_name = 'empresa_id'
    WHERE p.schemaname = 'public'
      AND p.cmd IN ('SELECT','UPDATE','DELETE','ALL')
      AND (p.qual = 'true' OR p.with_check = 'true')),
  0,
  'nenhuma policy SELECT/UPDATE/DELETE/ALL com predicado aberto em tabela com empresa_id');

-- =============================================================================
-- 4. CATRACA de privilégio: colunas de plano/trial de `empresas` não graváveis
--    por usuário comum (defende auto-upgrade de capacidade/plano).
-- =============================================================================
-- Colunas de plataforma (plano, trial, limites, verificação de documento, retenção e
-- exclusão) só mudam por service role ou RPC de ultra_admin. `status` e `cnpj` ficam
-- de fora de propósito: a tela de Configurações os grava.
SELECT is(
  (SELECT count(*)::int
     FROM information_schema.column_privileges
    WHERE table_schema = 'public' AND table_name = 'empresas'
      AND grantee IN ('authenticated','anon') AND privilege_type = 'UPDATE'
      AND column_name IN ('nivel_override','nivel_override_motivo','nivel_override_por','nivel_override_em',
                          'max_projetos_override','max_usuarios_override','leitura_desde',
                          'documento_verificacao','documento_verificado_em','deleted_at',
                          'preservar_dados','preservar_dados_motivo','preservar_dados_por',
                          'preservar_dados_em','retencao_aviso_60d_sent_at','retencao_aviso_85d_sent_at',
                          'owner_id','features','interna')),
  0,
  'colunas de plataforma de empresas não têm UPDATE para authenticated/anon');

SELECT * FROM finish();
ROLLBACK;
