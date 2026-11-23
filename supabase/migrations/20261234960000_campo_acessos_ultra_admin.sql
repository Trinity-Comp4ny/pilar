-- Pilar Campo: o ultra_admin (com MFA, via is_ultra_admin()) lista e revoga acessos
-- de campo de qualquer empresa. Direção do dono (23/11/2026): o ultra_admin
-- enxerga e controla tudo. Quem não é ultra_admin segue preso à própria empresa.

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

  -- Ultra_admin usa a empresa dona da obra; os demais, a própria.
  IF public.is_ultra_admin() THEN
    SELECT o.empresa_id INTO v_empresa FROM obras o WHERE o.id = p_obra_id;
  ELSE
    SELECT o.empresa_id INTO v_empresa FROM obras o
    WHERE o.id = p_obra_id AND o.empresa_id = public.get_user_empresa_id();
  END IF;

  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'Obra não encontrada';
  END IF;

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
BEGIN
  IF NOT (public.has_role('admin', 'coordenador') OR public.is_ultra_admin()) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  UPDATE campo_accounts
  SET ativo = false,
      updated_at = now()
  WHERE id = p_account_id
    AND (public.is_ultra_admin() OR empresa_id = public.get_user_empresa_id());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acesso não encontrado';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.campo_revogar_acesso(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.campo_revogar_acesso(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
