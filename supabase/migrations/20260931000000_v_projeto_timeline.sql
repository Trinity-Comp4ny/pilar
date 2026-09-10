-- Spec 093 (PR 2): aba Histórico do projeto. View única com UNION ALL das fontes que
-- já existem (projetos, projeto_disciplinas, projeto_disciplina_pausas, escopos) mais
-- projeto_disciplina_revisoes (PR 1, 20260906000000), projeto_status_historico
-- (migration anterior) e três braços novos lendo ações do cliente pelo Portal
-- (proposta aceita, entrega aprovada, revisão de entrega solicitada). Nenhuma fonte
-- existente é duplicada em tabela de evento: a verdade continua na tabela dona, a
-- view só lê.
--
-- security_invoker = true (doutrina de 20260842000000_fecha_leak_cross_tenant_v_budget_vs_actual.sql):
-- a view herda a RLS já correta de cada tabela base, filtrada por quem consulta. Por
-- isso os braços de evento do portal leem `propostas`/`portal_entregas` (RLS por
-- empresa_id + feature, já usada pelas telas de Propostas/Entregas) e NÃO
-- `admin_audit_logs` (RLS restrita a admin/owner) — ler de admin_audit_logs vazaria
-- menos, não mais, mas esconderia o evento de coordenador/colaborador com acesso
-- normal ao projeto, o que quebraria o requisito de a timeline ser visível pra quem já
-- vê o projeto.

CREATE VIEW public.v_projeto_timeline AS

-- projeto iniciado
SELECT
  p.id AS projeto_id,
  NULL::uuid AS disciplina_id,
  NULL::text AS disciplina_nome,
  'projeto_iniciado'::text AS tipo,
  p.data_inicio::timestamptz AS ocorrido_em,
  NULL::text AS detalhe,
  NULL::text AS autor_nome
FROM public.projetos p
WHERE p.deleted_at IS NULL AND p.data_inicio IS NOT NULL

UNION ALL

-- projeto concluído
SELECT
  p.id, NULL, NULL,
  'projeto_concluido',
  p.data_final::timestamptz,
  NULL, NULL
FROM public.projetos p
WHERE p.deleted_at IS NULL AND p.status = 'Concluído' AND p.data_final IS NOT NULL

UNION ALL

-- mudança de status do projeto
SELECT
  h.projeto_id, NULL, NULL,
  'status_alterado',
  h.mudado_em,
  COALESCE(h.de::text, '(sem status)') || ' → ' || h.para::text,
  ps.nome
FROM public.projeto_status_historico h
LEFT JOIN public.pessoas ps ON ps.id = h.mudado_por

UNION ALL

-- disciplina iniciada
SELECT
  d.projeto_id, d.id, d.nome,
  'disciplina_iniciada',
  d.data_inicio::timestamptz,
  NULL, NULL
FROM public.projeto_disciplinas d
WHERE d.data_inicio IS NOT NULL

UNION ALL

-- disciplina concluída
SELECT
  d.projeto_id, d.id, d.nome,
  'disciplina_concluida',
  d.data_fim_real::timestamptz,
  NULL, NULL
FROM public.projeto_disciplinas d
WHERE d.status = 'Concluído' AND d.data_fim_real IS NOT NULL

UNION ALL

-- pausa iniciada
SELECT
  d.projeto_id, d.id, d.nome,
  'pausa_iniciada',
  pa.pausado_em,
  pa.motivo,
  ps.nome
FROM public.projeto_disciplina_pausas pa
JOIN public.projeto_disciplinas d ON d.id = pa.projeto_disciplina_id
LEFT JOIN public.pessoas ps ON ps.id = pa.pausado_por

UNION ALL

-- pausa retomada
SELECT
  d.projeto_id, d.id, d.nome,
  'pausa_retomada',
  pa.retomado_em,
  NULL,
  ps.nome
FROM public.projeto_disciplina_pausas pa
JOIN public.projeto_disciplinas d ON d.id = pa.projeto_disciplina_id
LEFT JOIN public.pessoas ps ON ps.id = pa.retomado_por
WHERE pa.retomado_em IS NOT NULL

UNION ALL

-- revisão registrada
SELECT
  d.projeto_id, d.id, d.nome,
  'revisao_registrada',
  r.solicitada_em::timestamptz,
  r.motivo,
  ps.nome
FROM public.projeto_disciplina_revisoes r
JOIN public.projeto_disciplinas d ON d.id = r.projeto_disciplina_id
LEFT JOIN public.pessoas ps ON ps.id = r.registrada_por

UNION ALL

-- revisão concluída
SELECT
  d.projeto_id, d.id, d.nome,
  'revisao_concluida',
  r.concluida_em::timestamptz,
  r.motivo,
  ps.nome
FROM public.projeto_disciplina_revisoes r
JOIN public.projeto_disciplinas d ON d.id = r.projeto_disciplina_id
LEFT JOIN public.pessoas ps ON ps.id = r.concluida_por
WHERE r.concluida_em IS NOT NULL

UNION ALL

-- escopo/aditivo aprovado
SELECT
  e.projeto_id, NULL, NULL,
  'escopo_alterado',
  e.aprovado_em,
  e.descricao,
  ps.nome
FROM public.escopos e
LEFT JOIN public.pessoas ps ON ps.id = e.aprovado_por
WHERE e.deleted_at IS NULL AND e.tipo = 'aditivo' AND e.status = 'aprovado' AND e.aprovado_em IS NOT NULL

UNION ALL

-- portal: proposta aceita pelo cliente
SELECT
  pr.projeto_id, NULL, NULL,
  'portal_proposta_aprovada',
  pr.updated_at,
  pr.titulo,
  c.nome
FROM public.propostas pr
LEFT JOIN public.clientes c ON c.id = pr.cliente_id
WHERE pr.deleted_at IS NULL AND pr.status = 'aceita' AND pr.projeto_id IS NOT NULL

UNION ALL

-- portal: entrega aprovada pelo cliente
SELECT
  e.projeto_id, e.projeto_disciplina_id, d.nome,
  'portal_entrega_aprovada',
  e.respondido_em,
  e.titulo,
  c.nome
FROM public.portal_entregas e
LEFT JOIN public.projeto_disciplinas d ON d.id = e.projeto_disciplina_id
LEFT JOIN public.projetos p ON p.id = e.projeto_id
LEFT JOIN public.clientes c ON c.id = p.cliente_id
WHERE e.status = 'aprovado' AND e.respondido_em IS NOT NULL

UNION ALL

-- portal: revisão de entrega solicitada pelo cliente (texto livre do cliente vira o detalhe)
SELECT
  e.projeto_id, e.projeto_disciplina_id, d.nome,
  'portal_entrega_revisao_solicitada',
  e.respondido_em,
  e.resposta_cliente,
  c.nome
FROM public.portal_entregas e
LEFT JOIN public.projeto_disciplinas d ON d.id = e.projeto_disciplina_id
LEFT JOIN public.projetos p ON p.id = e.projeto_id
LEFT JOIN public.clientes c ON c.id = p.cliente_id
WHERE e.status = 'revisao_solicitada' AND e.respondido_em IS NOT NULL;

ALTER VIEW public.v_projeto_timeline SET (security_invoker = true);

GRANT SELECT ON public.v_projeto_timeline TO authenticated;
