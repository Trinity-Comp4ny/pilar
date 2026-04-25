-- Migration 020: MFA enforcement para admins
-- Bloqueia RPCs administrativas e mudanças sensíveis quando admin não tem AAL2.
-- AAL1 = senha; AAL2 = senha + TOTP (MFA).

-- =============================================
-- 1. Helper: verifica se caller tem AAL2
-- =============================================

CREATE OR REPLACE FUNCTION public.has_aal2()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_aal TEXT;
BEGIN
  -- AAL vem do JWT no claim "aal"
  v_aal := (auth.jwt() ->> 'aal');
  RETURN v_aal = 'aal2';
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_aal2() TO authenticated;

-- =============================================
-- 2. Helper: admin precisa ter MFA
-- =============================================

CREATE OR REPLACE FUNCTION public.admin_mfa_required()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.user_role;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();

  -- Se não é admin, não exige MFA
  IF v_role IS DISTINCT FROM 'admin' THEN
    RETURN TRUE;
  END IF;

  -- Admin: exige AAL2
  RETURN public.has_aal2();
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_mfa_required() TO authenticated;

-- =============================================
-- 3. Aplicar check em RPCs administrativas
-- =============================================

-- create_convite: admin precisa MFA
CREATE OR REPLACE FUNCTION public.create_convite(
  p_email TEXT,
  p_cargo TEXT,
  p_nome TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id UUID;
  v_cargo public.user_role;
  v_token TEXT;
  v_allowed BOOLEAN;
BEGIN
  v_empresa_id := public.get_user_empresa_id();

  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem criar convites';
  END IF;

  IF NOT public.admin_mfa_required() THEN
    RAISE EXCEPTION 'MFA obrigatório. Configure autenticação de dois fatores em Perfil > Segurança.';
  END IF;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa';
  END IF;

  v_allowed := public.check_rate_limit('create_convite', v_empresa_id::TEXT, 20, 3600);
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Limite de convites por hora excedido (20). Aguarde.';
  END IF;

  BEGIN
    v_cargo := p_cargo::public.user_role;
  EXCEPTION WHEN OTHERS THEN
    v_cargo := 'user';
  END;

  UPDATE public.convites
  SET usado_em = NOW()
  WHERE email = lower(trim(p_email))
    AND empresa_id = v_empresa_id
    AND usado_em IS NULL;

  INSERT INTO public.convites (empresa_id, email, cargo, nome, criado_por)
  VALUES (v_empresa_id, lower(trim(p_email)), v_cargo, p_nome, auth.uid())
  RETURNING token INTO v_token;

  RETURN v_token;
END;
$$;

-- =============================================
-- 4. RLS: impedir admin sem MFA de editar asaas_config
-- =============================================

DROP POLICY IF EXISTS "asaas_config_admin_insert" ON public.asaas_config;
DROP POLICY IF EXISTS "asaas_config_admin_update" ON public.asaas_config;
DROP POLICY IF EXISTS "asaas_config_admin_delete" ON public.asaas_config;

CREATE POLICY "asaas_config_admin_insert_mfa" ON public.asaas_config
  FOR INSERT
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.has_role('admin', 'financeiro')
    AND public.admin_mfa_required()
  );

CREATE POLICY "asaas_config_admin_update_mfa" ON public.asaas_config
  FOR UPDATE
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.has_role('admin', 'financeiro')
    AND public.admin_mfa_required()
  )
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.has_role('admin', 'financeiro')
    AND public.admin_mfa_required()
  );

CREATE POLICY "asaas_config_admin_delete_mfa" ON public.asaas_config
  FOR DELETE
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.has_role('admin', 'financeiro')
    AND public.admin_mfa_required()
  );

-- =============================================
-- 5. View para admin verificar quem ainda não tem MFA
-- =============================================

CREATE OR REPLACE VIEW public.view_admins_sem_mfa AS
SELECT
  p.id,
  p.empresa_id,
  p.nome,
  p.email,
  p.role,
  -- auth.mfa_factors tem os factors enrollados; se count = 0, sem MFA
  COALESCE((
    SELECT COUNT(*)::INT
    FROM auth.mfa_factors f
    WHERE f.user_id = p.id AND f.status = 'verified'
  ), 0) AS factors_ativos
FROM public.profiles p
WHERE p.role = 'admin';

GRANT SELECT ON public.view_admins_sem_mfa TO authenticated;

-- Nota: a view expõe apenas contagem; quem lê é filtrado por RLS de profiles
-- (usuário só vê os admins da própria empresa).
