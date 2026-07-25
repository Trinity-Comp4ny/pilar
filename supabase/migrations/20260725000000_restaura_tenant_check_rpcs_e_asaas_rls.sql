-- Restaura o isolamento por empresa em 3 RPCs SECURITY DEFINER e o filtro de role
-- em asaas_config.
--
-- CONTEXTO (verificado nos dois bancos em 2026-07-25, não inferido do código):
--
-- A migration 013_rpcs_empresa_check.sql adicionou `IF <empresa do registro> !=
-- get_user_empresa_id() THEN RAISE 'Acesso negado'` nas 3 funções abaixo. Depois,
-- 028_sync_remote_changes.sql (linhas 1775, 1921, 2115) recriou as 3 a partir de um
-- dump do estado remoto, SEM os checks. Como 028 vem depois de 013 na ordem, a versão
-- permissiva venceu. O mesmo aconteceu com a policy de SELECT de asaas_config: a 014
-- exigia has_role('admin','financeiro') e 20260507300000_capture_remote_post.sql:1920
-- reintroduziu a versão que filtra só por empresa.
--
-- Estado real encontrado em PROD e STAGING:
--   - as 3 funções são SECURITY DEFINER (passam por cima do RLS), sem nenhum check de
--     empresa, e com EXECUTE concedido a `anon` (a anon key é pública por design);
--   - rpc_faturar_marco e rpc_converter_lead_cliente não chamam auth.uid() em lugar
--     nenhum, ou seja, não olham quem está chamando;
--   - update_projeto_completo tinha DOIS overloads (14 e 15 args), ambos sem check. O
--     front usa o de 15 (src/pages/projetos/components/useProjetoForm.ts:576), então o
--     de 14 é órfão e sai;
--   - asaas_config: só a policy permissiva existia, sem policy de DELETE, e api_key é
--     text puro (a 021_pgsodium_api_key não chegou ao banco).
--
-- Ninguém percebeu por ~2 meses porque o job de pgTAP que cobre exatamente isso foi
-- desligado em f5a86ea. Foi ao religá-lo que as 4 falhas apareceram.
--
-- O corpo das funções aqui é o corpo ATUAL do banco de staging mais o check, de
-- propósito: restaurar a versão de 013 reverteria mudanças de negócio legítimas que
-- vieram depois (p_prioridade, updated_by, p_omit_cnpj, tratamento de empresa_lead).
--
-- DROP + CREATE explícito em vez de CREATE OR REPLACE onde a assinatura muda: com
-- overload, CREATE OR REPLACE cria uma função nova e deixa a antiga viva.

-- =============================================
-- 1. update_projeto_completo
-- =============================================

-- Mata os dois overloads. O de 14 args não é chamado por nada no repo.
DROP FUNCTION IF EXISTS public.update_projeto_completo(
  uuid, text, text, uuid, date, date, date, numeric, text, text, text, numeric, jsonb, text
);
DROP FUNCTION IF EXISTS public.update_projeto_completo(
  uuid, text, text, uuid, date, date, date, numeric, text, text, text, numeric, jsonb, text, text
);

CREATE FUNCTION public.update_projeto_completo(
  p_projeto_id UUID,
  p_codigo TEXT,
  p_nome TEXT,
  p_cliente_id UUID,
  p_data_inicio DATE DEFAULT NULL,
  p_data_previsao DATE DEFAULT NULL,
  p_data_final DATE DEFAULT NULL,
  p_valor_contrato NUMERIC DEFAULT 0,
  p_observacao TEXT DEFAULT '',
  p_localizacao TEXT DEFAULT '',
  p_parcelas TEXT DEFAULT NULL,
  p_area_m2 NUMERIC DEFAULT 0,
  p_disciplinas JSONB DEFAULT '[]',
  p_status TEXT DEFAULT 'Planejamento',
  p_prioridade TEXT DEFAULT 'Media'
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_caller_empresa_id UUID;
  v_projeto_empresa_id UUID;
BEGIN
  v_user_id := auth.uid();
  v_caller_empresa_id := public.get_user_empresa_id();

  -- Sem empresa no contexto não há como autorizar: fecha em vez de seguir.
  IF v_caller_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT empresa_id INTO v_projeto_empresa_id
  FROM public.projetos
  WHERE id = p_projeto_id AND deleted_at IS NULL;

  IF v_projeto_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Projeto não encontrado';
  END IF;

  IF v_projeto_empresa_id != v_caller_empresa_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  UPDATE public.projetos SET
    codigo_projeto = p_codigo,
    nome = p_nome,
    cliente_id = p_cliente_id,
    data_inicio = p_data_inicio,
    data_previsao = p_data_previsao,
    data_final = p_data_final,
    valor_contrato = p_valor_contrato,
    observacao = p_observacao,
    localizacao = p_localizacao,
    parcelas = p_parcelas,
    area_m2 = p_area_m2,
    disciplinas = p_disciplinas,
    status = p_status::status_projeto,
    prioridade = p_prioridade,
    updated_by = v_user_id,
    updated_at = now()
  WHERE id = p_projeto_id;
END;
$$;

-- =============================================
-- 2. rpc_faturar_marco
-- =============================================

CREATE OR REPLACE FUNCTION public.rpc_faturar_marco(p_marco_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_marco RECORD;
  v_projeto RECORD;
  v_receita_id UUID;
  v_caller_empresa_id UUID;
BEGIN
  v_caller_empresa_id := public.get_user_empresa_id();

  IF v_caller_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT * INTO v_marco FROM marcos_faturamento WHERE id = p_marco_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Marco não encontrado';
  END IF;

  IF v_marco.status != 'pendente' THEN
    RAISE EXCEPTION 'Apenas marcos pendentes podem ser faturados';
  END IF;

  SELECT id, cliente_id, empresa_id, nome FROM projetos
  WHERE id = v_marco.projeto_id AND deleted_at IS NULL
  INTO v_projeto;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Projeto não encontrado';
  END IF;

  -- O check tem que ser contra a empresa do PROJETO, que é a que vai receber a
  -- receita. Sem ele, faturar marco de outra empresa criava receita lá.
  IF v_projeto.empresa_id != v_caller_empresa_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  INSERT INTO receitas (
    empresa_id, descricao, valor, data_vencimento, status,
    projeto_id, cliente_id
  ) VALUES (
    v_projeto.empresa_id,
    'Marco: ' || v_marco.nome || ' — ' || v_projeto.nome,
    v_marco.valor,
    CURRENT_DATE,
    'Pendente',
    v_marco.projeto_id,
    v_projeto.cliente_id
  )
  RETURNING id INTO v_receita_id;

  UPDATE marcos_faturamento
  SET status = 'faturado',
      data_faturada = CURRENT_DATE,
      receita_id = v_receita_id
  WHERE id = p_marco_id;

  RETURN v_receita_id;
END;
$$;

-- =============================================
-- 3. rpc_converter_lead_cliente
-- =============================================

-- Prod tem a assinatura de 1 arg, staging já tem a de 2 (p_omit_cnpj). Dropa as duas
-- para não deixar a de 1 arg viva sem check depois do deploy em prod.
DROP FUNCTION IF EXISTS public.rpc_converter_lead_cliente(uuid);
DROP FUNCTION IF EXISTS public.rpc_converter_lead_cliente(uuid, boolean);

CREATE FUNCTION public.rpc_converter_lead_cliente(
  p_lead_id UUID,
  p_omit_cnpj BOOLEAN DEFAULT false
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

-- =============================================
-- 4. Grants: tirar anon das três
-- =============================================
-- CREATE FUNCTION concede EXECUTE a PUBLIC por default, então revogar de PUBLIC e
-- conceder explicitamente é obrigatório, não zelo extra. Nenhuma das três é chamada
-- de contexto anônimo: useProjetoForm.ts, BillingMilestonesTab.tsx e useLeads.ts
-- rodam autenticados, e ai-chat usa service_role.

REVOKE ALL ON FUNCTION public.update_projeto_completo(
  uuid, text, text, uuid, date, date, date, numeric, text, text, text, numeric, jsonb, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_projeto_completo(
  uuid, text, text, uuid, date, date, date, numeric, text, text, text, numeric, jsonb, text, text
) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.rpc_faturar_marco(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_faturar_marco(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.rpc_converter_lead_cliente(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_converter_lead_cliente(uuid, boolean) TO authenticated, service_role;

-- =============================================
-- 5. asaas_config: volta a exigir admin/financeiro
-- =============================================
-- api_key é credencial do gateway de pagamento em texto puro. Antes disto, qualquer
-- usuário autenticado da empresa lia (não era vazamento entre empresas: o filtro de
-- empresa estava correto; era escalada de privilégio dentro do tenant).
--
-- has_role é VARIADIC user_role[], os literais são convertidos para o enum.
--
-- NÃO reintroduz admin_mfa_required() das policies _mfa da 020: essa função não
-- existe em nenhum dos dois bancos, então a 020 nunca chegou lá. Exigir MFA aqui
-- travaria a configuração do Asaas sem aviso. Decisão separada, fora deste fix.

DROP POLICY IF EXISTS "asaas_config_empresa_select" ON public.asaas_config;
DROP POLICY IF EXISTS "asaas_config_empresa_insert" ON public.asaas_config;
DROP POLICY IF EXISTS "asaas_config_empresa_update" ON public.asaas_config;
DROP POLICY IF EXISTS "asaas_config_empresa_delete" ON public.asaas_config;
DROP POLICY IF EXISTS "asaas_config_admin_select" ON public.asaas_config;
DROP POLICY IF EXISTS "asaas_config_admin_insert" ON public.asaas_config;
DROP POLICY IF EXISTS "asaas_config_admin_update" ON public.asaas_config;
DROP POLICY IF EXISTS "asaas_config_admin_delete" ON public.asaas_config;

ALTER TABLE public.asaas_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "asaas_config_admin_select" ON public.asaas_config
  FOR SELECT
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.has_role('admin', 'financeiro')
  );

CREATE POLICY "asaas_config_admin_insert" ON public.asaas_config
  FOR INSERT
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.has_role('admin', 'financeiro')
  );

CREATE POLICY "asaas_config_admin_update" ON public.asaas_config
  FOR UPDATE
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.has_role('admin', 'financeiro')
  )
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.has_role('admin', 'financeiro')
  );

-- Não havia policy de DELETE, ou seja, ninguém conseguia apagar config errada pela API.
CREATE POLICY "asaas_config_admin_delete" ON public.asaas_config
  FOR DELETE
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.has_role('admin', 'financeiro')
  );
