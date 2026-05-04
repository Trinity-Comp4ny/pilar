-- ultra_admin deve ter acesso irrestrito — incluir no has_role
CREATE OR REPLACE FUNCTION public.has_role(VARIADIC allowed_roles user_role[])
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role user_role;
BEGIN
  SELECT role INTO user_role FROM public.profiles WHERE id = auth.uid();
  RETURN user_role = 'ultra_admin' OR user_role = ANY(allowed_roles);
END;
$$;
