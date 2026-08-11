-- =====================================================================
-- Hardening de acesso a RPCs SECURITY DEFINER que nasciam executáveis por
-- anon/PUBLIC (grant default do Postgres em CREATE FUNCTION), sem que as
-- migrations revogassem. Um deploy limpo em prod (2026-08-10) expôs isso:
-- rpc_converter_lead_cliente(uuid, boolean) chegou anon-executável e SEM
-- tenant check, permitindo converter lead de qualquer empresa via anon key.
--
-- Esta migration:
--   1. Redefine rpc_converter_lead_cliente com tenant check (empresa do
--      caller == empresa do lead). Corpo idêntico ao que a staging já rodava
--      por patch manual; aqui vira código versionado.
--   2. Revoga anon/PUBLIC e concede só authenticated + service_role numa
--      classe de RPCs que faziam escrita cross-tenant sem gate de rede.
--
-- Idempotente: prod e staging já estão neste estado (aplicado via console em
-- 2026-08-10); a migration só garante que um `db reset`/ambiente novo nasça
-- seguro. Ver memória project_rpc_anon_exposed_class_2026-08-10.
--
-- FOLLOW-UP (fora deste escopo, precisa análise de caller + teste em staging):
-- adicionar tenant check no CORPO de rpc_converter_proposta_projeto,
-- rpc_gerar_parcelas_projeto e rpc_gerar_alertas(uuid) para fechar também o
-- vetor authenticated-cross-tenant. Aqui só o vetor anon/PUBLIC é fechado
-- nesses (o pior), mais o corpo do lead converter (que é seguro e comprovado).
-- =====================================================================

BEGIN;

-- 1. Lead converter: tenant check + grants restritos.
CREATE OR REPLACE FUNCTION public.rpc_converter_lead_cliente(p_lead_id uuid, p_omit_cnpj boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_lead RECORD;
  v_empresa_id UUID;
  v_cliente_id UUID;
  v_nome TEXT;
  v_sobrenome TEXT;
  v_cpf_cnpj TEXT;
  v_caller_empresa_id UUID;
BEGIN
  v_caller_empresa_id := public.get_user_empresa_id();

  IF v_caller_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT * INTO v_lead FROM leads WHERE id = p_lead_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead não encontrado';
  END IF;

  IF v_lead.empresa_id != v_caller_empresa_id THEN
    RAISE EXCEPTION 'Acesso negado';
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

  IF p_omit_cnpj THEN
    v_cpf_cnpj := NULL;
  ELSE
    v_cpf_cnpj := NULLIF(regexp_replace(COALESCE(v_lead.cnpj, ''), '[^0-9]', '', 'g'), '');
  END IF;

  INSERT INTO clientes (empresa_id, nome, sobrenome, cpf_cnpj, email, contato, origem)
  VALUES (
    v_empresa_id, v_nome, v_sobrenome, v_cpf_cnpj,
    COALESCE(v_lead.email, ''), COALESCE(v_lead.contato, ''), v_lead.origem
  )
  RETURNING id INTO v_cliente_id;

  UPDATE leads
  SET status = 'Ganho', cliente_id = v_cliente_id, convertido_em = NOW()
  WHERE id = p_lead_id;

  RETURN v_cliente_id;
END;
$function$;

-- 2. Hardening de grant: sem anon/PUBLIC, só authenticated + service_role.
REVOKE EXECUTE ON FUNCTION public.rpc_converter_lead_cliente(uuid, boolean) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.rpc_converter_lead_cliente(uuid, boolean) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.rpc_converter_proposta_projeto(uuid) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.rpc_converter_proposta_projeto(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.rpc_gerar_parcelas_projeto(uuid, integer, integer) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.rpc_gerar_parcelas_projeto(uuid, integer, integer) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.rpc_gerar_alertas(uuid) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.rpc_gerar_alertas(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.rpc_gerar_alertas() FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.rpc_gerar_alertas() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.find_or_create_fatura(uuid, date) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.find_or_create_fatura(uuid, date) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.recalc_grupo_parcela_status(uuid) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.recalc_grupo_parcela_status(uuid) TO authenticated, service_role;

COMMIT;
