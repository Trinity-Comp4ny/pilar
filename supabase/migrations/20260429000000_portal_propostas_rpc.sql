-- RPCs para o portal do cliente visualizar e responder propostas

-- Retorna propostas do cliente dono do token (apenas status != rascunho e não deletadas)
CREATE OR REPLACE FUNCTION public.get_portal_propostas(p_token text)
RETURNS TABLE (
  id uuid,
  codigo text,
  titulo text,
  valor_proposto numeric,
  prazo_estimado_dias integer,
  localizacao text,
  area_m2 numeric,
  validade date,
  status text,
  observacao text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id uuid;
BEGIN
  SELECT pt.cliente_id INTO v_cliente_id
  FROM portal_tokens pt
  WHERE pt.token = p_token
    AND pt.ativo = true
    AND (pt.expira_em IS NULL OR pt.expira_em > now());

  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Token inválido ou expirado';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.codigo,
    p.titulo,
    p.valor_proposto,
    p.prazo_estimado_dias,
    p.localizacao,
    p.area_m2,
    p.validade,
    p.status,
    p.observacao,
    p.created_at
  FROM propostas p
  WHERE p.cliente_id = v_cliente_id
    AND p.deleted_at IS NULL
    AND p.status != 'rascunho'
  ORDER BY p.created_at DESC;
END;
$$;

-- Atualiza status de proposta via token do portal (só aceita → aceita/recusada)
CREATE OR REPLACE FUNCTION public.portal_atualizar_status_proposta(
  p_token text,
  p_proposta_id uuid,
  p_status text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id uuid;
  v_empresa_id uuid;
  v_proposta_status text;
BEGIN
  IF p_status NOT IN ('aceita', 'recusada') THEN
    RAISE EXCEPTION 'Status inválido: apenas aceita ou recusada são permitidos';
  END IF;

  SELECT pt.cliente_id, pt.empresa_id INTO v_cliente_id, v_empresa_id
  FROM portal_tokens pt
  WHERE pt.token = p_token
    AND pt.ativo = true
    AND (pt.expira_em IS NULL OR pt.expira_em > now());

  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Token inválido ou expirado';
  END IF;

  SELECT p.status INTO v_proposta_status
  FROM propostas p
  WHERE p.id = p_proposta_id
    AND p.cliente_id = v_cliente_id
    AND p.deleted_at IS NULL;

  IF v_proposta_status IS NULL THEN
    RAISE EXCEPTION 'Proposta não encontrada';
  END IF;

  IF v_proposta_status != 'enviada' THEN
    RAISE EXCEPTION 'Apenas propostas com status "enviada" podem ser aceitas ou recusadas';
  END IF;

  UPDATE propostas
  SET status = p_status, updated_at = now()
  WHERE id = p_proposta_id;

  RETURN json_build_object('ok', true, 'status', p_status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_portal_propostas(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_atualizar_status_proposta(text, uuid, text) TO anon, authenticated;
