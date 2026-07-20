-- Gates de feature financeiro em tabelas que tinham só isolamento por empresa_id.
-- Antes desta migration, qualquer autenticado (colab/coord) lia e escrevia nelas
-- via API direta, mesmo sem a feature financeiro. RPCs SECURITY DEFINER (agentes,
-- rollups) bypassam RLS e não são afetadas.
--
-- Padrão: SELECT exige feature 'viewer'; INSERT/UPDATE/DELETE exigem 'editor'.

-- ==========================================================================
-- ACH-RLS-03: folha_pagamento (salários) estava totalmente sem gate.
-- Colab conseguia UPDATE de salário para 999999. Fecha leitura e escrita.
-- ==========================================================================
DROP POLICY IF EXISTS "Enable read access for authenticated users based on company" ON public.folha_pagamento;
DROP POLICY IF EXISTS "Enable insert access for authenticated users based on company" ON public.folha_pagamento;
DROP POLICY IF EXISTS "Enable update access for authenticated users based on company" ON public.folha_pagamento;
DROP POLICY IF EXISTS "Enable delete access for authenticated users based on company" ON public.folha_pagamento;

CREATE POLICY folha_pagamento_select ON public.folha_pagamento
  FOR SELECT USING (
    empresa_id = get_user_empresa_id()
    AND user_has_feature('financeiro', 'viewer')
  );
CREATE POLICY folha_pagamento_insert ON public.folha_pagamento
  FOR INSERT WITH CHECK (
    empresa_id = get_user_empresa_id()
    AND user_has_feature('financeiro', 'editor')
  );
CREATE POLICY folha_pagamento_update ON public.folha_pagamento
  FOR UPDATE USING (
    empresa_id = get_user_empresa_id()
    AND user_has_feature('financeiro', 'editor')
  ) WITH CHECK (
    empresa_id = get_user_empresa_id()
    AND user_has_feature('financeiro', 'editor')
  );
CREATE POLICY folha_pagamento_delete ON public.folha_pagamento
  FOR DELETE USING (
    empresa_id = get_user_empresa_id()
    AND user_has_feature('financeiro', 'editor')
  );

-- ==========================================================================
-- ACH-RLS-02: faturas — SELECT sem gate (coord/colab liam faturas de cartão).
-- Escrita já era gated; alinhamos a leitura.
-- ==========================================================================
DROP POLICY IF EXISTS faturas_select ON public.faturas;
CREATE POLICY faturas_select ON public.faturas
  FOR SELECT USING (
    empresa_id = get_user_empresa_id()
    AND deleted_at IS NULL
    AND user_has_feature('financeiro', 'viewer')
  );

-- ==========================================================================
-- ACH-RLS-04: transferencias, centros_custo, lancamento_rateios — só empresa_id.
-- Colab lia E escrevia (inseriu em centros_custo). Aplica gate financeiro.
-- ==========================================================================
DROP POLICY IF EXISTS transferencias_select ON public.transferencias;
DROP POLICY IF EXISTS transferencias_insert ON public.transferencias;
DROP POLICY IF EXISTS transferencias_update ON public.transferencias;
DROP POLICY IF EXISTS transferencias_delete ON public.transferencias;
CREATE POLICY transferencias_select ON public.transferencias
  FOR SELECT USING (empresa_id = get_user_empresa_id() AND user_has_feature('financeiro', 'viewer'));
CREATE POLICY transferencias_insert ON public.transferencias
  FOR INSERT WITH CHECK (empresa_id = get_user_empresa_id() AND user_has_feature('financeiro', 'editor'));
CREATE POLICY transferencias_update ON public.transferencias
  FOR UPDATE USING (empresa_id = get_user_empresa_id() AND user_has_feature('financeiro', 'editor'))
  WITH CHECK (empresa_id = get_user_empresa_id() AND user_has_feature('financeiro', 'editor'));
CREATE POLICY transferencias_delete ON public.transferencias
  FOR DELETE USING (empresa_id = get_user_empresa_id() AND user_has_feature('financeiro', 'editor'));

DROP POLICY IF EXISTS centros_custo_select ON public.centros_custo;
DROP POLICY IF EXISTS centros_custo_insert ON public.centros_custo;
DROP POLICY IF EXISTS centros_custo_update ON public.centros_custo;
DROP POLICY IF EXISTS centros_custo_delete ON public.centros_custo;
CREATE POLICY centros_custo_select ON public.centros_custo
  FOR SELECT USING (empresa_id = get_user_empresa_id() AND user_has_feature('financeiro', 'viewer'));
CREATE POLICY centros_custo_insert ON public.centros_custo
  FOR INSERT WITH CHECK (empresa_id = get_user_empresa_id() AND user_has_feature('financeiro', 'editor'));
CREATE POLICY centros_custo_update ON public.centros_custo
  FOR UPDATE USING (empresa_id = get_user_empresa_id() AND user_has_feature('financeiro', 'editor'))
  WITH CHECK (empresa_id = get_user_empresa_id() AND user_has_feature('financeiro', 'editor'));
CREATE POLICY centros_custo_delete ON public.centros_custo
  FOR DELETE USING (empresa_id = get_user_empresa_id() AND user_has_feature('financeiro', 'editor'));

DROP POLICY IF EXISTS lancamento_rateios_select ON public.lancamento_rateios;
DROP POLICY IF EXISTS lancamento_rateios_insert ON public.lancamento_rateios;
DROP POLICY IF EXISTS lancamento_rateios_update ON public.lancamento_rateios;
DROP POLICY IF EXISTS lancamento_rateios_delete ON public.lancamento_rateios;
CREATE POLICY lancamento_rateios_select ON public.lancamento_rateios
  FOR SELECT USING (empresa_id = get_user_empresa_id() AND user_has_feature('financeiro', 'viewer'));
CREATE POLICY lancamento_rateios_insert ON public.lancamento_rateios
  FOR INSERT WITH CHECK (empresa_id = get_user_empresa_id() AND user_has_feature('financeiro', 'editor'));
CREATE POLICY lancamento_rateios_update ON public.lancamento_rateios
  FOR UPDATE USING (empresa_id = get_user_empresa_id() AND user_has_feature('financeiro', 'editor'))
  WITH CHECK (empresa_id = get_user_empresa_id() AND user_has_feature('financeiro', 'editor'));
CREATE POLICY lancamento_rateios_delete ON public.lancamento_rateios
  FOR DELETE USING (empresa_id = get_user_empresa_id() AND user_has_feature('financeiro', 'editor'));
