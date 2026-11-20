CREATE FUNCTION public.revogar_link_proposta(p_versao_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v proposta_versoes%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT coalesce(user_has_feature('propostas', 'editor'), false)
     OR NOT coalesce(can_view_financeiro(), false) THEN
    RAISE EXCEPTION 'Sem permissão para revogar links de propostas' USING ERRCODE = '42501';
  END IF;

  -- O mesmo lock usado para publicar e aceitar serializa a revogação.
  PERFORM p.id FROM propostas p JOIN proposta_versoes pv ON pv.proposta_id = p.id AND pv.empresa_id = p.empresa_id
  WHERE pv.id = p_versao_id AND p.empresa_id = get_user_empresa_id() AND p.deleted_at IS NULL FOR UPDATE OF p;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Versão indisponível' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO STRICT v FROM proposta_versoes WHERE id = p_versao_id;
  IF v.aceita_em IS NOT NULL THEN
    RAISE EXCEPTION 'O link de uma versão aceita fica no histórico' USING ERRCODE = '22023';
  END IF;
  IF v.link_token IS NULL THEN RETURN false; END IF;
  UPDATE proposta_versoes SET link_token = NULL WHERE id = p_versao_id;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.revogar_link_proposta(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revogar_link_proposta(uuid) TO authenticated;
