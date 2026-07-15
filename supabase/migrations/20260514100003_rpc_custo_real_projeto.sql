-- Migration: RPC custo real de um projeto
--
-- Retorna:
--   custo_estimado       — soma de projeto_orcamento_fases.custo_estimado (GENERATED)
--   despesas_diretas     — soma de despesas vinculadas ao projeto (Pago + Pendente)
--   custo_total_estimado — soma dos dois acima
--   fonte                — 'estimativa' até timesheet ser reativado
--
-- Validação: apenas o owner do projeto (mesma empresa_id) pode chamar.

DROP FUNCTION IF EXISTS public.rpc_custo_real_projeto(UUID);

CREATE OR REPLACE FUNCTION public.rpc_custo_real_projeto(p_projeto_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id      UUID;
  v_custo_estimado  DECIMAL;
  v_despesas_diretas DECIMAL;
BEGIN
  -- Busca empresa_id e valida acesso
  SELECT p.empresa_id INTO v_empresa_id
  FROM public.projetos p
  WHERE p.id = p_projeto_id
    AND p.deleted_at IS NULL;

  IF v_empresa_id IS NULL OR v_empresa_id != public.get_user_empresa_id() THEN
    RAISE EXCEPTION 'Projeto não encontrado ou acesso negado';
  END IF;

  -- Custo estimado a partir das fases de orçamento (custo_estimado é coluna GENERATED)
  SELECT COALESCE(SUM(pof.custo_estimado), 0) INTO v_custo_estimado
  FROM public.projeto_orcamento_fases pof
  WHERE pof.projeto_id = p_projeto_id
    AND pof.deleted_at IS NULL;

  -- Despesas diretas vinculadas ao projeto (excluindo pagamentos de fatura)
  SELECT COALESCE(SUM(d.valor), 0) INTO v_despesas_diretas
  FROM public.despesas d
  WHERE d.projeto_id = p_projeto_id
    AND d.deleted_at IS NULL
    AND d.is_fatura_payment = false
    AND d.status IN ('Pago', 'Pendente');

  RETURN jsonb_build_object(
    'custo_estimado',       v_custo_estimado,
    'despesas_diretas',     v_despesas_diretas,
    'custo_total_estimado', v_custo_estimado + v_despesas_diretas,
    -- Será 'timesheet' quando o módulo for reativado e as horas reais forem somadas
    'fonte', 'estimativa'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_custo_real_projeto(UUID) TO authenticated;
