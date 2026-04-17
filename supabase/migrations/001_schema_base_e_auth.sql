-- Migration 001: Schema Base e Auth
-- Consolidação de: schema_updates, fix_project_responsibles, auth_hardening

-- =============================================
-- 1. ALTER TABLES — Novas colunas
-- =============================================

-- Clientes
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS tipo_nf TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS origem TEXT;

-- Pessoas
ALTER TABLE public.pessoas ADD COLUMN IF NOT EXISTS endereco TEXT;
ALTER TABLE public.pessoas ADD COLUMN IF NOT EXISTS data_admissao DATE;
ALTER TABLE public.pessoas ADD COLUMN IF NOT EXISTS salario_fixo DECIMAL(12,2);
ALTER TABLE public.pessoas ADD COLUMN IF NOT EXISTS valor_m2 DECIMAL(12,2);

-- Leads
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'cliente_id'
  ) THEN
    ALTER TABLE public.leads ADD COLUMN cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Projetos
ALTER TABLE public.projetos ADD COLUMN IF NOT EXISTS parcelas TEXT;

-- Projetos Responsáveis
ALTER TABLE public.projetos_responsaveis ADD COLUMN IF NOT EXISTS responsabilidade TEXT;

-- Profiles (auth hardening)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- Empresas (auth hardening)
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- =============================================
-- 2. DATA MIGRATION — Marcar onboarding existente
-- =============================================

UPDATE public.profiles SET onboarding_completed = TRUE WHERE contato IS NOT NULL AND nome != email;
UPDATE public.empresas SET onboarding_completed = TRUE WHERE nome != 'Minha Empresa';

-- =============================================
-- 3. FUNCTIONS
-- =============================================

-- 3a. Sync Pessoas -> Profiles (antes de INSERT/UPDATE)
CREATE OR REPLACE FUNCTION public.link_pessoa_profile_before()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.email IS NOT NULL THEN
        NEW.profile_id := (SELECT id FROM public.profiles WHERE email = NEW.email LIMIT 1);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3b. Sync Profiles -> Pessoas (após INSERT/UPDATE)
CREATE OR REPLACE FUNCTION public.link_profile_pessoa_after()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.pessoas
    SET profile_id = NEW.id
    WHERE email = NEW.email;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3c. Handle new user — bloqueia signup não-convidado
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id UUID;
  v_role user_role;
  meta_empresa_id TEXT;
  meta_cargo TEXT;
  meta_nome TEXT;
  meta_is_owner TEXT;
BEGIN
  meta_empresa_id := NEW.raw_user_meta_data->>'empresa_id_convite';
  meta_cargo := NEW.raw_user_meta_data->>'cargo_convite';
  meta_nome := NEW.raw_user_meta_data->>'nome';
  meta_is_owner := NEW.raw_user_meta_data->>'is_company_owner';

  -- CENÁRIO 1: FUNCIONÁRIO CONVIDADO (tem empresa_id_convite)
  IF meta_empresa_id IS NOT NULL THEN
    v_empresa_id := meta_empresa_id::UUID;

    IF NOT EXISTS (SELECT 1 FROM public.empresas WHERE id = v_empresa_id) THEN
      RAISE EXCEPTION 'Empresa do convite não encontrada';
    END IF;

    BEGIN
      v_role := meta_cargo::user_role;
    EXCEPTION WHEN OTHERS THEN
      v_role := 'user';
    END;

    INSERT INTO public.profiles (id, empresa_id, nome, email, role, onboarding_completed)
    VALUES (NEW.id, v_empresa_id, COALESCE(meta_nome, NEW.email), NEW.email, v_role, FALSE);

  -- CENÁRIO 2: NOVO DONO DE EMPRESA (criado via admin com flag is_company_owner)
  ELSIF meta_is_owner = 'true' THEN
    INSERT INTO public.empresas (owner_id, nome, onboarding_completed)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'company_name', 'Minha Empresa'), FALSE)
    RETURNING id INTO v_empresa_id;

    INSERT INTO public.profiles (id, empresa_id, nome, email, role, onboarding_completed)
    VALUES (NEW.id, v_empresa_id, COALESCE(meta_nome, NEW.email), NEW.email, 'admin', FALSE);

  -- CENÁRIO 3: SIGNUP NÃO AUTORIZADO → rejeitar
  ELSE
    RAISE EXCEPTION 'Cadastro não autorizado. Entre em contato com a equipe comercial.';
  END IF;

  RETURN NEW;
END;
$$;

-- =============================================
-- 4. TRIGGERS
-- =============================================

-- Pessoas -> Profiles sync
DROP TRIGGER IF EXISTS tr_link_pessoa_profile_before ON public.pessoas;
CREATE TRIGGER tr_link_pessoa_profile_before
BEFORE INSERT OR UPDATE OF email ON public.pessoas
FOR EACH ROW EXECUTE FUNCTION public.link_pessoa_profile_before();

-- Profiles -> Pessoas sync
DROP TRIGGER IF EXISTS tr_link_profile_pessoa_after ON public.profiles;
CREATE TRIGGER tr_link_profile_pessoa_after
AFTER INSERT OR UPDATE OF email ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.link_profile_pessoa_after();

-- =============================================
-- 5. RPCs
-- =============================================

-- RPC para criar dono de empresa (chamável apenas por admin / service_role)
CREATE OR REPLACE FUNCTION public.admin_create_company_owner(
  p_email TEXT,
  p_nome TEXT,
  p_company_name TEXT DEFAULT 'Minha Empresa'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role user_role;
BEGIN
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();

  IF caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Apenas administradores podem criar donos de empresa';
  END IF;

  RETURN json_build_object(
    'instruction', 'Use supabase auth admin createUser com os seguintes metadados',
    'email', p_email,
    'user_metadata', json_build_object(
      'is_company_owner', 'true',
      'company_name', p_company_name,
      'nome', p_nome
    )
  );
END;
$$;
