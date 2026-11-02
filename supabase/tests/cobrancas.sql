-- pgTAP: cobrança por e-mail com escada e rascunho (SPEC 148).
-- Etapa devida por data, texto com fatos do histórico, idempotência, supressão do aviso
-- duplicado, recusar e "já cobrei por fora", visibilidade por papel. Fixtures como postgres;
-- as chamadas de usuário rodam como authenticated. A transação inteira é revertida.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(25);

INSERT INTO public.empresas (id, nome, email, owner_id, onboarding_completed, features)
VALUES
  ('a1480000-0000-0000-0000-0000000000a1', 'Empresa A cobranca', 'contato@a.test', NULL, TRUE,
   '{"financeiro": true, "projetos": true}'::jsonb),
  ('a1480000-0000-0000-0000-0000000000b1', 'Empresa B cobranca', NULL, NULL, TRUE,
   '{"financeiro": true, "projetos": true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features, email = EXCLUDED.email;

SET LOCAL session_replication_role = 'replica';
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role, email_confirmed_at)
VALUES
  ('a1480000-0000-0000-0000-000000000001', 'a_admin@cobr.test', '{}'::jsonb, 'authenticated', 'authenticated', now()),
  ('a1480000-0000-0000-0000-000000000002', 'a_coord@cobr.test', '{}'::jsonb, 'authenticated', 'authenticated', now()),
  ('a1480000-0000-0000-0000-000000000003', 'b_admin@cobr.test', '{}'::jsonb, 'authenticated', 'authenticated', now())
ON CONFLICT (id) DO NOTHING;
SET LOCAL session_replication_role = 'origin';

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, financeiro_delegado, onboarding_completed)
VALUES
  ('a1480000-0000-0000-0000-000000000001', 'a1480000-0000-0000-0000-0000000000a1', 'A', 'Admin', 'a_admin@cobr.test', 'admin', FALSE, TRUE),
  ('a1480000-0000-0000-0000-000000000002', 'a1480000-0000-0000-0000-0000000000a1', 'A', 'Coord', 'a_coord@cobr.test', 'coordenador', FALSE, TRUE),
  ('a1480000-0000-0000-0000-000000000003', 'a1480000-0000-0000-0000-0000000000b1', 'B', 'Admin', 'b_admin@cobr.test', 'admin', FALSE, TRUE)
ON CONFLICT (id) DO UPDATE SET empresa_id = EXCLUDED.empresa_id, role = EXCLUDED.role;

DO $$ BEGIN
  PERFORM set_config('request.jwt.claims',
    '{"sub": "a1480000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
END $$;

INSERT INTO public.clientes (id, empresa_id, nome, email) VALUES
  ('a1480000-0000-0000-0000-00000000c001', 'a1480000-0000-0000-0000-0000000000a1', 'Cliente Com Email', 'financeiro@cliente.test'),
  ('a1480000-0000-0000-0000-00000000c002', 'a1480000-0000-0000-0000-0000000000a1', 'Cliente Sem Email', NULL);

-- Histórico: duas parcelas pagas com 6 dias de atraso.
INSERT INTO public.receitas (empresa_id, cliente_id, descricao, valor, data_vencimento, data_recebimento, status)
VALUES
  ('a1480000-0000-0000-0000-0000000000a1', 'a1480000-0000-0000-0000-00000000c001', 'Parcela antiga 1', 1000, CURRENT_DATE - 90, CURRENT_DATE - 84, 'Recebido'),
  ('a1480000-0000-0000-0000-0000000000a1', 'a1480000-0000-0000-0000-00000000c001', 'Parcela antiga 2', 1000, CURRENT_DATE - 60, CURRENT_DATE - 54, 'Recebido');

INSERT INTO public.receitas (id, empresa_id, cliente_id, descricao, valor, data_vencimento, status, parcela_numero, parcela_total) VALUES
  ('a1480000-0000-0000-0000-00000000e001', 'a1480000-0000-0000-0000-0000000000a1', 'a1480000-0000-0000-0000-00000000c001', 'Parcela 2', 18500, CURRENT_DATE - 7, 'Pendente', 2, 3),
  ('a1480000-0000-0000-0000-00000000e002', 'a1480000-0000-0000-0000-0000000000a1', 'a1480000-0000-0000-0000-00000000c002', 'Parcela sem email', 900, CURRENT_DATE - 2, 'Pendente', 1, 2),
  ('a1480000-0000-0000-0000-00000000e003', 'a1480000-0000-0000-0000-0000000000a1', 'a1480000-0000-0000-0000-00000000c001', 'Parcela 3', 5000, CURRENT_DATE - 20, 'Pendente', 3, 3),
  ('a1480000-0000-0000-0000-00000000e004', 'a1480000-0000-0000-0000-0000000000a1', 'a1480000-0000-0000-0000-00000000c001', 'Parcela 4', 700, CURRENT_DATE + 2, 'Pendente', 1, 1),
  ('a1480000-0000-0000-0000-00000000e005', 'a1480000-0000-0000-0000-0000000000a1', 'a1480000-0000-0000-0000-00000000c001', 'Parcela muito atrasada', 3000, CURRENT_DATE - 40, 'Pendente', 1, 1),
  ('a1480000-0000-0000-0000-00000000e006', 'a1480000-0000-0000-0000-0000000000a1', 'a1480000-0000-0000-0000-00000000c001', 'Parcela com rascunho velho', 2000, CURRENT_DATE - 10, 'Pendente', 1, 1);

-- R5 já foi cobrada na etapa 4 há 10 dias; R6 tem um rascunho da etapa 2 que ficou para trás.
INSERT INTO public.cobrancas (empresa_id, receita_id, etapa, status, destinatario_email, assunto, abertura, decidida_em)
VALUES
  ('a1480000-0000-0000-0000-0000000000a1', 'a1480000-0000-0000-0000-00000000e005', 4, 'enviada', 'financeiro@cliente.test', 'x', 'x', now() - interval '10 days');
INSERT INTO public.cobrancas (empresa_id, receita_id, etapa, status, destinatario_email, assunto, abertura)
VALUES
  ('a1480000-0000-0000-0000-0000000000a1', 'a1480000-0000-0000-0000-00000000e006', 2, 'rascunho', 'financeiro@cliente.test', 'velho', 'velho');

DO $$ BEGIN
  PERFORM set_config('request.jwt.claims',
    '{"sub": "a1480000-0000-0000-0000-000000000003", "role": "authenticated"}', true);
END $$;
INSERT INTO public.clientes (id, empresa_id, nome, email)
VALUES ('a1480000-0000-0000-0000-00000000c0b1', 'a1480000-0000-0000-0000-0000000000b1', 'Cliente da B', 'b@cliente.test');
INSERT INTO public.receitas (id, empresa_id, cliente_id, descricao, valor, data_vencimento, status)
VALUES ('a1480000-0000-0000-0000-00000000e0b1', 'a1480000-0000-0000-0000-0000000000b1', 'a1480000-0000-0000-0000-00000000c0b1', 'Parcela da B', 800, CURRENT_DATE - 3, 'Pendente');

-- =====================================================================
-- Rascunhos
-- =====================================================================
SELECT public.agente_pendencias_varrer('a1480000-0000-0000-0000-0000000000a1');

SELECT is(
  (SELECT string_agg(r.descricao || '=' || c.etapa, ',' ORDER BY r.descricao) FROM public.cobrancas c
   JOIN public.receitas r ON r.id = c.receita_id WHERE c.status = 'rascunho' AND c.empresa_id = 'a1480000-0000-0000-0000-0000000000a1'),
  'Parcela 2=3,Parcela 3=4,Parcela 4=1,Parcela com rascunho velho=3',
  'cada parcela recebe só a etapa devida hoje (7 dias: 3, 20 dias: 4, 2 dias antes: 1, rascunho velho substituído)'
);

SELECT is(
  (SELECT status FROM public.cobrancas WHERE receita_id = 'a1480000-0000-0000-0000-00000000e006' AND etapa = 2),
  'cancelada', 'rascunho de etapa superada é cancelado'
);

SELECT is(
  (SELECT count(*)::int FROM public.cobrancas WHERE receita_id = 'a1480000-0000-0000-0000-00000000e002'),
  0, 'cliente sem e-mail não recebe rascunho'
);

SELECT is(
  (SELECT count(*)::int FROM public.cobrancas WHERE receita_id = 'a1480000-0000-0000-0000-00000000e005' AND status = 'rascunho'),
  0, 'parcela já cobrada na etapa 4 não recebe outro rascunho'
);

SELECT ok(
  (SELECT abertura FROM public.cobrancas WHERE receita_id = 'a1480000-0000-0000-0000-00000000e001' AND etapa = 3)
    LIKE '%em média 6 dia(s) após o vencimento%',
  'a abertura usa o histórico de pagamento do cliente (fato do banco)'
);

SELECT ok(
  (SELECT abertura FROM public.cobrancas WHERE receita_id = 'a1480000-0000-0000-0000-00000000e003' AND etapa = 4)
    NOT LIKE '%em média%',
  'a etapa firme não cita o histórico'
);

SELECT ok(
  (SELECT assunto FROM public.cobrancas WHERE receita_id = 'a1480000-0000-0000-0000-00000000e004' AND etapa = 1) LIKE 'Lembrete: %',
  'a etapa 1 tem assunto de lembrete'
);

SELECT is(
  (SELECT count(*)::int FROM public.cobrancas WHERE empresa_id = 'a1480000-0000-0000-0000-0000000000b1'),
  0, 'escritório sem e-mail cadastrado não gera rascunho'
);

-- =====================================================================
-- Pendências
-- =====================================================================
SELECT is(
  (SELECT count(*)::int FROM public.agente_pendencias WHERE tipo = 'cobranca_pronta' AND status = 'aberta'
     AND empresa_id = 'a1480000-0000-0000-0000-0000000000a1'),
  4, 'cada rascunho vira uma pendência "cobrança pronta"'
);

SELECT is(
  (SELECT count(*)::int FROM public.agente_pendencias WHERE status = 'aberta' AND empresa_id = 'a1480000-0000-0000-0000-0000000000a1'
     AND tipo IN ('recebimento_atrasado', 'a_receber_proximo')
     AND referencia_id IN ('a1480000-0000-0000-0000-00000000e001', 'a1480000-0000-0000-0000-00000000e004')),
  0, 'parcela com cobrança pronta não aparece também como atrasada ou a vencer'
);

SELECT is(
  (SELECT (dados->>'etapa') || '/' || (dados->>'etapa_total') FROM public.agente_pendencias
   WHERE chave = 'cobranca_pronta:a1480000-0000-0000-0000-00000000e001'),
  '3/4', 'a pendência traz a etapa e o total da escada'
);

SELECT is(
  (SELECT count(*)::int FROM public.agente_pendencias WHERE tipo = 'cobranca_sem_email'
     AND empresa_id = 'a1480000-0000-0000-0000-0000000000a1' AND status = 'aberta'),
  1, 'cliente sem e-mail vira pendência "cadastre o e-mail", uma por cliente'
);

SELECT is(
  (SELECT count(*)::int FROM public.agente_pendencias WHERE tipo = 'cobranca_ligar'
     AND referencia_id = 'a1480000-0000-0000-0000-00000000e005'),
  1, 'aos 30 dias com cobrança enviada o agente sugere ligar'
);

SELECT public.agente_pendencias_varrer('a1480000-0000-0000-0000-0000000000b1');
SELECT is(
  (SELECT count(*)::int FROM public.agente_pendencias WHERE tipo = 'cobranca_sem_email_empresa'
     AND empresa_id = 'a1480000-0000-0000-0000-0000000000b1'),
  1, 'escritório sem e-mail vira pendência de configuração'
);

-- Idempotência
SELECT public.agente_pendencias_varrer('a1480000-0000-0000-0000-0000000000a1');
SELECT is(
  (SELECT count(*)::int FROM public.cobrancas WHERE status = 'rascunho' AND empresa_id = 'a1480000-0000-0000-0000-0000000000a1'),
  4, 'varrer de novo não duplica rascunho'
);

-- =====================================================================
-- Papéis e decisões
-- =====================================================================
CREATE OR REPLACE FUNCTION pg_temp.como(p_user uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

SELECT pg_temp.como('a1480000-0000-0000-0000-000000000002');
SELECT is((SELECT count(*)::int FROM public.cobrancas), 0, 'coordenador não lê cobranças');
SELECT throws_ok(
  $$SELECT public.cobranca_decidir((SELECT id FROM public.cobrancas LIMIT 1), 'recusada')$$, '42501', NULL,
  'coordenador não decide cobrança');

SELECT pg_temp.como('a1480000-0000-0000-0000-000000000003');
SELECT is((SELECT count(*)::int FROM public.cobrancas WHERE empresa_id = 'a1480000-0000-0000-0000-0000000000a1'),
  0, 'admin de outra empresa não lê cobrança da A');

SELECT pg_temp.como('a1480000-0000-0000-0000-000000000001');
SELECT throws_ok(
  $$SELECT public.cobranca_decidir((SELECT id FROM public.cobrancas WHERE etapa = 3 AND status = 'rascunho' LIMIT 1), 'enviada')$$,
  '22023', NULL, 'só dá para recusar ou marcar como cobrado por fora (enviar é pela função de envio)');

SELECT lives_ok(
  $$SELECT public.cobranca_decidir((SELECT id FROM public.cobrancas WHERE receita_id = 'a1480000-0000-0000-0000-00000000e001' AND status = 'rascunho'), 'recusada')$$,
  'admin recusa a cobrança');
SELECT lives_ok(
  $$SELECT public.cobranca_decidir((SELECT id FROM public.cobrancas WHERE receita_id = 'a1480000-0000-0000-0000-00000000e003' AND status = 'rascunho'), 'externa')$$,
  'admin marca "já cobrei por fora"');

RESET ROLE;
SELECT is(
  (SELECT string_agg(tipo || ':' || status, ',' ORDER BY tipo) FROM public.agente_pendencias
   WHERE referencia_id = 'a1480000-0000-0000-0000-00000000e001'),
  'cobranca_pronta:resolvida,recebimento_atrasado:aberta',
  'recusada: a pendência de cobrança fecha e a parcela volta como atrasada'
);

SELECT is(
  (SELECT count(*)::int FROM public.cobrancas WHERE receita_id = 'a1480000-0000-0000-0000-00000000e001' AND status = 'rascunho'),
  0, 'depois de recusar, a mesma etapa não volta'
);

SELECT ok(
  (SELECT detalhe FROM public.agente_pendencias WHERE tipo = 'recebimento_atrasado'
     AND referencia_id = 'a1480000-0000-0000-0000-00000000e003') LIKE '%Cobrada em %(etapa 4 de 4)%',
  'parcela cobrada por fora mostra quando e em que etapa'
);

-- Parcela paga cancela o rascunho aberto
UPDATE public.receitas SET status = 'Recebido', data_recebimento = CURRENT_DATE WHERE id = 'a1480000-0000-0000-0000-00000000e004';
SELECT public.agente_pendencias_varrer('a1480000-0000-0000-0000-0000000000a1');
SELECT is(
  (SELECT status FROM public.cobrancas WHERE receita_id = 'a1480000-0000-0000-0000-00000000e004'),
  'cancelada', 'parcela paga cancela o rascunho e fecha a pendência'
);

SELECT * FROM finish();
ROLLBACK;
