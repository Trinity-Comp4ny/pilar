-- "Ver como admin": libera o ultra_admin a visualizar como admin da empresa.
--
-- Regra: ultra_admin pode ter alvo 'user' OU 'admin'. admin comum segue só 'user'
-- (impersonar admin seria escalonamento lateral). ultra_admin como alvo continua
-- proibido para qualquer caller. current_effective_role() já devolve o target_role
-- da sessão, então a RLS e o front (usePermissions.effectiveRole) passam a ver a
-- sessão como admin enquanto ela durar.
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
