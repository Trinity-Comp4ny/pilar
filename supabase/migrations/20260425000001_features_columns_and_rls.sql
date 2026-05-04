-- ============================================================================
-- Migration: features granulares + RLS para ultra_admin
-- ----------------------------------------------------------------------------
-- Modelo final:
--   profiles.role:
--     'ultra_admin' → cross-empresa, bypass total (concedido SOMENTE via SQL)
--     'admin'       → bypass dentro da empresa
--     'user'        → granular, lê profiles.features
--     (financeiro/marketing/operacional/user legados ficam no enum como
--      compatibilidade — backfill abaixo migra todos para 'user' + features)
--
--   empresas.features  JSONB { feature_key: boolean }
--   profiles.features  JSONB { feature_key: 'viewer' | 'editor' }
--   convites.features  JSONB { feature_key: 'viewer' | 'editor' }
--
-- Triggers validam que:
--   1. Toda chave de features pertence ao catálogo conhecido
--   2. Toda chave em profiles.features está habilitada em empresas.features
--   3. Valores válidos: 'viewer' ou 'editor' (admin é via role, não feature)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CONSTANTES: catálogo canônico de features
-- ----------------------------------------------------------------------------
-- Mantenha sincronizado com src/lib/features.ts (FEATURES[].key).
-- Se adicionar/remover feature, gere nova migration ajustando esta função.

CREATE OR REPLACE FUNCTION public._feature_catalog()
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ARRAY[
    'dashboard',
    'relatorios',
    'leads',
    'propostas',
    'clientes',
    'projetos',
    'planejamento',
    'timesheet',
    'mapa',
    'financeiro',
    'pessoas',
    'metas',
    'portal_cliente',
    'ai_hub',
    'capacidade',
    'templates'
  ];
$$;

-- ----------------------------------------------------------------------------
-- 2. COLUNAS NOVAS
-- ----------------------------------------------------------------------------

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS features JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS features JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Recria convites caso tenha sido dropada por migration de sync anterior
CREATE TABLE IF NOT EXISTS public.convites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  cargo public.user_role NOT NULL DEFAULT 'user',
  nome TEXT,
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  criado_por UUID REFERENCES auth.users(id),
  expira_em TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  usado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_convites_token ON public.convites(token) WHERE usado_em IS NULL;
CREATE INDEX IF NOT EXISTS idx_convites_email ON public.convites(email) WHERE usado_em IS NULL;
CREATE INDEX IF NOT EXISTS idx_convites_empresa ON public.convites(empresa_id);

ALTER TABLE public.convites ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.convites
  ADD COLUMN IF NOT EXISTS features JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ----------------------------------------------------------------------------
-- 3. BACKFILL empresas.features (decisão C)
--    Todas as features ativas exceto add-ons (ai_hub, capacidade, templates).
-- ----------------------------------------------------------------------------

UPDATE public.empresas
SET features = jsonb_build_object(
  'dashboard', true,
  'relatorios', true,
  'leads', true,
  'propostas', true,
  'clientes', true,
  'projetos', true,
  'planejamento', true,
  'timesheet', true,
  'mapa', true,
  'financeiro', true,
  'pessoas', true,
  'metas', true,
  'portal_cliente', true,
  'ai_hub', false,
  'capacidade', false,
  'templates', false
)
WHERE features = '{}'::jsonb OR features IS NULL;

-- ----------------------------------------------------------------------------
-- 4. BACKFILL profiles.role + profiles.features (decisão B)
--    Roles legados → 'user' + features equivalentes da matriz CAPABILITIES.
--    'admin' permanece 'admin' (bypass mantido).
--    Se já existe ultra_admin (improvável neste momento), preserva.
-- ----------------------------------------------------------------------------

UPDATE public.profiles
SET features = CASE role
  WHEN 'financeiro' THEN jsonb_build_object(
    'financeiro', 'editor',
    'relatorios', 'viewer',
    'clientes', 'viewer',
    'projetos', 'viewer',
    'timesheet', 'editor',
    'mapa', 'viewer',
    'pessoas', 'viewer',
    'metas', 'viewer',
    'templates', 'viewer',
    'ai_hub', 'viewer'
  )
  WHEN 'marketing' THEN jsonb_build_object(
    'leads', 'editor',
    'propostas', 'editor',
    'clientes', 'editor',
    'relatorios', 'viewer',
    'projetos', 'viewer',
    'timesheet', 'editor',
    'mapa', 'viewer',
    'pessoas', 'viewer',
    'metas', 'viewer',
    'templates', 'viewer',
    'ai_hub', 'viewer'
  )
  WHEN 'operacional' THEN jsonb_build_object(
    'projetos', 'editor',
    'planejamento', 'editor',
    'timesheet', 'editor',
    'mapa', 'viewer',
    'clientes', 'editor',
    'leads', 'editor',
    'propostas', 'editor',
    'relatorios', 'viewer',
    'capacidade', 'viewer',
    'pessoas', 'viewer',
    'metas', 'viewer',
    'templates', 'viewer',
    'ai_hub', 'viewer'
  )
  WHEN 'user' THEN jsonb_build_object(
    'timesheet', 'editor'
  )
  ELSE features
END
WHERE role IN ('financeiro', 'marketing', 'operacional', 'user')
  AND features = '{}'::jsonb;

-- Move roles legados → 'user' (preserva admin e ultra_admin)
UPDATE public.profiles
SET role = 'user'
WHERE role IN ('financeiro', 'marketing', 'operacional');

-- ----------------------------------------------------------------------------
-- 5. BACKFILL convites pendentes (mesma lógica que profiles)
-- ----------------------------------------------------------------------------

UPDATE public.convites
SET features = CASE cargo
  WHEN 'financeiro' THEN jsonb_build_object(
    'financeiro', 'editor', 'relatorios', 'viewer', 'clientes', 'viewer',
    'projetos', 'viewer', 'timesheet', 'editor'
  )
  WHEN 'marketing' THEN jsonb_build_object(
    'leads', 'editor', 'propostas', 'editor', 'clientes', 'editor',
    'relatorios', 'viewer', 'timesheet', 'editor'
  )
  WHEN 'operacional' THEN jsonb_build_object(
    'projetos', 'editor', 'planejamento', 'editor', 'timesheet', 'editor',
    'mapa', 'viewer', 'clientes', 'editor'
  )
  WHEN 'user' THEN jsonb_build_object('timesheet', 'editor')
  ELSE features
END
WHERE cargo IN ('financeiro', 'marketing', 'operacional', 'user')
  AND features = '{}'::jsonb
  AND usado_em IS NULL;

UPDATE public.convites
SET cargo = 'user'
WHERE cargo IN ('financeiro', 'marketing', 'operacional')
  AND usado_em IS NULL;

-- ----------------------------------------------------------------------------
-- 6. HELPERS: is_ultra_admin, is_company_admin, user_has_feature
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_ultra_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role = 'ultra_admin' FROM public.profiles WHERE id = auth.uid()),
    FALSE
  );
$$;

ALTER FUNCTION public.is_ultra_admin() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.is_ultra_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_company_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role = 'admin' FROM public.profiles WHERE id = auth.uid()),
    FALSE
  );
$$;

ALTER FUNCTION public.is_company_admin() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.is_company_admin() TO authenticated;

-- Checagem completa de feature: role + empresa.features + profile.features
CREATE OR REPLACE FUNCTION public.user_has_feature(
  p_feature TEXT,
  p_min_level TEXT DEFAULT 'viewer'
)
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

  -- Ultra admin bypass total
  IF v_role = 'ultra_admin' THEN
    RETURN TRUE;
  END IF;

  -- Empresa precisa ter feature ativa (exceto core 'dashboard')
  IF p_feature <> 'dashboard'
     AND COALESCE((v_empresa_features ->> p_feature)::BOOLEAN, FALSE) = FALSE THEN
    RETURN FALSE;
  END IF;

  -- Admin da empresa bypassa nivel granular (após checar empresa)
  IF v_role = 'admin' THEN
    RETURN TRUE;
  END IF;

  -- User: precisa ter level explícito
  v_user_level := v_profile_features ->> p_feature;
  IF v_user_level IS NULL THEN
    -- 'dashboard' é core, todo user tem viewer mesmo sem feature explícita
    IF p_feature = 'dashboard' AND p_min_level = 'viewer' THEN
      RETURN TRUE;
    END IF;
    RETURN FALSE;
  END IF;

  IF p_min_level = 'viewer' THEN
    RETURN v_user_level IN ('viewer', 'editor');
  END IF;

  -- p_min_level = 'editor'
  RETURN v_user_level = 'editor';
END;
$$;

ALTER FUNCTION public.user_has_feature(TEXT, TEXT) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.user_has_feature(TEXT, TEXT) TO authenticated;

-- ----------------------------------------------------------------------------
-- 7. TRIGGER: validate_features_payload
--    Valida estrutura de profiles.features e convites.features.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public._validate_features_payload(
  p_features JSONB,
  p_empresa_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_key TEXT;
  v_value TEXT;
  v_empresa_features JSONB;
  v_catalog TEXT[] := public._feature_catalog();
BEGIN
  IF p_features IS NULL OR p_features = '{}'::jsonb THEN
    RETURN;
  END IF;

  IF jsonb_typeof(p_features) <> 'object' THEN
    RAISE EXCEPTION 'features deve ser um objeto JSON';
  END IF;

  SELECT features INTO v_empresa_features
  FROM public.empresas
  WHERE id = p_empresa_id;

  FOR v_key, v_value IN SELECT * FROM jsonb_each_text(p_features)
  LOOP
    IF NOT (v_key = ANY (v_catalog)) THEN
      RAISE EXCEPTION 'Feature desconhecida: %', v_key;
    END IF;

    IF v_value NOT IN ('viewer', 'editor') THEN
      RAISE EXCEPTION 'Nível inválido para %: % (use "viewer" ou "editor")', v_key, v_value;
    END IF;

    IF v_key <> 'dashboard'
       AND COALESCE((v_empresa_features ->> v_key)::BOOLEAN, FALSE) = FALSE THEN
      RAISE EXCEPTION 'Feature "%" não está habilitada na empresa', v_key;
    END IF;
  END LOOP;
END;
$$;

ALTER FUNCTION public._validate_features_payload(JSONB, UUID) OWNER TO postgres;

-- Trigger profiles
CREATE OR REPLACE FUNCTION public.tg_validate_profile_features()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Admin/ultra_admin não usam features (sempre vazio)
  IF NEW.role IN ('admin', 'ultra_admin') THEN
    NEW.features := '{}'::jsonb;
    RETURN NEW;
  END IF;

  PERFORM public._validate_features_payload(NEW.features, NEW.empresa_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_profile_features ON public.profiles;
CREATE TRIGGER validate_profile_features
  BEFORE INSERT OR UPDATE OF features, role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_validate_profile_features();

-- Trigger convites
CREATE OR REPLACE FUNCTION public.tg_validate_convite_features()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.cargo = 'admin' THEN
    NEW.features := '{}'::jsonb;
    RETURN NEW;
  END IF;

  PERFORM public._validate_features_payload(NEW.features, NEW.empresa_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_convite_features ON public.convites;
CREATE TRIGGER validate_convite_features
  BEFORE INSERT OR UPDATE OF features, cargo ON public.convites
  FOR EACH ROW EXECUTE FUNCTION public.tg_validate_convite_features();

-- ----------------------------------------------------------------------------
-- 8. TRIGGER: bloquear promoção/rebaixamento de ultra_admin via UI
--    UI roda como `authenticated`. SQL admin (service_role) bypassa.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.tg_protect_ultra_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Bypass: conexão direta (postgres/supabase_admin) OU service_role via JWT
  IF current_user IN ('postgres', 'supabase_admin')
     OR current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Não pode promover ninguém a ultra_admin via SQL de usuário comum
  IF (TG_OP = 'INSERT' AND NEW.role = 'ultra_admin')
     OR (TG_OP = 'UPDATE' AND NEW.role = 'ultra_admin' AND OLD.role <> 'ultra_admin') THEN
    RAISE EXCEPTION 'Promoção a ultra_admin requer SQL com service_role';
  END IF;

  -- Não pode rebaixar um ultra_admin
  IF TG_OP = 'UPDATE' AND OLD.role = 'ultra_admin' AND NEW.role <> 'ultra_admin' THEN
    RAISE EXCEPTION 'Rebaixamento de ultra_admin requer SQL com service_role';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_ultra_admin ON public.profiles;
CREATE TRIGGER protect_ultra_admin
  BEFORE INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_protect_ultra_admin();

-- ----------------------------------------------------------------------------
-- 9. RLS: ultra_admin lê/edita tudo
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Ultra admin full empresas" ON public.empresas;
CREATE POLICY "Ultra admin full empresas" ON public.empresas
  FOR ALL TO authenticated
  USING (public.is_ultra_admin())
  WITH CHECK (public.is_ultra_admin());

DROP POLICY IF EXISTS "Ultra admin full profiles" ON public.profiles;
CREATE POLICY "Ultra admin full profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (public.is_ultra_admin())
  WITH CHECK (public.is_ultra_admin());

DROP POLICY IF EXISTS "Ultra admin full convites" ON public.convites;
CREATE POLICY "Ultra admin full convites" ON public.convites
  FOR ALL TO authenticated
  USING (public.is_ultra_admin())
  WITH CHECK (public.is_ultra_admin());

-- ----------------------------------------------------------------------------
-- 10. REESCRITA: handle_new_user copia features do convite
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_convite RECORD;
  v_owner_pending RECORD;
  v_empresa_id UUID;
  v_token TEXT;
BEGIN
  v_token := NEW.raw_user_meta_data->>'invite_token';

  IF v_token IS NOT NULL THEN
    -- CENÁRIO 1: FUNCIONÁRIO CONVIDADO
    SELECT id, empresa_id, email, cargo, nome, features
    INTO v_convite
    FROM public.convites
    WHERE token = v_token
      AND email = lower(NEW.email)
      AND usado_em IS NULL
      AND expira_em > NOW();

    IF v_convite.id IS NOT NULL THEN
      INSERT INTO public.profiles (id, empresa_id, nome, email, role, features, onboarding_completed)
      VALUES (
        NEW.id,
        v_convite.empresa_id,
        COALESCE(v_convite.nome, NEW.email),
        NEW.email,
        v_convite.cargo,
        COALESCE(v_convite.features, '{}'::jsonb),
        FALSE
      );

      UPDATE public.convites SET usado_em = NOW() WHERE id = v_convite.id;
      RETURN NEW;
    END IF;

    -- CENÁRIO 2: NOVO DONO DE EMPRESA
    SELECT id, email, company_name, nome
    INTO v_owner_pending
    FROM public.empresa_owners_pending
    WHERE token = v_token
      AND email = lower(NEW.email)
      AND usado_em IS NULL
      AND expira_em > NOW();

    IF v_owner_pending.id IS NOT NULL THEN
      INSERT INTO public.empresas (owner_id, nome, features, onboarding_completed)
      VALUES (
        NEW.id,
        v_owner_pending.company_name,
        jsonb_build_object(
          'dashboard', true, 'relatorios', true, 'leads', true,
          'propostas', true, 'clientes', true, 'projetos', true,
          'planejamento', true, 'timesheet', true, 'mapa', true,
          'financeiro', true, 'pessoas', true, 'metas', true,
          'portal_cliente', true,
          'ai_hub', false, 'capacidade', false, 'templates', false
        ),
        FALSE
      )
      RETURNING id INTO v_empresa_id;

      INSERT INTO public.profiles (id, empresa_id, nome, email, role, features, onboarding_completed)
      VALUES (
        NEW.id,
        v_empresa_id,
        COALESCE(v_owner_pending.nome, NEW.email),
        NEW.email,
        'admin',
        '{}'::jsonb,
        FALSE
      );

      UPDATE public.empresa_owners_pending SET usado_em = NOW() WHERE id = v_owner_pending.id;
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Token de convite inválido ou expirado';
  END IF;

  RAISE EXCEPTION 'Cadastro não autorizado. Entre em contato com a equipe comercial.';
END;
$$;

-- ----------------------------------------------------------------------------
-- 11. REESCRITA: create_convite aceita features (JSONB)
--     Função antiga (TEXT, TEXT, TEXT) é dropada; nova suporta chamadas
--     legadas via DEFAULT em p_features.
-- ----------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.create_convite(TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.create_convite(
  p_email TEXT,
  p_cargo TEXT,
  p_nome TEXT DEFAULT NULL,
  p_features JSONB DEFAULT '{}'::jsonb
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id UUID;
  v_cargo public.user_role;
  v_features JSONB;
  v_token TEXT;
BEGIN
  v_empresa_id := public.get_user_empresa_id();

  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem criar convites';
  END IF;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa';
  END IF;

  -- Cargo: admin ou user. Não permitir promoção a ultra_admin via convite.
  BEGIN
    v_cargo := p_cargo::public.user_role;
  EXCEPTION WHEN OTHERS THEN
    v_cargo := 'user';
  END;

  IF v_cargo = 'ultra_admin' THEN
    RAISE EXCEPTION 'ultra_admin não pode ser concedido via convite';
  END IF;

  -- Roles legados forçados para 'user'
  IF v_cargo IN ('financeiro', 'marketing', 'operacional') THEN
    v_cargo := 'user';
  END IF;

  -- Features: admin não usa
  IF v_cargo = 'admin' THEN
    v_features := '{}'::jsonb;
  ELSE
    v_features := COALESCE(p_features, '{}'::jsonb);
  END IF;

  -- Invalida convites antigos não usados
  UPDATE public.convites
  SET usado_em = NOW()
  WHERE email = lower(trim(p_email))
    AND empresa_id = v_empresa_id
    AND usado_em IS NULL;

  -- O trigger validate_convite_features valida estrutura + empresa.features
  INSERT INTO public.convites (empresa_id, email, cargo, nome, features, criado_por)
  VALUES (v_empresa_id, lower(trim(p_email)), v_cargo, p_nome, v_features, auth.uid())
  RETURNING token INTO v_token;

  RETURN v_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_convite(TEXT, TEXT, TEXT, JSONB) TO authenticated;

-- ----------------------------------------------------------------------------
-- 12. RPC: update_user_access (admin altera role/features de membro)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_user_access(
  p_user_id UUID,
  p_role TEXT,
  p_features JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_empresa UUID;
  v_target_empresa UUID;
  v_target_role public.user_role;
  v_new_role public.user_role;
BEGIN
  v_caller_empresa := public.get_user_empresa_id();

  IF NOT (public.has_role('admin') OR public.is_ultra_admin()) THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar acessos';
  END IF;

  SELECT empresa_id, role INTO v_target_empresa, v_target_role
  FROM public.profiles WHERE id = p_user_id;

  IF v_target_empresa IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;

  -- Admin de empresa só pode editar membros da própria empresa
  IF NOT public.is_ultra_admin() AND v_target_empresa <> v_caller_empresa THEN
    RAISE EXCEPTION 'Sem permissão para editar usuário de outra empresa';
  END IF;

  IF v_target_role = 'ultra_admin' THEN
    RAISE EXCEPTION 'Ultra admin só pode ser editado via SQL direto';
  END IF;

  BEGIN
    v_new_role := p_role::public.user_role;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Role inválido: %', p_role;
  END;

  IF v_new_role = 'ultra_admin' THEN
    RAISE EXCEPTION 'Promoção a ultra_admin requer SQL direto';
  END IF;

  IF v_new_role IN ('financeiro', 'marketing', 'operacional') THEN
    v_new_role := 'user';
  END IF;

  -- Trigger validate_profile_features valida features ao escrever
  UPDATE public.profiles
  SET role = v_new_role,
      features = CASE WHEN v_new_role = 'admin' THEN '{}'::jsonb ELSE COALESCE(p_features, '{}'::jsonb) END,
      updated_at = NOW(),
      updated_by = auth.uid()
  WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_user_access(UUID, TEXT, JSONB) TO authenticated;

-- ----------------------------------------------------------------------------
-- 13. RPC: update_company_features (admin liga/desliga features da empresa)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_company_features(
  p_features JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id UUID;
  v_key TEXT;
  v_value TEXT;
  v_catalog TEXT[] := public._feature_catalog();
  v_clean JSONB := '{}'::jsonb;
BEGIN
  v_empresa_id := public.get_user_empresa_id();

  IF NOT (public.has_role('admin') OR public.is_ultra_admin()) THEN
    RAISE EXCEPTION 'Apenas administradores podem editar features da empresa';
  END IF;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa';
  END IF;

  IF jsonb_typeof(p_features) <> 'object' THEN
    RAISE EXCEPTION 'features deve ser um objeto JSON';
  END IF;

  -- Sanitiza payload: só chaves do catálogo, valores boolean
  FOR v_key, v_value IN SELECT * FROM jsonb_each_text(p_features)
  LOOP
    IF NOT (v_key = ANY (v_catalog)) THEN
      CONTINUE;  -- ignora chaves desconhecidas
    END IF;
    IF v_value NOT IN ('true', 'false') THEN
      RAISE EXCEPTION 'Valor inválido para %: % (use boolean)', v_key, v_value;
    END IF;
    v_clean := v_clean || jsonb_build_object(v_key, (v_value = 'true'));
  END LOOP;

  UPDATE public.empresas
  SET features = v_clean,
      updated_at = NOW(),
      updated_by = auth.uid()
  WHERE id = v_empresa_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_company_features(JSONB) TO authenticated;
