-- Gestão · Tarefas pessoais (ajuste da spec 008-gestao-meu-trabalho)
-- Tarefa avulsa é item PESSOAL: todo membro da empresa cria e gerencia as suas,
-- sem depender do nível 'editor' da feature. O usuário comum enxerga apenas as
-- próprias tarefas (as que criou ou é responsável); admin da empresa (e ultra
-- admin) enxerga e administra as de todo mundo.

-- ---------------------------------------------------------------------------
-- 1. Helper: pessoa vinculada ao usuário logado
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER para poder ler pessoas.profile_id dentro das policies sem
-- depender do RLS de pessoas. STABLE: mesmo valor no escopo da query.
CREATE OR REPLACE FUNCTION public.current_pessoa_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.pessoas
  WHERE profile_id = auth.uid() AND deleted_at IS NULL
  LIMIT 1;
$$;

ALTER FUNCTION public.current_pessoa_id() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.current_pessoa_id() TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. RLS de tarefas: leitura/edição/exclusão escopadas ao dono (admin vê tudo)
-- ---------------------------------------------------------------------------
-- INSERT continua liberado a qualquer membro da empresa (created_by = auth.uid()
-- por default), então a policy tarefas_insert original é mantida.
DROP POLICY IF EXISTS tarefas_select ON public.tarefas;
DROP POLICY IF EXISTS tarefas_update ON public.tarefas;
DROP POLICY IF EXISTS tarefas_delete ON public.tarefas;

-- Leitura: admin da empresa vê todas; os demais veem só as próprias
-- (que criaram ou de que são responsáveis).
CREATE POLICY tarefas_select ON public.tarefas
  FOR SELECT USING (
    empresa_id = public.get_user_empresa_id()
    AND (
      public.is_company_admin()
      OR public.is_ultra_admin()
      OR created_by = auth.uid()
      OR responsavel_id = public.current_pessoa_id()
    )
  );

-- Edição: mesmo escopo de dono; WITH CHECK revalida empresa e FKs cross-tenant.
CREATE POLICY tarefas_update ON public.tarefas
  FOR UPDATE USING (
    empresa_id = public.get_user_empresa_id()
    AND (
      public.is_company_admin()
      OR public.is_ultra_admin()
      OR created_by = auth.uid()
      OR responsavel_id = public.current_pessoa_id()
    )
  )
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND (
      responsavel_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.pessoas p
        WHERE p.id = responsavel_id AND p.empresa_id = public.get_user_empresa_id()
      )
    )
    AND (
      projeto_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.projetos pr
        WHERE pr.id = projeto_id AND pr.empresa_id = public.get_user_empresa_id()
      )
    )
  );

-- Exclusão: mesmo escopo de dono.
CREATE POLICY tarefas_delete ON public.tarefas
  FOR DELETE USING (
    empresa_id = public.get_user_empresa_id()
    AND (
      public.is_company_admin()
      OR public.is_ultra_admin()
      OR created_by = auth.uid()
      OR responsavel_id = public.current_pessoa_id()
    )
  );
