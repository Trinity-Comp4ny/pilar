-- Migration 014: Asaas RLS lockdown + search_path em SECURITY DEFINER
-- Problemas corrigidos:
--   * asaas_config.api_key vazava para qualquer funcionário da empresa
--   * link_pessoa_profile_before / link_profile_pessoa_after rodavam como
--     SECURITY DEFINER sem search_path fixo (risco de schema hijack)
--   * admin_create_company_owner devolvia instruções inúteis; removida.

-- =============================================
-- 1. asaas_config: SELECT/UPDATE/DELETE só admin ou financeiro
-- =============================================

DROP POLICY IF EXISTS "asaas_config_empresa_select" ON public.asaas_config;
DROP POLICY IF EXISTS "asaas_config_empresa_insert" ON public.asaas_config;
DROP POLICY IF EXISTS "asaas_config_empresa_update" ON public.asaas_config;
DROP POLICY IF EXISTS "asaas_config_empresa_delete" ON public.asaas_config;

CREATE POLICY "asaas_config_admin_select" ON public.asaas_config
  FOR SELECT
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.has_role('admin', 'financeiro')
  );

CREATE POLICY "asaas_config_admin_insert" ON public.asaas_config
  FOR INSERT
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.has_role('admin', 'financeiro')
  );

CREATE POLICY "asaas_config_admin_update" ON public.asaas_config
  FOR UPDATE
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.has_role('admin', 'financeiro')
  )
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.has_role('admin', 'financeiro')
  );

CREATE POLICY "asaas_config_admin_delete" ON public.asaas_config
  FOR DELETE
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.has_role('admin', 'financeiro')
  );

-- asaas_webhook_logs: leitura restrita a admin/financeiro (pode conter dados sensíveis)
DROP POLICY IF EXISTS "asaas_webhook_logs_select" ON public.asaas_webhook_logs;
CREATE POLICY "asaas_webhook_logs_admin_select" ON public.asaas_webhook_logs
  FOR SELECT
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.has_role('admin', 'financeiro')
  );

-- =============================================
-- 2. Fix search_path em triggers SECURITY DEFINER (001_schema_base_e_auth)
-- =============================================

CREATE OR REPLACE FUNCTION public.link_pessoa_profile_before()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NOT NULL THEN
    NEW.profile_id := (SELECT id FROM public.profiles WHERE email = NEW.email LIMIT 1);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.link_profile_pessoa_after()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.pessoas
  SET profile_id = NEW.id
  WHERE email = NEW.email;
  RETURN NULL;
END;
$$;

-- =============================================
-- 3. Remove admin_create_company_owner (devolvia apenas instruções; confuso)
-- =============================================

DROP FUNCTION IF EXISTS public.admin_create_company_owner(TEXT, TEXT, TEXT);
