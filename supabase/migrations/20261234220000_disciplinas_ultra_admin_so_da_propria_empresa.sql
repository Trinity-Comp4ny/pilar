-- Catálogo de disciplinas vazava entre empresas para o ultra-admin.
--
-- disciplinas_manage (ALL, ultra_admin) não filtrava empresa: a sessão de
-- ultra-admin lia o catálogo de TODAS as empresas e, ao excluir/renomear uma
-- disciplina pelo nome, mexia nas linhas das outras (e o trigger de assinatura
-- suspensa recusava a operação quando alguma era de empresa expirada).
--
-- Agora o ultra-admin continua curando a semente global (empresa_id NULL) e
-- gerencia o catálogo da empresa em que está logado, nada além disso. Usuário
-- comum nunca viu outra empresa (disciplinas_select já escopa).

DROP POLICY IF EXISTS disciplinas_manage ON public.disciplinas;
CREATE POLICY disciplinas_manage ON public.disciplinas
  FOR ALL
  TO authenticated
  USING (
    public.current_effective_role() = 'ultra_admin'
    AND (empresa_id IS NULL OR empresa_id = public.get_user_empresa_id())
  )
  WITH CHECK (
    public.current_effective_role() = 'ultra_admin'
    AND (empresa_id IS NULL OR empresa_id = public.get_user_empresa_id())
  );
