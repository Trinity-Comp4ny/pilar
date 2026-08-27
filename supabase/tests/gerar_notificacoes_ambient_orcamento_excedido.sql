-- pgTAP: notificação `orcamento_excedido` em gerar_notificacoes_ambient()
-- (migration 20260865000000, spec 067 — correção). gerar_alertas_ambient()
-- foi aposentada em 20260817000100; esta é a função que de fato roda via
-- pg_cron em produção e alimenta o sino de notificações por usuário.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(6);

INSERT INTO public.empresas (id, nome, owner_id, onboarding_completed, features)
VALUES ('00000000-0000-0000-0000-00000000ec01', 'Empresa Guardiao Escopo Notif', NULL, TRUE, '{"projetos": true, "financeiro": true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features;

SET LOCAL session_replication_role = 'replica';

INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES ('77777777-0000-0000-0000-0000000ec001', 'gestor-guardiao@test.com', '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

SET LOCAL session_replication_role = 'origin';

-- Gestão da empresa (owner) — é quem _notif_gestao() resolve como destinatário.
INSERT INTO public.profiles (id, empresa_id, first_name, last_name, email, role, onboarding_completed)
VALUES ('77777777-0000-0000-0000-0000000ec001', '00000000-0000-0000-0000-00000000ec01', 'Gestor', 'Guardiao', 'gestor-guardiao@test.com', 'owner', TRUE)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

-- Projeto A: escopo original R$10k, despesa R$12k, sem aditivo aberto → deve notificar
INSERT INTO public.projetos (id, empresa_id, nome, status)
VALUES ('eeeeeeee-0000-0000-0000-00000000ec01', '00000000-0000-0000-0000-00000000ec01', 'Projeto Estourado', 'Em andamento');
INSERT INTO public.escopos (empresa_id, projeto_id, descricao, tipo, status, custo_estimado)
VALUES ('00000000-0000-0000-0000-00000000ec01', 'eeeeeeee-0000-0000-0000-00000000ec01', 'Escopo original', 'original', 'aprovado', 10000);
INSERT INTO public.despesas (empresa_id, projeto_id, descricao, valor, status)
VALUES ('00000000-0000-0000-0000-00000000ec01', 'eeeeeeee-0000-0000-0000-00000000ec01', 'Despesa 1', 12000, 'Pago');

-- Projeto B: mesmo estouro, mas com aditivo em rascunho → NÃO deve notificar
INSERT INTO public.projetos (id, empresa_id, nome, status)
VALUES ('eeeeeeee-0000-0000-0000-00000000ec02', '00000000-0000-0000-0000-00000000ec01', 'Projeto Com Aditivo Aberto', 'Em andamento');
INSERT INTO public.escopos (empresa_id, projeto_id, descricao, tipo, status, custo_estimado)
VALUES ('00000000-0000-0000-0000-00000000ec01', 'eeeeeeee-0000-0000-0000-00000000ec02', 'Escopo original', 'original', 'aprovado', 10000);
INSERT INTO public.despesas (empresa_id, projeto_id, descricao, valor, status)
VALUES ('00000000-0000-0000-0000-00000000ec01', 'eeeeeeee-0000-0000-0000-00000000ec02', 'Despesa 1', 12000, 'Pago');
INSERT INTO public.escopos (empresa_id, projeto_id, descricao, tipo, status, custo_estimado)
VALUES ('00000000-0000-0000-0000-00000000ec01', 'eeeeeeee-0000-0000-0000-00000000ec02', 'Aditivo em análise', 'aditivo', 'pendente_aprovacao', 3000);

-- Projeto C: despesa alta, sem NENHUM escopo cadastrado → NÃO deve notificar
INSERT INTO public.projetos (id, empresa_id, nome, status)
VALUES ('eeeeeeee-0000-0000-0000-00000000ec03', '00000000-0000-0000-0000-00000000ec01', 'Projeto Sem Escopo', 'Em andamento');
INSERT INTO public.despesas (empresa_id, projeto_id, descricao, valor, status)
VALUES ('00000000-0000-0000-0000-00000000ec01', 'eeeeeeee-0000-0000-0000-00000000ec03', 'Despesa 1', 50000, 'Pago');

-- Projeto D: dentro do orçado (despesa < escopo) → NÃO deve notificar
INSERT INTO public.projetos (id, empresa_id, nome, status)
VALUES ('eeeeeeee-0000-0000-0000-00000000ec04', '00000000-0000-0000-0000-00000000ec01', 'Projeto Dentro Do Orcado', 'Em andamento');
INSERT INTO public.escopos (empresa_id, projeto_id, descricao, tipo, status, custo_estimado)
VALUES ('00000000-0000-0000-0000-00000000ec01', 'eeeeeeee-0000-0000-0000-00000000ec04', 'Escopo original', 'original', 'aprovado', 10000);
INSERT INTO public.despesas (empresa_id, projeto_id, descricao, valor, status)
VALUES ('00000000-0000-0000-0000-00000000ec01', 'eeeeeeee-0000-0000-0000-00000000ec04', 'Despesa 1', 4000, 'Pago');

SELECT lives_ok(
  $$ SELECT public.gerar_notificacoes_ambient() $$,
  'gerar_notificacoes_ambient roda sem erro'
);

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.notificacoes
   WHERE tipo = 'orcamento_excedido' AND referencia_id = 'eeeeeeee-0000-0000-0000-00000000ec01'
     AND destinatario_id = '77777777-0000-0000-0000-0000000ec001'),
  1,
  'Projeto A (estourado, sem aditivo aberto) notifica a gestão'
);

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.notificacoes
   WHERE tipo = 'orcamento_excedido' AND referencia_id = 'eeeeeeee-0000-0000-0000-00000000ec02'),
  0,
  'Projeto B (estourado, mas com aditivo em rascunho) não notifica'
);

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.notificacoes
   WHERE tipo = 'orcamento_excedido' AND referencia_id = 'eeeeeeee-0000-0000-0000-00000000ec03'),
  0,
  'Projeto C (sem escopo original) não notifica'
);

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.notificacoes
   WHERE tipo = 'orcamento_excedido' AND referencia_id = 'eeeeeeee-0000-0000-0000-00000000ec04'),
  0,
  'Projeto D (dentro do orçado) não notifica'
);

-- Dedupe (feito por notificar(): não empilha não-lida pro mesmo destinatário+tipo+referência).
SELECT public.gerar_notificacoes_ambient();

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.notificacoes
   WHERE tipo = 'orcamento_excedido' AND referencia_id = 'eeeeeeee-0000-0000-0000-00000000ec01'),
  1,
  'Rodar de novo não duplica a notificação (dedupe do notificar())'
);

SELECT * FROM finish();

ROLLBACK;
