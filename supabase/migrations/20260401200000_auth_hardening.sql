-- ==============================================================================
-- AUTH HARDENING: Bloquear signup aberto + melhorar onboarding flags
-- ==============================================================================

-- ==============================================================================
-- 1. Adicionar flag onboarding_completed em profiles e empresas
--    Substitui a lógica frágil de "Minha Empresa" e "nome === email"
-- ==============================================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- Marcar todos os profiles/empresas existentes como onboarding completo
UPDATE public.profiles SET onboarding_completed = TRUE WHERE contato IS NOT NULL AND nome != email;
UPDATE public.empresas SET onboarding_completed = TRUE WHERE nome != 'Minha Empresa';

-- ==============================================================================
-- 2. Reescrever handle_new_user para BLOQUEAR signups não-convidados
--    Apenas convites (empresa_id_convite) ou criação via admin são permitidos
-- ==============================================================================

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
    
    -- Valida que a empresa existe
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

-- ==============================================================================
-- 3. RPC para criar dono de empresa (chamável apenas com service_role key)
--    Usar via: supabase functions invoke ou dashboard
-- ==============================================================================

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
  -- Verifica se quem chama é admin (ou será chamado com service_role)
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  
  IF caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Apenas administradores podem criar donos de empresa';
  END IF;

  -- Retorna as instruções para criação via Supabase Admin API
  -- (o usuário precisa ser criado via auth.admin.createUser com os metadados corretos)
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
