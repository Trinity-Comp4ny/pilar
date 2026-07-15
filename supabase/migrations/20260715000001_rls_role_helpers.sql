-- =====================================================================
-- Helpers de RLS + contrato dos 3 perfis de acesso do ICP.
--
-- Endurece o modelo existente (multi-tenant por empresa_id + permissões
-- feature-based, ADRs 0001/0005). NÃO reescreve as policies existentes.
--
-- Entrega:
--   1. get_user_role() / my_empresa_id()  — helpers SECURITY DEFINER STABLE
--      (nomes do contrato compartilhado; espelham o padrão dos repos internos)
--   2. has_role()        — owner passa a ser equivalente a admin (ops admin)
--   3. user_has_feature()— owner enxerga todos os módulos da empresa
--   4. can_view_financeiro() / can_view_folha() — predicados do contrato
--   5. set_access_profile()— aplica um dos 3 perfis prontos (role + features)
--   6. sync role → auth.users.app_metadata.role (conveniência p/ o JWT;
--      a AUTORIZAÇÃO continua sendo resolvida NO BANCO, nunca no metadata)
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Helpers de identidade
-- ---------------------------------------------------------------------

-- Papel do usuário atual (texto). NULL se não houver profile.
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role::text FROM public.profiles WHERE id = auth.uid();
$$;

-- Empresa do usuário atual. Alias canônico de get_user_empresa_id()
-- (mantido para o contrato compartilhado; a implementação é a mesma).
CREATE OR REPLACE FUNCTION public.my_empresa_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT empresa_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_empresa_id() TO authenticated;

-- ---------------------------------------------------------------------
-- 2. has_role: owner é equivalente a admin para operações administrativas.
--    ultra_admin mantém bypass. Papéis legados (user/admin) inalterados.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_role(VARIADIC allowed_roles public.user_role[])
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_role public.user_role;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  RETURN v_role = 'ultra_admin'
     OR v_role = ANY(allowed_roles)
     OR (v_role = 'owner' AND 'admin' = ANY(allowed_roles));
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_role(VARIADIC public.user_role[]) TO authenticated;

-- ---------------------------------------------------------------------
-- 3. user_has_feature: owner enxerga todos os módulos que a empresa tem
--    habilitados (sem depender de features granulares no profile).
--    coordenador/colaborador caem na mesma regra granular de 'user' —
--    logo, sem a feature 'financeiro'/'pessoas' no preset, não veem dinheiro.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_has_feature(p_feature text, p_min_level text DEFAULT 'viewer')
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
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

  -- Owner: vê todos os módulos que a empresa tem habilitados (bypass do
  -- gate granular por profile). Ainda respeita o toggle da empresa.
  IF v_role = 'owner' THEN
    IF p_feature <> 'dashboard'
       AND COALESCE((v_empresa_features ->> p_feature)::BOOLEAN, FALSE) = FALSE THEN
      RETURN FALSE;
    END IF;
    RETURN TRUE;
  END IF;

  -- Empresa precisa ter feature ativa (exceto core 'dashboard' que é universal)
  IF p_feature <> 'dashboard'
     AND COALESCE((v_empresa_features ->> p_feature)::BOOLEAN, FALSE) = FALSE THEN
    RETURN FALSE;
  END IF;

  -- admin / user / coordenador / colaborador: regra granular por profile.
  v_user_level := v_profile_features ->> p_feature;

  IF v_user_level IS NULL THEN
    RETURN FALSE;
  END IF;

  IF p_min_level = 'viewer' THEN
    RETURN v_user_level IN ('viewer', 'editor');
  ELSE
    RETURN v_user_level = 'editor';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.user_has_feature(text, text) TO authenticated;

-- ---------------------------------------------------------------------
-- 4. Predicados do contrato — coarse gate por PAPEL.
--    Uso principal: esconder financeiro/folha na UI. A visibilidade fina
--    continua sendo feature-based (RLS). coordenador/colaborador nunca veem
--    dinheiro; owner/admin/ultra_admin/user(legado) passam no gate de papel.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_view_financeiro()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT role NOT IN ('coordenador', 'colaborador')
       FROM public.profiles WHERE id = auth.uid()),
    FALSE
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_folha()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT role IN ('owner', 'admin', 'ultra_admin')
       FROM public.profiles WHERE id = auth.uid()),
    FALSE
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_view_financeiro() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_folha() TO authenticated;

-- ---------------------------------------------------------------------
-- 5. set_access_profile: aplica um dos 3 perfis prontos a um usuário.
--    Gated por admin/owner/ultra_admin. Escopo: mesma empresa do caller
--    (ultra_admin cruza empresas). Não mexe em ultra_admin nem promove a ele.
--    O preset de features é interseccionado com o que a empresa tem habilitado
--    para não bater no trigger de validação (tg_validate_profile_features).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_access_profile(p_user_id uuid, p_perfil text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_role   public.user_role;
  v_caller_emp    uuid;
  v_target_emp    uuid;
  v_target_role   public.user_role;
  v_preset        jsonb;
  v_empresa_feat  jsonb;
  v_final         jsonb := '{}'::jsonb;
  v_key           text;
  v_lvl           text;
BEGIN
  IF p_perfil NOT IN ('owner', 'coordenador', 'colaborador') THEN
    RAISE EXCEPTION 'Perfil inválido: %', p_perfil USING ERRCODE = '22023';
  END IF;

  SELECT role, empresa_id INTO v_caller_role, v_caller_emp
  FROM public.profiles WHERE id = auth.uid();

  IF v_caller_role IS NULL
     OR v_caller_role NOT IN ('admin', 'owner', 'ultra_admin') THEN
    RAISE EXCEPTION 'Apenas admin/owner podem definir perfis de acesso'
      USING ERRCODE = '42501';
  END IF;

  -- Conceder 'owner' é escalada vertical (owner enxerga financeiro/folha via
  -- bypass do gate granular): exige que o caller JÁ seja owner ou ultra_admin.
  -- Um admin comum NÃO pode cunhar owner (nem promover a si mesmo).
  IF p_perfil = 'owner' AND v_caller_role NOT IN ('owner', 'ultra_admin') THEN
    RAISE EXCEPTION 'Conceder o perfil owner requer ser owner ou ultra_admin'
      USING ERRCODE = '42501';
  END IF;

  SELECT role, empresa_id INTO v_target_role, v_target_emp
  FROM public.profiles WHERE id = p_user_id;

  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado' USING ERRCODE = '22023';
  END IF;

  -- Escopo de empresa (ultra_admin cruza).
  IF v_caller_role <> 'ultra_admin' AND v_target_emp IS DISTINCT FROM v_caller_emp THEN
    RAISE EXCEPTION 'Usuário de outra empresa' USING ERRCODE = '42501';
  END IF;

  -- Não rebaixa/altera ultra_admin por esta via.
  IF v_target_role = 'ultra_admin' THEN
    RAISE EXCEPTION 'Não é possível alterar o perfil de um ultra_admin'
      USING ERRCODE = '42501';
  END IF;

  -- Preset de features por perfil (owner usa {} — acesso vem do papel).
  v_preset := CASE p_perfil
    WHEN 'owner' THEN '{}'::jsonb
    WHEN 'coordenador' THEN jsonb_build_object(
      'dashboard', 'viewer', 'relatorios', 'viewer',
      'projetos', 'editor', 'leads', 'editor', 'propostas', 'editor',
      'clientes', 'editor', 'mapa', 'viewer', 'planejamento', 'editor'
    )
    WHEN 'colaborador' THEN jsonb_build_object(
      'dashboard', 'viewer', 'projetos', 'viewer', 'timesheet', 'editor'
    )
  END;

  -- Intersecção com os módulos que a empresa tem habilitados.
  SELECT e.features INTO v_empresa_feat
  FROM public.empresas e WHERE e.id = v_target_emp;

  FOR v_key, v_lvl IN SELECT * FROM jsonb_each_text(v_preset)
  LOOP
    IF v_key = 'dashboard'
       OR COALESCE((v_empresa_feat ->> v_key)::boolean, FALSE) THEN
      v_final := v_final || jsonb_build_object(v_key, v_lvl);
    END IF;
  END LOOP;

  UPDATE public.profiles
  SET role = p_perfil::public.user_role,
      features = v_final
  WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_access_profile(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------
-- 6. Sincroniza profiles.role → auth.users.raw_app_meta_data.role
--    para o papel viajar no JWT (app_metadata é read-only pro cliente).
--    CONVENIÊNCIA apenas: nenhuma decisão de autorização deve confiar no
--    metadata do token — o gate real é resolvido no banco (admin-auth.ts,
--    has_role, RLS). Evita a classe do bug SEC-11.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_sync_role_to_app_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Nunca deixar a sincronização (conveniência) derrubar o fluxo de signup/update.
  BEGIN
    UPDATE auth.users
    SET raw_app_meta_data =
      COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', NEW.role::text)
    WHERE id = NEW.id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[sync_role_to_app_metadata] falha ao sincronizar role para %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_role_to_app_metadata ON public.profiles;
CREATE TRIGGER sync_role_to_app_metadata
  AFTER INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_sync_role_to_app_metadata();

-- Backfill único do metadata para profiles já existentes.
UPDATE auth.users u
SET raw_app_meta_data =
  COALESCE(u.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', p.role::text)
FROM public.profiles p
WHERE p.id = u.id
  AND COALESCE(u.raw_app_meta_data ->> 'role', '') IS DISTINCT FROM p.role::text;

-- ---------------------------------------------------------------------
-- 7. Endurece tg_protect_ultra_admin: além de ultra_admin, conceder 'owner'
--    por UPDATE/INSERT direto de usuário comum também é bloqueado (owner é
--    mais poderoso que admin — bypassa o gate de features). Só owner/ultra_admin
--    concedem owner. postgres/supabase_admin/service_role continuam com bypass
--    (migrations, edge functions e o set_access_profile já auto-validam).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_protect_ultra_admin()
RETURNS trigger
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

  -- Conceder 'owner' exige que o caller já seja owner ou ultra_admin.
  IF (TG_OP = 'INSERT' AND NEW.role = 'owner')
     OR (TG_OP = 'UPDATE' AND NEW.role = 'owner' AND OLD.role IS DISTINCT FROM 'owner') THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'ultra_admin')
    ) THEN
      RAISE EXCEPTION 'Conceder o perfil owner requer ser owner ou ultra_admin';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
