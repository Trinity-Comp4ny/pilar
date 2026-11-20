-- A aprovação via RPC já cria ou redistribui os títulos antes de atualizar o escopo.
CREATE OR REPLACE FUNCTION public.aditivo_aprovado_handler()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_projeto RECORD;
BEGIN
  -- Só roda quando escopo tipo "aditivo" é aprovado
  IF NEW.tipo = 'aditivo' AND NEW.status = 'aprovado' AND (OLD.status IS NULL OR OLD.status != 'aprovado') THEN
    -- Buscar projeto
    SELECT id, data_previsao, cliente_id, empresa_id INTO v_projeto
    FROM public.projetos WHERE id = NEW.projeto_id;

    -- Atualizar prazo do projeto se há impacto
    IF NEW.impacto_prazo_dias > 0 AND v_projeto.data_previsao IS NOT NULL THEN
      UPDATE public.projetos
      SET data_previsao = data_previsao + (NEW.impacto_prazo_dias || ' days')::interval
      WHERE id = NEW.projeto_id;
    END IF;

    -- A RPC moderna registra a cobrança antes de aprovar. Somente a
    -- aprovação legada sem esse registro ainda precisa gerar receita aqui.
    IF NEW.valor_aditivo > 0 AND NOT EXISTS (
      SELECT 1 FROM public.projeto_registros
      WHERE empresa_id = NEW.empresa_id
        AND projeto_id = NEW.projeto_id
        AND origem_id = NEW.id
        AND tipo = 'aditivo_cobranca'
    ) THEN
      INSERT INTO public.receitas (empresa_id, descricao, valor, data_vencimento, status, projeto_id, cliente_id)
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
