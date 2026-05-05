-- Lote: módulo projetos.
-- Tabelas: projetos, escopos, escopo_itens, disciplinas, fluxos_disciplinas,
--          proposta_disciplinas, aprovacoes, orcamento_versoes, projeto_orcamento_fases.
-- Convenção: SELECT → user_has_feature('projetos','viewer'); WRITE → 'editor'.

-- =============================================
-- PROJETOS
-- =============================================
DROP POLICY IF EXISTS "Projetos Read" ON public.projetos;
DROP POLICY IF EXISTS "Projetos Full" ON public.projetos;

DROP POLICY IF EXISTS "projetos_select" ON public.projetos;
CREATE POLICY "projetos_select" ON public.projetos
  FOR SELECT
  USING (
    empresa_id = public.get_user_empresa_id()
    AND deleted_at IS NULL
    AND public.user_has_feature('projetos', 'viewer')
  );

DROP POLICY IF EXISTS "projetos_write" ON public.projetos;
CREATE POLICY "projetos_write" ON public.projetos
  FOR ALL
  USING (
    empresa_id = public.get_user_empresa_id()
    AND deleted_at IS NULL
    AND public.user_has_feature('projetos', 'editor')
  )
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('projetos', 'editor')
  );

-- =============================================
-- ESCOPOS
-- =============================================
DROP POLICY IF EXISTS "Escopos Read Fin" ON public.escopos;
DROP POLICY IF EXISTS "Escopos Full Admin/Op" ON public.escopos;

DROP POLICY IF EXISTS "escopos_select" ON public.escopos;
CREATE POLICY "escopos_select" ON public.escopos
  FOR SELECT
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('projetos', 'viewer')
  );

DROP POLICY IF EXISTS "escopos_write" ON public.escopos;
CREATE POLICY "escopos_write" ON public.escopos
  FOR ALL
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('projetos', 'editor')
  )
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('projetos', 'editor')
  );

-- =============================================
-- ESCOPO_ITENS — herda gate via projeto pai (FK), check direto também.
-- =============================================
DROP POLICY IF EXISTS "EscopoItens Read" ON public.escopo_itens;
DROP POLICY IF EXISTS "EscopoItens Full" ON public.escopo_itens;

DROP POLICY IF EXISTS "escopo_itens_select" ON public.escopo_itens;
CREATE POLICY "escopo_itens_select" ON public.escopo_itens
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.escopos e
      WHERE e.id = escopo_itens.escopo_id
        AND e.empresa_id = public.get_user_empresa_id()
    )
    AND public.user_has_feature('projetos', 'viewer')
  );

DROP POLICY IF EXISTS "escopo_itens_write" ON public.escopo_itens;
CREATE POLICY "escopo_itens_write" ON public.escopo_itens
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.escopos e
      WHERE e.id = escopo_itens.escopo_id
        AND e.empresa_id = public.get_user_empresa_id()
    )
    AND public.user_has_feature('projetos', 'editor')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.escopos e
      WHERE e.id = escopo_itens.escopo_id
        AND e.empresa_id = public.get_user_empresa_id()
    )
    AND public.user_has_feature('projetos', 'editor')
  );

-- =============================================
-- DISCIPLINAS — catálogo global da plataforma (sem empresa_id).
-- Leitura livre para quem tem feature 'projetos'; escrita só ultra_admin.
-- =============================================
DROP POLICY IF EXISTS "Enable read access for all users" ON public.disciplinas;
DROP POLICY IF EXISTS "Enable write access for admin users" ON public.disciplinas;
DROP POLICY IF EXISTS "Enable update access for admin users" ON public.disciplinas;
DROP POLICY IF EXISTS "Enable delete access for admin users" ON public.disciplinas;

DROP POLICY IF EXISTS "disciplinas_select" ON public.disciplinas;
CREATE POLICY "disciplinas_select" ON public.disciplinas
  FOR SELECT
  USING ( public.user_has_feature('projetos', 'viewer') );

DROP POLICY IF EXISTS "disciplinas_write" ON public.disciplinas;
CREATE POLICY "disciplinas_write" ON public.disciplinas
  FOR ALL
  USING ( public.current_effective_role() = 'ultra_admin' )
  WITH CHECK ( public.current_effective_role() = 'ultra_admin' );

-- =============================================
-- FLUXOS_DISCIPLINAS
-- =============================================
DROP POLICY IF EXISTS "Fluxos Read All" ON public.fluxos_disciplinas;
DROP POLICY IF EXISTS "Fluxos Full Admin/Op" ON public.fluxos_disciplinas;

DROP POLICY IF EXISTS "fluxos_disciplinas_select" ON public.fluxos_disciplinas;
CREATE POLICY "fluxos_disciplinas_select" ON public.fluxos_disciplinas
  FOR SELECT
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('projetos', 'viewer')
  );

DROP POLICY IF EXISTS "fluxos_disciplinas_write" ON public.fluxos_disciplinas;
CREATE POLICY "fluxos_disciplinas_write" ON public.fluxos_disciplinas
  FOR ALL
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('projetos', 'editor')
  )
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('projetos', 'editor')
  );

-- =============================================
-- PROPOSTA_DISCIPLINAS — vinculado a propostas, mas é template de disciplinas
-- (mantido sob feature 'projetos' que cobre disciplinas).
-- =============================================
DROP POLICY IF EXISTS "PropostaDisc Read" ON public.proposta_disciplinas;
DROP POLICY IF EXISTS "PropostaDisc Full" ON public.proposta_disciplinas;

DROP POLICY IF EXISTS "proposta_disciplinas_select" ON public.proposta_disciplinas;
CREATE POLICY "proposta_disciplinas_select" ON public.proposta_disciplinas
  FOR SELECT
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('projetos', 'viewer')
  );

DROP POLICY IF EXISTS "proposta_disciplinas_write" ON public.proposta_disciplinas;
CREATE POLICY "proposta_disciplinas_write" ON public.proposta_disciplinas
  FOR ALL
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('projetos', 'editor')
  )
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('projetos', 'editor')
  );

-- =============================================
-- APROVACOES — fluxo de aprovação de marcos/escopos. Editor de projetos pode aprovar.
-- =============================================
DROP POLICY IF EXISTS "Aprovacoes read all" ON public.aprovacoes;
DROP POLICY IF EXISTS "Aprovacoes write admin" ON public.aprovacoes;

DROP POLICY IF EXISTS "aprovacoes_select" ON public.aprovacoes;
CREATE POLICY "aprovacoes_select" ON public.aprovacoes
  FOR SELECT
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('projetos', 'viewer')
  );

DROP POLICY IF EXISTS "aprovacoes_write" ON public.aprovacoes;
CREATE POLICY "aprovacoes_write" ON public.aprovacoes
  FOR ALL
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('projetos', 'editor')
  )
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('projetos', 'editor')
  );

-- =============================================
-- ORCAMENTO_VERSOES
-- =============================================
DROP POLICY IF EXISTS "Versoes read all" ON public.orcamento_versoes;
DROP POLICY IF EXISTS "Versoes write admin/op" ON public.orcamento_versoes;

DROP POLICY IF EXISTS "orcamento_versoes_select" ON public.orcamento_versoes;
CREATE POLICY "orcamento_versoes_select" ON public.orcamento_versoes
  FOR SELECT
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('projetos', 'viewer')
  );

DROP POLICY IF EXISTS "orcamento_versoes_write" ON public.orcamento_versoes;
CREATE POLICY "orcamento_versoes_write" ON public.orcamento_versoes
  FOR ALL
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('projetos', 'editor')
  )
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('projetos', 'editor')
  );

-- =============================================
-- PROJETO_ORCAMENTO_FASES — orçamento por fase do projeto.
-- =============================================
DROP POLICY IF EXISTS "Orcamento Read Financeiro" ON public.projeto_orcamento_fases;
DROP POLICY IF EXISTS "Orcamento Full Admin/Op" ON public.projeto_orcamento_fases;

DROP POLICY IF EXISTS "projeto_orcamento_fases_select" ON public.projeto_orcamento_fases;
CREATE POLICY "projeto_orcamento_fases_select" ON public.projeto_orcamento_fases
  FOR SELECT
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('projetos', 'viewer')
  );

DROP POLICY IF EXISTS "projeto_orcamento_fases_write" ON public.projeto_orcamento_fases;
CREATE POLICY "projeto_orcamento_fases_write" ON public.projeto_orcamento_fases
  FOR ALL
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('projetos', 'editor')
  )
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('projetos', 'editor')
  );
