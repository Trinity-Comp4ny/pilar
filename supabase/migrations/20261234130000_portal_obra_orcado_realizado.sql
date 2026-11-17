-- Relatório financeiro ao cliente: orçado x realizado da obra por fase, etapa e serviço (pedido do Naka: "onde
-- está indo cada centavo", linha por linha). Função NOVA e separada do get_cliente_obra_detail para não mexer no
-- contrato que o portal já usa.
--
-- Mesmo gate do detalhe da obra: sessão do portal válida e obra do cliente, em administração e visível no portal.
-- O realizado soma SÓ as despesas confirmadas para o portal (confirmada_portal = true): o que o gestor segurou em
-- conferência não aparece. Devolve o previsto e o realizado de cada nó; a soma de baixo para cima é do front.

CREATE OR REPLACE FUNCTION public.get_cliente_obra_orcamento(p_token text, p_obra_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_session     json;
  v_cliente_id  uuid;
  v_empresa_id  uuid;
  v_obra_id     uuid;
  v_linhas      json;
  v_sem_frente  numeric(14,2);
BEGIN
  v_session := public.portal_verify_session_readonly(p_token);
  IF v_session IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida';
  END IF;
  v_cliente_id := (v_session ->> 'cliente_id')::uuid;
  v_empresa_id := (v_session ->> 'empresa_id')::uuid;

  SELECT o.id INTO v_obra_id
  FROM public.obras o
  WHERE o.id = p_obra_id
    AND o.cliente_id = v_cliente_id
    AND o.empresa_id = v_empresa_id
    AND o.modelo_cobranca = 'administracao'
    AND o.visivel_portal = true
    AND o.deleted_at IS NULL;

  IF v_obra_id IS NULL THEN
    RAISE EXCEPTION 'Obra não encontrada';
  END IF;

  SELECT COALESCE(json_agg(json_build_object(
           'id', fr.id,
           'parent_id', fr.parent_id,
           'nivel', fr.nivel,
           'nome', fr.nome,
           'ordem', fr.ordem,
           'previsto', COALESCE(oe.valor_previsto, 0),
           'realizado', COALESCE(d.total, 0)
         ) ORDER BY fr.ordem, fr.nome), '[]'::json)
  INTO v_linhas
  FROM public.obra_frente fr
  LEFT JOIN public.obra_orcamento_etapa oe
    ON oe.obra_frente_id = fr.id AND oe.obra_id = fr.obra_id
  LEFT JOIN LATERAL (
    SELECT sum(l.valor) AS total
    FROM public.obra_conta_lancamento l
    WHERE l.obra_frente_id = fr.id
      AND l.tipo = 'despesa'
      AND l.confirmada_portal = true
      AND l.deleted_at IS NULL
  ) d ON true
  WHERE fr.obra_id = v_obra_id;

  SELECT COALESCE(sum(l.valor), 0) INTO v_sem_frente
  FROM public.obra_conta_lancamento l
  WHERE l.obra_id = v_obra_id
    AND l.obra_frente_id IS NULL
    AND l.tipo = 'despesa'
    AND l.confirmada_portal = true
    AND l.deleted_at IS NULL;

  RETURN json_build_object('linhas', v_linhas, 'sem_frente', v_sem_frente);
END;
$$;

REVOKE ALL ON FUNCTION public.get_cliente_obra_orcamento(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_cliente_obra_orcamento(text, uuid) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
