-- Lote: módulo CRM (leads + clientes + propostas).
-- Tabelas: leads, clientes, propostas, proposta_templates.
-- Convenção: SELECT → user_has_feature(<feature>,'viewer'); WRITE → 'editor'.

-- =============================================
-- LEADS → feature 'leads'
-- =============================================
DROP POLICY IF EXISTS "Leads Read" ON public.leads;
DROP POLICY IF EXISTS "Leads Full" ON public.leads;
DROP POLICY IF EXISTS "leads_select" ON public.leads;
DROP POLICY IF EXISTS "leads_write" ON public.leads;

CREATE POLICY "leads_select" ON public.leads
  FOR SELECT
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('leads', 'viewer')
  );

CREATE POLICY "leads_write" ON public.leads
  FOR ALL
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('leads', 'editor')
  )
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('leads', 'editor')
  );

-- =============================================
-- CLIENTES → feature 'clientes'
-- =============================================
DROP POLICY IF EXISTS "Clientes Read" ON public.clientes;
DROP POLICY IF EXISTS "Clientes Full" ON public.clientes;
DROP POLICY IF EXISTS "clientes_select" ON public.clientes;
DROP POLICY IF EXISTS "clientes_write" ON public.clientes;

CREATE POLICY "clientes_select" ON public.clientes
  FOR SELECT
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('clientes', 'viewer')
  );

CREATE POLICY "clientes_write" ON public.clientes
  FOR ALL
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('clientes', 'editor')
  )
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('clientes', 'editor')
  );

-- =============================================
-- PROPOSTAS → feature 'propostas'
-- =============================================
DROP POLICY IF EXISTS "Propostas Read Fin" ON public.propostas;
DROP POLICY IF EXISTS "Propostas Full Admin/Op/Mkt" ON public.propostas;
DROP POLICY IF EXISTS "propostas_select" ON public.propostas;
DROP POLICY IF EXISTS "propostas_write" ON public.propostas;

CREATE POLICY "propostas_select" ON public.propostas
  FOR SELECT
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('propostas', 'viewer')
  );

CREATE POLICY "propostas_write" ON public.propostas
  FOR ALL
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('propostas', 'editor')
  )
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('propostas', 'editor')
  );

-- =============================================
-- PROPOSTA_TEMPLATES → feature 'propostas' (templates de propostas)
-- =============================================
DROP POLICY IF EXISTS "PropostaTemplates Read" ON public.proposta_templates;
DROP POLICY IF EXISTS "PropostaTemplates Full" ON public.proposta_templates;
DROP POLICY IF EXISTS "proposta_templates_select" ON public.proposta_templates;
DROP POLICY IF EXISTS "proposta_templates_write" ON public.proposta_templates;

CREATE POLICY "proposta_templates_select" ON public.proposta_templates
  FOR SELECT
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('propostas', 'viewer')
  );

CREATE POLICY "proposta_templates_write" ON public.proposta_templates
  FOR ALL
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('propostas', 'editor')
  )
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('propostas', 'editor')
  );
