-- SPEC 073 / ADR 0034: fase 3. projetos_safe mascara valor_contrato e
-- custo_indireto_pct (margem) pra quem não tem can_view_financeiro(), sem
-- esconder o resto do projeto. Mesmo padrão de pessoas_safe
-- (20260715000050): security_barrier, roda com privilégio do dono, replica
-- o predicado de RLS da tabela base no WHERE.
--
-- ATENÇÃO: esta migration NÃO revoga SELECT de projetos na tabela base. O
-- revoke por coluna é o ÚLTIMO passo (migration separada), só depois de
-- todo o front migrar a leitura de valor/margem para esta view — revoke
-- antes disso quebra qualquer select('*') existente, inclusive para admin
-- (privilégio de coluna não olha papel da aplicação). Ver SPEC 073, "Plano
-- de implementação".

DROP VIEW IF EXISTS public.projetos_safe;

CREATE VIEW public.projetos_safe WITH (security_barrier = true) AS
SELECT
  p.id,
  p.empresa_id,
  p.cliente_id,
  p.codigo_projeto,
  p.nome,
  p.localizacao,
  p.latitude,
  p.longitude,
  p.status,
  p.status_data,
  p.data_inicio,
  p.data_previsao,
  p.data_final,
  p.observacao,
  p.parcelas,
  p.area_m2,
  p.prioridade,
  p.etapa_id,
  p.disciplinas,
  p.comentarios,
  p.links,
  p.deleted_at,
  p.created_at,
  p.created_by,
  p.updated_at,
  p.updated_by,
  -- Flag para o cliente saber (sem round-trip extra) se recebeu os valores reais.
  public.can_view_financeiro() AS pode_ver_valor,
  CASE WHEN public.can_view_financeiro() THEN p.valor_contrato END AS valor_contrato,
  CASE WHEN public.can_view_financeiro() THEN p.custo_indireto_pct END AS custo_indireto_pct
FROM public.projetos p
-- View roda com privilégio do dono (bypassa a RLS da base): replica o
-- predicado da policy projetos_select (20260507300000) para manter o
-- multi-tenant, o soft-delete e o gate de módulo.
WHERE p.empresa_id = public.get_user_empresa_id()
  AND p.deleted_at IS NULL
  AND public.user_has_feature('projetos', 'viewer');

GRANT SELECT ON public.projetos_safe TO authenticated;

COMMENT ON VIEW public.projetos_safe IS
  'Leitura segura de projetos: valor_contrato e custo_indireto_pct só com can_view_financeiro(); senão NULL. Multi-tenant + soft-delete + feature viewer replicados no WHERE. Escritas continuam em public.projetos.';
