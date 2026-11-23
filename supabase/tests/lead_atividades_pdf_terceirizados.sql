-- Isolamento, autoria, imutabilidade das revisões e dependência externa.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;
SELECT plan(20);

INSERT INTO public.empresas(id,nome,features,onboarding_completed) VALUES
('a1700000-0000-0000-0000-000000000001','Comercial A','{"leads":true,"propostas":true,"projetos":true}',true),
('a1700000-0000-0000-0000-000000000002','Comercial B','{"leads":true,"propostas":true,"projetos":true}',true);
SET LOCAL session_replication_role = replica;
INSERT INTO auth.users(id,email,aud,role) VALUES
('b1700000-0000-0000-0000-000000000001','comercial-a@test.local','authenticated','authenticated'),
('b1700000-0000-0000-0000-000000000002','comercial-b@test.local','authenticated','authenticated');
SET LOCAL session_replication_role = origin;
INSERT INTO public.profiles(id,empresa_id,first_name,last_name,email,role,onboarding_completed) VALUES
('b1700000-0000-0000-0000-000000000001','a1700000-0000-0000-0000-000000000001','Ana','Lima','comercial-a@test.local','admin',true),
('b1700000-0000-0000-0000-000000000002','a1700000-0000-0000-0000-000000000002','Bia','Souza','comercial-b@test.local','admin',true);
INSERT INTO public.leads(id,empresa_id,nome,status) VALUES
('c1700000-0000-0000-0000-000000000001','a1700000-0000-0000-0000-000000000001','Lead A','Novo'),
('c1700000-0000-0000-0000-000000000002','a1700000-0000-0000-0000-000000000002','Lead B','Novo');
INSERT INTO public.propostas(id,empresa_id,lead_id,titulo,status) VALUES
('d1700000-0000-0000-0000-000000000001','a1700000-0000-0000-0000-000000000001','c1700000-0000-0000-0000-000000000001','PDF pronto','rascunho');
INSERT INTO storage.objects(bucket_id,name) VALUES
('proposta-pdfs','a1700000-0000-0000-0000-000000000001/d1700000-0000-0000-0000-000000000001/e1700000-0000-0000-0000-000000000001.pdf');
SELECT set_config('request.jwt.claims','{"sub":"b1700000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}',true);
SET LOCAL ROLE authenticated;
SELECT lives_ok($$ INSERT INTO public.lead_atividades(empresa_id,lead_id,texto,autor_nome) VALUES
('a1700000-0000-0000-0000-000000000001','c1700000-0000-0000-0000-000000000001','Reunião marcada','Nome falso'),
('a1700000-0000-0000-0000-000000000001','c1700000-0000-0000-0000-000000000001','Contato realizado','Nome falso') $$,'duas atividades são registros independentes');
SELECT is((SELECT count(*)::int FROM public.lead_atividades WHERE lead_id='c1700000-0000-0000-0000-000000000001'),2,'histórico preservado');
SELECT is((SELECT autor_nome FROM public.lead_atividades LIMIT 1),'Ana Lima','autor vem do servidor');
SELECT throws_ok($$ INSERT INTO public.lead_atividades(empresa_id,lead_id,texto) VALUES
('a1700000-0000-0000-0000-000000000001','c1700000-0000-0000-0000-000000000002','Outra empresa') $$,'42501','Lead não encontrado','recusa vínculo de outra empresa');
SELECT lives_ok($$ INSERT INTO public.proposta_versoes(id,empresa_id,proposta_id,arquivo_path,nome_arquivo,tamanho,valor_proposto) VALUES
('e1700000-0000-0000-0000-000000000001','a1700000-0000-0000-0000-000000000001','d1700000-0000-0000-0000-000000000001','a1700000-0000-0000-0000-000000000001/d1700000-0000-0000-0000-000000000001/e1700000-0000-0000-0000-000000000001.pdf','proposta.pdf',100,1500) $$,'registra PDF de lead sem projeto');
SELECT is((SELECT numero FROM public.proposta_versoes LIMIT 1),1,'numeração definida no servidor');
SELECT ok((SELECT enviado_em IS NULL FROM public.proposta_versoes LIMIT 1),'importar não envia');
SELECT is((SELECT status FROM public.propostas WHERE id='d1700000-0000-0000-0000-000000000001'),'rascunho','importar mantém rascunho');
-- Revogação do endereço preserva o PDF publicado e o registro de versão.
RESET ROLE;
UPDATE public.proposta_versoes SET link_token = 'e1700000-0000-0000-0000-000000000002'
WHERE id = 'e1700000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;
SELECT ok(public.revogar_link_proposta('e1700000-0000-0000-0000-000000000001'), 'admin revoga link da própria proposta');
SELECT is(public.revogar_link_proposta('e1700000-0000-0000-0000-000000000001'), false, 'segunda revogação é idempotente');
RESET ROLE;
SELECT is(public.acessar_link_proposta('e1700000-0000-0000-0000-000000000002', 'abrir'), NULL::jsonb,
  'token revogado deixa de resolver a versão pública');
SET LOCAL ROLE authenticated;
-- O Storage API mantém um trigger que proíbe DELETE SQL direto, mesmo sem linhas.
-- Este trecho testa somente a RLS; a proteção de transporte fica fora do teste SQL.
RESET ROLE;
SET LOCAL session_replication_role = replica;
SET LOCAL ROLE authenticated;
WITH apagados AS (DELETE FROM storage.objects WHERE bucket_id='proposta-pdfs' RETURNING id)
SELECT is((SELECT count(*)::int FROM apagados),0,'PDF de revisão gravada não pode ser removido pelo navegador');
RESET ROLE;
SET LOCAL session_replication_role = origin;
SELECT set_config('request.jwt.claims','{"sub":"b1700000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}',true);
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.lead_atividades WHERE lead_id='c1700000-0000-0000-0000-000000000001'),0,'outra empresa não lê atividades');
SELECT is((SELECT count(*)::int FROM public.proposta_versoes WHERE proposta_id='d1700000-0000-0000-0000-000000000001'),0,'outra empresa não lê revisões');
SELECT throws_ok($$ SELECT public.revogar_link_proposta('e1700000-0000-0000-0000-000000000001') $$,
  '22023', 'Versão indisponível', 'outra empresa não consegue revogar o link');
SELECT ok(NOT public.pode_acessar_proposta_pdf('a1700000-0000-0000-0000-000000000001/d1700000-0000-0000-0000-000000000001/e1700000-0000-0000-0000-000000000001.pdf'),'outra empresa não baixa PDF');
RESET ROLE;
SELECT set_config('request.jwt.claims','{}',true);
INSERT INTO public.projetos(id,empresa_id,nome,status) VALUES
('f1700000-0000-0000-0000-000000000001','a1700000-0000-0000-0000-000000000001','Fluxo de teste','Planejamento');
SELECT lives_ok($$ INSERT INTO public.projeto_disciplinas(id,projeto_id,nome,status,ordem_etapa,tipo_execucao,prestador_nome) VALUES
('f1700000-0000-0000-0000-000000000002','f1700000-0000-0000-0000-000000000001','Medição','Não Iniciado',1,'terceirizada','Empresa parceira'),
('f1700000-0000-0000-0000-000000000003','f1700000-0000-0000-0000-000000000001','Pedido','Não Iniciado',2,'interna',NULL) $$,'terceirizada não exige usuário interno');
SELECT throws_ok($$ UPDATE public.projeto_disciplinas SET status='Em Andamento' WHERE id='f1700000-0000-0000-0000-000000000003' $$,'23514','Conclua o serviço terceirizado anterior antes de avançar esta disciplina','impede avançar antes do serviço externo');
SELECT lives_ok($$ UPDATE public.projeto_disciplinas SET status='Concluído',data_fim_real=current_date WHERE id='f1700000-0000-0000-0000-000000000002'; UPDATE public.projeto_disciplinas SET status='Em Andamento' WHERE id='f1700000-0000-0000-0000-000000000003' $$,'concluir libera próxima coluna');
SELECT is((SELECT count(*)::int FROM public.projeto_disciplina_responsaveis WHERE projeto_disciplina_id='f1700000-0000-0000-0000-000000000002'),0,'prestador não cria pessoa fictícia');
SELECT * FROM finish();
ROLLBACK;
