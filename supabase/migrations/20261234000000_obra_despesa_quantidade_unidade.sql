-- Custo por item na conta da obra: a despesa passa a registrar quantidade e unidade
-- (ex.: "Parafuso sextavado", 200 un, R$ 340 na Balarotti). O item continua sendo a descrição;
-- o preço unitário se deriva (valor / quantidade). Sem composição de custo nem curva ABC (spec 016).
--
-- A RPC ganha dois parâmetros, então é DROP + CREATE explícito: CREATE OR REPLACE criaria um
-- overload (feedback_supabase_function_overload). Corpo igual ao da 20261015000000 (ADR 0046).

ALTER TABLE public.obra_conta_lancamento
  ADD COLUMN IF NOT EXISTS quantidade numeric(14,3),
  ADD COLUMN IF NOT EXISTS unidade text;

ALTER TABLE public.obra_conta_lancamento
  DROP CONSTRAINT IF EXISTS obra_conta_lancamento_quantidade_positiva;
ALTER TABLE public.obra_conta_lancamento
  ADD CONSTRAINT obra_conta_lancamento_quantidade_positiva CHECK (quantidade IS NULL OR quantidade > 0);

DROP FUNCTION IF EXISTS public.rpc_obra_despesa_salvar(uuid, date, text, numeric, uuid, uuid, uuid, text, text, boolean);

CREATE FUNCTION public.rpc_obra_despesa_salvar(p_obra_id uuid, p_data date, p_descricao text, p_valor numeric, p_id uuid DEFAULT NULL::uuid, p_obra_frente_id uuid DEFAULT NULL::uuid, p_fornecedor_id uuid DEFAULT NULL::uuid, p_pago_por text DEFAULT 'cliente'::text, p_comprovante_url text DEFAULT NULL::text, p_confirmada_portal boolean DEFAULT true, p_quantidade numeric DEFAULT NULL::numeric, p_unidade text DEFAULT NULL::text)
 RETURNS obra_conta_lancamento
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa    uuid := public.get_user_empresa_id();
  v_obra       public.obras;
  v_lanc       public.obra_conta_lancamento;
  v_cliente    uuid;
  v_taxa_valor numeric(14,2);
BEGIN
  -- ADR 0046: dinheiro exige can_view_financeiro() (admin ou financeiro_delegado).
  -- O filtro por empresa abaixo isola tenants, mas não papéis dentro da empresa.
  IF NOT public.can_view_financeiro() THEN
    RAISE EXCEPTION 'Sem acesso ao financeiro' USING ERRCODE = '42501';
  END IF;
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

  IF p_quantidade IS NOT NULL AND p_quantidade <= 0 THEN
    RAISE EXCEPTION 'quantidade inválida';
  END IF;

  IF p_pago_por IS NOT NULL AND p_pago_por NOT IN ('cliente', 'escritorio_reembolsavel') THEN
    RAISE EXCEPTION 'pago_por inválido';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.obra_conta_lancamento (
      empresa_id, obra_id, tipo, data, descricao, valor,
      obra_frente_id, fornecedor_id, pago_por, comprovante_url, confirmada_portal, created_by,
      quantidade, unidade
    ) VALUES (
      v_empresa, p_obra_id, 'despesa', p_data, p_descricao, p_valor,
      p_obra_frente_id, p_fornecedor_id, COALESCE(p_pago_por, 'cliente'), p_comprovante_url,
      COALESCE(p_confirmada_portal, true), auth.uid(),
      p_quantidade, NULLIF(btrim(p_unidade), '')
    )
    RETURNING * INTO v_lanc;
  ELSE
    UPDATE public.obra_conta_lancamento SET
      data = p_data, descricao = p_descricao, valor = p_valor,
      obra_frente_id = p_obra_frente_id, fornecedor_id = p_fornecedor_id,
      pago_por = COALESCE(p_pago_por, 'cliente'), comprovante_url = p_comprovante_url,
      confirmada_portal = COALESCE(p_confirmada_portal, true),
      quantidade = p_quantidade, unidade = NULLIF(btrim(p_unidade), ''),
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
$function$;

REVOKE ALL ON FUNCTION public.rpc_obra_despesa_salvar(uuid, date, text, numeric, uuid, uuid, uuid, text, text, boolean, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_obra_despesa_salvar(uuid, date, text, numeric, uuid, uuid, uuid, text, text, boolean, numeric, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
