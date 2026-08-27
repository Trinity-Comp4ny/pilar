-- pgTAP: novo alerta `orcamento_excedido` em gerar_alertas_ambient()
-- (migration 20260863000000, spec 067). Cobre os critérios de aceite da spec:
-- estourou sem aditivo aberto → alerta; com aditivo aberto → nada; sem escopo
-- original → nada; dentro do orçado → nada; dedupe por `lido = false`.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(6);

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES ('00000000-0000-0000-0000-00000000eb01', 'Empresa Guardiao Escopo', NULL, TRUE, '{"projetos": true, "financeiro": true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

-- Projeto A: escopo original R$10k, despesa R$12k, sem aditivo aberto → deve alertar
INSERT INTO public.projetos (id, empresa_id, nome, status)
VALUES ('eeeeeeee-0000-0000-0000-00000000eb01', '00000000-0000-0000-0000-00000000eb01', 'Projeto Estourado', 'Em andamento');
INSERT INTO public.escopos (empresa_id, projeto_id, descricao, tipo, status, custo_estimado)
VALUES ('00000000-0000-0000-0000-00000000eb01', 'eeeeeeee-0000-0000-0000-00000000eb01', 'Escopo original', 'original', 'aprovado', 10000);
INSERT INTO public.despesas (empresa_id, projeto_id, descricao, valor, status)
VALUES ('00000000-0000-0000-0000-00000000eb01', 'eeeeeeee-0000-0000-0000-00000000eb01', 'Despesa 1', 12000, 'Pago');

-- Projeto B: mesmo estouro, mas com aditivo em rascunho → NÃO deve alertar
INSERT INTO public.projetos (id, empresa_id, nome, status)
VALUES ('eeeeeeee-0000-0000-0000-00000000eb02', '00000000-0000-0000-0000-00000000eb01', 'Projeto Com Aditivo Aberto', 'Em andamento');
INSERT INTO public.escopos (empresa_id, projeto_id, descricao, tipo, status, custo_estimado)
VALUES ('00000000-0000-0000-0000-00000000eb01', 'eeeeeeee-0000-0000-0000-00000000eb02', 'Escopo original', 'original', 'aprovado', 10000);
INSERT INTO public.despesas (empresa_id, projeto_id, descricao, valor, status)
VALUES ('00000000-0000-0000-0000-00000000eb01', 'eeeeeeee-0000-0000-0000-00000000eb02', 'Despesa 1', 12000, 'Pago');
INSERT INTO public.escopos (empresa_id, projeto_id, descricao, tipo, status, custo_estimado)
VALUES ('00000000-0000-0000-0000-00000000eb01', 'eeeeeeee-0000-0000-0000-00000000eb02', 'Aditivo em análise', 'aditivo', 'pendente_aprovacao', 3000);

-- Projeto C: despesa alta, sem NENHUM escopo cadastrado → NÃO deve alertar
INSERT INTO public.projetos (id, empresa_id, nome, status)
VALUES ('eeeeeeee-0000-0000-0000-00000000eb03', '00000000-0000-0000-0000-00000000eb01', 'Projeto Sem Escopo', 'Em andamento');
INSERT INTO public.despesas (empresa_id, projeto_id, descricao, valor, status)
VALUES ('00000000-0000-0000-0000-00000000eb01', 'eeeeeeee-0000-0000-0000-00000000eb03', 'Despesa 1', 50000, 'Pago');

-- Projeto D: dentro do orçado (despesa < escopo) → NÃO deve alertar
INSERT INTO public.projetos (id, empresa_id, nome, status)
VALUES ('eeeeeeee-0000-0000-0000-00000000eb04', '00000000-0000-0000-0000-00000000eb01', 'Projeto Dentro Do Orcado', 'Em andamento');
INSERT INTO public.escopos (empresa_id, projeto_id, descricao, tipo, status, custo_estimado)
VALUES ('00000000-0000-0000-0000-00000000eb01', 'eeeeeeee-0000-0000-0000-00000000eb04', 'Escopo original', 'original', 'aprovado', 10000);
INSERT INTO public.despesas (empresa_id, projeto_id, descricao, valor, status)
VALUES ('00000000-0000-0000-0000-00000000eb01', 'eeeeeeee-0000-0000-0000-00000000eb04', 'Despesa 1', 4000, 'Pago');

SELECT lives_ok(
  $$ SELECT public.gerar_alertas_ambient() $$,
  'gerar_alertas_ambient roda sem erro'
);

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.alertas
   WHERE tipo = 'orcamento_excedido' AND referencia_id = 'eeeeeeee-0000-0000-0000-00000000eb01'),
  1,
  'Projeto A (estourado, sem aditivo aberto) gera exatamente 1 alerta'
);

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.alertas
   WHERE tipo = 'orcamento_excedido' AND referencia_id = 'eeeeeeee-0000-0000-0000-00000000eb02'),
  0,
  'Projeto B (estourado, mas com aditivo em rascunho) não gera alerta'
);

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.alertas
   WHERE tipo = 'orcamento_excedido' AND referencia_id = 'eeeeeeee-0000-0000-0000-00000000eb03'),
  0,
  'Projeto C (sem escopo original) não gera alerta'
);

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.alertas
   WHERE tipo = 'orcamento_excedido' AND referencia_id = 'eeeeeeee-0000-0000-0000-00000000eb04'),
  0,
  'Projeto D (dentro do orçado) não gera alerta'
);

-- Dedupe: rodar de novo não duplica o alerta do Projeto A enquanto ele não for lido.
SELECT public.gerar_alertas_ambient();

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.alertas
   WHERE tipo = 'orcamento_excedido' AND referencia_id = 'eeeeeeee-0000-0000-0000-00000000eb01'),
  1,
  'Rodar de novo não duplica o alerta (dedupe por lido = false)'
);

SELECT * FROM finish();

ROLLBACK;
