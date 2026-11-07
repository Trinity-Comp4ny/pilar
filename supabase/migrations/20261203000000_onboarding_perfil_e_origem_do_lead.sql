-- SPEC 149: onboarding da empresa, do convidado e da primeira semana.
--
-- 1. Perfil do escritório (empresas): site, porte, disciplinas, como conheceu,
--    origem (só o ultra-admin escreve) e por onde quer começar.
-- 2. Perfil da pessoa (profiles): função no escritório e LinkedIn.
-- 3. demo_interesses: cada clique em "Agendar demonstração" na landing, com o
--    canal de onde o visitante veio (UTM ou referrer: Google, ChatGPT...).
--    Sem dado pessoal: só canal, parâmetros de campanha e página.

BEGIN;

-- =============================================
-- 1. empresas
-- =============================================

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS site text,
  ADD COLUMN IF NOT EXISTS porte text,
  ADD COLUMN IF NOT EXISTS disciplinas text[],
  ADD COLUMN IF NOT EXISTS como_conheceu text,
  ADD COLUMN IF NOT EXISTS origem text,
  ADD COLUMN IF NOT EXISTS objetivo_inicial text;

ALTER TABLE public.empresas
  ADD CONSTRAINT empresas_site_tamanho CHECK (site IS NULL OR char_length(site) <= 200),
  ADD CONSTRAINT empresas_porte_valido CHECK (porte IS NULL OR porte IN ('1-5', '6-15', '16-40', '40+')),
  ADD CONSTRAINT empresas_disciplinas_validas CHECK (
    disciplinas IS NULL
    OR disciplinas <@ ARRAY['arquitetura', 'estrutural', 'instalacoes', 'civil_infra', 'geotecnia', 'outra']::text[]
  ),
  ADD CONSTRAINT empresas_como_conheceu_valido CHECK (
    como_conheceu IS NULL
    OR como_conheceu IN ('indicacao', 'google', 'ia', 'linkedin', 'instagram', 'youtube', 'evento', 'outro')
  ),
  ADD CONSTRAINT empresas_origem_valida CHECK (
    origem IS NULL
    OR origem IN ('indicacao', 'google', 'ia', 'linkedin', 'instagram', 'youtube', 'evento', 'outro')
  ),
  ADD CONSTRAINT empresas_objetivo_inicial_valido CHECK (
    objetivo_inicial IS NULL OR objetivo_inicial IN ('gestao', 'projetos', 'obras')
  );

COMMENT ON COLUMN public.empresas.como_conheceu IS
  'Resposta do dono no onboarding: como conheceu o Pilar (SPEC 149).';
COMMENT ON COLUMN public.empresas.origem IS
  'Canal de aquisição registrado pelo ultra-admin na criação. O admin da empresa não altera (SPEC 149).';
COMMENT ON COLUMN public.empresas.objetivo_inicial IS
  'Pilar por onde o escritório quer começar (gestao, projetos, obras): ordena o checklist (SPEC 149).';

-- origem é dado comercial da plataforma: o admin da empresa edita a própria
-- linha (policy empresas_admin_update), mas não esta coluna. service_role
-- (edge do ultra-admin) passa porque auth.uid() é nulo.
CREATE OR REPLACE FUNCTION public.empresas_origem_so_ultra_admin()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.origem IS DISTINCT FROM OLD.origem
     AND auth.uid() IS NOT NULL
     AND NOT public.is_ultra_admin() THEN
    RAISE EXCEPTION 'Só o ultra-admin altera a origem da empresa';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_empresas_origem_so_ultra_admin ON public.empresas;
CREATE TRIGGER tg_empresas_origem_so_ultra_admin
  BEFORE UPDATE OF origem ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.empresas_origem_so_ultra_admin();

-- =============================================
-- 2. profiles
-- =============================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS funcao text,
  ADD COLUMN IF NOT EXISTS linkedin_url text;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_funcao_valida CHECK (
    funcao IS NULL OR funcao IN ('socio', 'coordenador', 'tecnico', 'financeiro', 'outra')
  ),
  ADD CONSTRAINT profiles_linkedin_url_valido CHECK (
    linkedin_url IS NULL
    OR (char_length(linkedin_url) <= 300 AND linkedin_url ~* '^https://([a-z]{2,3}\.)?linkedin\.com/')
  );

COMMENT ON COLUMN public.profiles.funcao IS
  'Função da pessoa no escritório, perguntada no onboarding (SPEC 149).';

-- =============================================
-- 3. demo_interesses
-- =============================================

CREATE TABLE IF NOT EXISTS public.demo_interesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canal text NOT NULL CHECK (char_length(canal) <= 40),
  origem jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (pg_column_size(origem) <= 4000),
  pagina text CHECK (pagina IS NULL OR char_length(pagina) <= 200),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.demo_interesses IS
  'Cliques em "Agendar demonstração" na landing, com o canal de origem (SPEC 149). Escrito só pela edge registrar-interesse-demo.';

CREATE INDEX IF NOT EXISTS demo_interesses_created_at_idx ON public.demo_interesses (created_at DESC);

ALTER TABLE public.demo_interesses ENABLE ROW LEVEL SECURITY;

-- Leitura só do ultra-admin. Sem policy de escrita: só service_role insere.
DROP POLICY IF EXISTS demo_interesses_ultra_admin_select ON public.demo_interesses;
CREATE POLICY demo_interesses_ultra_admin_select ON public.demo_interesses
  FOR SELECT TO authenticated USING (public.is_ultra_admin());

COMMIT;
