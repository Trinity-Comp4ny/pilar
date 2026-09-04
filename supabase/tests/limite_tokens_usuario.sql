-- pgTAP: motor de tokens, limite por usuário e controle da equipe (migration
-- 20260910000000, SPEC 094). Prova os critérios de aceite da spec: gate por usuário
-- é no-op sem teto configurado, prioridade saldo_empresa > limite_usuario, RLS
-- (usuário nunca escreve o próprio teto nem lê o de colega, mensagem de pedido é
-- privada), fluxo completo de solicitar/aprovar/negar, e que consumo sem usuário
-- (cron/automação) nunca é atribuído a ninguém na view.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(36);

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES ('b0b00000-0000-0000-0000-00000000000a', 'Empresa Limite A', NULL, TRUE, '{}'::jsonb)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

SET LOCAL session_replication_role = 'replica';
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES
  ('b0b01111-0000-0000-0000-00000000000a', 'lim_admin@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('b0b01111-0000-0000-0000-00000000000b', 'lim_user1@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('b0b01111-0000-0000-0000-00000000000c', 'lim_coord_sem@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('b0b01111-0000-0000-0000-00000000000d', 'lim_coord_com@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
SET LOCAL session_replication_role = 'origin';

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed)
VALUES
  ('b0b01111-0000-0000-0000-00000000000a', 'b0b00000-0000-0000-0000-00000000000a', 'Admin', 'Lim', 'lim_admin@test.com', 'admin', TRUE),
  ('b0b01111-0000-0000-0000-00000000000b', 'b0b00000-0000-0000-0000-00000000000a', 'User1', 'Lim', 'lim_user1@test.com', 'user', TRUE),
  ('b0b01111-0000-0000-0000-00000000000c', 'b0b00000-0000-0000-0000-00000000000a', 'CoordSem', 'Lim', 'lim_coord_sem@test.com', 'coordenador', TRUE),
  ('b0b01111-0000-0000-0000-00000000000d', 'b0b00000-0000-0000-0000-00000000000a', 'CoordCom', 'Lim', 'lim_coord_com@test.com', 'coordenador', TRUE)
ON CONFLICT (id) DO UPDATE SET empresa_id = EXCLUDED.empresa_id, role = EXCLUDED.role;

UPDATE public.profiles SET equipe_delegado = TRUE WHERE id = 'b0b01111-0000-0000-0000-00000000000d';

CREATE OR REPLACE FUNCTION test_set_auth(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

CREATE OR REPLACE FUNCTION test_set_service()
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  PERFORM set_config('role', 'service_role', true);
END; $$;

CREATE OR REPLACE FUNCTION test_set_postgres()
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('role', 'postgres', true);
END; $$;

-- Seed de saldo generoso: 1.000.000 no plano, com o reference_id EXATO que
-- gate_tokens espera para o ciclo corrente — sem isso, a primeira chamada ao gate
-- não reconhece o ciclo como já concedido e expira este seed inteiro para conceder
-- a cota real do plano por cima (comportamento correto do gate, não é bug: é este
-- seed que precisa parecer uma concessão de ciclo legítima).
INSERT INTO public.ai_token_ledger (empresa_id, agent_key, source, tokens_delta, reference_id)
VALUES (
  'b0b00000-0000-0000-0000-00000000000a', 'ciclo', 'plan_grant', 1000000,
  'plan_grant:b0b00000-0000-0000-0000-00000000000a:' || to_char(now(), 'YYYY-MM')
);

-- =============================================
-- 1. can_manage_equipe(): admin/owner sempre; coordenador só com equipe_delegado
-- =============================================
SELECT test_set_auth('b0b01111-0000-0000-0000-00000000000a');
SELECT ok(public.can_manage_equipe(), 'admin: can_manage_equipe() = true');

SELECT test_set_auth('b0b01111-0000-0000-0000-00000000000b');
SELECT ok(NOT public.can_manage_equipe(), 'user comum: can_manage_equipe() = false');

SELECT test_set_auth('b0b01111-0000-0000-0000-00000000000c');
SELECT ok(NOT public.can_manage_equipe(), 'coordenador sem equipe_delegado: can_manage_equipe() = false');

SELECT test_set_auth('b0b01111-0000-0000-0000-00000000000d');
SELECT ok(public.can_manage_equipe(), 'coordenador com equipe_delegado: can_manage_equipe() = true');

-- =============================================
-- 2. gate_tokens retrocompatível (sem p_user_id) e no-op por usuário sem teto
-- =============================================
SELECT test_set_service();

SELECT is(
  (SELECT bloqueado_motivo FROM public.gate_tokens('b0b00000-0000-0000-0000-00000000000a')),
  NULL,
  'gate_tokens sem p_user_id (retrocompat): saldo positivo, sem bloqueio'
);

SELECT lives_ok(
  $$ SELECT * FROM public.debitar_tokens(
       'b0b00000-0000-0000-0000-00000000000a', 'b0b01111-0000-0000-0000-00000000000b',
       'chat', NULL, 'gemini-2.5-flash', 400000, 500000, 'lim-turno-1') $$,
  'debita 900000 tokens para user1 (sem teto configurado ainda)'
);

SELECT is(
  (SELECT bloqueado_motivo FROM public.gate_tokens('b0b00000-0000-0000-0000-00000000000a', 'b0b01111-0000-0000-0000-00000000000b')),
  NULL,
  'sem linha em ai_token_limite_usuario, gate por usuário é no-op mesmo com consumo alto'
);

-- =============================================
-- 3. RLS de escrita em ai_token_limite_usuario: só quem can_manage_equipe()
-- =============================================
SELECT test_set_auth('b0b01111-0000-0000-0000-00000000000b');
SELECT throws_ok(
  $$ INSERT INTO public.ai_token_limite_usuario (empresa_id, user_id, limite_mensal)
     VALUES ('b0b00000-0000-0000-0000-00000000000a', 'b0b01111-0000-0000-0000-00000000000b', 500000) $$,
  '42501',
  NULL,
  'usuário comum não pode setar o próprio teto (RLS nega o INSERT)'
);

SELECT test_set_auth('b0b01111-0000-0000-0000-00000000000c');
SELECT throws_ok(
  $$ INSERT INTO public.ai_token_limite_usuario (empresa_id, user_id, limite_mensal)
     VALUES ('b0b00000-0000-0000-0000-00000000000a', 'b0b01111-0000-0000-0000-00000000000b', 500000) $$,
  '42501',
  NULL,
  'coordenador sem delegação não pode setar teto de ninguém'
);

SELECT test_set_auth('b0b01111-0000-0000-0000-00000000000a');
SELECT lives_ok(
  $$ INSERT INTO public.ai_token_limite_usuario (empresa_id, user_id, limite_mensal, criado_por)
     VALUES ('b0b00000-0000-0000-0000-00000000000a', 'b0b01111-0000-0000-0000-00000000000b', 500000, 'b0b01111-0000-0000-0000-00000000000a') $$,
  'admin define teto de 500000 para user1'
);

-- =============================================
-- 4. gate por usuário bloqueia ao estourar o teto pessoal, com saldo de empresa OK
-- =============================================
SELECT test_set_service();
SELECT is(
  (SELECT bloqueado_motivo FROM public.gate_tokens('b0b00000-0000-0000-0000-00000000000a', 'b0b01111-0000-0000-0000-00000000000b')),
  'limite_usuario',
  'consumo (900000) >= teto pessoal (500000): motivo = limite_usuario'
);

SELECT is(
  (SELECT bloqueado_motivo FROM public.gate_tokens('b0b00000-0000-0000-0000-00000000000a', 'b0b01111-0000-0000-0000-00000000000c')),
  NULL,
  'colega sem consumo e sem teto configurado não é afetado pelo teto de user1'
);

-- =============================================
-- 5. Prioridade: saldo_empresa vence limite_usuario quando os dois estouram
-- =============================================
SELECT lives_ok(
  $$ SELECT * FROM public.debitar_tokens(
       'b0b00000-0000-0000-0000-00000000000a', 'b0b01111-0000-0000-0000-00000000000c',
       'chat', NULL, 'gemini-2.5-flash', 50000, 50000, 'lim-turno-2') $$,
  'zera o saldo da empresa (mais 100000 debitados, total 1.000.000)'
);

SELECT is(
  (SELECT bloqueado_motivo FROM public.gate_tokens('b0b00000-0000-0000-0000-00000000000a', 'b0b01111-0000-0000-0000-00000000000b')),
  'saldo_empresa',
  'saldo de empresa zerado tem prioridade sobre limite_usuario (motivo = saldo_empresa)'
);

-- =============================================
-- 6. RLS de leitura: usuário só vê o PRÓPRIO teto; quem administra vê o de todos
-- =============================================
SELECT test_set_auth('b0b01111-0000-0000-0000-00000000000b');
SELECT is(
  (SELECT count(*)::int FROM public.ai_token_limite_usuario WHERE user_id = 'b0b01111-0000-0000-0000-00000000000b'),
  1,
  'user1 vê o próprio teto'
);

SELECT test_set_auth('b0b01111-0000-0000-0000-00000000000c');
SELECT is(
  (SELECT count(*)::int FROM public.ai_token_limite_usuario WHERE user_id = 'b0b01111-0000-0000-0000-00000000000b'),
  0,
  'coordenador sem delegação não vê o teto de user1'
);

SELECT test_set_auth('b0b01111-0000-0000-0000-00000000000a');
SELECT is(
  (SELECT count(*)::int FROM public.ai_token_limite_usuario WHERE user_id = 'b0b01111-0000-0000-0000-00000000000b'),
  1,
  'admin vê o teto de user1'
);

-- =============================================
-- 7. solicitar_mais_tokens: cria pedido, notifica gestão, dedupe de pendente
-- =============================================
SELECT test_set_auth('b0b01111-0000-0000-0000-00000000000b');
SELECT lives_ok(
  $$ SELECT public.solicitar_mais_tokens('preciso pra fechar a proposta do cliente X', 800000) $$,
  'user1 pede mais tokens'
);

-- Troca de sessão antes de checar: notificacoes só deixa cada um ler AS SUAS
-- (RLS), então continuar como user1 aqui veria sempre 0, mesmo com a notificação
-- do admin criada com sucesso.
SELECT test_set_auth('b0b01111-0000-0000-0000-00000000000a');
SELECT is(
  (SELECT count(*)::int FROM public.notificacoes
   WHERE destinatario_id = 'b0b01111-0000-0000-0000-00000000000a' AND tipo = 'tokens_solicitacao_usuario'),
  1,
  'admin recebe notificação do pedido de tokens'
);

SELECT test_set_auth('b0b01111-0000-0000-0000-00000000000b');

SELECT throws_ok(
  $$ SELECT public.solicitar_mais_tokens('de novo', NULL) $$,
  '23505',
  NULL,
  'segundo pedido com um já pendente é rejeitado'
);

-- =============================================
-- 8. resolver_solicitacao_tokens: só can_manage_equipe(), aprovar sobe o teto
-- =============================================
SELECT throws_ok(
  $$ SELECT public.resolver_solicitacao_tokens(
       (SELECT id FROM public.ai_token_solicitacao
        WHERE user_id = 'b0b01111-0000-0000-0000-00000000000b' AND status = 'pendente'),
       true, 800000) $$,
  '42501',
  NULL,
  'user1 não pode resolver a própria solicitação'
);

SELECT test_set_auth('b0b01111-0000-0000-0000-00000000000a');
SELECT lives_ok(
  $$ SELECT public.resolver_solicitacao_tokens(
       (SELECT id FROM public.ai_token_solicitacao
        WHERE user_id = 'b0b01111-0000-0000-0000-00000000000b' AND status = 'pendente'),
       true, 800000) $$,
  'admin aprova o pedido com novo teto de 800000'
);

SELECT is(
  (SELECT limite_mensal FROM public.ai_token_limite_usuario WHERE user_id = 'b0b01111-0000-0000-0000-00000000000b'),
  800000::bigint,
  'aprovar com novo_limite atualiza o teto (upsert)'
);

SELECT throws_ok(
  $$ SELECT public.resolver_solicitacao_tokens(
       (SELECT id FROM public.ai_token_solicitacao
        WHERE user_id = 'b0b01111-0000-0000-0000-00000000000b' AND status = 'aprovado'
        ORDER BY created_at DESC LIMIT 1),
       true, 900000) $$,
  '22023',
  NULL,
  'resolver uma solicitação já resolvida falha'
);

-- =============================================
-- 9. Aprovar com novo_limite NULL remove o teto (usuário fica sem limite de novo)
-- =============================================
SELECT test_set_auth('b0b01111-0000-0000-0000-00000000000b');
SELECT lives_ok(
  $$ SELECT public.solicitar_mais_tokens(NULL, NULL) $$,
  'user1 pede de novo (sem sugestão de valor)'
);

SELECT test_set_auth('b0b01111-0000-0000-0000-00000000000a');
SELECT lives_ok(
  $$ SELECT public.resolver_solicitacao_tokens(
       (SELECT id FROM public.ai_token_solicitacao
        WHERE user_id = 'b0b01111-0000-0000-0000-00000000000b' AND status = 'pendente'),
       true, NULL) $$,
  'admin aprova removendo o teto (novo_limite NULL)'
);

SELECT is(
  (SELECT count(*)::int FROM public.ai_token_limite_usuario WHERE user_id = 'b0b01111-0000-0000-0000-00000000000b'),
  0,
  'teto de user1 foi removido (sem linha = sem limite, comportamento original)'
);

-- =============================================
-- 10. Negar um pedido: nunca mexe no teto, só fecha a solicitação
-- =============================================
SELECT test_set_auth('b0b01111-0000-0000-0000-00000000000b');
SELECT lives_ok(
  $$ SELECT public.solicitar_mais_tokens('mais uma vez', 300000) $$,
  'user1 pede pela terceira vez'
);

SELECT test_set_auth('b0b01111-0000-0000-0000-00000000000a');
SELECT lives_ok(
  $$ SELECT public.resolver_solicitacao_tokens(
       (SELECT id FROM public.ai_token_solicitacao
        WHERE user_id = 'b0b01111-0000-0000-0000-00000000000b' AND status = 'pendente'),
       false, NULL) $$,
  'admin nega o pedido'
);

SELECT is(
  (SELECT count(*)::int FROM public.ai_token_limite_usuario WHERE user_id = 'b0b01111-0000-0000-0000-00000000000b'),
  0,
  'negar não cria nem altera nenhum teto'
);

-- =============================================
-- 11. v_uso_tokens_usuario_ciclo: limite_mensal privado, tokens_ciclo transparente
-- =============================================
SELECT lives_ok(
  $$ INSERT INTO public.ai_token_limite_usuario (empresa_id, user_id, limite_mensal, criado_por)
     VALUES ('b0b00000-0000-0000-0000-00000000000a', 'b0b01111-0000-0000-0000-00000000000b', 300000, 'b0b01111-0000-0000-0000-00000000000a') $$,
  'admin define novo teto de 300000 para user1, para os testes da view'
);

SELECT test_set_auth('b0b01111-0000-0000-0000-00000000000b');
SELECT is(
  (SELECT limite_mensal FROM public.v_uso_tokens_usuario_ciclo WHERE user_id = 'b0b01111-0000-0000-0000-00000000000b'),
  300000::bigint,
  'user1 vê o próprio limite na view'
);

SELECT test_set_auth('b0b01111-0000-0000-0000-00000000000c');
SELECT is(
  (SELECT limite_mensal FROM public.v_uso_tokens_usuario_ciclo WHERE user_id = 'b0b01111-0000-0000-0000-00000000000b'),
  NULL,
  'coordenador sem delegação não vê o limite de user1 na view (RLS oculta, LEFT JOIN vira NULL)'
);

SELECT ok(
  (SELECT tokens_ciclo FROM public.v_uso_tokens_usuario_ciclo WHERE user_id = 'b0b01111-0000-0000-0000-00000000000b') > 0,
  'consumo (tokens_ciclo) de user1 é visível a um colega (transparência já existente do extrato)'
);

-- =============================================
-- 12. Consumo de sistema (user_id NULL) não é atribuído a ninguém
-- =============================================
SELECT test_set_service();
SELECT lives_ok(
  $$ SELECT * FROM public.debitar_tokens(
       'b0b00000-0000-0000-0000-00000000000a', NULL,
       'guardiao-margem', NULL, 'gemini-2.5-flash', 10000, 10000, 'lim-cron-1') $$,
  'débito de automação (user_id NULL) roda normalmente'
);

SELECT test_set_auth('b0b01111-0000-0000-0000-00000000000a');
SELECT is(
  (SELECT count(*)::int FROM public.v_uso_tokens_usuario_ciclo WHERE user_id IS NULL),
  0,
  'a view nunca tem linha atribuída a user_id NULL (consumo de sistema não vira "alguém")'
);

SELECT * FROM finish();
ROLLBACK;
