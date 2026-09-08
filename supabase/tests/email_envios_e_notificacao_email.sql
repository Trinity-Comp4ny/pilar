-- pgTAP: SPEC 095 fase 2 (email_envios / email_supressoes) e SPEC 096
-- (notificacoes_pendentes_email). Roda como `authenticated` via set_config +
-- SET ROLE, não como superuser: superuser ignora RLS e GRANT e passaria por acidente.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(18);

-- ---------------------------------------------------------------------------
-- Fixtures: 2 empresas, admin da A, admin da B, colaborador da A
-- ---------------------------------------------------------------------------
INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES
  ('00000000-0000-0000-0000-00000000ee0a', 'Empresa Email A', NULL, TRUE, '{}'::jsonb),
  ('00000000-0000-0000-0000-00000000ee0b', 'Empresa Email B', NULL, TRUE, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

SET LOCAL session_replication_role = 'replica';
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES
  ('77777777-0000-0000-0000-00000000ee01', 'admin_a@test.com',  '{}'::jsonb, 'authenticated', 'authenticated'),
  ('77777777-0000-0000-0000-00000000ee02', 'admin_b@test.com',  '{}'::jsonb, 'authenticated', 'authenticated'),
  ('77777777-0000-0000-0000-00000000ee03', 'colab_a@test.com',  '{}'::jsonb, 'authenticated', 'authenticated'),
  ('77777777-0000-0000-0000-00000000ee04', 'saiu_a@test.com',   '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
SET LOCAL session_replication_role = 'origin';

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed)
VALUES
  ('77777777-0000-0000-0000-00000000ee01', '00000000-0000-0000-0000-00000000ee0a', 'Admin', 'A', 'admin_a@test.com', 'admin', TRUE),
  ('77777777-0000-0000-0000-00000000ee02', '00000000-0000-0000-0000-00000000ee0b', 'Admin', 'B', 'admin_b@test.com', 'admin', TRUE),
  ('77777777-0000-0000-0000-00000000ee03', '00000000-0000-0000-0000-00000000ee0a', 'Colab', 'A', 'colab_a@test.com', 'colaborador', TRUE),
  -- "saiu": tem notificação da empresa A mas o perfil hoje está na B (foi desligado e recontratado noutra)
  ('77777777-0000-0000-0000-00000000ee04', '00000000-0000-0000-0000-00000000ee0b', 'Saiu', 'A', 'saiu_a@test.com', 'colaborador', TRUE)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, empresa_id = EXCLUDED.empresa_id;

CREATE OR REPLACE FUNCTION test_set_auth(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

-- Envios: 2 da empresa A, 1 da B, 1 de plataforma sem empresa (recuperação de senha)
INSERT INTO public.email_envios (id, empresa_id, classe, tipo, destinatario, assunto, status, resend_id)
VALUES
  ('aaaaaaaa-0000-0000-0000-00000000ee01', '00000000-0000-0000-0000-00000000ee0a', 'escritorio', 'cobranca_lembrete', 'cli@a.com', 'Lembrete', 'enviado', 're_a1'),
  ('aaaaaaaa-0000-0000-0000-00000000ee02', '00000000-0000-0000-0000-00000000ee0a', 'escritorio', 'proposta_envio',    'cli2@a.com', 'Proposta', 'entregue', 're_a2'),
  ('aaaaaaaa-0000-0000-0000-00000000ee03', '00000000-0000-0000-0000-00000000ee0b', 'escritorio', 'cobranca_atraso',   'cli@b.com', 'Atraso', 'bounce', 're_b1'),
  ('aaaaaaaa-0000-0000-0000-00000000ee04', NULL, 'plataforma', 'auth_recovery', 'x@y.com', 'Redefinir', 'enviado', 're_p1');

INSERT INTO public.email_supressoes (email, motivo) VALUES ('morto@a.com', 'bounce');

-- Notificações pendentes de e-mail (email_enviado_em NULL, criadas há 10 min)
INSERT INTO public.notificacoes (id, empresa_id, destinatario_id, tipo, categoria, severidade, titulo, mensagem, created_at)
VALUES
  -- admin A: financeiro high → imediato SIM
  ('bbbbbbbb-0000-0000-0000-00000000ee01', '00000000-0000-0000-0000-00000000ee0a', '77777777-0000-0000-0000-00000000ee01', 'pagamento_atrasado', 'financeiro', 'critical', 'Pagamento vencido: aluguel', 'R$ 1.000 venceu', now() - interval '10 minutes'),
  -- admin A: projeto medium → só semanal
  ('bbbbbbbb-0000-0000-0000-00000000ee02', '00000000-0000-0000-0000-00000000ee0a', '77777777-0000-0000-0000-00000000ee01', 'projeto_prazo_proximo', 'projeto', 'medium', 'Prazo próximo: X', NULL, now() - interval '10 minutes'),
  -- admin A: tarefa medium → padrão DESLIGADO, não sai em nenhum
  ('bbbbbbbb-0000-0000-0000-00000000ee03', '00000000-0000-0000-0000-00000000ee0a', '77777777-0000-0000-0000-00000000ee01', 'tarefa_atribuida', 'tarefa', 'medium', 'Tarefa: Y', NULL, now() - interval '10 minutes'),
  -- admin A: high criada há 1 min → ainda na janela de 5 min, imediato NÃO
  ('bbbbbbbb-0000-0000-0000-00000000ee04', '00000000-0000-0000-0000-00000000ee0a', '77777777-0000-0000-0000-00000000ee01', 'disciplina_atrasada', 'disciplina', 'high', 'Disciplina atrasada: Z', NULL, now() - interval '1 minute'),
  -- admin A: high JÁ LIDA → não sai
  ('bbbbbbbb-0000-0000-0000-00000000ee05', '00000000-0000-0000-0000-00000000ee0a', '77777777-0000-0000-0000-00000000ee01', 'obra_atrasada', 'obra', 'high', 'Obra atrasada: W', NULL, now() - interval '10 minutes'),
  -- colab A: obra high → imediato SIM (categoria obra padrão ligado)
  ('bbbbbbbb-0000-0000-0000-00000000ee06', '00000000-0000-0000-0000-00000000ee0a', '77777777-0000-0000-0000-00000000ee03', 'obra_passo_atrasado', 'obra', 'high', 'Passo atrasado: V', NULL, now() - interval '10 minutes'),
  -- "saiu": notificação da empresa A, mas o perfil está na B → NÃO sai
  ('bbbbbbbb-0000-0000-0000-00000000ee07', '00000000-0000-0000-0000-00000000ee0a', '77777777-0000-0000-0000-00000000ee04', 'projeto_atrasado', 'projeto', 'high', 'Prazo estourado: U', NULL, now() - interval '10 minutes'),
  -- admin A: semanal, mas criada há 10 dias → fora da janela de 7 dias
  ('bbbbbbbb-0000-0000-0000-00000000ee08', '00000000-0000-0000-0000-00000000ee0a', '77777777-0000-0000-0000-00000000ee01', 'projeto_prazo_proximo', 'projeto', 'medium', 'Prazo velho', NULL, now() - interval '10 days');

UPDATE public.notificacoes SET email_enviado_em = NULL
 WHERE id::text LIKE 'bbbbbbbb-0000-0000-0000-00000000ee%';
UPDATE public.notificacoes SET lido_em = now() WHERE id = 'bbbbbbbb-0000-0000-0000-00000000ee05';

-- admin A desligou e-mail de 'projeto' explicitamente
INSERT INTO public.notificacao_preferencias (user_id, empresa_id, categoria, in_app, email)
VALUES ('77777777-0000-0000-0000-00000000ee01', '00000000-0000-0000-0000-00000000ee0a', 'projeto', TRUE, FALSE)
ON CONFLICT (user_id, categoria) DO UPDATE SET email = FALSE;

RESET ROLE;

-- ---------------------------------------------------------------------------
-- 1..5  RLS de email_envios
-- ---------------------------------------------------------------------------
SELECT test_set_auth('77777777-0000-0000-0000-00000000ee01');
SET ROLE authenticated;

SELECT is(
  (SELECT count(*) FROM public.email_envios)::int, 2,
  'admin da A vê só os 2 envios da empresa A (nem o da B, nem o de plataforma sem empresa)');

SELECT is(
  (SELECT count(*) FROM public.email_supressoes)::int, 0,
  'admin comum não lê email_supressoes (tabela global, só ultra_admin)');

SELECT throws_ok(
  $$ INSERT INTO public.email_envios (classe, tipo, destinatario, assunto, status)
     VALUES ('plataforma', 'x', 'a@b.c', 's', 'enviado') $$,
  '42501', NULL,
  'authenticated não insere em email_envios (sem policy de INSERT)');

-- Sem policy de UPDATE, o RLS não lança: a linha simplesmente não é alcançada.
UPDATE public.email_envios SET status = 'entregue' WHERE id = 'aaaaaaaa-0000-0000-0000-00000000ee01';
SELECT is(
  (SELECT status FROM public.email_envios WHERE id = 'aaaaaaaa-0000-0000-0000-00000000ee01'), 'enviado',
  'authenticated não atualiza email_envios (UPDATE não alcança a linha)');

RESET ROLE;
SELECT test_set_auth('77777777-0000-0000-0000-00000000ee03');
SET ROLE authenticated;

SELECT is(
  (SELECT count(*) FROM public.email_envios)::int, 0,
  'colaborador não vê envio nenhum, nem da própria empresa');

-- ---------------------------------------------------------------------------
-- 6  Função de seleção não é executável por usuário logado
-- ---------------------------------------------------------------------------
SELECT throws_ok(
  $$ SELECT * FROM public.notificacoes_pendentes_email('imediato') $$,
  '42501', NULL,
  'authenticated não executa notificacoes_pendentes_email (permission denied)');

RESET ROLE;

-- ---------------------------------------------------------------------------
-- 7..14  Seleção (como o service role veria; aqui superuser após RESET ROLE)
-- ---------------------------------------------------------------------------
SELECT is(
  (SELECT count(*) FROM public.notificacoes_pendentes_email('imediato')
    WHERE notificacao_id::text LIKE 'bbbbbbbb-0000-0000-0000-00000000ee%')::int, 2,
  'imediato: só as high/critical com 5+ min, não lidas, de quem ainda está na empresa e com categoria ligada');

SELECT ok(
  EXISTS (SELECT 1 FROM public.notificacoes_pendentes_email('imediato') WHERE notificacao_id = 'bbbbbbbb-0000-0000-0000-00000000ee01'),
  'imediato inclui o pagamento vencido (critical, 10 min) do admin A');

SELECT ok(
  EXISTS (SELECT 1 FROM public.notificacoes_pendentes_email('imediato') WHERE notificacao_id = 'bbbbbbbb-0000-0000-0000-00000000ee06'),
  'imediato inclui o passo de obra atrasado do colaborador (obra é padrão ligado)');

SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.notificacoes_pendentes_email('imediato') WHERE notificacao_id = 'bbbbbbbb-0000-0000-0000-00000000ee04'),
  'imediato NÃO inclui a high criada há 1 minuto (janela de 5 min pra ver no app)');

SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.notificacoes_pendentes_email('imediato') WHERE notificacao_id = 'bbbbbbbb-0000-0000-0000-00000000ee05'),
  'imediato NÃO inclui a que já foi lida no app');

SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.notificacoes_pendentes_email('imediato') WHERE notificacao_id = 'bbbbbbbb-0000-0000-0000-00000000ee07'),
  'quem não está mais na empresa da notificação não recebe (perfil mudou de empresa)');

SELECT is(
  (SELECT count(*) FROM public.notificacoes_pendentes_email('semanal')
    WHERE notificacao_id::text LIKE 'bbbbbbbb-0000-0000-0000-00000000ee%')::int, 3,
  'semanal: pendentes dos últimos 7 dias com categoria ligada (critical + high de 1 min + obra do colab), sem tarefa, sem projeto desligado, sem a de 10 dias');

SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.notificacoes_pendentes_email('semanal') WHERE notificacao_id = 'bbbbbbbb-0000-0000-0000-00000000ee02'),
  'preferência explícita email=false em projeto vence o padrão ligado');

SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.notificacoes_pendentes_email('semanal') WHERE notificacao_id = 'bbbbbbbb-0000-0000-0000-00000000ee03'),
  'tarefa sem preferência segue o padrão desligado');

-- ---------------------------------------------------------------------------
-- 15..17  Supressão, modo inválido e padrão por categoria
-- ---------------------------------------------------------------------------
UPDATE public.profiles SET email = 'morto@a.com' WHERE id = '77777777-0000-0000-0000-00000000ee03';
SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.notificacoes_pendentes_email('imediato') WHERE destinatario_id = '77777777-0000-0000-0000-00000000ee03'),
  'destinatário em email_supressoes é excluído da seleção');

SELECT throws_ok(
  $$ SELECT * FROM public.notificacoes_pendentes_email('diario') $$,
  'modo inválido: diario (use imediato ou semanal)',
  'modo desconhecido é recusado com mensagem clara');

SELECT is(
  ARRAY(SELECT c FROM unnest(ARRAY['financeiro','projeto','disciplina','obra','tarefa','sistema']) c
         WHERE public.notificacao_email_padrao(c)),
  ARRAY['financeiro','projeto','disciplina','obra'],
  'padrão do canal e-mail: ligado para financeiro/projeto/disciplina/obra, desligado para tarefa/sistema');

SELECT * FROM finish();
ROLLBACK;
