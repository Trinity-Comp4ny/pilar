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
  'Canal de aquisição registrado pelo ultra-admin na criação. Sem GRANT de UPDATE para authenticated: só service_role grava (SPEC 149).';
COMMENT ON COLUMN public.empresas.objetivo_inicial IS
  'Pilar por onde o escritório quer começar (gestao, projetos, obras): ordena o checklist (SPEC 149).';

-- profiles e empresas usam UPDATE por coluna para authenticated
-- (20260870000000 e 20261101000000): coluna nova só é gravável pelo app se
-- entrar na lista. origem fica de fora de propósito: é dado comercial da
-- plataforma, gravado só pela edge do ultra-admin (service_role).
GRANT UPDATE (site, porte, disciplinas, como_conheceu, objetivo_inicial) ON public.empresas TO authenticated;

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

-- Cada pessoa edita a própria função e o LinkedIn (a policy de UPDATE de
-- profiles já restringe à própria linha).
GRANT UPDATE (funcao, linkedin_url) ON public.profiles TO authenticated;

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
