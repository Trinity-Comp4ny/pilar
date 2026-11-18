-- Histórico do projeto: acrescenta pausa/retomada do projeto e liberação de acesso ao
-- portal à view v_projeto_timeline (spec 093). Mesmas colunas, só mais braços.

CREATE OR REPLACE VIEW public.v_projeto_timeline AS

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
WHERE e.status = 'revisao_solicitada' AND e.respondido_em IS NOT NULL

UNION ALL

-- projeto pausado (pausa do projeto inteiro, não da disciplina)
SELECT
  pp.projeto_id, NULL, NULL,
  'projeto_pausado',
  pp.pausado_em,
  pp.motivo,
  ps.nome
FROM public.projeto_pausas pp
LEFT JOIN public.pessoas ps ON ps.id = pp.pausado_por

UNION ALL

-- projeto retomado
SELECT
  pp.projeto_id, NULL, NULL,
  'projeto_retomado',
  pp.retomado_em,
  NULL,
  ps.nome
FROM public.projeto_pausas pp
LEFT JOIN public.pessoas ps ON ps.id = pp.retomado_por
WHERE pp.retomado_em IS NOT NULL

UNION ALL

-- portal: acesso do cliente liberado (a conta é do cliente, vale para os projetos dele)
SELECT
  p.id, NULL, NULL,
  'portal_acesso_concedido',
  pa.created_at::timestamptz,
  pa.email,
  c.nome
FROM public.cliente_portal_accounts pa
JOIN public.projetos p ON p.cliente_id = pa.cliente_id AND p.deleted_at IS NULL
LEFT JOIN public.clientes c ON c.id = pa.cliente_id
WHERE pa.created_at IS NOT NULL;

ALTER VIEW public.v_projeto_timeline SET (security_invoker = true);

GRANT SELECT ON public.v_projeto_timeline TO authenticated;
