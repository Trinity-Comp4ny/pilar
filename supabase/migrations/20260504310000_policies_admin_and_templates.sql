-- Lote final: templates_projeto (operacional) + administrativas (empresas, profiles, impersonation_sessions).
--
-- Operacional → user_has_feature
-- Administrativa → current_effective_role() IN ('admin','ultra_admin')
--   (current_effective_role respeita impersonation: admin impersonando user perde acesso administrativo)

-- =============================================
-- TEMPLATES_PROJETO → feature 'templates' (operacional)
-- =============================================
DROP POLICY IF EXISTS "Templates Read All" ON public.templates_projeto;
DROP POLICY IF EXISTS "Templates Full Admin/Op" ON public.templates_projeto;
DROP POLICY IF EXISTS "templates_projeto_select" ON public.templates_projeto;
DROP POLICY IF EXISTS "templates_projeto_write" ON public.templates_projeto;

CREATE POLICY "templates_projeto_select" ON public.templates_projeto
  FOR SELECT
  USING (
    empresa_id = public.get_user_empresa_id()
    AND deleted_at IS NULL
    AND public.user_has_feature('templates', 'viewer')
  );

CREATE POLICY "templates_projeto_write" ON public.templates_projeto
  FOR ALL
  USING (
    empresa_id = public.get_user_empresa_id()
    AND deleted_at IS NULL
    AND public.user_has_feature('templates', 'editor')
  )
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('templates', 'editor')
  );

-- =============================================
-- EMPRESAS — UPDATE administrativo (admin gere própria empresa)
-- =============================================
DROP POLICY IF EXISTS "Admin edita empresa" ON public.empresas;
DROP POLICY IF EXISTS "empresas_admin_update" ON public.empresas;

CREATE POLICY "empresas_admin_update" ON public.empresas
  FOR UPDATE
  USING (
    id = public.get_user_empresa_id()
    AND public.current_effective_role() IN ('admin', 'ultra_admin')
  )
  WITH CHECK (
    id = public.get_user_empresa_id()
    AND public.current_effective_role() IN ('admin', 'ultra_admin')
  );

-- =============================================
-- PROFILES — admin gere users da empresa (administrativo)
-- =============================================
DROP POLICY IF EXISTS "Admin gere profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_manage" ON public.profiles;

CREATE POLICY "profiles_admin_manage" ON public.profiles
  FOR ALL
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.current_effective_role() IN ('admin', 'ultra_admin')
  )
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.current_effective_role() IN ('admin', 'ultra_admin')
  );

-- =============================================
-- IMPERSONATION_SESSIONS — usuário lê apenas próprias sessões.
-- NÃO usa current_effective_role() porque admin impersonando user precisa
-- continuar vendo a própria sessão ativa para poder encerrá-la.
-- Segurança: só pode ver sessões onde admin_id = auth.uid().
-- =============================================
DROP POLICY IF EXISTS "impersonation_sessions_admin_read" ON public.impersonation_sessions;

CREATE POLICY "impersonation_sessions_admin_read" ON public.impersonation_sessions
  FOR SELECT
  USING ( admin_id = auth.uid() );
