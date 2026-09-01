-- pgTAP: public.projetos_com_escopo_estourado() (migration 20260887000000, spec 081)
--
-- Fonte única de "quais projetos estouraram o orçamento vivo", consumida pelo
-- guardiao-margem-cron (agente que prepara o rascunho de aditivo) e conceitualmente
-- igual à condição do alerta 'orcamento_excedido' em gerar_notificacoes_ambient()
-- (ver supabase/tests/gerar_notificacoes_ambient_orcamento_excedido.sql).

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(5);

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES ('00000000-0000-0000-0000-0000000fc001', 'Empresa Guardiao Margem RPC', NULL, TRUE, '{"projetos": true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

-- Projeto A: orçamento vivo R$10k (100h x R$100/h), despesa R$12k, sem aditivo aberto → aparece
INSERT INTO public.projetos (id, empresa_id, nome, status)
VALUES ('ffffffff-0000-0000-0000-0000000fc001', '00000000-0000-0000-0000-0000000fc001', 'Projeto Estourado', 'Em andamento');
INSERT INTO public.projeto_orcamento_fases (empresa_id, projeto_id, disciplina, horas_estimadas, custo_hora)
VALUES ('00000000-0000-0000-0000-0000000fc001', 'ffffffff-0000-0000-0000-0000000fc001', 'Estrutural', 100, 100);
INSERT INTO public.despesas (empresa_id, projeto_id, descricao, valor, status)
VALUES ('00000000-0000-0000-0000-0000000fc001', 'ffffffff-0000-0000-0000-0000000fc001', 'Despesa 1', 12000, 'Pago');

-- Projeto B: mesmo estouro, mas já tem aditivo em rascunho → não aparece (idempotência do agente)
INSERT INTO public.projetos (id, empresa_id, nome, status)
VALUES ('ffffffff-0000-0000-0000-0000000fc002', '00000000-0000-0000-0000-0000000fc001', 'Projeto Com Aditivo Aberto', 'Em andamento');
INSERT INTO public.projeto_orcamento_fases (empresa_id, projeto_id, disciplina, horas_estimadas, custo_hora)
VALUES ('00000000-0000-0000-0000-0000000fc001', 'ffffffff-0000-0000-0000-0000000fc002', 'Estrutural', 100, 100);
INSERT INTO public.despesas (empresa_id, projeto_id, descricao, valor, status)
VALUES ('00000000-0000-0000-0000-0000000fc001', 'ffffffff-0000-0000-0000-0000000fc002', 'Despesa 1', 12000, 'Pago');
INSERT INTO public.escopos (empresa_id, projeto_id, descricao, tipo, status, custo_estimado)
VALUES ('00000000-0000-0000-0000-0000000fc001', 'ffffffff-0000-0000-0000-0000000fc002', 'Aditivo em análise', 'aditivo', 'rascunho', 3000);

-- Projeto C: sem orçamento vivo → não aparece
INSERT INTO public.projetos (id, empresa_id, nome, status)
VALUES ('ffffffff-0000-0000-0000-0000000fc003', '00000000-0000-0000-0000-0000000fc001', 'Projeto Sem Orcamento', 'Em andamento');
INSERT INTO public.despesas (empresa_id, projeto_id, descricao, valor, status)
VALUES ('00000000-0000-0000-0000-0000000fc001', 'ffffffff-0000-0000-0000-0000000fc003', 'Despesa 1', 50000, 'Pago');

-- Projeto D: dentro do orçado → não aparece
INSERT INTO public.projetos (id, empresa_id, nome, status)
VALUES ('ffffffff-0000-0000-0000-0000000fc004', '00000000-0000-0000-0000-0000000fc001', 'Projeto Dentro Do Orcado', 'Em andamento');
INSERT INTO public.projeto_orcamento_fases (empresa_id, projeto_id, disciplina, horas_estimadas, custo_hora)
VALUES ('00000000-0000-0000-0000-0000000fc001', 'ffffffff-0000-0000-0000-0000000fc004', 'Estrutural', 100, 100);
INSERT INTO public.despesas (empresa_id, projeto_id, descricao, valor, status)
VALUES ('00000000-0000-0000-0000-0000000fc001', 'ffffffff-0000-0000-0000-0000000fc004', 'Despesa 1', 4000, 'Pago');

-- Projeto E: status diferente de "Em andamento" (Concluído), mesmo estourado → não aparece
INSERT INTO public.projetos (id, empresa_id, nome, status)
VALUES ('ffffffff-0000-0000-0000-0000000fc005', '00000000-0000-0000-0000-0000000fc001', 'Projeto Concluido', 'Concluído');
INSERT INTO public.projeto_orcamento_fases (empresa_id, projeto_id, disciplina, horas_estimadas, custo_hora)
VALUES ('00000000-0000-0000-0000-0000000fc001', 'ffffffff-0000-0000-0000-0000000fc005', 'Estrutural', 100, 100);
INSERT INTO public.despesas (empresa_id, projeto_id, descricao, valor, status)
VALUES ('00000000-0000-0000-0000-0000000fc001', 'ffffffff-0000-0000-0000-0000000fc005', 'Despesa 1', 12000, 'Pago');

SELECT lives_ok(
  $$ SELECT * FROM public.projetos_com_escopo_estourado() $$,
  'projetos_com_escopo_estourado roda sem erro'
);

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.projetos_com_escopo_estourado()
   WHERE projeto_id = 'ffffffff-0000-0000-0000-0000000fc001'),
  1,
  'Projeto A (estourado, sem aditivo aberto) aparece'
);

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.projetos_com_escopo_estourado()
   WHERE projeto_id = 'ffffffff-0000-0000-0000-0000000fc002'),
  0,
  'Projeto B (com aditivo em rascunho) não aparece — idempotência do agente'
);

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.projetos_com_escopo_estourado()
   WHERE projeto_id IN ('ffffffff-0000-0000-0000-0000000fc003', 'ffffffff-0000-0000-0000-0000000fc004', 'ffffffff-0000-0000-0000-0000000fc005')),
  0,
  'Sem orçamento, dentro do orçado, e projeto concluído não aparecem'
);

SELECT is(
  (SELECT custo_orcado FROM public.projetos_com_escopo_estourado() WHERE projeto_id = 'ffffffff-0000-0000-0000-0000000fc001'),
  10000::numeric,
  'custo_orcado vem de projeto_orcamento_fases (100h x R$100/h = R$10.000), não de escopos'
);

SELECT * FROM finish();

ROLLBACK;
