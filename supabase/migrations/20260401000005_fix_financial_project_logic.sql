-- ==============================================================================
-- CORREÇÕES CRÍTICAS: Lógica Financeira + Projetos
-- ==============================================================================

-- ============================================================
-- 1. AUTO-MARCAR RECEITAS/DESPESAS COMO ATRASADAS
-- Roda diariamente via cron ou chamada manual
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_atualizar_status_atrasados()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  receitas_atualizadas INTEGER := 0;
  despesas_atualizadas INTEGER := 0;
BEGIN
  -- Marcar receitas pendentes vencidas como Atrasado
  UPDATE receitas
  SET status = 'Atrasado'
  WHERE status = 'Pendente'
    AND data_vencimento < CURRENT_DATE
    AND deleted_at IS NULL;
  GET DIAGNOSTICS receitas_atualizadas = ROW_COUNT;

  -- Marcar despesas pendentes vencidas como Atrasado
  UPDATE despesas
  SET status = 'Atrasado'
  WHERE status = 'Pendente'
    AND data_vencimento < CURRENT_DATE
    AND deleted_at IS NULL;
  GET DIAGNOSTICS despesas_atualizadas = ROW_COUNT;

  RETURN json_build_object(
    'receitas_atualizadas', receitas_atualizadas,
    'despesas_atualizadas', despesas_atualizadas
  );
END;
$$;

-- ============================================================
-- 2. TRIGGER: Garantir data_recebimento ao marcar como Recebido
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_receita_data_recebimento()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Se status mudou para Recebido, garantir data_recebimento
  IF NEW.status = 'Recebido' AND NEW.data_recebimento IS NULL THEN
    NEW.data_recebimento := COALESCE(OLD.data_recebimento, NEW.data_vencimento, CURRENT_DATE);
  END IF;

  -- Se status voltou para Pendente, limpar data_recebimento
  IF NEW.status = 'Pendente' AND OLD.status = 'Recebido' THEN
    NEW.data_recebimento := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS receita_enforce_data ON public.receitas;
CREATE TRIGGER receita_enforce_data
  BEFORE UPDATE ON public.receitas
  FOR EACH ROW EXECUTE FUNCTION public.enforce_receita_data_recebimento();

-- ============================================================
-- 3. TRIGGER: Garantir data_pagamento ao marcar despesa como Pago
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_despesa_data_pagamento()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Se status mudou para Pago, garantir data_pagamento
  IF NEW.status = 'Pago' AND NEW.data_pagamento IS NULL THEN
    NEW.data_pagamento := COALESCE(OLD.data_pagamento, NEW.data_vencimento, CURRENT_DATE);
  END IF;

  -- Se status voltou para Pendente, limpar data_pagamento
  IF NEW.status = 'Pendente' AND OLD.status = 'Pago' THEN
    NEW.data_pagamento := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS despesa_enforce_data ON public.despesas;
CREATE TRIGGER despesa_enforce_data
  BEFORE UPDATE ON public.despesas
  FOR EACH ROW EXECUTE FUNCTION public.enforce_despesa_data_pagamento();

-- ============================================================
-- 4. AUTO-COMPLETAR DISCIPLINAS AO CONCLUIR PROJETO
-- ============================================================

CREATE OR REPLACE FUNCTION public.auto_complete_disciplinas()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  disciplina JSONB;
  updated_disciplinas JSONB := '[]'::jsonb;
BEGIN
  -- Só roda quando status muda para Concluído
  IF NEW.status = 'Concluído' AND (OLD.status IS NULL OR OLD.status != 'Concluído') THEN
    -- Marcar todas as disciplinas como Concluído
    IF NEW.disciplinas IS NOT NULL AND jsonb_array_length(NEW.disciplinas) > 0 THEN
      FOR disciplina IN SELECT * FROM jsonb_array_elements(NEW.disciplinas)
      LOOP
        updated_disciplinas := updated_disciplinas || jsonb_build_array(
          disciplina || jsonb_build_object(
            'status', 'Concluído',
            'data_final', COALESCE(disciplina->>'data_final', to_char(CURRENT_DATE, 'YYYY-MM-DD'))
          )
        );
      END LOOP;
      NEW.disciplinas := updated_disciplinas;
    END IF;

    -- Garantir data_final
    IF NEW.data_final IS NULL THEN
      NEW.data_final := CURRENT_DATE;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS projeto_auto_complete ON public.projetos;
CREATE TRIGGER projeto_auto_complete
  BEFORE UPDATE ON public.projetos
  FOR EACH ROW EXECUTE FUNCTION public.auto_complete_disciplinas();

-- ============================================================
-- 5. GERAR RECEITA AUTOMÁTICA AO FATURAR MARCO
-- ============================================================

CREATE OR REPLACE FUNCTION public.auto_gerar_receita_from_marco()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_receita_id UUID;
  v_projeto RECORD;
BEGIN
  -- Só roda quando marco muda para "faturado" e não tem receita vinculada
  IF NEW.status = 'faturado' AND (OLD.status IS NULL OR OLD.status != 'faturado') AND NEW.receita_id IS NULL THEN
    -- Busca dados do projeto
    SELECT id, cliente_id, empresa_id INTO v_projeto
    FROM projetos WHERE id = NEW.projeto_id;

    -- Cria receita automaticamente
    INSERT INTO receitas (empresa_id, descricao, valor, data_vencimento, status, projeto_id, cliente_id)
    VALUES (
      NEW.empresa_id,
      'Marco: ' || NEW.nome,
      NEW.valor,
      COALESCE(NEW.data_prevista, CURRENT_DATE),
      'Pendente',
      NEW.projeto_id,
      v_projeto.cliente_id
    )
    RETURNING id INTO v_receita_id;

    -- Vincula receita ao marco
    NEW.receita_id := v_receita_id;
  END IF;

  -- Quando marco é "recebido", atualiza receita para Recebido
  IF NEW.status = 'recebido' AND OLD.status = 'faturado' AND NEW.receita_id IS NOT NULL THEN
    UPDATE receitas SET status = 'Recebido', data_recebimento = CURRENT_DATE
    WHERE id = NEW.receita_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS marco_auto_receita ON public.marcos_faturamento;
CREATE TRIGGER marco_auto_receita
  BEFORE UPDATE ON public.marcos_faturamento
  FOR EACH ROW EXECUTE FUNCTION public.auto_gerar_receita_from_marco();

-- ============================================================
-- 6. ADITIVO APROVADO: Atualizar prazo do projeto + gerar receita
-- ============================================================

CREATE OR REPLACE FUNCTION public.aditivo_aprovado_handler()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_projeto RECORD;
BEGIN
  -- Só roda quando escopo tipo "aditivo" é aprovado
  IF NEW.tipo = 'aditivo' AND NEW.status = 'aprovado' AND (OLD.status IS NULL OR OLD.status != 'aprovado') THEN
    -- Buscar projeto
    SELECT id, data_previsao, cliente_id, empresa_id INTO v_projeto
    FROM projetos WHERE id = NEW.projeto_id;

    -- Atualizar prazo do projeto se há impacto
    IF NEW.impacto_prazo_dias > 0 AND v_projeto.data_previsao IS NOT NULL THEN
      UPDATE projetos
      SET data_previsao = data_previsao + (NEW.impacto_prazo_dias || ' days')::interval
      WHERE id = NEW.projeto_id;
    END IF;

    -- Gerar receita do aditivo se há valor
    IF NEW.valor_aditivo > 0 THEN
      INSERT INTO receitas (empresa_id, descricao, valor, data_vencimento, status, projeto_id, cliente_id)
      VALUES (
        NEW.empresa_id,
        'Aditivo: ' || LEFT(NEW.descricao, 100),
        NEW.valor_aditivo,
        COALESCE(v_projeto.data_previsao, CURRENT_DATE + 30),
        'Pendente',
        NEW.projeto_id,
        v_projeto.cliente_id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS escopo_aditivo_aprovado ON public.escopos;
CREATE TRIGGER escopo_aditivo_aprovado
  BEFORE UPDATE ON public.escopos
  FOR EACH ROW EXECUTE FUNCTION public.aditivo_aprovado_handler();

-- ============================================================
-- 7. RPC: Gerar parcelas de receita a partir de projeto
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_gerar_parcelas_projeto(
  p_projeto_id UUID,
  p_num_parcelas INTEGER DEFAULT 1,
  p_intervalo_dias INTEGER DEFAULT 30
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_projeto RECORD;
  v_valor_parcela NUMERIC;
  v_data_base DATE;
  i INTEGER;
  parcelas_criadas INTEGER := 0;
BEGIN
  -- Busca dados do projeto
  SELECT id, valor_contrato, cliente_id, empresa_id, data_inicio, nome, codigo_projeto
  INTO v_projeto
  FROM projetos
  WHERE id = p_projeto_id AND deleted_at IS NULL;

  IF v_projeto IS NULL THEN
    RAISE EXCEPTION 'Projeto não encontrado';
  END IF;

  IF v_projeto.valor_contrato IS NULL OR v_projeto.valor_contrato <= 0 THEN
    RAISE EXCEPTION 'Projeto sem valor de contrato';
  END IF;

  IF p_num_parcelas < 1 OR p_num_parcelas > 60 THEN
    RAISE EXCEPTION 'Número de parcelas deve ser entre 1 e 60';
  END IF;

  v_valor_parcela := ROUND(v_projeto.valor_contrato / p_num_parcelas, 2);
  v_data_base := COALESCE(v_projeto.data_inicio, CURRENT_DATE);

  FOR i IN 1..p_num_parcelas LOOP
    INSERT INTO receitas (empresa_id, descricao, valor, data_vencimento, status, projeto_id, cliente_id)
    VALUES (
      v_projeto.empresa_id,
      v_projeto.codigo_projeto || ' - Parcela ' || i || '/' || p_num_parcelas,
      v_valor_parcela,
      v_data_base + ((i - 1) * p_intervalo_dias),
      'Pendente',
      p_projeto_id,
      v_projeto.cliente_id
    );
    parcelas_criadas := parcelas_criadas + 1;
  END LOOP;

  -- Ajusta última parcela para fechar o valor exato (evita centavos perdidos)
  IF p_num_parcelas > 1 THEN
    UPDATE receitas
    SET valor = v_projeto.valor_contrato - (v_valor_parcela * (p_num_parcelas - 1))
    WHERE projeto_id = p_projeto_id
      AND descricao LIKE '%Parcela ' || p_num_parcelas || '/' || p_num_parcelas
      AND deleted_at IS NULL;
  END IF;

  RETURN parcelas_criadas;
END;
$$;

-- ============================================================
-- 8. RPC: Job diário unificado (alertas + status atrasados)
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_daily_maintenance()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_atrasados JSON;
  v_alertas INTEGER;
  v_empresa_id UUID;
BEGIN
  v_empresa_id := public.get_user_empresa_id();
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não associado a uma empresa';
  END IF;

  SELECT rpc_atualizar_status_atrasados() INTO v_atrasados;

  SELECT rpc_gerar_alertas() INTO v_alertas;

  UPDATE projetos
  SET updated_at = NOW()
  WHERE empresa_id = v_empresa_id
    AND deleted_at IS NULL
    AND status IN ('Planejamento', 'Em andamento');

  RETURN json_build_object(
    'atrasados', v_atrasados,
    'alertas_gerados', v_alertas
  );
END;
$$;

-- ============================================================
-- 9. VALIDAÇÃO: Limite de parcelas (max 60)
-- ============================================================

-- Já implementado na RPC rpc_gerar_parcelas_projeto acima

-- ============================================================
-- 10. INDEX para consultas comuns que faltavam
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_receitas_status ON public.receitas(empresa_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_despesas_status ON public.despesas(empresa_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_receitas_projeto ON public.receitas(projeto_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_despesas_projeto ON public.despesas(projeto_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_receitas_recebimento ON public.receitas(empresa_id, data_recebimento) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_despesas_pagamento ON public.despesas(empresa_id, data_pagamento) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_timesheets_aprovados ON public.timesheets(projeto_id, status) WHERE status = 'aprovado' AND deleted_at IS NULL;
