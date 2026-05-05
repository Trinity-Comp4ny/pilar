-- =====================================================================
-- Cleanup user_role enum: remove valores legados
--
-- Antes: ('ultra_admin','admin','financeiro','marketing','operacional','user')
-- Depois: ('user','admin','ultra_admin')
--
-- Postgres não permite DROP de valor de enum. Estratégia:
--   1. Criar tipo novo `user_role_v2` com apenas (user, admin, ultra_admin)
--   2. Drop funções dependentes (has_role) — serão recriadas
--   3. ALTER colunas para o tipo novo, mapeando valores legados via CASE
--      (defensivo — verificação prévia confirmou ausência de dados legados)
--   4. DROP TYPE antigo, RENAME novo para `user_role`
--   5. Recriar has_role e start_impersonation
--
-- Pré-requisito (verificado): nenhuma linha em public.profiles ou
-- public.convites possui role/cargo legados.
-- =====================================================================

BEGIN;

-- 1. Tipo novo
CREATE TYPE public.user_role_v2 AS ENUM ('user', 'admin', 'ultra_admin');

-- 2. Drop funções/triggers que dependem do tipo da coluna
DROP FUNCTION IF EXISTS public.has_role(VARIADIC public.user_role[]);
-- Triggers que mencionam coluna `role` em UPDATE OF — precisam ser dropadas
-- antes do ALTER COLUMN TYPE, e recriadas depois (mesma definição).
DROP TRIGGER IF EXISTS validate_profile_features ON public.profiles;
DROP TRIGGER IF EXISTS protect_ultra_admin ON public.profiles;
DROP TRIGGER IF EXISTS validate_convite_features ON public.convites;

-- 3a. profiles.role: drop default, alterar tipo, restaurar default
ALTER TABLE public.profiles ALTER COLUMN role DROP DEFAULT;
ALTER TABLE public.profiles
  ALTER COLUMN role TYPE public.user_role_v2
  USING (
    CASE role::text
      WHEN 'ultra_admin' THEN 'ultra_admin'::public.user_role_v2
      WHEN 'admin'       THEN 'admin'::public.user_role_v2
      ELSE 'user'::public.user_role_v2
    END
  );
ALTER TABLE public.profiles
  ALTER COLUMN role SET DEFAULT 'user'::public.user_role_v2;

-- 3b. convites.cargo: idem
ALTER TABLE public.convites ALTER COLUMN cargo DROP DEFAULT;
ALTER TABLE public.convites
  ALTER COLUMN cargo TYPE public.user_role_v2
  USING (
    CASE cargo::text
      WHEN 'ultra_admin' THEN 'ultra_admin'::public.user_role_v2
      WHEN 'admin'       THEN 'admin'::public.user_role_v2
      ELSE 'user'::public.user_role_v2
    END
  );
ALTER TABLE public.convites
  ALTER COLUMN cargo SET DEFAULT 'user'::public.user_role_v2;

-- 4. Drop tipo antigo, renomear novo
DROP TYPE public.user_role;
ALTER TYPE public.user_role_v2 RENAME TO user_role;

-- 5. Recriar has_role (assinatura idêntica, agora sobre o enum novo)
CREATE OR REPLACE FUNCTION public.has_role(VARIADIC allowed_roles public.user_role[])
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role public.user_role;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  RETURN v_role = 'ultra_admin' OR v_role = ANY(allowed_roles);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.has_role(VARIADIC public.user_role[]) TO authenticated;

-- 5b. start_impersonation: validação aceitava roles legados.
--     Após cleanup, único target válido é 'user'.
CREATE OR REPLACE FUNCTION public.start_impersonation(
  p_target_role text,
  p_ip text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
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

  IF p_target_role IN ('admin', 'ultra_admin') THEN
    RAISE EXCEPTION 'Impersonation de admin/ultra_admin não permitido' USING ERRCODE = '42501';
  END IF;

  IF p_target_role NOT IN ('user') THEN
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

-- 6. Recriar triggers dropadas
CREATE TRIGGER validate_profile_features
  BEFORE INSERT OR UPDATE OF features, role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION tg_validate_profile_features();

CREATE TRIGGER protect_ultra_admin
  BEFORE INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION tg_protect_ultra_admin();

CREATE TRIGGER validate_convite_features
  BEFORE INSERT OR UPDATE OF features, cargo ON public.convites
  FOR EACH ROW EXECUTE FUNCTION tg_validate_convite_features();

COMMIT;
