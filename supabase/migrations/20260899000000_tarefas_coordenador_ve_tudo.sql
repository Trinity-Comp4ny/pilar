-- Coordenador passa a ver/gerenciar as tarefas de toda a empresa, igual admin
-- (pedido do CEO): antes só created_by/responsável, igual usuário comum.
-- has_role() já embute o bypass de ultra_admin, então substitui a checagem
-- is_company_admin()/is_ultra_admin() por has_role('admin', 'coordenador').

DROP POLICY IF EXISTS tarefas_select ON public.tarefas;
DROP POLICY IF EXISTS tarefas_update ON public.tarefas;
DROP POLICY IF EXISTS tarefas_delete ON public.tarefas;

CREATE POLICY tarefas_select ON public.tarefas
  FOR SELECT USING (
    empresa_id = public.get_user_empresa_id()
    AND (
      public.has_role('admin', 'coordenador')
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
      public.has_role('admin', 'coordenador')
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
      public.has_role('admin', 'coordenador')
      OR created_by = auth.uid()
      OR responsavel_id = public.current_pessoa_id()
      OR EXISTS (
        SELECT 1 FROM public.tarefa_responsaveis tr
        WHERE tr.tarefa_id = tarefas.id AND tr.pessoa_id = public.current_pessoa_id()
      )
    )
  );
