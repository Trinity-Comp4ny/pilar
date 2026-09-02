-- Fix: RLS de tarefas só reconhecia o responsável PRIMÁRIO (responsavel_id).
-- Desde a ponte tarefa_responsaveis (20260814000000), uma tarefa pode ter mais
-- de um responsável, mas quem é responsável secundário (não o primeiro da
-- lista) não conseguia ver/editar/excluir a própria tarefa: a policy nunca
-- olhava a ponte. Passa a considerar current_pessoa_id() também via
-- tarefa_responsaveis, não só via responsavel_id.

DROP POLICY IF EXISTS tarefas_select ON public.tarefas;
DROP POLICY IF EXISTS tarefas_update ON public.tarefas;
DROP POLICY IF EXISTS tarefas_delete ON public.tarefas;

CREATE POLICY tarefas_select ON public.tarefas
  FOR SELECT USING (
    empresa_id = public.get_user_empresa_id()
    AND (
      public.is_company_admin()
      OR public.is_ultra_admin()
      OR created_by = auth.uid()
      OR responsavel_id = public.current_pessoa_id()
      OR EXISTS (
        SELECT 1 FROM public.tarefa_responsaveis tr
        WHERE tr.tarefa_id = tarefas.id AND tr.pessoa_id = public.current_pessoa_id()
      )
    )
  );

CREATE POLICY tarefas_update ON public.tarefas
  FOR UPDATE USING (
    empresa_id = public.get_user_empresa_id()
    AND (
      public.is_company_admin()
      OR public.is_ultra_admin()
      OR created_by = auth.uid()
      OR responsavel_id = public.current_pessoa_id()
      OR EXISTS (
        SELECT 1 FROM public.tarefa_responsaveis tr
        WHERE tr.tarefa_id = tarefas.id AND tr.pessoa_id = public.current_pessoa_id()
      )
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

CREATE POLICY tarefas_delete ON public.tarefas
  FOR DELETE USING (
    empresa_id = public.get_user_empresa_id()
    AND (
      public.is_company_admin()
      OR public.is_ultra_admin()
      OR created_by = auth.uid()
      OR responsavel_id = public.current_pessoa_id()
      OR EXISTS (
        SELECT 1 FROM public.tarefa_responsaveis tr
        WHERE tr.tarefa_id = tarefas.id AND tr.pessoa_id = public.current_pessoa_id()
      )
    )
  );
