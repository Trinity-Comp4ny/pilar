-- SPEC 073 / ADR 0034: fase 2. Reescreve todas as policies de RLS que hoje
-- gateiam por user_has_feature('financeiro', ...) diretamente, trocando por
-- can_view_folha() (folha e PII) ou can_view_financeiro() (resto).
--
-- Estrutura de cada policy preservada 1:1 (empresa_id, deleted_at, USING/WITH
-- CHECK) em relação à última definição em produção; só o helper de permissão
-- muda. Nada de viewer/editor daqui pra frente: can_view_financeiro() e
-- can_view_folha() não têm nível, é um único degrau de acesso.

-- ==========================================================================
-- FOLHA DE PAGAMENTO: admin-only, sem exceção (última definição: 20260720000002)
-- ==========================================================================
DROP POLICY IF EXISTS folha_pagamento_select ON public.folha_pagamento;
CREATE POLICY folha_pagamento_select ON public.folha_pagamento
  FOR SELECT USING (
    empresa_id = get_user_empresa_id()
    AND public.can_view_folha()
  );

DROP POLICY IF EXISTS folha_pagamento_insert ON public.folha_pagamento;
CREATE POLICY folha_pagamento_insert ON public.folha_pagamento
  FOR INSERT WITH CHECK (
    empresa_id = get_user_empresa_id()
    AND public.can_view_folha()
  );

DROP POLICY IF EXISTS folha_pagamento_update ON public.folha_pagamento;
CREATE POLICY folha_pagamento_update ON public.folha_pagamento
  FOR UPDATE USING (
    empresa_id = get_user_empresa_id()
    AND public.can_view_folha()
  ) WITH CHECK (
    empresa_id = get_user_empresa_id()
    AND public.can_view_folha()
  );

DROP POLICY IF EXISTS folha_pagamento_delete ON public.folha_pagamento;
CREATE POLICY folha_pagamento_delete ON public.folha_pagamento
  FOR DELETE USING (
    empresa_id = get_user_empresa_id()
    AND public.can_view_folha()
  );

-- ==========================================================================
-- get_folha_pessoas_pii: CPF/PIX, mesmo padrão de folha (última definição: 20260822000000)
-- ==========================================================================
DROP FUNCTION IF EXISTS public.get_folha_pessoas_pii(uuid[]);
CREATE FUNCTION public.get_folha_pessoas_pii(p_ids uuid[])
 RETURNS TABLE(pessoa_id uuid, cpf text, chaves_pix jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_empresa_id uuid;
BEGIN
  v_empresa_id := public.get_user_empresa_id();

  IF v_empresa_id IS NULL OR NOT public.can_view_folha() THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT pe.id, pe.cpf, pe.chaves_pix
  FROM public.pessoas pe
  WHERE pe.id = ANY(p_ids)
    AND pe.empresa_id = v_empresa_id;
END;
$function$;

ALTER FUNCTION public.get_folha_pessoas_pii(uuid[]) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_folha_pessoas_pii(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_folha_pessoas_pii(uuid[]) TO authenticated;

-- ==========================================================================
-- FATURAS (última definição: select 20260720000002; insert/update/delete 20260504260000)
-- ==========================================================================
DROP POLICY IF EXISTS faturas_select ON public.faturas;
CREATE POLICY faturas_select ON public.faturas
  FOR SELECT USING (
    empresa_id = get_user_empresa_id()
    AND deleted_at IS NULL
    AND public.can_view_financeiro()
  );

DROP POLICY IF EXISTS faturas_insert ON public.faturas;
CREATE POLICY faturas_insert ON public.faturas
  FOR INSERT WITH CHECK (
    empresa_id = get_user_empresa_id()
    AND public.can_view_financeiro()
  );

DROP POLICY IF EXISTS faturas_update ON public.faturas;
CREATE POLICY faturas_update ON public.faturas
  FOR UPDATE USING (
    empresa_id = get_user_empresa_id()
    AND deleted_at IS NULL
    AND public.can_view_financeiro()
  ) WITH CHECK (
    empresa_id = get_user_empresa_id()
    AND public.can_view_financeiro()
  );

DROP POLICY IF EXISTS faturas_delete ON public.faturas;
CREATE POLICY faturas_delete ON public.faturas
  FOR DELETE USING (
    empresa_id = get_user_empresa_id()
    AND public.can_view_financeiro()
  );

-- ==========================================================================
-- TRANSFERENCIAS / CENTROS_CUSTO / LANCAMENTO_RATEIOS (última def: 20260720000002)
-- ==========================================================================
DROP POLICY IF EXISTS transferencias_select ON public.transferencias;
DROP POLICY IF EXISTS transferencias_insert ON public.transferencias;
DROP POLICY IF EXISTS transferencias_update ON public.transferencias;
DROP POLICY IF EXISTS transferencias_delete ON public.transferencias;
CREATE POLICY transferencias_select ON public.transferencias
  FOR SELECT USING (empresa_id = get_user_empresa_id() AND public.can_view_financeiro());
CREATE POLICY transferencias_insert ON public.transferencias
  FOR INSERT WITH CHECK (empresa_id = get_user_empresa_id() AND public.can_view_financeiro());
CREATE POLICY transferencias_update ON public.transferencias
  FOR UPDATE USING (empresa_id = get_user_empresa_id() AND public.can_view_financeiro())
  WITH CHECK (empresa_id = get_user_empresa_id() AND public.can_view_financeiro());
CREATE POLICY transferencias_delete ON public.transferencias
  FOR DELETE USING (empresa_id = get_user_empresa_id() AND public.can_view_financeiro());

DROP POLICY IF EXISTS centros_custo_select ON public.centros_custo;
DROP POLICY IF EXISTS centros_custo_insert ON public.centros_custo;
DROP POLICY IF EXISTS centros_custo_update ON public.centros_custo;
DROP POLICY IF EXISTS centros_custo_delete ON public.centros_custo;
CREATE POLICY centros_custo_select ON public.centros_custo
  FOR SELECT USING (empresa_id = get_user_empresa_id() AND public.can_view_financeiro());
CREATE POLICY centros_custo_insert ON public.centros_custo
  FOR INSERT WITH CHECK (empresa_id = get_user_empresa_id() AND public.can_view_financeiro());
CREATE POLICY centros_custo_update ON public.centros_custo
  FOR UPDATE USING (empresa_id = get_user_empresa_id() AND public.can_view_financeiro())
  WITH CHECK (empresa_id = get_user_empresa_id() AND public.can_view_financeiro());
CREATE POLICY centros_custo_delete ON public.centros_custo
  FOR DELETE USING (empresa_id = get_user_empresa_id() AND public.can_view_financeiro());

DROP POLICY IF EXISTS lancamento_rateios_select ON public.lancamento_rateios;
DROP POLICY IF EXISTS lancamento_rateios_insert ON public.lancamento_rateios;
DROP POLICY IF EXISTS lancamento_rateios_update ON public.lancamento_rateios;
DROP POLICY IF EXISTS lancamento_rateios_delete ON public.lancamento_rateios;
CREATE POLICY lancamento_rateios_select ON public.lancamento_rateios
  FOR SELECT USING (empresa_id = get_user_empresa_id() AND public.can_view_financeiro());
CREATE POLICY lancamento_rateios_insert ON public.lancamento_rateios
  FOR INSERT WITH CHECK (empresa_id = get_user_empresa_id() AND public.can_view_financeiro());
CREATE POLICY lancamento_rateios_update ON public.lancamento_rateios
  FOR UPDATE USING (empresa_id = get_user_empresa_id() AND public.can_view_financeiro())
  WITH CHECK (empresa_id = get_user_empresa_id() AND public.can_view_financeiro());
CREATE POLICY lancamento_rateios_delete ON public.lancamento_rateios
  FOR DELETE USING (empresa_id = get_user_empresa_id() AND public.can_view_financeiro());

-- ==========================================================================
-- RECEITAS / DESPESAS / CONTAS / CARTOES / FORNECEDORES / CATEGORIAS_FINANCEIRAS
-- / MARCOS_FATURAMENTO (última definição: 20260504270000, select+write=ALL)
-- ==========================================================================
DROP POLICY IF EXISTS "receitas_select" ON public.receitas;
DROP POLICY IF EXISTS "receitas_write" ON public.receitas;
CREATE POLICY "receitas_select" ON public.receitas
  FOR SELECT
  USING (
    empresa_id = public.get_user_empresa_id()
    AND deleted_at IS NULL
    AND public.can_view_financeiro()
  );
CREATE POLICY "receitas_write" ON public.receitas
  FOR ALL
  USING (
    empresa_id = public.get_user_empresa_id()
    AND deleted_at IS NULL
    AND public.can_view_financeiro()
  )
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.can_view_financeiro()
  );

DROP POLICY IF EXISTS "despesas_select" ON public.despesas;
DROP POLICY IF EXISTS "despesas_write" ON public.despesas;
CREATE POLICY "despesas_select" ON public.despesas
  FOR SELECT
  USING (
    empresa_id = public.get_user_empresa_id()
    AND deleted_at IS NULL
    AND public.can_view_financeiro()
  );
CREATE POLICY "despesas_write" ON public.despesas
  FOR ALL
  USING (
    empresa_id = public.get_user_empresa_id()
    AND deleted_at IS NULL
    AND public.can_view_financeiro()
  )
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.can_view_financeiro()
  );

DROP POLICY IF EXISTS "contas_select" ON public.contas;
DROP POLICY IF EXISTS "contas_write" ON public.contas;
CREATE POLICY "contas_select" ON public.contas
  FOR SELECT
  USING (
    empresa_id = public.get_user_empresa_id()
    AND deleted_at IS NULL
    AND public.can_view_financeiro()
  );
CREATE POLICY "contas_write" ON public.contas
  FOR ALL
  USING (
    empresa_id = public.get_user_empresa_id()
    AND deleted_at IS NULL
    AND public.can_view_financeiro()
  )
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.can_view_financeiro()
  );

DROP POLICY IF EXISTS "cartoes_select" ON public.cartoes;
DROP POLICY IF EXISTS "cartoes_write" ON public.cartoes;
CREATE POLICY "cartoes_select" ON public.cartoes
  FOR SELECT
  USING (
    empresa_id = public.get_user_empresa_id()
    AND deleted_at IS NULL
    AND public.can_view_financeiro()
  );
CREATE POLICY "cartoes_write" ON public.cartoes
  FOR ALL
  USING (
    empresa_id = public.get_user_empresa_id()
    AND deleted_at IS NULL
    AND public.can_view_financeiro()
  )
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.can_view_financeiro()
  );

DROP POLICY IF EXISTS "fornecedores_select" ON public.fornecedores;
DROP POLICY IF EXISTS "fornecedores_write" ON public.fornecedores;
CREATE POLICY "fornecedores_select" ON public.fornecedores
  FOR SELECT
  USING (
    empresa_id = public.get_user_empresa_id()
    AND deleted_at IS NULL
    AND public.can_view_financeiro()
  );
CREATE POLICY "fornecedores_write" ON public.fornecedores
  FOR ALL
  USING (
    empresa_id = public.get_user_empresa_id()
    AND deleted_at IS NULL
    AND public.can_view_financeiro()
  )
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.can_view_financeiro()
  );

DROP POLICY IF EXISTS "categorias_financeiras_select" ON public.categorias_financeiras;
DROP POLICY IF EXISTS "categorias_financeiras_write" ON public.categorias_financeiras;
CREATE POLICY "categorias_financeiras_select" ON public.categorias_financeiras
  FOR SELECT
  USING (
    empresa_id = public.get_user_empresa_id()
    AND deleted_at IS NULL
    AND public.can_view_financeiro()
  );
CREATE POLICY "categorias_financeiras_write" ON public.categorias_financeiras
  FOR ALL
  USING (
    empresa_id = public.get_user_empresa_id()
    AND deleted_at IS NULL
    AND public.can_view_financeiro()
  )
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.can_view_financeiro()
  );

DROP POLICY IF EXISTS "marcos_faturamento_select" ON public.marcos_faturamento;
DROP POLICY IF EXISTS "marcos_faturamento_write" ON public.marcos_faturamento;
CREATE POLICY "marcos_faturamento_select" ON public.marcos_faturamento
  FOR SELECT
  USING (
    empresa_id = public.get_user_empresa_id()
    AND deleted_at IS NULL
    AND public.can_view_financeiro()
  );
CREATE POLICY "marcos_faturamento_write" ON public.marcos_faturamento
  FOR ALL
  USING (
    empresa_id = public.get_user_empresa_id()
    AND deleted_at IS NULL
    AND public.can_view_financeiro()
  )
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.can_view_financeiro()
  );

-- ==========================================================================
-- ALERTAS (última definição: DELETE/INSERT em 20260504260000, SELECT em
-- 20260507300000 — "Alertas Read" ficou pra trás nas duas rodadas de
-- fechamento (a original e a auditoria desta spec): DELETE/INSERT já exigiam
-- financeiro desde antes desta PR, SELECT nunca teve gate nenhum além do
-- tenant. tipo inclui alerta claramente financeiro (pagamento_atrasado,
-- margem_baixa, orcamento_excedido, vencimento_proximo, recebimento_baixo,
-- ver CHECK em 000_base_schema.sql), com valor/projeto no título/mensagem
-- em texto livre. Mesmo gate das outras duas, pra ficar consistente com o
-- que a própria tabela já decidiu pra escrita.
-- ==========================================================================
DROP POLICY IF EXISTS "Alertas Read" ON public.alertas;
CREATE POLICY "Alertas Read" ON public.alertas
  FOR SELECT
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.can_view_financeiro()
  );

DROP POLICY IF EXISTS "Alertas Delete" ON public.alertas;
CREATE POLICY "Alertas Delete" ON public.alertas
  FOR DELETE
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.can_view_financeiro()
  );

DROP POLICY IF EXISTS "Alertas Insert" ON public.alertas;
CREATE POLICY "Alertas Insert" ON public.alertas
  FOR INSERT
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.can_view_financeiro()
  );

DROP POLICY IF EXISTS "Alertas Update" ON public.alertas;
CREATE POLICY "Alertas Update" ON public.alertas
  FOR UPDATE
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.can_view_financeiro()
  )
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.can_view_financeiro()
  );
