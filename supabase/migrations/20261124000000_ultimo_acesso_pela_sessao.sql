-- Último acesso do portal ultra admin pela sessão, não pelo login.
--
-- auth.users.last_sign_in_at só muda em login explícito (senha, link, OTP). Quem
-- fica logado renova o token por semanas sem passar por ali: o Bruno (VRZ)
-- aparecia com "último acesso há 15 dias" tendo usado o Pilar no mesmo dia.
-- auth.sessions.refreshed_at muda a cada renovação do token (a cada ~1 h de uso),
-- então o maior valor por usuário é o último momento em que ele estava no app.
--
-- Só a service_role chama (as edges ultra-admin-*, que já checam o papel).

CREATE OR REPLACE FUNCTION public.ops_ultimo_acesso_usuarios()
RETURNS TABLE (user_id uuid, ultimo_acesso timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
  SELECT s.user_id, max(coalesce(s.refreshed_at, s.updated_at, s.created_at))
  FROM auth.sessions s
  GROUP BY s.user_id;
$$;

REVOKE ALL ON FUNCTION public.ops_ultimo_acesso_usuarios() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ops_ultimo_acesso_usuarios() TO service_role;
