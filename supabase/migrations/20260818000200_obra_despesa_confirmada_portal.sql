-- Fase 3 da spec 030: a despesa passa a carregar confirmada_portal explícito.
-- O sócio pode "segurar" uma despesa em conferência (confirmada_portal = false)
-- no ato do lançamento, em vez de só herdar o default true da coluna.
--
-- A RPC ganha um parâmetro novo (p_confirmada_portal). Como isso muda a assinatura,
-- é DROP + CREATE explícito (CREATE OR REPLACE criaria overload — ver
-- feedback_supabase_function_overload). Corpo idêntico ao 20260731000000, só com o
-- campo novo no INSERT/UPDATE.

DROP FUNCTION IF EXISTS public.rpc_obra_despesa_salvar(uuid, date, text, numeric, uuid, uuid, uuid, text, text);

CREATE FUNCTION public.rpc_obra_despesa_salvar(
  p_obra_id         uuid,
  p_data            date,
  p_descricao       text,
  p_valor           numeric,
  p_id              uuid DEFAULT NULL,
  p_obra_frente_id  uuid DEFAULT NULL,
  p_fornecedor_id   uuid DEFAULT NULL,
  p_pago_por        text DEFAULT 'cliente',
  p_comprovante_url text DEFAULT NULL,
  p_confirmada_portal boolean DEFAULT true
)
RETURNS public.obra_conta_lancamento
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa    uuid := public.get_user_empresa_id();
  v_obra       public.obras;
  v_lanc       public.obra_conta_lancamento;
  v_cliente    uuid;
  v_taxa_valor numeric(14,2);
BEGIN
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'usuário sem empresa';
  END IF;
  IF p_valor IS NULL OR p_valor < 0 THEN
    RAISE EXCEPTION 'valor inválido';
  END IF;

  SELECT * INTO v_obra
  FROM public.obras
  WHERE id = p_obra_id AND empresa_id = v_empresa AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'obra inexistente ou de outra empresa';
  END IF;

  IF p_obra_frente_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.obra_frente
    WHERE id = p_obra_frente_id AND empresa_id = v_empresa
  ) THEN
    RAISE EXCEPTION 'frente inválida';
  END IF;

  IF p_fornecedor_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.fornecedores
    WHERE id = p_fornecedor_id AND empresa_id = v_empresa
  ) THEN
    RAISE EXCEPTION 'fornecedor inválido';
  END IF;

  IF p_pago_por IS NOT NULL AND p_pago_por NOT IN ('cliente', 'escritorio_reembolsavel') THEN
    RAISE EXCEPTION 'pago_por inválido';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.obra_conta_lancamento (
      empresa_id, obra_id, tipo, data, descricao, valor,
      obra_frente_id, fornecedor_id, pago_por, comprovante_url, confirmada_portal, created_by
    ) VALUES (
      v_empresa, p_obra_id, 'despesa', p_data, p_descricao, p_valor,
      p_obra_frente_id, p_fornecedor_id, COALESCE(p_pago_por, 'cliente'), p_comprovante_url,
      COALESCE(p_confirmada_portal, true), auth.uid()
    )
    RETURNING * INTO v_lanc;
  ELSE
    UPDATE public.obra_conta_lancamento SET
      data = p_data, descricao = p_descricao, valor = p_valor,
      obra_frente_id = p_obra_frente_id, fornecedor_id = p_fornecedor_id,
      pago_por = COALESCE(p_pago_por, 'cliente'), comprovante_url = p_comprovante_url,
      confirmada_portal = COALESCE(p_confirmada_portal, true),
      updated_by = auth.uid()
    WHERE id = p_id AND empresa_id = v_empresa AND deleted_at IS NULL AND tipo = 'despesa'
    RETURNING * INTO v_lanc;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'lançamento inexistente ou de outra empresa';
    END IF;
  END IF;

  -- Taxa de administração: só no modelo administracao e taxa > 0. Idempotente pelo
  -- vínculo obra_lancamento_origem_id (upsert; estorna se a taxa deixar de existir).
  IF v_obra.modelo_cobranca = 'administracao' AND COALESCE(v_obra.taxa_administracao_pct, 0) > 0 THEN
    v_taxa_valor := round(p_valor * v_obra.taxa_administracao_pct / 100, 2);
    SELECT cliente_id INTO v_cliente FROM public.projetos WHERE id = v_obra.projeto_id;

    UPDATE public.receitas SET
      valor = v_taxa_valor,
      descricao = 'Taxa de administração — ' || v_obra.nome,
      projeto_id = v_obra.projeto_id,
      cliente_id = v_cliente,
      data_vencimento = p_data,
      deleted_at = NULL,
      updated_by = auth.uid()
    WHERE obra_lancamento_origem_id = v_lanc.id;

    IF NOT FOUND THEN
      INSERT INTO public.receitas (
        empresa_id, descricao, valor, status, projeto_id, cliente_id,
        data_vencimento, obra_lancamento_origem_id, created_by
      ) VALUES (
        v_empresa, 'Taxa de administração — ' || v_obra.nome, v_taxa_valor, 'Pendente',
        v_obra.projeto_id, v_cliente, p_data, v_lanc.id, auth.uid()
      );
    END IF;
  ELSE
    UPDATE public.receitas SET deleted_at = now(), updated_by = auth.uid()
    WHERE obra_lancamento_origem_id = v_lanc.id AND deleted_at IS NULL;
  END IF;

  RETURN v_lanc;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_obra_despesa_salvar(uuid, date, text, numeric, uuid, uuid, uuid, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_obra_despesa_salvar(uuid, date, text, numeric, uuid, uuid, uuid, text, text, boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';
