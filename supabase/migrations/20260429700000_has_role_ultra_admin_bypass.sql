-- ultra_admin deve ter acesso a tudo que admin tem acesso.
-- A função has_role() é usada em ~120 policies RLS; ao retornar true para
-- ultra_admin em qualquer chamada, todas as policies são corrigidas de uma vez.

CREATE OR REPLACE FUNCTION public.has_role(VARIADIC allowed_roles public.user_role[])
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.user_role;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  -- ultra_admin tem bypass total: passa em qualquer verificação de role
  RETURN v_role = 'ultra_admin' OR v_role = ANY(allowed_roles);
END;
$$;
