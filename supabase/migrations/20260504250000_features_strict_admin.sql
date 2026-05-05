-- Reescreve user_has_feature() para remover o bypass automático de admin.
--
-- Contexto: no SaaS Pilar, ultra_admin é o operador da plataforma (Labrynth).
-- Empresas-cliente têm seu próprio admin (dono da empresa de engenharia/arquitetura).
-- Esse admin precisa ter features explicitamente atribuídas, igual a qualquer user —
-- a única diferença é que admin gerencia a empresa (convidar, billing, audit).
--
-- Antes: admin bypassava nível granular após validar empresa.features
-- Depois: admin segue exatamente as mesmas regras de feature gate que user

CREATE OR REPLACE FUNCTION public.user_has_feature(p_feature TEXT, p_min_level TEXT DEFAULT 'viewer')
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.user_role;
  v_empresa_features JSONB;
  v_profile_features JSONB;
  v_user_level TEXT;
BEGIN
  IF p_min_level NOT IN ('viewer', 'editor') THEN
    RAISE EXCEPTION 'p_min_level deve ser "viewer" ou "editor"';
  END IF;

  IF NOT (p_feature = ANY (public._feature_catalog())) THEN
    RETURN FALSE;
  END IF;

  SELECT p.role, e.features, p.features
  INTO v_role, v_empresa_features, v_profile_features
  FROM public.profiles p
  LEFT JOIN public.empresas e ON e.id = p.empresa_id
  WHERE p.id = auth.uid();

  IF v_role IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Ultra admin: bypass total (cross-empresa, plataforma)
  IF v_role = 'ultra_admin' THEN
    RETURN TRUE;
  END IF;

  -- Empresa precisa ter feature ativa (exceto core 'dashboard' que é universal)
  IF p_feature <> 'dashboard'
     AND COALESCE((v_empresa_features ->> p_feature)::BOOLEAN, FALSE) = FALSE THEN
    RETURN FALSE;
  END IF;

  -- Admin e user seguem mesma regra granular: precisam ter level explícito no profile.
  -- (Diferença admin↔user é exclusiva pra operações administrativas — convites,
  -- billing, audit — que checam role diretamente, não user_has_feature.)
  v_user_level := v_profile_features ->> p_feature;

  IF v_user_level IS NULL THEN
    RETURN FALSE;
  END IF;

  -- viewer: passa em viewer/editor required ; editor: só passa em editor required
  IF p_min_level = 'viewer' THEN
    RETURN v_user_level IN ('viewer', 'editor');
  ELSE -- 'editor'
    RETURN v_user_level = 'editor';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.user_has_feature(TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.user_has_feature(TEXT, TEXT) IS
  'Feature gate operacional. Ultra_admin bypassa. Admin segue mesmas regras de feature granular que user — admin é apenas a accountability da empresa, não autorização operacional.';

-- =============================================
-- Trigger tg_validate_profile_features: parar de zerar features de admin.
-- =============================================
-- Antes: admin/ultra_admin tinham features = {} forçadamente (bypass via has_role).
-- Agora: admin precisa ter features atribuídas pra trabalhar nos módulos.
-- Ultra_admin continua sem features (bypassa via user_has_feature).

CREATE OR REPLACE FUNCTION public.tg_validate_profile_features()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Ultra_admin não precisa de features (bypass total). Mantém vazio.
  IF NEW.role = 'ultra_admin' THEN
    NEW.features := '{}'::jsonb;
    RETURN NEW;
  END IF;

  -- Admin e user: features são validadas contra o plano da empresa.
  PERFORM public._validate_features_payload(NEW.features, NEW.empresa_id);
  RETURN NEW;
END;
$$;
