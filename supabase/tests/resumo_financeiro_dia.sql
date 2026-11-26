-- pgTAP: resumo diário "vence hoje" (migration 20261235600000). Uma notificação por
-- empresa para quem vê financeiro, só quando há algo vencendo hoje, sem empilhar.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(6);

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES ('00000000-0000-0000-0000-00000000f901', 'Empresa Resumo Dia', NULL, TRUE, '{"projetos": true, "financeiro": true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

SET LOCAL session_replication_role = 'replica';

INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role) VALUES
  ('88888888-0000-0000-0000-00000000f901', 'admin-rd@test.com', '{}'::jsonb, 'authenticated', 'authenticated'),
  ('88888888-0000-0000-0000-00000000f902', 'coord-rd@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, financeiro_delegado, onboarding_completed) VALUES
  ('88888888-0000-0000-0000-00000000f901', '00000000-0000-0000-0000-00000000f901', 'Admin', 'RD', 'admin-rd@test.com', 'admin', FALSE, TRUE),
  ('88888888-0000-0000-0000-00000000f902', '00000000-0000-0000-0000-00000000f901', 'Coord', 'RD', 'coord-rd@test.com', 'coordenador', FALSE, TRUE)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, financeiro_delegado = EXCLUDED.financeiro_delegado;

SET LOCAL session_replication_role = 'origin';

-- Sem nada vencendo hoje: não avisa.
SELECT is(public.gerar_resumo_financeiro_dia(), 0, 'sem vencimento hoje não gera resumo');

INSERT INTO public.despesas (id, empresa_id, descricao, valor, status, data_vencimento) VALUES
  ('aaaaaaaa-0000-0000-0000-00000000f901', '00000000-0000-0000-0000-00000000f901', 'Aluguel', 1000, 'Pendente', current_date),
  ('aaaaaaaa-0000-0000-0000-00000000f902', '00000000-0000-0000-0000-00000000f901', 'Internet', 200, 'Pendente', current_date),
  ('aaaaaaaa-0000-0000-0000-00000000f903', '00000000-0000-0000-0000-00000000f901', 'Amanhã', 999, 'Pendente', current_date + 1);
INSERT INTO public.receitas (id, empresa_id, descricao, valor, status, data_vencimento) VALUES
  ('bbbbbbbb-0000-0000-0000-00000000f901', '00000000-0000-0000-0000-00000000f901', 'Parcela 1/2', 5000, 'Pendente', current_date);

SELECT is(public.gerar_resumo_financeiro_dia(), 1, 'gera um resumo para quem vê financeiro (só o admin)');

SELECT is(
  (SELECT titulo FROM public.notificacoes
    WHERE destinatario_id = '88888888-0000-0000-0000-00000000f901' AND tipo = 'resumo_financeiro_dia'),
  'Vence hoje: 2 a pagar (R$ 1200.00) e 1 a receber (R$ 5000.00)',
  'soma só o que vence hoje, a pagar e a receber'
);

SELECT is(
  (SELECT count(*)::int FROM public.notificacoes
    WHERE destinatario_id = '88888888-0000-0000-0000-00000000f902' AND tipo = 'resumo_financeiro_dia'),
  0, 'coordenador sem delegação não recebe'
);

SELECT is(public.gerar_resumo_financeiro_dia(), 0, 'segunda rodada no mesmo dia não empilha');

UPDATE public.despesas SET status = 'Pago' WHERE empresa_id = '00000000-0000-0000-0000-00000000f901';
UPDATE public.notificacoes SET lido_em = now() WHERE tipo = 'resumo_financeiro_dia';
UPDATE public.receitas SET status = 'Recebido' WHERE empresa_id = '00000000-0000-0000-0000-00000000f901';
SELECT is(public.gerar_resumo_financeiro_dia(), 0, 'tudo baixado: não avisa de novo');

SELECT * FROM finish();
ROLLBACK;
