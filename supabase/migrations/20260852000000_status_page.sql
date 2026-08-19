-- Spec 055: status page pública (/status). Leitura liberada pra anon (página
-- sem sessão); escrita só is_ultra_admin(). Sem escopo por empresa: status é
-- da plataforma inteira.

CREATE TABLE IF NOT EXISTS public.status_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z_]+$'),
  nome_exibicao TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0
);

INSERT INTO public.status_components (slug, nome_exibicao, ordem) VALUES
  ('app', 'Aplicação Pilar', 1),
  ('portal_cliente', 'Portal do Cliente', 2),
  ('api', 'API / Edge Functions', 3),
  ('banco', 'Banco de dados', 4)
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.status_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL CHECK (length(trim(titulo)) > 0),
  severidade TEXT NOT NULL CHECK (severidade IN ('degradado', 'parcial', 'outage')),
  status TEXT NOT NULL DEFAULT 'investigando'
    CHECK (status IN ('investigando', 'identificado', 'monitorando', 'resolvido')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.status_incident_components (
  incident_id UUID NOT NULL REFERENCES public.status_incidents(id) ON DELETE CASCADE,
  component_id UUID NOT NULL REFERENCES public.status_components(id) ON DELETE CASCADE,
  PRIMARY KEY (incident_id, component_id)
);

CREATE INDEX IF NOT EXISTS status_incident_components_component_idx
  ON public.status_incident_components(component_id);

CREATE TABLE IF NOT EXISTS public.status_incident_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES public.status_incidents(id) ON DELETE CASCADE,
  mensagem TEXT NOT NULL CHECK (length(trim(mensagem)) > 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS status_incident_updates_incident_idx
  ON public.status_incident_updates(incident_id);

ALTER TABLE public.status_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_incident_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_incident_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Status Components Select Public" ON public.status_components;
CREATE POLICY "Status Components Select Public" ON public.status_components
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Status Components Insert Ultra Admin" ON public.status_components;
CREATE POLICY "Status Components Insert Ultra Admin" ON public.status_components
  FOR INSERT TO authenticated WITH CHECK (public.is_ultra_admin());
DROP POLICY IF EXISTS "Status Components Update Ultra Admin" ON public.status_components;
CREATE POLICY "Status Components Update Ultra Admin" ON public.status_components
  FOR UPDATE TO authenticated USING (public.is_ultra_admin()) WITH CHECK (public.is_ultra_admin());
DROP POLICY IF EXISTS "Status Components Delete Ultra Admin" ON public.status_components;
CREATE POLICY "Status Components Delete Ultra Admin" ON public.status_components
  FOR DELETE TO authenticated USING (public.is_ultra_admin());

DROP POLICY IF EXISTS "Status Incidents Select Public" ON public.status_incidents;
CREATE POLICY "Status Incidents Select Public" ON public.status_incidents
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Status Incidents Insert Ultra Admin" ON public.status_incidents;
CREATE POLICY "Status Incidents Insert Ultra Admin" ON public.status_incidents
  FOR INSERT TO authenticated WITH CHECK (public.is_ultra_admin());
DROP POLICY IF EXISTS "Status Incidents Update Ultra Admin" ON public.status_incidents;
CREATE POLICY "Status Incidents Update Ultra Admin" ON public.status_incidents
  FOR UPDATE TO authenticated USING (public.is_ultra_admin()) WITH CHECK (public.is_ultra_admin());

DROP POLICY IF EXISTS "Status Incident Components Select Public" ON public.status_incident_components;
CREATE POLICY "Status Incident Components Select Public" ON public.status_incident_components
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Status Incident Components Insert Ultra Admin" ON public.status_incident_components;
CREATE POLICY "Status Incident Components Insert Ultra Admin" ON public.status_incident_components
  FOR INSERT TO authenticated WITH CHECK (public.is_ultra_admin());
DROP POLICY IF EXISTS "Status Incident Components Delete Ultra Admin" ON public.status_incident_components;
CREATE POLICY "Status Incident Components Delete Ultra Admin" ON public.status_incident_components
  FOR DELETE TO authenticated USING (public.is_ultra_admin());

DROP POLICY IF EXISTS "Status Incident Updates Select Public" ON public.status_incident_updates;
CREATE POLICY "Status Incident Updates Select Public" ON public.status_incident_updates
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Status Incident Updates Insert Ultra Admin" ON public.status_incident_updates;
CREATE POLICY "Status Incident Updates Insert Ultra Admin" ON public.status_incident_updates
  FOR INSERT TO authenticated WITH CHECK (public.is_ultra_admin());

-- Status efetivo por componente: pior severidade entre incidentes ainda não
-- resolvidos que o afetam, ou 'operacional' se nenhum. View (não RPC): função
-- SECURITY DEFINER nova executável por anon quebraria
-- supabase/tests/anon_function_grants.sql a menos que entrasse na allowlist,
-- desnecessário aqui.
CREATE OR REPLACE VIEW public.status_current AS
SELECT
  sc.id,
  sc.slug,
  sc.nome_exibicao,
  sc.ordem,
  COALESCE(
    (
      SELECT CASE
        WHEN bool_or(si.severidade = 'outage') THEN 'outage'
        WHEN bool_or(si.severidade = 'parcial') THEN 'parcial'
        WHEN bool_or(si.severidade = 'degradado') THEN 'degradado'
      END
      FROM public.status_incident_components sic
      JOIN public.status_incidents si ON si.id = sic.incident_id
      WHERE sic.component_id = sc.id AND si.status <> 'resolvido'
    ),
    'operacional'
  ) AS status_efetivo
FROM public.status_components sc
ORDER BY sc.ordem;

ALTER VIEW public.status_current SET (security_invoker = true);
GRANT SELECT ON public.status_current TO anon, authenticated;
