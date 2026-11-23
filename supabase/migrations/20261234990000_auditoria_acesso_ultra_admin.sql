-- Auditoria do acesso do ultra_admin a dados de OUTRA empresa. Direção do dono
-- (23/11/2026): o ultra_admin enxerga e controla tudo, e cada ação cross-tenant
-- deixa rastro em admin_audit_logs (categoria acesso_cross_tenant).
--
-- Cobre as RPCs e edge functions com bypass. Leitura direta via RLS (policies
-- permissivas do ultra_admin) NÃO é registrada: o Postgres não loga SELECT por policy.

ALTER TABLE public.admin_audit_logs DROP CONSTRAINT IF EXISTS admin_audit_logs_category_check;
ALTER TABLE public.admin_audit_logs ADD CONSTRAINT admin_audit_logs_category_check
  CHECK (category = ANY (ARRAY['user', 'empresa', 'member', 'billing', 'impersonation', 'acesso_cross_tenant']));

-- Registra a ação quando o chamador é ultra_admin (com MFA) agindo em empresa que não é a dele.
-- Para qualquer outro chamador, ou para a própria empresa, não faz nada.
CREATE OR REPLACE FUNCTION public.registrar_acesso_ultra_admin(
  p_empresa_alvo uuid,
  p_action text,
  p_target_type text DEFAULT NULL,
  p_target_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  IF NOT public.is_ultra_admin() THEN
    RETURN;
  END IF;
  IF p_empresa_alvo IS NULL OR p_empresa_alvo IS NOT DISTINCT FROM public.get_user_empresa_id() THEN
    RETURN;
  END IF;

  SELECT email INTO v_email FROM public.profiles WHERE id = auth.uid();

  INSERT INTO public.admin_audit_logs
    (actor_id, actor_email, actor_role, action, category, target_type, target_id, empresa_id, metadata)
  VALUES
    (auth.uid(), COALESCE(v_email, 'desconhecido'), 'ultra_admin', p_action, 'acesso_cross_tenant',
     p_target_type, p_target_id, p_empresa_alvo, COALESCE(p_metadata, '{}'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_acesso_ultra_admin(uuid, text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_acesso_ultra_admin(uuid, text, text, text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.campo_listar_contas_obra(p_obra_id uuid)
RETURNS SETOF json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_empresa uuid;
BEGIN
  IF NOT (public.has_role('admin', 'coordenador') OR public.is_ultra_admin()) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  IF public.is_ultra_admin() THEN
    SELECT o.empresa_id INTO v_empresa FROM obras o WHERE o.id = p_obra_id;
  ELSE
    SELECT o.empresa_id INTO v_empresa FROM obras o
    WHERE o.id = p_obra_id AND o.empresa_id = public.get_user_empresa_id();
  END IF;

  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'Obra não encontrada';
  END IF;

  PERFORM public.registrar_acesso_ultra_admin(v_empresa, 'campo_listar_contas_obra', 'obra', p_obra_id::text);

  RETURN QUERY
  SELECT json_build_object(
    'id', ca.id,
    'nome', ca.nome,
    'email', ca.email,
    'login_gerado', ca.login_gerado,
    'ativo', ca.ativo,
    'ultimo_acesso', ca.ultimo_acesso,
    'convite_pendente', ca.convite_token_hash IS NOT NULL AND ca.convite_expira_em > now()
  )
  FROM campo_accounts ca
  WHERE ca.obra_id = p_obra_id
    AND ca.empresa_id = v_empresa
  ORDER BY ca.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.campo_listar_contas_obra(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.campo_listar_contas_obra(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.campo_revogar_acesso(p_account_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_empresa uuid;
BEGIN
  IF NOT (public.has_role('admin', 'coordenador') OR public.is_ultra_admin()) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  UPDATE campo_accounts
  SET ativo = false,
      updated_at = now()
  WHERE id = p_account_id
    AND (public.is_ultra_admin() OR empresa_id = public.get_user_empresa_id())
  RETURNING empresa_id INTO v_empresa;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acesso não encontrado';
  END IF;

  PERFORM public.registrar_acesso_ultra_admin(v_empresa, 'campo_revogar_acesso', 'campo_account', p_account_id::text);
END;
$$;

REVOKE ALL ON FUNCTION public.campo_revogar_acesso(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.campo_revogar_acesso(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
