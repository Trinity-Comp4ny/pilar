-- Sprint 4.3: Despesas recorrentes
-- Adiciona campos para marcar despesas como recorrentes e gerar próximas ocorrências

ALTER TABLE despesas ADD COLUMN IF NOT EXISTS recorrente BOOLEAN DEFAULT FALSE;
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS periodicidade TEXT CHECK (periodicidade IN ('mensal', 'trimestral', 'semestral', 'anual'));
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS despesa_pai_id UUID REFERENCES despesas(id);

-- RPC para gerar próximas despesas recorrentes
CREATE OR REPLACE FUNCTION public.rpc_gerar_despesas_recorrentes()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_despesa RECORD;
  v_proxima_data DATE;
  v_count INTEGER := 0;
  v_empresa_id UUID;
BEGIN
  v_empresa_id := public.get_user_empresa_id();

  FOR v_despesa IN
    SELECT d.*
    FROM despesas d
    WHERE d.empresa_id = v_empresa_id
      AND d.recorrente = TRUE
      AND d.deleted_at IS NULL
      AND d.periodicidade IS NOT NULL
      -- Só gera se não existe filha no futuro
      AND NOT EXISTS (
        SELECT 1 FROM despesas filha
        WHERE filha.despesa_pai_id = d.id
          AND filha.deleted_at IS NULL
          AND filha.data_vencimento > CURRENT_DATE
      )
  LOOP
    -- Calcular próxima data
    v_proxima_data := CASE v_despesa.periodicidade
      WHEN 'mensal' THEN v_despesa.data_vencimento + INTERVAL '1 month'
      WHEN 'trimestral' THEN v_despesa.data_vencimento + INTERVAL '3 months'
      WHEN 'semestral' THEN v_despesa.data_vencimento + INTERVAL '6 months'
      WHEN 'anual' THEN v_despesa.data_vencimento + INTERVAL '1 year'
      ELSE v_despesa.data_vencimento + INTERVAL '1 month'
    END;

    -- Ajustar se data já passou (avançar até o futuro)
    WHILE v_proxima_data <= CURRENT_DATE LOOP
      v_proxima_data := CASE v_despesa.periodicidade
        WHEN 'mensal' THEN v_proxima_data + INTERVAL '1 month'
        WHEN 'trimestral' THEN v_proxima_data + INTERVAL '3 months'
        WHEN 'semestral' THEN v_proxima_data + INTERVAL '6 months'
        WHEN 'anual' THEN v_proxima_data + INTERVAL '1 year'
        ELSE v_proxima_data + INTERVAL '1 month'
      END;
    END LOOP;

    -- Criar próxima ocorrência
    INSERT INTO despesas (
      empresa_id, descricao, valor, data_vencimento, status,
      projeto_id, fornecedor_id, categoria_id, conta_id,
      recorrente, periodicidade, despesa_pai_id, observacao
    ) VALUES (
      v_despesa.empresa_id,
      v_despesa.descricao,
      v_despesa.valor,
      v_proxima_data,
      'Pendente',
      v_despesa.projeto_id,
      v_despesa.fornecedor_id,
      v_despesa.categoria_id,
      v_despesa.conta_id,
      TRUE,
      v_despesa.periodicidade,
      v_despesa.id,
      v_despesa.observacao
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_gerar_despesas_recorrentes() TO authenticated;
