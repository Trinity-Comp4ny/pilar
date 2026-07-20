-- Conversão lead -> cliente: parar de copiar o CNPJ CRU do lead.
--
-- Bug (QA): a RPC sempre gravava leads.cnpj (formatado) em clientes.cpf_cnpj.
-- Se esse CNPJ colidia com um cliente existente (unique parcial por empresa), a
-- conversão falhava por QUALQUER via — inclusive o botão "Criar sem CNPJ", que
-- não omitia nada. O CNPJ bom vem do enrichment (lookup da Receita), aplicado
-- num UPDATE posterior, não do lead.
--
-- Fix: novo parâmetro p_omit_cnpj. Quando true, o cliente nasce sem cpf_cnpj e
-- o enrichment (quando houver) preenche o CNPJ limpo depois. O caminho da UI
-- passa a chamar com omit=true.
--
-- DROP + CREATE explícito (padrão do projeto; evita overload ambíguo).

DROP FUNCTION IF EXISTS public.rpc_converter_lead_cliente(uuid);
DROP FUNCTION IF EXISTS public.rpc_converter_lead_cliente(uuid, boolean);

CREATE FUNCTION public.rpc_converter_lead_cliente(p_lead_id uuid, p_omit_cnpj boolean DEFAULT false)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lead RECORD;
  v_empresa_id UUID;
  v_cliente_id UUID;
  v_nome TEXT;
  v_sobrenome TEXT;
  v_cpf_cnpj TEXT;
BEGIN
  SELECT * INTO v_lead FROM leads WHERE id = p_lead_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead não encontrado';
  END IF;

  IF v_lead.cliente_id IS NOT NULL THEN
    RAISE EXCEPTION 'Lead já foi convertido em cliente';
  END IF;

  v_empresa_id := v_lead.empresa_id;

  IF v_lead.empresa_lead IS NOT NULL AND btrim(v_lead.empresa_lead) <> '' THEN
    v_nome := v_lead.empresa_lead;
    v_sobrenome := NULL;
  ELSE
    v_nome := v_lead.nome;
    v_sobrenome := v_lead.sobrenome;
  END IF;

  -- CNPJ: omitido quando p_omit_cnpj; senão só dígitos (vazio vira NULL).
  IF p_omit_cnpj THEN
    v_cpf_cnpj := NULL;
  ELSE
    v_cpf_cnpj := NULLIF(regexp_replace(COALESCE(v_lead.cnpj, ''), '[^0-9]', '', 'g'), '');
  END IF;

  INSERT INTO clientes (empresa_id, nome, sobrenome, cpf_cnpj, email, contato, origem)
  VALUES (
    v_empresa_id,
    v_nome,
    v_sobrenome,
    v_cpf_cnpj,
    COALESCE(v_lead.email, ''),
    COALESCE(v_lead.contato, ''),
    v_lead.origem
  )
  RETURNING id INTO v_cliente_id;

  UPDATE leads
  SET status = 'Ganho',
      cliente_id = v_cliente_id,
      convertido_em = NOW()
  WHERE id = p_lead_id;

  RETURN v_cliente_id;
END;
$$;

ALTER FUNCTION public.rpc_converter_lead_cliente(uuid, boolean) OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.rpc_converter_lead_cliente(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_converter_lead_cliente(uuid, boolean) TO service_role;
