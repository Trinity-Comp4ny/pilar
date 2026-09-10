-- SPEC 098 Fase 3: retencao pos-trial (ADR 0042 + ADR 0043).
--
-- 1. empresas.leitura_desde / deleted_at: novas colunas, fonte de verdade do
--    modo somente-leitura e da exclusao (soft) da empresa.
-- 2. enforce_empresa_nao_leitura(): trigger generico aplicado dinamicamente a
--    toda tabela com empresa_id (ADR 0042), allowlist de excecao pequena.
-- 3. excluir_empresa_retencao(): RPC SECURITY DEFINER que anonimiza dados
--    fiscais e apaga o resto (ADR 0043), chamada so pelo cron ou ultra-admin.

-- =============================================
-- 1. Colunas novas em empresas
-- =============================================

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS leitura_desde timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

COMMENT ON COLUMN public.empresas.leitura_desde IS
  'Fonte de verdade do modo somente leitura pos-trial (SPEC 098 Fase 3, ADR 0042). Setado pelo trial-expiry-cron quando o trial vence sem forma de pagamento tokenizada; limpo ao reativar ou quando preservar_dados=true.';
COMMENT ON COLUMN public.empresas.deleted_at IS
  'Soft delete da empresa pelo cron de retencao (SPEC 098 Fase 3, ADR 0043), dia 90 sem preservar_dados. Nunca hard delete: preserva unicidade de CNPJ e a trilha em admin_audit_logs.';

-- =============================================
-- 2. Somente leitura pos-trial: trigger generico (ADR 0042)
-- =============================================

CREATE OR REPLACE FUNCTION public.enforce_empresa_nao_leitura()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid := COALESCE(NEW.empresa_id, OLD.empresa_id);
  v_leitura    boolean;
BEGIN
  -- service_role/postgres passam direto (cron, ultra-admin, migration,
  -- reativacao) -- mesmo padrao de enforce_capacidade_projetos. A 2a condicao
  -- cobre excluir_empresa_retencao() chamada por ultra_admin (sessao
  -- authenticated, SECURITY DEFINER nao muda auth.role()): sem ela, apagar os
  -- dados de uma empresa que ja esta em leitura ficaria bloqueado pelo
  -- proprio trigger que a colocou em leitura.
  IF auth.role() <> 'authenticated' OR current_setting('pilar.retencao_em_curso', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT (leitura_desde IS NOT NULL) INTO v_leitura
  FROM public.empresas WHERE id = v_empresa_id;

  IF v_leitura THEN
    RAISE EXCEPTION 'empresa_em_leitura' USING ERRCODE = 'P0001';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION public.enforce_empresa_nao_leitura() IS
  'ADR 0042: bloqueia INSERT/UPDATE/DELETE de sessao authenticated quando empresas.leitura_desde esta setado. service_role/postgres passam direto. Aplicada dinamicamente a toda tabela com empresa_id pelo bloco DO abaixo.';

DO $$
DECLARE
  v_tabela text;
BEGIN
  FOR v_tabela IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_name = c.table_name AND t.table_schema = c.table_schema
    WHERE c.column_name = 'empresa_id'
      AND c.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      -- Allowlist de EXCECAO: tabelas de sistema/auditoria que precisam
      -- continuar gravando mesmo com a empresa em leitura, ou que ja tem
      -- protecao propria mais especifica. notificacoes/notificacao_preferencias
      -- (usuario ainda le/marca lido), admin_audit_logs/audit_logs*
      -- (trilha nunca para), data_deletion_requests/data_export_requests
      -- (fluxo LGPD do usuario nao pode travar), consentimentos_cobranca
      -- (append-only, ja bloqueado por RLS), terms_acceptances/convites
      -- (aceite/convite nao dependem de escrita "de produto"), email_envios
      -- (log de envio), ai_token_ledger/ai_usage_logs/ai_usage (billing de
      -- uso precisa fechar o periodo mesmo em leitura), pilar_subscriptions
      -- (senao a propria reativacao trava), empresas (nao tem empresa_id,
      -- mas listada por seguranca/clareza).
      AND c.table_name NOT IN (
        'notificacoes', 'notificacao_preferencias', 'admin_audit_logs',
        'audit_logs', 'audit_logs_archive', 'data_deletion_requests',
        'data_export_requests', 'consentimentos_cobranca', 'terms_acceptances',
        'convites', 'email_envios', 'ai_token_ledger', 'ai_usage_logs',
        'ai_usage', 'pilar_subscriptions', 'empresas'
      )
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_enforce_empresa_nao_leitura ON public.%I', v_tabela);
    EXECUTE format(
      'CREATE TRIGGER trg_enforce_empresa_nao_leitura
         BEFORE INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.enforce_empresa_nao_leitura()',
      v_tabela
    );
  END LOOP;
END $$;

-- =============================================
-- 3. Exclusao de empresa (ADR 0043)
-- =============================================

-- 2 FKs precisam virar SET NULL antes de apagar o grupo 2: sem isso, apagar
-- pessoas/projetos faria CASCADE destruir folha_pagamento/marcos_faturamento
-- (grupo 1, retencao fiscal de 5 anos) em vez de so soltar o vinculo.
ALTER TABLE public.folha_pagamento ALTER COLUMN pessoa_id DROP NOT NULL;
ALTER TABLE public.folha_pagamento DROP CONSTRAINT folha_pagamento_pessoa_id_fkey;
ALTER TABLE public.folha_pagamento
  ADD CONSTRAINT folha_pagamento_pessoa_id_fkey
  FOREIGN KEY (pessoa_id) REFERENCES public.pessoas(id) ON DELETE SET NULL;

ALTER TABLE public.marcos_faturamento ALTER COLUMN projeto_id DROP NOT NULL;
ALTER TABLE public.marcos_faturamento DROP CONSTRAINT marcos_faturamento_projeto_id_fkey;
ALTER TABLE public.marcos_faturamento
  ADD CONSTRAINT marcos_faturamento_projeto_id_fkey
  FOREIGN KEY (projeto_id) REFERENCES public.projetos(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.folha_pagamento.pessoa_id IS
  'Nullable desde SPEC 098 Fase 3 (ADR 0043): excluir_empresa_retencao() apaga pessoas mas retem folha_pagamento por obrigacao fiscal; o vinculo com a pessoa vira NULL em vez de cascatear a exclusao do registro fiscal.';
COMMENT ON COLUMN public.marcos_faturamento.projeto_id IS
  'Nullable desde SPEC 098 Fase 3 (ADR 0043): mesma razao de folha_pagamento.pessoa_id, mas para projetos.';

-- soft_delete_generic() (SPEC 060, 20260859000000_soft_delete_via_rpc.sql)
-- intercepta todo DELETE em ~16 tabelas (clientes, projetos, pessoas,
-- propostas, escopos etc.) e vira UPDATE deleted_at, cancelando o DELETE
-- fisico. Sem o escape abaixo, o grupo 2 nunca apagaria essas tabelas de
-- verdade: so ficariam com deleted_at setado, com todo o PII ainda no banco.
-- O escape e via GUC local a transacao (set_config(..., true) no corpo de
-- excluir_empresa_retencao) -- nunca vaza pra outra sessao/empresa
-- concorrente, ao contrario de ALTER TABLE ... DISABLE TRIGGER (que e
-- global a tabela, nao a linha).
CREATE OR REPLACE FUNCTION public.soft_delete_generic()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_filhos int;
BEGIN
  IF current_setting('pilar.retencao_em_curso', true) = 'on' THEN
    RETURN OLD;
  END IF;

  IF TG_TABLE_NAME = 'projetos' THEN
    SELECT count(*) INTO v_filhos FROM (
      SELECT 1 FROM receitas WHERE projeto_id = OLD.id AND deleted_at IS NULL
      UNION ALL
      SELECT 1 FROM despesas WHERE projeto_id = OLD.id AND deleted_at IS NULL
    ) s;
    IF v_filhos > 0 THEN
      RAISE EXCEPTION 'Não é possível excluir: há % lançamento(s) financeiro(s) vinculado(s) a este projeto. Exclua ou desvincule os lançamentos antes.', v_filhos
        USING ERRCODE = 'foreign_key_violation';
    END IF;
  ELSIF TG_TABLE_NAME = 'clientes' THEN
    SELECT count(*) INTO v_filhos FROM (
      SELECT 1 FROM projetos WHERE cliente_id = OLD.id AND deleted_at IS NULL
      UNION ALL
      SELECT 1 FROM receitas WHERE cliente_id = OLD.id AND deleted_at IS NULL
    ) s;
    IF v_filhos > 0 THEN
      RAISE EXCEPTION 'Não é possível excluir: há % projeto(s) ou lançamento(s) vinculado(s) a este cliente. Trate-os antes de excluir.', v_filhos
        USING ERRCODE = 'foreign_key_violation';
    END IF;
  END IF;

  EXECUTE format('UPDATE %I.%I SET deleted_at = NOW() WHERE id = $1', TG_TABLE_SCHEMA, TG_TABLE_NAME) USING OLD.id;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.excluir_empresa_retencao(p_empresa_id uuid, p_motivo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_email     text;
  v_tabela          text;
  v_pendentes       text[];
  v_novos_pendentes text[];
  v_progresso       boolean;
  v_pass            integer := 0;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_ultra_admin() THEN
    RAISE EXCEPTION 'Sem permissao' USING ERRCODE = '42501';
  END IF;

  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN
    RAISE EXCEPTION 'Motivo obrigatorio' USING ERRCODE = '22023';
  END IF;

  -- Grupo 1: retencao fiscal/contratual de 5 anos (ADR 0043,
  -- TERMS_OF_SERVICE Sec 5). Mantem a linha (valor, data, categoria, status),
  -- mascara so o que identifica pessoa fisica ou terceiro em texto livre.
  -- `lancamentos` (SPEC 033/ADR 0017) e VIEW = receitas UNION despesas, sem
  -- coluna propria: anonimizar as duas tabelas base cobre o que a view mostra,
  -- inclusive o nome da contraparte (vem de JOIN com clientes/fornecedores,
  -- que somem no grupo 2 abaixo).
  UPDATE public.receitas
  SET descricao = '[anonimizado]', observacao = NULL
  WHERE empresa_id = p_empresa_id;

  UPDATE public.despesas
  SET descricao = '[anonimizado]', observacao = NULL
  WHERE empresa_id = p_empresa_id;

  UPDATE public.contas
  SET chave_pix = NULL
  WHERE empresa_id = p_empresa_id;

  -- vinculo com a pessoa/projeto severado (ver ALTER TABLE acima); os
  -- valores fiscais (salario, marco, data, percentual) permanecem intactos.
  UPDATE public.folha_pagamento SET pessoa_id = NULL WHERE empresa_id = p_empresa_id;
  UPDATE public.marcos_faturamento SET projeto_id = NULL WHERE empresa_id = p_empresa_id;

  UPDATE public.grupos_parcela
  SET descricao = '[anonimizado]', observacao = NULL
  WHERE empresa_id = p_empresa_id;

  UPDATE public.lancamento_rateios
  SET observacao = NULL
  WHERE empresa_id = p_empresa_id;

  UPDATE public.transferencias
  SET descricao = '[anonimizado]', observacao = NULL
  WHERE empresa_id = p_empresa_id;

  -- faturas, cartoes, categorias_financeiras e centros_custo nao tem coluna
  -- de texto livre com PII: sobrevivem sem alteracao, so ficam de fora do
  -- grupo 2 abaixo.

  -- Liga o escape de soft_delete_generic() e do proprio
  -- enforce_empresa_nao_leitura() (a empresa alvo normalmente ja esta em
  -- leitura). Local a transacao: nunca afeta outra sessao/empresa.
  PERFORM set_config('pilar.retencao_em_curso', 'on', true);

  -- Grupo 2: sem obrigacao de retencao -- apaga de verdade. Ordem resolvida
  -- por tentativa-e-erro (ate 10 passes) em vez de uma lista de ~65 tabelas
  -- ordenada manualmente por FK: mesmo efeito pratico, sem o risco de
  -- esquecer uma dependencia quando uma tabela nova entrar no schema.
  v_pendentes := ARRAY(
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_name = c.table_name AND t.table_schema = c.table_schema
    WHERE c.column_name = 'empresa_id'
      AND c.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND c.table_name NOT IN (
        -- grupo 1 (anonimizado acima, nunca apagado)
        'lancamentos', 'receitas', 'despesas', 'faturas', 'contas', 'cartoes',
        'folha_pagamento', 'marcos_faturamento', 'categorias_financeiras',
        'centros_custo', 'grupos_parcela', 'lancamento_rateios', 'transferencias',
        -- preservado: trilha de auditoria e prova de conformidade LGPD
        -- sobrevivem a exclusao da empresa por desenho (FK empresa_id ->
        -- empresas em SET NULL, ou sem FK nenhuma pra nao travar nunca)
        'admin_audit_logs', 'audit_logs', 'audit_logs_archive',
        'data_deletion_requests', 'data_export_requests', 'terms_acceptances',
        'email_envios'
      )
  );

  WHILE array_length(v_pendentes, 1) > 0 AND v_pass < 10 LOOP
    v_pass := v_pass + 1;
    v_novos_pendentes := ARRAY[]::text[];
    v_progresso := false;

    FOREACH v_tabela IN ARRAY v_pendentes LOOP
      BEGIN
        EXECUTE format('DELETE FROM public.%I WHERE empresa_id = $1', v_tabela) USING p_empresa_id;
        v_progresso := true;
      EXCEPTION WHEN foreign_key_violation THEN
        v_novos_pendentes := array_append(v_novos_pendentes, v_tabela);
      END;
    END LOOP;

    v_pendentes := v_novos_pendentes;
    EXIT WHEN NOT v_progresso;
  END LOOP;

  IF array_length(v_pendentes, 1) > 0 THEN
    RAISE EXCEPTION 'excluir_empresa_retencao: tabelas nao apagadas por FK apos 10 passes: %',
      array_to_string(v_pendentes, ', ');
  END IF;

  -- Usuarios: auth.users e apagado depois, numa chamada separada da edge
  -- (auth.admin.deleteUser exige service role do client JS, indisponivel em
  -- SQL puro). A edge le os profiles.id da empresa ANTES de chamar esta RPC
  -- (profiles ja fica vazio depois do loop acima).

  -- empresas: soft delete, nunca DELETE -- preserva a unicidade de CNPJ
  -- contra reuso indevido (ADR 0041) e mantem admin_audit_logs apontando
  -- pra um id valido. PII de contato e removida; cnpj/razao_social ficam
  -- (e a propria razao de existir do soft delete).
  UPDATE public.empresas
  SET deleted_at = now(),
      leitura_desde = NULL,
      status = 'cancelled',
      nome = '[empresa excluida]',
      email = NULL,
      contato = NULL,
      endereco = NULL,
      cep = NULL,
      logo_url = NULL,
      pix_chave = NULL,
      pix_instrucoes = NULL
  WHERE id = p_empresa_id;

  SELECT email INTO v_actor_email FROM public.profiles WHERE id = auth.uid();
  v_actor_email := COALESCE(v_actor_email, 'system@pilar');

  INSERT INTO public.admin_audit_logs (
    actor_id, actor_email, actor_role, action, category,
    target_type, target_id, empresa_id, metadata
  )
  VALUES (
    auth.uid(), v_actor_email, 'ultra_admin', 'empresa_excluida_retencao', 'billing',
    'empresa', p_empresa_id::text, p_empresa_id,
    jsonb_build_object('motivo', p_motivo, 'quando', now())
  );
END;
$$;

REVOKE ALL ON FUNCTION public.excluir_empresa_retencao(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.excluir_empresa_retencao(uuid, text) TO authenticated, service_role;

COMMENT ON FUNCTION public.excluir_empresa_retencao(uuid, text) IS
  'ADR 0043: chamada so pelo cron retencao-pos-trial (service_role) ou manualmente por ultra_admin (mitigacao de risco pra testar antes do 1o disparo automatico). Grupo 1 (13 tabelas fiscais) e anonimizado; grupo 2 (resto, exceto trilha de auditoria/LGPD) e apagado; empresas fica soft-deleted.';
