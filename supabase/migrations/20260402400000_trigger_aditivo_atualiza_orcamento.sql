-- Sprint 3.2: Trigger que ao aprovar um aditivo, atualiza o orçamento do projeto
-- Soma horas/custos dos escopo_itens ao projeto_orcamento_fases
-- Atualiza valor_contrato do projeto

CREATE OR REPLACE FUNCTION public.handle_escopo_aprovado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_empresa_id UUID;
BEGIN
  -- Só executa quando status muda para 'aprovado' e tipo é 'aditivo'
  IF NEW.status = 'aprovado' AND NEW.tipo = 'aditivo'
     AND (OLD.status IS DISTINCT FROM 'aprovado') THEN

    v_empresa_id := NEW.empresa_id;

    -- Para cada item do escopo, upsert no orçamento
    FOR v_item IN
      SELECT disciplina, horas, custo
      FROM escopo_itens
      WHERE escopo_id = NEW.id
    LOOP
      INSERT INTO projeto_orcamento_fases (
        empresa_id, projeto_id, disciplina, horas_estimadas, custo_hora, valor_venda
      ) VALUES (
        v_empresa_id, NEW.projeto_id, v_item.disciplina,
        COALESCE(v_item.horas, 0),
        CASE WHEN v_item.horas > 0 THEN COALESCE(v_item.custo, 0) / v_item.horas ELSE 0 END,
        COALESCE(v_item.custo, 0) * 1.3 -- margem 30% sobre custo
      )
      ON CONFLICT (projeto_id, disciplina) DO UPDATE SET
        horas_estimadas = projeto_orcamento_fases.horas_estimadas + COALESCE(v_item.horas, 0),
        valor_venda = projeto_orcamento_fases.valor_venda + (COALESCE(v_item.custo, 0) * 1.3),
        updated_at = NOW();
    END LOOP;

    -- Atualizar valor_contrato do projeto
    IF NEW.valor_aditivo IS NOT NULL AND NEW.valor_aditivo > 0 THEN
      UPDATE projetos
      SET valor_contrato = COALESCE(valor_contrato, 0) + NEW.valor_aditivo,
          updated_at = NOW()
      WHERE id = NEW.projeto_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Criar o trigger (drop se existir para ser idempotente)
DROP TRIGGER IF EXISTS trigger_escopo_aprovado ON public.escopos;

CREATE TRIGGER trigger_escopo_aprovado
  AFTER UPDATE ON public.escopos
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_escopo_aprovado();
