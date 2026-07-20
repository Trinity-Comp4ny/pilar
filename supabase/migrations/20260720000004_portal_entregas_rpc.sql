-- ACH-PORT-01 + ACH-PORT-03: o cliente do portal não é usuário Supabase (auth por
-- token próprio), então a policy portal_entregas_manage (staff + feature) nunca
-- casa para ele. Efeitos: listar entregas falha (PORT-01) e aprovar/solicitar
-- revisão dá toast de sucesso mas o UPDATE afeta 0 linhas (PORT-03).
--
-- Fix: RPCs SECURITY DEFINER que validam o session_token via
-- portal_verify_session_readonly e escopam pelo CLIENTE do token (não só pela
-- empresa — senão um cliente veria entregas de outro cliente da mesma empresa).

-- Listar entregas de um projeto do cliente do token.
CREATE OR REPLACE FUNCTION public.portal_listar_entregas(p_token TEXT, p_projeto_id UUID)
RETURNS SETOF public.portal_entregas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_session JSON;
  v_cliente_id UUID;
BEGIN
  v_session := portal_verify_session_readonly(p_token);
  IF v_session IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida ou expirada';
  END IF;
  v_cliente_id := (v_session->>'cliente_id')::uuid;

  RETURN QUERY
  SELECT e.*
  FROM portal_entregas e
  JOIN projetos p ON p.id = e.projeto_id
  WHERE e.projeto_id = p_projeto_id
    AND p.cliente_id = v_cliente_id
  ORDER BY e.created_at ASC;
END;
$$;

-- Aprovar um entregável (só se pertence a um projeto do cliente do token).
CREATE OR REPLACE FUNCTION public.portal_aprovar_entrega(p_token TEXT, p_entrega_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_session JSON;
  v_cliente_id UUID;
  v_ok BOOLEAN;
BEGIN
  v_session := portal_verify_session_readonly(p_token);
  IF v_session IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida ou expirada';
  END IF;
  v_cliente_id := (v_session->>'cliente_id')::uuid;

  UPDATE portal_entregas e
  SET status = 'aprovado', respondido_em = NOW()
  FROM projetos p
  WHERE e.id = p_entrega_id
    AND p.id = e.projeto_id
    AND p.cliente_id = v_cliente_id
    AND e.status = 'pendente';

  GET DIAGNOSTICS v_ok = ROW_COUNT;
  IF v_ok = 0 THEN
    RAISE EXCEPTION 'Entregável não encontrado, já respondido, ou fora do seu acesso';
  END IF;
END;
$$;

-- Solicitar revisão de um entregável.
CREATE OR REPLACE FUNCTION public.portal_solicitar_revisao_entrega(
  p_token TEXT, p_entrega_id UUID, p_resposta TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_session JSON;
  v_cliente_id UUID;
  v_ok BOOLEAN;
BEGIN
  IF p_resposta IS NULL OR btrim(p_resposta) = '' THEN
    RAISE EXCEPTION 'Descreva o que precisa ser revisado';
  END IF;

  v_session := portal_verify_session_readonly(p_token);
  IF v_session IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida ou expirada';
  END IF;
  v_cliente_id := (v_session->>'cliente_id')::uuid;

  UPDATE portal_entregas e
  SET status = 'revisao_solicitada',
      resposta_cliente = btrim(p_resposta),
      respondido_em = NOW()
  FROM projetos p
  WHERE e.id = p_entrega_id
    AND p.id = e.projeto_id
    AND p.cliente_id = v_cliente_id
    AND e.status = 'pendente';

  GET DIAGNOSTICS v_ok = ROW_COUNT;
  IF v_ok = 0 THEN
    RAISE EXCEPTION 'Entregável não encontrado, já respondido, ou fora do seu acesso';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.portal_listar_entregas(TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.portal_aprovar_entrega(TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.portal_solicitar_revisao_entrega(TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_listar_entregas(TEXT, UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.portal_aprovar_entrega(TEXT, UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.portal_solicitar_revisao_entrega(TEXT, UUID, TEXT) TO anon, authenticated, service_role;
