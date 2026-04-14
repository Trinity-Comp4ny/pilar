-- Sprint 1.1: Adiciona motivo_perda e convertido_em na tabela leads
-- motivo_perda: registra por que o lead foi perdido (obrigatorio no frontend)
-- convertido_em: timestamp de quando o lead foi convertido em cliente

ALTER TABLE leads ADD COLUMN IF NOT EXISTS motivo_perda TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS convertido_em TIMESTAMPTZ;

-- RPC para converter lead em cliente automaticamente
CREATE OR REPLACE FUNCTION public.rpc_converter_lead_cliente(p_lead_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead RECORD;
  v_empresa_id UUID;
  v_cliente_id UUID;
BEGIN
  -- Buscar o lead
  SELECT * INTO v_lead FROM leads WHERE id = p_lead_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead não encontrado';
  END IF;

  -- Verificar se já foi convertido
  IF v_lead.cliente_id IS NOT NULL THEN
    RAISE EXCEPTION 'Lead já foi convertido em cliente';
  END IF;

  v_empresa_id := v_lead.empresa_id;

  -- Criar o cliente a partir dos dados do lead
  INSERT INTO clientes (empresa_id, nome, email, contato, origem)
  VALUES (v_empresa_id, v_lead.nome, v_lead.email, v_lead.contato, v_lead.origem)
  RETURNING id INTO v_cliente_id;

  -- Atualizar o lead
  UPDATE leads
  SET status = 'Ganho',
      cliente_id = v_cliente_id,
      convertido_em = NOW()
  WHERE id = p_lead_id;

  RETURN v_cliente_id;
END;
$$;

-- Permitir que roles com acesso a leads possam chamar o RPC
GRANT EXECUTE ON FUNCTION public.rpc_converter_lead_cliente(UUID) TO authenticated;
