-- Conversão lead -> cliente: preservar CNPJ e resolver razão social.
--
-- Antes a RPC copiava só nome/sobrenome/email/contato/origem e descartava o
-- CNPJ e o nome da empresa do lead. Aqui passamos o CNPJ (só dígitos) para
-- clientes.cpf_cnpj e, quando o lead tem empresa (empresa_lead), usamos esse
-- nome como razão social do cliente (clientes.nome), deixando o sobrenome nulo.
-- valor_estimado e notas não têm coluna correspondente em clientes, então
-- seguem apenas no lead.
--
-- DROP + CREATE explícito (não CREATE OR REPLACE) e GRANT recriado, conforme
-- padrão do projeto para funções SQL.

DROP FUNCTION IF EXISTS public.rpc_converter_lead_cliente(uuid);

CREATE FUNCTION public.rpc_converter_lead_cliente(p_lead_id uuid)
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

  -- Razão social: lead com empresa vira cliente pessoa jurídica (nome = empresa,
  -- sem sobrenome); sem empresa mantém nome + sobrenome da pessoa.
  IF v_lead.empresa_lead IS NOT NULL AND btrim(v_lead.empresa_lead) <> '' THEN
    v_nome := v_lead.empresa_lead;
    v_sobrenome := NULL;
  ELSE
    v_nome := v_lead.nome;
    v_sobrenome := v_lead.sobrenome;
  END IF;

  -- CNPJ só com dígitos; vazio vira NULL para não colidir com o unique parcial.
  v_cpf_cnpj := NULLIF(regexp_replace(COALESCE(v_lead.cnpj, ''), '[^0-9]', '', 'g'), '');

  -- email e contato são NOT NULL em clientes; COALESCE evita falha de conversão
  -- quando o lead não tem esses dados.
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

ALTER FUNCTION public.rpc_converter_lead_cliente(uuid) OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.rpc_converter_lead_cliente(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_converter_lead_cliente(uuid) TO service_role;
