-- SPEC 058 (follow-up): `disciplinas` era catálogo GLOBAL, compartilhado por
-- todas as empresas. Uma disciplina cadastrada por um cliente aparecia para os
-- outros, e qualquer membro com o módulo Projetos escrevia nesse catálogo comum.
--
-- Achado ao investigar o 403 do design partner: o teste pgTAP
-- `policy_projetos_module` já registrava a dúvida "catálogo curado ou
-- colaborativo?" sem responder. É colaborativo, só que sem isolamento.
--
-- Modelo escolhido: `empresa_id NULL` = semente padrão do produto (as 14
-- disciplinas de engenharia que toda empresa vê, criadas em 14/07); com
-- `empresa_id` preenchido = disciplina daquela empresa, invisível para as
-- outras. Preserva o que existe, sem duplicar dado por empresa, e fecha o
-- vazamento para tudo que for criado daqui pra frente.
--
-- `projeto_disciplinas` guarda o NOME (texto), não FK para `disciplinas`: o
-- catálogo é picklist, então não há referência a corrigir.

-- =============================================
-- 1. Coluna, com default que fecha a porta
-- =============================================
-- O DEFAULT não é conveniência: `ManageDisciplinasDialog` faz
-- `.insert({ nome })` sem empresa_id, e sem o default a linha nasceria com
-- empresa_id nulo, ou seja, entraria na semente global de novo. Com o default
-- + a policy de INSERT abaixo, nenhum caminho de cliente consegue escrever no
-- catálogo global (só service_role e ultra_admin, que ignoram o default).

ALTER TABLE public.disciplinas
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE
  DEFAULT public.get_user_empresa_id();

COMMENT ON COLUMN public.disciplinas.empresa_id IS
  'NULL = semente padrão do produto (visível a todas as empresas). Preenchido = disciplina própria da empresa. Ver SPEC 058.';

CREATE INDEX IF NOT EXISTS disciplinas_empresa_id_idx
  ON public.disciplinas(empresa_id);

-- Sem duplicata de nome dentro do mesmo escopo. NULLS NOT DISTINCT para a
-- semente global também ser única (PG15+; staging e produção são PG17).
DROP INDEX IF EXISTS public.disciplinas_escopo_nome_uniq;
CREATE UNIQUE INDEX disciplinas_escopo_nome_uniq
  ON public.disciplinas (empresa_id, lower(nome)) NULLS NOT DISTINCT;

-- =============================================
-- 2. Policies com escopo de empresa
-- =============================================
-- Antes: SELECT/INSERT só checavam user_has_feature('projetos', ...), sem
-- nenhuma condição de tenancy, porque a tabela não tinha empresa_id.

DROP POLICY IF EXISTS disciplinas_select ON public.disciplinas;
CREATE POLICY disciplinas_select ON public.disciplinas
  FOR SELECT
  TO authenticated
  USING (
    (empresa_id IS NULL OR empresa_id = public.get_user_empresa_id())
    AND public.user_has_feature('projetos', 'viewer')
  );

DROP POLICY IF EXISTS disciplinas_insert ON public.disciplinas;
CREATE POLICY disciplinas_insert ON public.disciplinas
  FOR INSERT
  TO authenticated
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('projetos', 'editor')
  );

-- UPDATE e DELETE só na própria: a semente global (empresa_id NULL) fica fora
-- do alcance do cliente, senão um cliente apagaria a disciplina dos outros.
-- Antes desta migration não existia policy de UPDATE/DELETE para o cliente,
-- só o ALL do ultra_admin, mas o front já chamava `.delete()` (que voltava 0
-- linhas silenciosamente).
DROP POLICY IF EXISTS disciplinas_update_own ON public.disciplinas;
CREATE POLICY disciplinas_update_own ON public.disciplinas
  FOR UPDATE
  TO authenticated
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('projetos', 'editor')
  )
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('projetos', 'editor')
  );

DROP POLICY IF EXISTS disciplinas_delete_own ON public.disciplinas;
CREATE POLICY disciplinas_delete_own ON public.disciplinas
  FOR DELETE
  TO authenticated
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('projetos', 'editor')
  );

-- disciplinas_manage (ALL, ultra_admin) continua como está: é quem cura a
-- semente global do produto.

-- =============================================
-- 3. search_path fixo no catálogo de features
-- =============================================
-- Achado do Security Advisor. As duas são puras (não leem tabela), então o
-- risco concreto é baixo, mas função sem search_path fixo é a classe de bug
-- que a migration 20260849000000 já veio fechar; estas duas ficaram de fora.

CREATE OR REPLACE FUNCTION public._feature_catalog()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $function$
  SELECT ARRAY[
    'dashboard',
    'relatorios',
    'leads',
    'propostas',
    'clientes',
    'projetos',
    'planejamento',
    'timesheet',
    'mapa',
    'financeiro',
    'pessoas',
    'metas',
    'portal_cliente',
    'ai_hub',
    'capacidade',
    'templates',
    'ai_chat',
    'obras',
    'obras_fornecedores',
    'obras_clima',
    'obras_diario',
    'obras_cronograma',
    'obras_cotacoes',
    'obras_estoque',
    'obras_conta'
  ];
$function$;

CREATE OR REPLACE FUNCTION public._universal_features()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $function$
  SELECT ARRAY[
    'relatorios',
    'leads',
    'propostas',
    'clientes',
    'projetos',
    'mapa',
    'financeiro',
    'pessoas',
    'metas',
    'portal_cliente',
    'ai_chat',
    'obras',
    'obras_fornecedores',
    'obras_clima',
    'obras_diario',
    'obras_cronograma',
    'obras_cotacoes',
    'obras_estoque',
    'obras_conta'
  ];
$function$;

-- =============================================
-- 4. pessoas_safe: SECURITY DEFINER é intencional
-- =============================================
-- O Security Advisor marca `public.pessoas_safe` como ERROR
-- (security_definer_view). Aqui é por desenho, e trocar para
-- security_invoker seria PIOR: `authenticated` não tem SELECT em
-- `public.pessoas` justamente para forçar a leitura pela view, que mascara
-- CPF, salário, contas bancárias e chaves Pix conforme `can_view_folha()`.
-- Com security_invoker a view perderia acesso à tabela base, e liberar o
-- SELECT direto em `pessoas` para consertar isso expor o dado sensível cru.
-- A view faz o próprio escopo de tenancy no WHERE
-- (`empresa_id = get_user_empresa_id() AND user_has_feature('pessoas','viewer')`),
-- diferente do caso do `v_budget_vs_actual` (migration 20260842000000), que
-- era SECURITY DEFINER sem filtro nenhum e vazava entre empresas.
COMMENT ON VIEW public.pessoas_safe IS
  'SECURITY DEFINER intencional (ver SPEC 058): authenticated não tem SELECT em pessoas, a leitura passa por aqui para mascarar CPF/salário/contas/Pix via can_view_folha(). O escopo de empresa está no WHERE da própria view.';
