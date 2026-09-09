-- pgTAP: enforce_empresa_nao_leitura (trigger generico) e
-- excluir_empresa_retencao (SPEC 098 Fase 3, migration 20260936000000,
-- ADR 0042 + ADR 0043).

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(28);

CREATE OR REPLACE FUNCTION test_set_auth(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

CREATE OR REPLACE FUNCTION test_set_postgres()
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('role', 'postgres', true);
END; $$;

CREATE OR REPLACE FUNCTION test_set_service()
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  PERFORM set_config('role', 'service_role', true);
END; $$;

SELECT test_set_postgres();

-- Duas empresas via signup real (trigger cria empresa/profile/subscription).
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role, email_confirmed_at)
VALUES
  ('fce01111-0000-0000-0000-00000000000a', 'ret_leitura@empresareal.com.br', jsonb_build_object('company_name', 'RET Leitura'), 'authenticated', 'authenticated', now()),
  ('fce01111-0000-0000-0000-00000000000b', 'ret_normal@empresareal.com.br', jsonb_build_object('company_name', 'RET Normal'), 'authenticated', 'authenticated', now()),
  ('fce01111-0000-0000-0000-00000000000c', 'ret_excluir@empresareal.com.br', jsonb_build_object('company_name', 'RET Excluir'), 'authenticated', 'authenticated', now()),
  ('fce01111-0000-0000-0000-00000000000d', 'ret_admin@empresareal.com.br', jsonb_build_object('company_name', 'RET Admin'), 'authenticated', 'authenticated', now());

UPDATE public.profiles SET role = 'ultra_admin' WHERE id = 'fce01111-0000-0000-0000-00000000000d';

-- =============================================
-- 1. enforce_empresa_nao_leitura: bloqueia escrita em tabela representativa
--    de financeiro/projetos/obras, nao bloqueia leitura, nao afeta outra
--    empresa, service_role passa direto.
-- =============================================

SELECT test_set_postgres();
UPDATE public.empresas
SET leitura_desde = now() - interval '10 days'
WHERE owner_id = 'fce01111-0000-0000-0000-00000000000a';

SELECT test_set_auth('fce01111-0000-0000-0000-00000000000a');

SELECT throws_ok(
  $$INSERT INTO public.projetos (empresa_id, nome) VALUES (
    (SELECT id FROM public.empresas WHERE owner_id = 'fce01111-0000-0000-0000-00000000000a'), 'Projeto bloqueado'
  )$$,
  'P0001', 'empresa_em_leitura',
  'INSERT em projetos e recusado com a empresa em leitura'
);

SELECT throws_ok(
  $$INSERT INTO public.despesas (empresa_id, descricao, valor, data_vencimento, status) VALUES (
    (SELECT id FROM public.empresas WHERE owner_id = 'fce01111-0000-0000-0000-00000000000a'),
    'Despesa bloqueada', 100, current_date, 'Pendente'
  )$$,
  'P0001', 'empresa_em_leitura',
  'INSERT em despesas (financeiro) e recusado com a empresa em leitura'
);

SELECT throws_ok(
  $$INSERT INTO public.obras (empresa_id, nome) VALUES (
    (SELECT id FROM public.empresas WHERE owner_id = 'fce01111-0000-0000-0000-00000000000a'), 'Obra bloqueada'
  )$$,
  'P0001', 'empresa_em_leitura',
  'INSERT em obras e recusado com a empresa em leitura'
);

-- Leitura continua liberada (trigger e so BEFORE INSERT/UPDATE/DELETE).
SELECT lives_ok(
  $$SELECT count(*) FROM public.projetos WHERE empresa_id = (SELECT id FROM public.empresas WHERE owner_id = 'fce01111-0000-0000-0000-00000000000a')$$,
  'SELECT continua liberado com a empresa em leitura'
);

-- UPDATE tambem e bloqueado (no projeto exemplo criado pelo signup).
SELECT throws_ok(
  format(
    $$UPDATE public.projetos SET nome = 'renomeado' WHERE id = %L$$,
    (SELECT id FROM public.projetos WHERE empresa_id = (SELECT id FROM public.empresas WHERE owner_id = 'fce01111-0000-0000-0000-00000000000a') LIMIT 1)
  ),
  'P0001', 'empresa_em_leitura',
  'UPDATE em projetos e recusado com a empresa em leitura'
);

-- Outra empresa, sem leitura_desde, escreve normalmente.
SELECT test_set_auth('fce01111-0000-0000-0000-00000000000b');
SELECT lives_ok(
  $$INSERT INTO public.projetos (empresa_id, nome) VALUES (
    (SELECT id FROM public.empresas WHERE owner_id = 'fce01111-0000-0000-0000-00000000000b'), 'Projeto normal'
  )$$,
  'empresa sem leitura_desde continua escrevendo normalmente'
);

-- service_role passa direto mesmo com a empresa em leitura.
SELECT test_set_service();
SELECT lives_ok(
  $$INSERT INTO public.projetos (empresa_id, nome) VALUES (
    (SELECT id FROM public.empresas WHERE owner_id = 'fce01111-0000-0000-0000-00000000000a'), 'Projeto via cron'
  )$$,
  'service_role ignora o modo leitura (cron/reativacao)'
);

-- Tabela da allowlist de excecao (notificacoes) nao tem o trigger: escrita
-- de authenticated continua liberada mesmo com a empresa em leitura.
SELECT test_set_postgres();
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_enforce_empresa_nao_leitura' AND tgrelid = 'public.notificacoes'::regclass
  ),
  'notificacoes fica fora da allowlist do trigger generico (ADR 0042)'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_enforce_empresa_nao_leitura' AND tgrelid = 'public.pilar_subscriptions'::regclass
  ),
  'pilar_subscriptions fica fora da allowlist (reativacao nao pode travar)'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_enforce_empresa_nao_leitura' AND tgrelid = 'public.receitas'::regclass
  ),
  'receitas (financeiro) tem o trigger aplicado'
);

-- =============================================
-- 2. excluir_empresa_retencao: autorizacao e validacao.
-- =============================================

SELECT test_set_auth('fce01111-0000-0000-0000-00000000000b');
SELECT throws_ok(
  $$SELECT public.excluir_empresa_retencao(
    (SELECT id FROM public.empresas WHERE owner_id = 'fce01111-0000-0000-0000-00000000000c'), 'teste'
  )$$,
  '42501', NULL,
  'usuario comum nao pode chamar excluir_empresa_retencao'
);

SELECT test_set_service();
SELECT throws_ok(
  $$SELECT public.excluir_empresa_retencao(
    (SELECT id FROM public.empresas WHERE owner_id = 'fce01111-0000-0000-0000-00000000000c'), ''
  )$$,
  '22023', 'Motivo obrigatorio',
  'motivo vazio e recusado'
);

-- =============================================
-- 3. excluir_empresa_retencao: caminho feliz -- grupo 1 anonimizado, grupo 2
--    apagado, preservados sobrevivem, empresas fica soft-deleted.
-- =============================================

SELECT test_set_postgres();

INSERT INTO public.clientes (empresa_id, nome) VALUES
  ((SELECT id FROM public.empresas WHERE owner_id = 'fce01111-0000-0000-0000-00000000000c'), 'Cliente a apagar');

INSERT INTO public.receitas (empresa_id, descricao, valor, data_vencimento, status, observacao) VALUES
  ((SELECT id FROM public.empresas WHERE owner_id = 'fce01111-0000-0000-0000-00000000000c'), 'Receita do cliente X', 1000, current_date, 'Pendente', 'ligar pro João antes de cobrar');

INSERT INTO public.pessoas (empresa_id, nome, primeiro_nome, sobrenome, email) VALUES
  ((SELECT id FROM public.empresas WHERE owner_id = 'fce01111-0000-0000-0000-00000000000c'), 'Funcionario Teste', 'Funcionario', 'Teste', 'func@teste.com');

INSERT INTO public.folha_pagamento (empresa_id, pessoa_id, mes, ano, salario_fixo)
VALUES (
  (SELECT id FROM public.empresas WHERE owner_id = 'fce01111-0000-0000-0000-00000000000c'),
  (SELECT id FROM public.pessoas WHERE email = 'func@teste.com'),
  9, 2026, 5000
);

INSERT INTO public.marcos_faturamento (empresa_id, projeto_id, nome, valor)
VALUES (
  (SELECT id FROM public.empresas WHERE owner_id = 'fce01111-0000-0000-0000-00000000000c'),
  (SELECT id FROM public.projetos WHERE empresa_id = (SELECT id FROM public.empresas WHERE owner_id = 'fce01111-0000-0000-0000-00000000000c') LIMIT 1),
  'Marco 1', 500
);

SELECT lives_ok(
  $$SELECT public.excluir_empresa_retencao(
    (SELECT id FROM public.empresas WHERE owner_id = 'fce01111-0000-0000-0000-00000000000c'), 'trial vencido ha 90 dias'
  )$$,
  'ultra_admin executa a exclusao com motivo'
);

SELECT test_set_postgres();

-- Grupo 1: linha sobrevive, texto livre anonimizado.
SELECT is(
  (SELECT descricao FROM public.receitas WHERE empresa_id = (SELECT id FROM public.empresas WHERE owner_id = 'fce01111-0000-0000-0000-00000000000c')),
  '[anonimizado]',
  'receitas sobrevive com descricao anonimizada'
);
SELECT is(
  (SELECT observacao FROM public.receitas WHERE empresa_id = (SELECT id FROM public.empresas WHERE owner_id = 'fce01111-0000-0000-0000-00000000000c')),
  NULL,
  'observacao da receita foi limpa'
);
SELECT is(
  (SELECT valor FROM public.receitas WHERE empresa_id = (SELECT id FROM public.empresas WHERE owner_id = 'fce01111-0000-0000-0000-00000000000c')),
  1000::numeric,
  'valor fiscal da receita e preservado (retencao de 5 anos)'
);

-- folha_pagamento sobrevive, mas pessoa_id foi severado antes de apagar
-- pessoas (senao o CASCADE original destruiria o registro fiscal).
SELECT is(
  (SELECT pessoa_id FROM public.folha_pagamento WHERE empresa_id = (SELECT id FROM public.empresas WHERE owner_id = 'fce01111-0000-0000-0000-00000000000c')),
  NULL,
  'folha_pagamento sobrevive com pessoa_id nulo'
);
SELECT is(
  (SELECT salario_fixo FROM public.folha_pagamento WHERE empresa_id = (SELECT id FROM public.empresas WHERE owner_id = 'fce01111-0000-0000-0000-00000000000c')),
  5000::numeric,
  'valor fiscal da folha de pagamento e preservado'
);

SELECT is(
  (SELECT projeto_id FROM public.marcos_faturamento WHERE empresa_id = (SELECT id FROM public.empresas WHERE owner_id = 'fce01111-0000-0000-0000-00000000000c')),
  NULL,
  'marcos_faturamento sobrevive com projeto_id nulo'
);

-- Grupo 2: apagado de verdade.
SELECT is(
  (SELECT count(*)::int FROM public.clientes WHERE empresa_id = (SELECT id FROM public.empresas WHERE owner_id = 'fce01111-0000-0000-0000-00000000000c')),
  0,
  'clientes foi apagado (sem obrigacao de retencao)'
);
SELECT is(
  (SELECT count(*)::int FROM public.pessoas WHERE empresa_id = (SELECT id FROM public.empresas WHERE owner_id = 'fce01111-0000-0000-0000-00000000000c')),
  0,
  'pessoas foi apagado (o vinculo com folha_pagamento ja tinha sido severado)'
);
SELECT is(
  (SELECT count(*)::int FROM public.projetos WHERE empresa_id = (SELECT id FROM public.empresas WHERE owner_id = 'fce01111-0000-0000-0000-00000000000c')),
  0,
  'projetos foi apagado'
);
SELECT is(
  (SELECT count(*)::int FROM public.profiles WHERE empresa_id = (SELECT id FROM public.empresas WHERE owner_id = 'fce01111-0000-0000-0000-00000000000c')),
  0,
  'profiles foi apagado'
);

-- empresas: soft delete, nunca DELETE.
SELECT ok(
  (SELECT deleted_at FROM public.empresas WHERE owner_id = 'fce01111-0000-0000-0000-00000000000c') IS NOT NULL,
  'empresas fica soft-deleted, nao apagada'
);
SELECT is(
  (SELECT nome FROM public.empresas WHERE owner_id = 'fce01111-0000-0000-0000-00000000000c'),
  '[empresa excluida]',
  'nome da empresa e anonimizado'
);
SELECT is(
  (SELECT status FROM public.empresas WHERE owner_id = 'fce01111-0000-0000-0000-00000000000c')::text,
  'cancelled',
  'status da empresa vira cancelled'
);
-- Trilha de auditoria gravada.
SELECT is(
  (SELECT action FROM public.admin_audit_logs
     WHERE empresa_id = (SELECT id FROM public.empresas WHERE owner_id = 'fce01111-0000-0000-0000-00000000000c')
       AND action = 'empresa_excluida_retencao'),
  'empresa_excluida_retencao',
  'exclusao fica registrada em admin_audit_logs'
);
SELECT is(
  (SELECT metadata->>'motivo' FROM public.admin_audit_logs
     WHERE empresa_id = (SELECT id FROM public.empresas WHERE owner_id = 'fce01111-0000-0000-0000-00000000000c')
       AND action = 'empresa_excluida_retencao'),
  'trial vencido ha 90 dias',
  'motivo da exclusao fica registrado'
);

SELECT * FROM finish();
ROLLBACK;
