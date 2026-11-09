-- MFA obrigatório para o ultra admin, aplicado no servidor (ADR 0031).
--
-- A decisão é: MFA opcional para todo usuário e obrigatório só no acesso entre empresas
-- do ultra_admin. Até aqui só o front cumpria (UltraAdminRoute): o banco e as Edge
-- Functions aceitavam uma sessão aal1 do ultra_admin. Agora o poder entre empresas exige
-- sessão aal2 também no servidor. Quem não é ultra_admin não muda em nada.
--
-- Três pontos de poder entre empresas:
--   1. is_ultra_admin(): usada nas policies e nas RPCs de plataforma.
--   2. set_access_profile, start_impersonation, pilar_set_ultra_admin_scope: conferem o
--      papel direto, sem passar por is_ultra_admin().
--   3. Edge Functions requireUltraAdmin (supabase/functions/_shared/admin-auth.ts), que
--      leem a mesma configuração abaixo.
--
-- A exigência vem ligada. platform_settings.exigir_mfa_ultra_admin existe para o ambiente
-- local e o E2E, onde o usuário de seed não tem fator; só um ultra_admin com aal2 consegue
-- desligar em produção (a policy de platform_settings usa is_ultra_admin()).

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS exigir_mfa_ultra_admin boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.platform_settings.exigir_mfa_ultra_admin IS
  'Exige sessão aal2 para o acesso entre empresas do ultra_admin. Ligada por padrão; só desligada em dev local e E2E.';

-- Interna: nunca executável por usuário (só as funções SECURITY DEFINER abaixo a chamam).
CREATE OR REPLACE FUNCTION public._ultra_admin_mfa_ok()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT (auth.jwt() ->> 'aal') = 'aal2'
      OR NOT COALESCE((SELECT exigir_mfa_ultra_admin FROM public.platform_settings WHERE id = 'default'), true);
$function$;

REVOKE EXECUTE ON FUNCTION public._ultra_admin_mfa_ok() FROM PUBLIC, anon, authenticated;

-- 1. is_ultra_admin(): papel ultra_admin E sessão com segundo fator.
CREATE OR REPLACE FUNCTION public.is_ultra_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT role = 'ultra_admin' FROM public.profiles WHERE id = auth.uid()),
    FALSE
  ) AND public._ultra_admin_mfa_ok();
$function$;

-- 2a. set_access_profile: o ultra_admin só altera perfil de OUTRA empresa com aal2.
CREATE OR REPLACE FUNCTION public.set_access_profile(p_user_id uuid, p_perfil text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_role   public.user_role;
  v_caller_emp    uuid;
  v_target_emp    uuid;
  v_target_role   public.user_role;
BEGIN
  -- 'coordenador' entra na whitelist: era só owner/coordenador/colaborador
  -- (modelo A da spec 031, nunca chegou a virar autoridade real). Agora
  -- coordenador É o papel vivo; owner/colaborador saem, mapeiam pra admin/user.
  IF p_perfil NOT IN ('user', 'coordenador', 'admin') THEN
    RAISE EXCEPTION 'Perfil inválido: %', p_perfil USING ERRCODE = '22023';
  END IF;

  SELECT role, empresa_id INTO v_caller_role, v_caller_emp
  FROM public.profiles WHERE id = auth.uid();

  IF v_caller_role IS NULL
     OR v_caller_role NOT IN ('admin', 'ultra_admin') THEN
    RAISE EXCEPTION 'Apenas admin podem definir perfis de acesso'
      USING ERRCODE = '42501';
  END IF;

  SELECT role, empresa_id INTO v_target_role, v_target_emp
  FROM public.profiles WHERE id = p_user_id;

  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado' USING ERRCODE = '22023';
  END IF;

  IF v_caller_role = 'ultra_admin'
     AND v_target_emp IS DISTINCT FROM v_caller_emp
     AND NOT public._ultra_admin_mfa_ok() THEN
    RAISE EXCEPTION 'Segundo fator obrigatório para o acesso entre empresas'
      USING ERRCODE = '42501';
  END IF;

  IF v_caller_role <> 'ultra_admin' AND v_target_emp IS DISTINCT FROM v_caller_emp THEN
    RAISE EXCEPTION 'Usuário de outra empresa' USING ERRCODE = '42501';
  END IF;

  IF v_target_role = 'ultra_admin' THEN
    RAISE EXCEPTION 'Não é possível alterar o perfil de um ultra_admin'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
  SET role = p_perfil::public.user_role
  WHERE id = p_user_id;
END;
$function$;

-- 2b. start_impersonation: ultra_admin só impersona com aal2.
CREATE OR REPLACE FUNCTION public.start_impersonation(
  p_target_role text,
  p_ip text DEFAULT NULL::text,
  p_user_agent text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role TEXT;
  v_session_id UUID;
BEGIN
  SELECT role::TEXT INTO v_role FROM public.profiles WHERE id = auth.uid();

  IF v_role IS NULL OR v_role NOT IN ('admin', 'ultra_admin') THEN
    RAISE EXCEPTION 'Apenas admin ou ultra_admin podem impersonar' USING ERRCODE = '42501';
  END IF;

  IF v_role = 'ultra_admin' AND NOT public._ultra_admin_mfa_ok() THEN
    RAISE EXCEPTION 'Segundo fator obrigatório para o acesso entre empresas' USING ERRCODE = '42501';
  END IF;

  -- ultra_admin nunca é alvo.
  IF p_target_role = 'ultra_admin' THEN
    RAISE EXCEPTION 'Impersonation de ultra_admin não permitido' USING ERRCODE = '42501';
  END IF;

  -- 'admin' como alvo é exclusivo do ultra_admin (QA da visão de admin da empresa).
  -- Um admin comum não pode visualizar como admin (escalonamento lateral).
  IF p_target_role = 'admin' AND v_role <> 'ultra_admin' THEN
    RAISE EXCEPTION 'Só ultra_admin pode visualizar como admin' USING ERRCODE = '42501';
  END IF;

  IF p_target_role NOT IN ('user', 'admin') THEN
    RAISE EXCEPTION 'target_role inválido: %', p_target_role USING ERRCODE = '22023';
  END IF;

  UPDATE public.impersonation_sessions
  SET ended_at = NOW()
  WHERE admin_id = auth.uid()
    AND ended_at IS NULL;

  INSERT INTO public.impersonation_sessions (admin_id, admin_role, target_role, ip_address, user_agent)
  VALUES (auth.uid(), v_role, p_target_role, p_ip, p_user_agent)
  RETURNING id INTO v_session_id;

  RETURN v_session_id;
END;
$function$;

-- 2c. pilar_set_ultra_admin_scope: o modo do ultra_admin só muda com aal2.
CREATE OR REPLACE FUNCTION public.pilar_set_ultra_admin_scope(p_scoped boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role public.user_role;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();

  IF v_role IS DISTINCT FROM 'ultra_admin' THEN
    RAISE EXCEPTION 'Apenas ultra_admin pode alterar o scoped mode';
  END IF;

  IF NOT public._ultra_admin_mfa_ok() THEN
    RAISE EXCEPTION 'Segundo fator obrigatório para o acesso entre empresas' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.ultra_admin_modes (user_id, scoped, updated_at)
  VALUES (auth.uid(), p_scoped, NOW())
  ON CONFLICT (user_id) DO UPDATE
    SET scoped = EXCLUDED.scoped,
        updated_at = EXCLUDED.updated_at;

  RETURN p_scoped;
END;
$function$;
