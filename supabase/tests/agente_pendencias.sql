-- pgTAP: agente de acompanhamento (SPEC 146).
-- Regras de detecção, ciclo de vida (abrir, manter, fechar sozinho, reabrir, adiar, dispensar)
-- e visibilidade por papel. Fixtures como postgres; as chamadas de usuário rodam como
-- authenticated com o JWT de cada papel. A transação inteira é revertida.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(21);

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES
  ('a1460000-0000-0000-0000-0000000000a1', 'Empresa A acompanhamento', NULL, TRUE,
   '{"financeiro": true, "leads": true, "projetos": true, "obras": true}'::jsonb),
  ('a1460000-0000-0000-0000-0000000000b1', 'Empresa B acompanhamento', NULL, TRUE,
   '{"financeiro": true, "leads": true, "projetos": true, "obras": true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

SET LOCAL session_replication_role = 'replica';
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role, email_confirmed_at)
VALUES
  ('a1460000-0000-0000-0000-000000000001', 'a_admin@acomp.test', '{}'::jsonb, 'authenticated', 'authenticated', now()),
  ('a1460000-0000-0000-0000-000000000002', 'a_coord@acomp.test', '{}'::jsonb, 'authenticated', 'authenticated', now()),
  ('a1460000-0000-0000-0000-000000000003', 'b_admin@acomp.test', '{}'::jsonb, 'authenticated', 'authenticated', now())
ON CONFLICT (id) DO NOTHING;
SET LOCAL session_replication_role = 'origin';

INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, financeiro_delegado, onboarding_completed)
VALUES
  ('a1460000-0000-0000-0000-000000000001', 'a1460000-0000-0000-0000-0000000000a1', 'A', 'Admin', 'a_admin@acomp.test', 'admin', FALSE, TRUE),
  ('a1460000-0000-0000-0000-000000000002', 'a1460000-0000-0000-0000-0000000000a1', 'A', 'Coord', 'a_coord@acomp.test', 'coordenador', FALSE, TRUE),
  ('a1460000-0000-0000-0000-000000000003', 'a1460000-0000-0000-0000-0000000000b1', 'B', 'Admin', 'b_admin@acomp.test', 'admin', FALSE, TRUE)
ON CONFLICT (id) DO UPDATE SET empresa_id = EXCLUDED.empresa_id, role = EXCLUDED.role;

DO $$ BEGIN
  PERFORM set_config('request.jwt.claims',
    '{"sub": "a1460000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
END $$;

-- Projeto com prazo em 2 dias e contrato, sem orçamento por disciplina.
INSERT INTO public.projetos (id, empresa_id, nome, status, data_previsao, valor_contrato)
VALUES ('a1460000-0000-0000-0000-00000000f001', 'a1460000-0000-0000-0000-0000000000a1',
        'Projeto prazo próximo', 'Em andamento', CURRENT_DATE + 2, 100000);
-- Projeto atrasado, com orçamento maior que o contrato.
INSERT INTO public.projetos (id, empresa_id, nome, status, data_previsao, valor_contrato)
VALUES ('a1460000-0000-0000-0000-00000000f002', 'a1460000-0000-0000-0000-0000000000a1',
        'Projeto atrasado', 'Em andamento', CURRENT_DATE - 10, 50000);
INSERT INTO public.projeto_orcamento_fases (empresa_id, projeto_id, disciplina, horas_estimadas, custo_hora)
VALUES ('a1460000-0000-0000-0000-0000000000a1', 'a1460000-0000-0000-0000-00000000f002', 'Estrutural', 100, 700);
-- Projeto de B, só para provar o isolamento (o gatilho de limites exige o claim da própria empresa).
DO $$ BEGIN
  PERFORM set_config('request.jwt.claims',
    '{"sub": "a1460000-0000-0000-0000-000000000003", "role": "authenticated"}', true);
END $$;
INSERT INTO public.projetos (id, empresa_id, nome, status, data_previsao, valor_contrato)
VALUES ('a1460000-0000-0000-0000-00000000f003', 'a1460000-0000-0000-0000-0000000000b1',
        'Projeto B atrasado', 'Em andamento', CURRENT_DATE - 3, 10000);
DO $$ BEGIN
  PERFORM set_config('request.jwt.claims',
    '{"sub": "a1460000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
END $$;

-- Receita vencida (entra) e receita vencida excluída (não entra).
INSERT INTO public.receitas (id, empresa_id, descricao, valor, data_vencimento, status, parcela_numero, parcela_total)
VALUES ('a1460000-0000-0000-0000-00000000e001', 'a1460000-0000-0000-0000-0000000000a1',
        'Parcela 2 do projeto', 1000, CURRENT_DATE - 5, 'Pendente', 2, 3);
INSERT INTO public.receitas (id, empresa_id, descricao, valor, data_vencimento, status, deleted_at)
VALUES ('a1460000-0000-0000-0000-00000000e002', 'a1460000-0000-0000-0000-0000000000a1',
        'Receita excluída', 500, CURRENT_DATE - 40, 'Pendente', now());
INSERT INTO public.despesas (id, empresa_id, descricao, valor, data_vencimento, status)
VALUES ('a1460000-0000-0000-0000-00000000d001', 'a1460000-0000-0000-0000-0000000000a1',
        'Conta a vencer', 300, CURRENT_DATE + 3, 'Pendente');

-- Obra com tarefa vencida.
INSERT INTO public.obras (id, empresa_id, nome, status, created_by)
VALUES ('a1460000-0000-0000-0000-00000000b001', 'a1460000-0000-0000-0000-0000000000a1',
        'Obra acompanhamento', 'em_andamento', 'a1460000-0000-0000-0000-000000000001');
INSERT INTO public.tarefas (id, empresa_id, obra_id, titulo, status, prazo, created_by)
VALUES ('a1460000-0000-0000-0000-00000000c001', 'a1460000-0000-0000-0000-0000000000a1',
        'a1460000-0000-0000-0000-00000000b001', 'Concretar laje', 'a_fazer', CURRENT_DATE - 2,
        'a1460000-0000-0000-0000-000000000001');

-- =====================================================================
-- Detecção
-- =====================================================================
SELECT is(
  (SELECT array_agg(tipo ORDER BY tipo) FROM public.agente_pendencias_detectar('a1460000-0000-0000-0000-0000000000a1')),
  ARRAY['a_pagar_proximo', 'obra_sem_cronograma', 'orcamento_acima_do_contrato', 'orcamento_ausente',
        'projeto_atrasado', 'projeto_prazo_proximo', 'recebimento_atrasado', 'tarefa_obra_atrasada'],
  'detecta financeiro, prazos, orçamento, obra e planejamento da empresa A'
);

SELECT is(
  (SELECT count(*)::int FROM public.agente_pendencias_detectar('a1460000-0000-0000-0000-0000000000a1')
   WHERE referencia_id = 'a1460000-0000-0000-0000-00000000e002'),
  0, 'receita excluída não vira pendência'
);

SELECT is(
  (SELECT (dados->>'dias_atraso')::int || '/' || (dados->>'parcela_numero') || 'de' || (dados->>'parcela_total')
   FROM public.agente_pendencias_detectar('a1460000-0000-0000-0000-0000000000a1') WHERE tipo = 'recebimento_atrasado'),
  '5/2de3', 'a parcela vem com dias de atraso e número da parcela nos fatos'
);

SELECT is(
  (SELECT acao_sugerida FROM public.agente_pendencias_detectar('a1460000-0000-0000-0000-0000000000a1')
   WHERE tipo = 'recebimento_atrasado'),
  'marcar_recebido', 'recebimento atrasado sugere a operação do chat'
);

SELECT is(
  (SELECT count(*)::int FROM public.agente_pendencias_detectar('a1460000-0000-0000-0000-0000000000a1')
   WHERE empresa_id <> 'a1460000-0000-0000-0000-0000000000a1'),
  0, 'filtrar por empresa não vaza outra empresa'
);

-- =====================================================================
-- Ciclo de vida
-- =====================================================================
SELECT is((public.agente_pendencias_varrer('a1460000-0000-0000-0000-0000000000a1')->>'achadas')::int, 8,
  'primeira varredura grava os 8 achados');

CREATE TEMP TABLE antes AS
  SELECT id, primeira_deteccao FROM public.agente_pendencias
  WHERE empresa_id = 'a1460000-0000-0000-0000-0000000000a1' AND tipo = 'recebimento_atrasado';

SELECT public.agente_pendencias_varrer('a1460000-0000-0000-0000-0000000000a1');
SELECT is(
  (SELECT count(*)::int FROM public.agente_pendencias WHERE empresa_id = 'a1460000-0000-0000-0000-0000000000a1'),
  8, 'segunda varredura não duplica'
);
SELECT is(
  (SELECT ap.primeira_deteccao = a.primeira_deteccao FROM public.agente_pendencias ap JOIN antes a USING (id)),
  true, 'a idade da pendência é mantida entre varreduras'
);

UPDATE public.receitas SET status = 'Recebido', data_recebimento = CURRENT_DATE
 WHERE id = 'a1460000-0000-0000-0000-00000000e001';
SELECT public.agente_pendencias_varrer('a1460000-0000-0000-0000-0000000000a1');
SELECT is(
  (SELECT status || '/' || resolvida_motivo FROM public.agente_pendencias
   WHERE empresa_id = 'a1460000-0000-0000-0000-0000000000a1' AND tipo = 'recebimento_atrasado'),
  'resolvida/condicao_sumiu', 'quem recebeu a parcela fecha a pendência sozinho'
);

UPDATE public.receitas SET status = 'Pendente', data_recebimento = NULL
 WHERE id = 'a1460000-0000-0000-0000-00000000e001';
SELECT public.agente_pendencias_varrer('a1460000-0000-0000-0000-0000000000a1');
SELECT is(
  (SELECT status || '/' || (primeira_deteccao > (SELECT primeira_deteccao FROM antes))::text
   FROM public.agente_pendencias
   WHERE empresa_id = 'a1460000-0000-0000-0000-0000000000a1' AND tipo = 'recebimento_atrasado'),
  'aberta/true', 'se a condição volta, reabre como ocorrência nova com idade zerada'
);

-- =====================================================================
-- Visibilidade e ações por papel
-- =====================================================================
CREATE OR REPLACE FUNCTION pg_temp.como(p_user uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

SELECT pg_temp.como('a1460000-0000-0000-0000-000000000001');
SELECT is(
  (SELECT array_agg(DISTINCT area ORDER BY area) FROM public.agente_pendencias),
  ARRAY['financeiro', 'obra', 'orcamento', 'planejamento', 'prazos'],
  'admin da empresa A enxerga todas as áreas'
);

SELECT pg_temp.como('a1460000-0000-0000-0000-000000000002');
SELECT is(
  (SELECT array_agg(DISTINCT area ORDER BY area) FROM public.agente_pendencias),
  ARRAY['obra', 'planejamento', 'prazos'],
  'coordenador não enxerga dinheiro (financeiro e orçamento)'
);

SELECT pg_temp.como('a1460000-0000-0000-0000-000000000003');
SELECT is((SELECT count(*)::int FROM public.agente_pendencias WHERE empresa_id = 'a1460000-0000-0000-0000-0000000000a1'),
  0, 'admin de outra empresa não vê pendência da A');

SELECT pg_temp.como('a1460000-0000-0000-0000-000000000001');
SELECT throws_ok(
  $$SELECT * FROM public.agente_pendencias_detectar(NULL)$$, '42501', NULL,
  'usuário logado não chama o detector direto');
SELECT throws_ok(
  $$UPDATE public.agente_pendencias SET titulo = 'forjado'$$, '42501', NULL,
  'usuário só altera status e adiada_ate');

SELECT lives_ok(
  $$SELECT public.agente_pendencia_adiar((SELECT id FROM public.agente_pendencias WHERE tipo = 'a_pagar_proximo'), 3)$$,
  'adiar por 3 dias');
SELECT throws_ok(
  $$SELECT public.agente_pendencia_adiar((SELECT id FROM public.agente_pendencias WHERE tipo = 'a_pagar_proximo'), 0)$$,
  '22023', NULL, 'adiar exige entre 1 e 30 dias');

SELECT lives_ok(
  $$SELECT public.agente_pendencia_dispensar((SELECT id FROM public.agente_pendencias WHERE tipo = 'obra_sem_cronograma'))$$,
  'dispensar');

RESET ROLE;
SELECT public.agente_pendencias_varrer('a1460000-0000-0000-0000-0000000000a1');
SELECT is(
  (SELECT string_agg(tipo || '=' || status, ',' ORDER BY tipo) FROM public.agente_pendencias
   WHERE tipo IN ('a_pagar_proximo', 'obra_sem_cronograma')
     AND empresa_id = 'a1460000-0000-0000-0000-0000000000a1'),
  'a_pagar_proximo=adiada,obra_sem_cronograma=dispensada',
  'adiada e dispensada continuam assim enquanto a condição existe'
);

UPDATE public.agente_pendencias SET adiada_ate = CURRENT_DATE
 WHERE tipo = 'a_pagar_proximo' AND empresa_id = 'a1460000-0000-0000-0000-0000000000a1';
SELECT public.agente_pendencias_varrer('a1460000-0000-0000-0000-0000000000a1');
SELECT is(
  (SELECT status FROM public.agente_pendencias
   WHERE tipo = 'a_pagar_proximo' AND empresa_id = 'a1460000-0000-0000-0000-0000000000a1'),
  'aberta', 'adiada vencida volta a abrir'
);

-- atualizar(): a varredura vem da empresa do usuário.
SELECT pg_temp.como('a1460000-0000-0000-0000-000000000003');
SELECT is((public.agente_pendencias_atualizar()->>'achadas')::int, 2,
  'atualizar() varre só a empresa de quem chamou');

SELECT * FROM finish();
ROLLBACK;
