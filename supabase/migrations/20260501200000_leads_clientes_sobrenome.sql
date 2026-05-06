-- Separar nome em nome (primeiro) + sobrenome em leads e clientes

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS sobrenome TEXT;

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS sobrenome TEXT;

COMMENT ON COLUMN public.leads.nome     IS 'Primeiro nome';
COMMENT ON COLUMN public.leads.sobrenome IS 'Sobrenome';
COMMENT ON COLUMN public.clientes.nome     IS 'Primeiro nome ou razão social';
COMMENT ON COLUMN public.clientes.sobrenome IS 'Sobrenome (pessoas físicas)';

-- Atualizar RPC para copiar sobrenome do lead para o cliente
CREATE OR REPLACE FUNCTION public.rpc_converter_lead_cliente(p_lead_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lead RECORD;
  v_empresa_id UUID;
  v_cliente_id UUID;
BEGIN
  SELECT * INTO v_lead FROM leads WHERE id = p_lead_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead não encontrado';
  END IF;

  IF v_lead.cliente_id IS NOT NULL THEN
    RAISE EXCEPTION 'Lead já foi convertido em cliente';
  END IF;

  v_empresa_id := v_lead.empresa_id;

  INSERT INTO clientes (empresa_id, nome, sobrenome, email, contato, origem)
  VALUES (v_empresa_id, v_lead.nome, v_lead.sobrenome, v_lead.email, v_lead.contato, v_lead.origem)
  RETURNING id INTO v_cliente_id;

  UPDATE leads
  SET status = 'Ganho',
      cliente_id = v_cliente_id,
      convertido_em = NOW()
  WHERE id = p_lead_id;

  RETURN v_cliente_id;
END;
$$;
