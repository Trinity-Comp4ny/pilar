-- Captura POST: indices, triggers, policies, FKs.

-- Captura POST: tabelas, indices, triggers, policies do remoto.
SET statement_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET client_min_messages = warning;
-- Captura completa do schema remoto.
-- Idempotente; marcada como applied no remoto via migration repair.
SET statement_timeout = 0;
SELECT pg_catalog.set_config('search_path', '', false);
CREATE OR REPLACE VIEW "public"."lancamentos" WITH ("security_invoker"='true') AS
 SELECT "r"."id",
    "r"."empresa_id",
    'receita'::"text" AS "tipo",
    "r"."descricao",
    "r"."valor",
    "r"."data_vencimento",
    "r"."data_recebimento" AS "data_efetivacao",
    "r"."data_competencia",
    ("r"."status")::"text" AS "status",
    "r"."categoria_id",
    "r"."projeto_id",
    "r"."conta_id",
    "r"."centro_custo_id",
    "r"."tags",
    "r"."cliente_id" AS "contraparte_id",
    'cliente'::"text" AS "contraparte_tipo",
    NULL::"uuid" AS "cartao_id",
    NULL::"uuid" AS "fatura_id",
    "r"."forma_pagamento",
    "r"."grupo_parcela",
    "r"."parcela_numero",
    "r"."parcela_total",
    "gp"."tipo_grupo" AS "grupo_tipo",
    "gp"."status_agregado" AS "grupo_status",
    "gp"."total_original" AS "grupo_total_original",
    "r"."nota_fiscal",
    "r"."observacao",
    "r"."created_by",
    "r"."updated_by",
    "r"."created_at",
    "r"."updated_at",
    "r"."deleted_at",
    NULL::"uuid" AS "transferencia_par_id"
   FROM ("public"."receitas" "r"
     LEFT JOIN "public"."grupos_parcela" "gp" ON (("gp"."id" = "r"."grupo_parcela")))
  WHERE ("r"."deleted_at" IS NULL)
UNION ALL
 SELECT "d"."id",
    "d"."empresa_id",
    'despesa'::"text" AS "tipo",
    "d"."descricao",
    "d"."valor",
    "d"."data_vencimento",
    "d"."data_pagamento" AS "data_efetivacao",
    "d"."data_competencia",
    ("d"."status")::"text" AS "status",
    "d"."categoria_id",
    "d"."projeto_id",
    "d"."conta_id",
    "d"."centro_custo_id",
    "d"."tags",
    "d"."fornecedor_id" AS "contraparte_id",
    'fornecedor'::"text" AS "contraparte_tipo",
    "d"."cartao_id",
    "d"."fatura_id",
    "d"."forma_pagamento",
    "d"."grupo_parcela",
    "d"."parcela_numero",
    "d"."parcela_total",
    "gp"."tipo_grupo" AS "grupo_tipo",
    "gp"."status_agregado" AS "grupo_status",
    "gp"."total_original" AS "grupo_total_original",
    "d"."nota_fiscal",
    "d"."observacao",
    "d"."created_by",
    "d"."updated_by",
    "d"."created_at",
    "d"."updated_at",
    "d"."deleted_at",
    NULL::"uuid" AS "transferencia_par_id"
   FROM ("public"."despesas" "d"
     LEFT JOIN "public"."grupos_parcela" "gp" ON (("gp"."id" = "d"."grupo_parcela")))
  WHERE ("d"."deleted_at" IS NULL)
UNION ALL
 SELECT "t"."id",
    "t"."empresa_id",
    'transferencia'::"text" AS "tipo",
    COALESCE("t"."descricao", ('Transferência → '::"text" || "cd"."nome")) AS "descricao",
    "t"."valor",
    "t"."data_transferencia" AS "data_vencimento",
        CASE
            WHEN ("t"."status" = 'Concluída'::"text") THEN "t"."data_transferencia"
            ELSE NULL::"date"
        END AS "data_efetivacao",
    "t"."data_transferencia" AS "data_competencia",
    "t"."status",
    NULL::"uuid" AS "categoria_id",
    NULL::"uuid" AS "projeto_id",
    "t"."conta_origem_id" AS "conta_id",
    NULL::"uuid" AS "centro_custo_id",
    NULL::"text"[] AS "tags",
    "t"."conta_destino_id" AS "contraparte_id",
    'conta_destino'::"text" AS "contraparte_tipo",
    NULL::"uuid" AS "cartao_id",
    NULL::"uuid" AS "fatura_id",
    NULL::"text" AS "forma_pagamento",
    NULL::"uuid" AS "grupo_parcela",
    NULL::integer AS "parcela_numero",
    NULL::integer AS "parcela_total",
    NULL::"text" AS "grupo_tipo",
    NULL::"text" AS "grupo_status",
    NULL::numeric AS "grupo_total_original",
    NULL::"text" AS "nota_fiscal",
    "t"."observacao",
    "t"."created_by",
    "t"."updated_by",
    "t"."created_at",
    "t"."updated_at",
    "t"."deleted_at",
    "t"."conta_destino_id" AS "transferencia_par_id"
   FROM ("public"."transferencias" "t"
     JOIN "public"."contas" "cd" ON (("cd"."id" = "t"."conta_destino_id")))
  WHERE ("t"."deleted_at" IS NULL);
CREATE OR REPLACE VIEW "public"."view_cartao_resumo" AS
 SELECT "id",
    "nome",
    "empresa_id",
    "dia_fechamento",
    "dia_vencimento",
    "cor",
    "limite",
    "conta_pagamento_id",
    "tipo",
    COALESCE(( SELECT "sum"("d"."valor") AS "sum"
           FROM "public"."despesas" "d"
          WHERE (("d"."cartao_id" = "c"."id") AND ("d"."status" = 'Pendente'::"public"."status_financeiro") AND ("d"."deleted_at" IS NULL))), (0)::numeric) AS "usado",
    ("limite" - COALESCE(( SELECT "sum"("d"."valor") AS "sum"
           FROM "public"."despesas" "d"
          WHERE (("d"."cartao_id" = "c"."id") AND ("d"."status" = 'Pendente'::"public"."status_financeiro") AND ("d"."deleted_at" IS NULL))), (0)::numeric)) AS "disponivel"
   FROM "public"."cartoes" "c"
  WHERE ("deleted_at" IS NULL);
CREATE OR REPLACE VIEW "public"."view_fatura_resumo" AS
 SELECT "f"."id",
    "f"."empresa_id",
    "f"."cartao_id",
    "cc"."nome" AS "cartao_nome",
    "cc"."cor" AS "cartao_cor",
    "f"."mes_referencia",
    "f"."ano_referencia",
    "f"."data_inicio",
    "f"."data_fim",
    "f"."data_vencimento",
    "f"."status",
    "f"."data_pagamento",
    "f"."conta_pagamento_id",
    "c"."nome" AS "conta_pagamento_nome",
    COALESCE(( SELECT "sum"("d"."valor") AS "sum"
           FROM "public"."despesas" "d"
          WHERE (("d"."fatura_id" = "f"."id") AND ("d"."cartao_id" IS NOT NULL) AND ("d"."deleted_at" IS NULL))), (0)::numeric) AS "valor_total",
    "f"."valor_pago",
    ( SELECT "count"(*) AS "count"
           FROM "public"."despesas" "d"
          WHERE (("d"."fatura_id" = "f"."id") AND ("d"."cartao_id" IS NOT NULL) AND ("d"."deleted_at" IS NULL))) AS "qtd_despesas"
   FROM (("public"."faturas" "f"
     JOIN "public"."cartoes" "cc" ON (("f"."cartao_id" = "cc"."id")))
     LEFT JOIN "public"."contas" "c" ON (("f"."conta_pagamento_id" = "c"."id")))
  WHERE ("f"."deleted_at" IS NULL);
CREATE OR REPLACE VIEW "public"."view_financas_resumo" AS
 SELECT "id" AS "conta_id",
    "nome" AS "conta_nome",
    "banco",
    "cor",
    "empresa_id",
    "saldo_inicial",
    COALESCE(( SELECT "sum"("r"."valor") AS "sum"
           FROM "public"."receitas" "r"
          WHERE (("r"."conta_id" = "c"."id") AND ("r"."status" = 'Recebido'::"public"."status_financeiro") AND ("r"."deleted_at" IS NULL))), (0)::numeric) AS "total_entradas",
    COALESCE(( SELECT "sum"("d"."valor") AS "sum"
           FROM "public"."despesas" "d"
          WHERE (("d"."conta_id" = "c"."id") AND ("d"."status" = 'Pago'::"public"."status_financeiro") AND ("d"."deleted_at" IS NULL))), (0)::numeric) AS "total_saidas",
    (("saldo_inicial" + COALESCE(( SELECT "sum"("r"."valor") AS "sum"
           FROM "public"."receitas" "r"
          WHERE (("r"."conta_id" = "c"."id") AND ("r"."status" = 'Recebido'::"public"."status_financeiro") AND ("r"."deleted_at" IS NULL))), (0)::numeric)) - COALESCE(( SELECT "sum"("d"."valor") AS "sum"
           FROM "public"."despesas" "d"
          WHERE (("d"."conta_id" = "c"."id") AND ("d"."status" = 'Pago'::"public"."status_financeiro") AND ("d"."deleted_at" IS NULL))), (0)::numeric)) AS "saldo_atual"
   FROM "public"."contas" "c"
  WHERE ("deleted_at" IS NULL);
CREATE OR REPLACE VIEW "public"."view_folha_pagamento" AS
 SELECT "p"."id" AS "pessoa_id",
    "p"."nome" AS "pessoa_nome",
    "p"."cargo",
    "p"."empresa_id",
    COALESCE("p"."salario_fixo", (0)::numeric) AS "salario_fixo",
    COALESCE("p"."valor_m2", (0)::numeric) AS "valor_m2",
    "count"(DISTINCT "proj"."id") AS "qtd_projetos",
    COALESCE("sum"("proj"."area_m2"), (0)::numeric) AS "total_area_m2",
    COALESCE("sum"(("proj"."area_m2" * COALESCE("p"."valor_m2", (0)::numeric))), (0)::numeric) AS "total_comissao",
    (COALESCE("p"."salario_fixo", (0)::numeric) + COALESCE("sum"(("proj"."area_m2" * COALESCE("p"."valor_m2", (0)::numeric))), (0)::numeric)) AS "total_receber"
   FROM ("public"."pessoas" "p"
     LEFT JOIN "public"."projetos" "proj" ON ((("proj"."empresa_id" = "p"."empresa_id") AND ("proj"."deleted_at" IS NULL) AND ("proj"."status" = ANY (ARRAY['Planejamento'::"public"."status_projeto", 'Em andamento'::"public"."status_projeto"])) AND (EXISTS ( SELECT 1
           FROM "jsonb_array_elements"("proj"."disciplinas") "d"("value")
          WHERE ((("d"."value" ->> 'responsavel_id'::"text"))::"uuid" = "p"."id"))))))
  WHERE ("p"."deleted_at" IS NULL)
  GROUP BY "p"."id", "p"."nome", "p"."cargo", "p"."empresa_id", "p"."salario_fixo", "p"."valor_m2";
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='admin_audit_logs_pkey') THEN
    ALTER TABLE ONLY "public"."admin_audit_logs"
    ADD CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='alertas_pkey') THEN
    ALTER TABLE ONLY "public"."alertas"
    ADD CONSTRAINT "alertas_pkey" PRIMARY KEY ("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='aprovacoes_pkey') THEN
    ALTER TABLE ONLY "public"."aprovacoes"
    ADD CONSTRAINT "aprovacoes_pkey" PRIMARY KEY ("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='asaas_config_empresa_id_key') THEN
    ALTER TABLE ONLY "public"."asaas_config"
    ADD CONSTRAINT "asaas_config_empresa_id_key" UNIQUE ("empresa_id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='asaas_config_pkey') THEN
    ALTER TABLE ONLY "public"."asaas_config"
    ADD CONSTRAINT "asaas_config_pkey" PRIMARY KEY ("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='asaas_webhook_logs_pkey') THEN
    ALTER TABLE ONLY "public"."asaas_webhook_logs"
    ADD CONSTRAINT "asaas_webhook_logs_pkey" PRIMARY KEY ("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='audit_logs_archive_pkey') THEN
    ALTER TABLE ONLY "public"."audit_logs_archive"
    ADD CONSTRAINT "audit_logs_archive_pkey" PRIMARY KEY ("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='audit_logs_pkey') THEN
    ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='cartoes_pkey') THEN
    ALTER TABLE ONLY "public"."cartoes"
    ADD CONSTRAINT "cartoes_pkey" PRIMARY KEY ("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='cartoes_unique_empresa_nome') THEN
    ALTER TABLE ONLY "public"."cartoes"
    ADD CONSTRAINT "cartoes_unique_empresa_nome" UNIQUE ("empresa_id", "nome");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='categorias_financeiras_pkey') THEN
    ALTER TABLE ONLY "public"."categorias_financeiras"
    ADD CONSTRAINT "categorias_financeiras_pkey" PRIMARY KEY ("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='categorias_unique_empresa_nome_tipo') THEN
    ALTER TABLE ONLY "public"."categorias_financeiras"
    ADD CONSTRAINT "categorias_unique_empresa_nome_tipo" UNIQUE ("empresa_id", "nome", "tipo");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='centros_custo_empresa_id_codigo_key') THEN
    ALTER TABLE ONLY "public"."centros_custo"
    ADD CONSTRAINT "centros_custo_empresa_id_codigo_key" UNIQUE ("empresa_id", "codigo");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='centros_custo_pkey') THEN
    ALTER TABLE ONLY "public"."centros_custo"
    ADD CONSTRAINT "centros_custo_pkey" PRIMARY KEY ("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='cliente_portal_accounts_cliente_id_empresa_id_key') THEN
    ALTER TABLE ONLY "public"."cliente_portal_accounts"
    ADD CONSTRAINT "cliente_portal_accounts_cliente_id_empresa_id_key" UNIQUE ("cliente_id", "empresa_id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='cliente_portal_accounts_email_key') THEN
    ALTER TABLE ONLY "public"."cliente_portal_accounts"
    ADD CONSTRAINT "cliente_portal_accounts_email_key" UNIQUE ("email");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='cliente_portal_accounts_pkey') THEN
    ALTER TABLE ONLY "public"."cliente_portal_accounts"
    ADD CONSTRAINT "cliente_portal_accounts_pkey" PRIMARY KEY ("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='clientes_contato_key') THEN
    ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_contato_key" UNIQUE ("contato");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='clientes_cpf_cnpj_key') THEN
    ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_cpf_cnpj_key" UNIQUE ("cpf_cnpj");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='clientes_email_key') THEN
    ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_email_key" UNIQUE ("email");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='clientes_pkey') THEN
    ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_pkey" PRIMARY KEY ("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='clientes_unique_empresa_cpf_cnpj') THEN
    ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_unique_empresa_cpf_cnpj" UNIQUE ("empresa_id", "cpf_cnpj");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='contas_pkey') THEN
    ALTER TABLE ONLY "public"."contas"
    ADD CONSTRAINT "contas_pkey" PRIMARY KEY ("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='contas_unique_empresa_nome') THEN
    ALTER TABLE ONLY "public"."contas"
    ADD CONSTRAINT "contas_unique_empresa_nome" UNIQUE ("empresa_id", "nome");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='convites_pkey') THEN
    ALTER TABLE ONLY "public"."convites"
    ADD CONSTRAINT "convites_pkey" PRIMARY KEY ("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='convites_token_key') THEN
    ALTER TABLE ONLY "public"."convites"
    ADD CONSTRAINT "convites_token_key" UNIQUE ("token");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='critical_alerts_pkey') THEN
    ALTER TABLE ONLY "public"."critical_alerts"
    ADD CONSTRAINT "critical_alerts_pkey" PRIMARY KEY ("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='data_deletion_requests_pkey') THEN
    ALTER TABLE ONLY "public"."data_deletion_requests"
    ADD CONSTRAINT "data_deletion_requests_pkey" PRIMARY KEY ("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='data_export_requests_pkey') THEN
    ALTER TABLE ONLY "public"."data_export_requests"
    ADD CONSTRAINT "data_export_requests_pkey" PRIMARY KEY ("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='despesas_pkey') THEN
    ALTER TABLE ONLY "public"."despesas"
    ADD CONSTRAINT "despesas_pkey" PRIMARY KEY ("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='disciplinas_pkey') THEN
    ALTER TABLE ONLY "public"."disciplinas"
    ADD CONSTRAINT "disciplinas_pkey" PRIMARY KEY ("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='empresa_owners_pending_email_key') THEN
    ALTER TABLE ONLY "public"."empresa_owners_pending"
    ADD CONSTRAINT "empresa_owners_pending_email_key" UNIQUE ("email");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='empresa_owners_pending_pkey') THEN
    ALTER TABLE ONLY "public"."empresa_owners_pending"
    ADD CONSTRAINT "empresa_owners_pending_pkey" PRIMARY KEY ("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='empresa_owners_pending_token_key') THEN
    ALTER TABLE ONLY "public"."empresa_owners_pending"
    ADD CONSTRAINT "empresa_owners_pending_token_key" UNIQUE ("token");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='empresas_pkey') THEN
    ALTER TABLE ONLY "public"."empresas"
    ADD CONSTRAINT "empresas_pkey" PRIMARY KEY ("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='escopo_historico_pkey') THEN
    ALTER TABLE ONLY "public"."escopo_historico"
    ADD CONSTRAINT "escopo_historico_pkey" PRIMARY KEY ("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='escopo_itens_pkey') THEN
    ALTER TABLE ONLY "public"."escopo_itens"
    ADD CONSTRAINT "escopo_itens_pkey" PRIMARY KEY ("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='escopos_pkey') THEN
    ALTER TABLE ONLY "public"."escopos"
    ADD CONSTRAINT "escopos_pkey" PRIMARY KEY ("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='faturas_pkey') THEN
    ALTER TABLE ONLY "public"."faturas"
    ADD CONSTRAINT "faturas_pkey" PRIMARY KEY ("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='faturas_unique_cartao_mes') THEN
    ALTER TABLE ONLY "public"."faturas"
    ADD CONSTRAINT "faturas_unique_cartao_mes" UNIQUE ("cartao_id", "mes_referencia", "ano_referencia");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='feature_flags_pkey') THEN
    ALTER TABLE ONLY "public"."feature_flags"
    ADD CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("key");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fluxos_disciplinas_pkey') THEN
    ALTER TABLE ONLY "public"."fluxos_disciplinas"
    ADD CONSTRAINT "fluxos_disciplinas_pkey" PRIMARY KEY ("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='folha_pagamento_pessoa_id_mes_ano_key') THEN
    ALTER TABLE ONLY "public"."folha_pagamento"
    ADD CONSTRAINT "folha_pagamento_pessoa_id_mes_ano_key" UNIQUE ("pessoa_id", "mes", "ano");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='folha_pagamento_pkey') THEN
    ALTER TABLE ONLY "public"."folha_pagamento"
    ADD CONSTRAINT "folha_pagamento_pkey" PRIMARY KEY ("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fornecedores_pkey') THEN
    ALTER TABLE ONLY "public"."fornecedores"
    ADD CONSTRAINT "fornecedores_pkey" PRIMARY KEY ("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fornecedores_unique_empresa_cnpj') THEN
    ALTER TABLE ONLY "public"."fornecedores"
    ADD CONSTRAINT "fornecedores_unique_empresa_cnpj" UNIQUE ("empresa_id", "cnpj");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='grupos_parcela_pkey') THEN
    ALTER TABLE ONLY "public"."grupos_parcela"
    ADD CONSTRAINT "grupos_parcela_pkey" PRIMARY KEY ("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='impersonation_sessions_pkey') THEN
    ALTER TABLE ONLY "public"."impersonation_sessions"
    ADD CONSTRAINT "impersonation_sessions_pkey" PRIMARY KEY ("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='lancamento_rateios_lancamento_id_tipo_lancamento_centro_cus_key') THEN
    ALTER TABLE ONLY "public"."lancamento_rateios"
    ADD CONSTRAINT "lancamento_rateios_lancamento_id_tipo_lancamento_centro_cus_key" UNIQUE ("lancamento_id", "tipo_lancamento", "centro_custo_id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='lancamento_rateios_pkey') THEN
    ALTER TABLE ONLY "public"."lancamento_rateios"
    ADD CONSTRAINT "lancamento_rateios_pkey" PRIMARY KEY ("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='leads_pkey') THEN
    ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_pkey" PRIMARY KEY ("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='marcos_faturamento_pkey') THEN
    ALTER TABLE ONLY "public"."marcos_faturamento"
    ADD CONSTRAINT "marcos_faturamento_pkey" PRIMARY KEY ("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='metas_pkey') THEN
    ALTER TABLE ONLY "public"."metas"
    ADD CONSTRAINT "metas_pkey" PRIMARY KEY ("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='mfa_backup_codes_pkey') THEN
    ALTER TABLE ONLY "public"."mfa_backup_codes"
    ADD CONSTRAINT "mfa_backup_codes_pkey" PRIMARY KEY ("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='orcamento_unique_projeto_disciplina') THEN
    ALTER TABLE ONLY "public"."projeto_orcamento_fases"
    ADD CONSTRAINT "orcamento_unique_projeto_disciplina" UNIQUE ("projeto_id", "disciplina");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='orcamento_versoes_pkey') THEN
    ALTER TABLE ONLY "public"."orcamento_versoes"
    ADD CONSTRAINT "orcamento_versoes_pkey" PRIMARY KEY ("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pessoas_pkey') THEN
    ALTER TABLE ONLY "public"."pessoas"
    ADD CONSTRAINT "pessoas_pkey" PRIMARY KEY ("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pessoas_telefone_key') THEN
    ALTER TABLE ONLY "public"."pessoas"
    ADD CONSTRAINT "pessoas_telefone_key" UNIQUE ("telefone");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pilar_checkout_webhook_logs_pkey') THEN
    ALTER TABLE ONLY "public"."pilar_checkout_webhook_logs"
    ADD CONSTRAINT "pilar_checkout_webhook_logs_pkey" PRIMARY KEY ("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pilar_pending_signups_checkout_session_token_key') THEN
    ALTER TABLE ONLY "public"."pilar_pending_signups"
    ADD CONSTRAINT "pilar_pending_signups_checkout_session_token_key" UNIQUE ("checkout_session_token");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pilar_pending_signups_pkey') THEN
    ALTER TABLE ONLY "public"."pilar_pending_signups"
    ADD CONSTRAINT "pilar_pending_signups_pkey" PRIMARY KEY ("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pilar_subscription_plans_pkey') THEN
    ALTER TABLE ONLY "public"."pilar_subscription_plans"
    ADD CONSTRAINT "pilar_subscription_plans_pkey" PRIMARY KEY ("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pilar_subscription_plans_slug_key') THEN
    ALTER TABLE ONLY "public"."pilar_subscription_plans"
    ADD CONSTRAINT "pilar_subscription_plans_slug_key" UNIQUE ("slug");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pilar_subscriptions_empresa_id_key') THEN
    ALTER TABLE ONLY "public"."pilar_subscriptions"
    ADD CONSTRAINT "pilar_subscriptions_empresa_id_key" UNIQUE ("empresa_id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pilar_subscriptions_pkey') THEN
    ALTER TABLE ONLY "public"."pilar_subscriptions"
    ADD CONSTRAINT "pilar_subscriptions_pkey" PRIMARY KEY ("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='portal_download_logs_pkey') THEN
    ALTER TABLE ONLY "public"."portal_download_logs"
    ADD CONSTRAINT "portal_download_logs_pkey" PRIMARY KEY ("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='portal_entregas_pkey') THEN
    ALTER TABLE ONLY "public"."portal_entregas"
    ADD CONSTRAINT "portal_entregas_pkey" PRIMARY KEY ("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='profiles_pkey') THEN
    ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='projeto_disciplina_responsave_projeto_disciplina_id_pessoa__key') THEN
    ALTER TABLE ONLY "public"."projeto_disciplina_responsaveis"
    ADD CONSTRAINT "projeto_disciplina_responsave_projeto_disciplina_id_pessoa__key" UNIQUE ("projeto_disciplina_id", "pessoa_id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='projeto_disciplina_responsaveis_pkey') THEN
    ALTER TABLE ONLY "public"."projeto_disciplina_responsaveis"
    ADD CONSTRAINT "projeto_disciplina_responsaveis_pkey" PRIMARY KEY ("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='projeto_disciplinas_pkey') THEN
    ALTER TABLE ONLY "public"."projeto_disciplinas"
    ADD CONSTRAINT "projeto_disciplinas_pkey" PRIMARY KEY ("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='projeto_orcamento_fases_pkey') THEN
    ALTER TABLE ONLY "public"."projeto_orcamento_fases"
    ADD CONSTRAINT "projeto_orcamento_fases_pkey" PRIMARY KEY ("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='projeto_orcamento_fases_projeto_disciplina_uq') THEN
    ALTER TABLE ONLY "public"."projeto_orcamento_fases"
    ADD CONSTRAINT "projeto_orcamento_fases_projeto_disciplina_uq" UNIQUE ("projeto_id", "disciplina");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='projetos_empresa_codigo_uq') THEN
    ALTER TABLE ONLY "public"."projetos"
    ADD CONSTRAINT "projetos_empresa_codigo_uq" UNIQUE ("empresa_id", "codigo_projeto");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='projetos_pkey') THEN
    ALTER TABLE ONLY "public"."projetos"
    ADD CONSTRAINT "projetos_pkey" PRIMARY KEY ("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='projetos_unique_empresa_codigo') THEN
    ALTER TABLE ONLY "public"."projetos"
    ADD CONSTRAINT "projetos_unique_empresa_codigo" UNIQUE ("empresa_id", "codigo_projeto");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='proposta_disciplinas_pkey') THEN
    ALTER TABLE ONLY "public"."proposta_disciplinas"
    ADD CONSTRAINT "proposta_disciplinas_pkey" PRIMARY KEY ("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='proposta_templates_pkey') THEN
    ALTER TABLE ONLY "public"."proposta_templates"
    ADD CONSTRAINT "proposta_templates_pkey" PRIMARY KEY ("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='propostas_pkey') THEN
    ALTER TABLE ONLY "public"."propostas"
    ADD CONSTRAINT "propostas_pkey" PRIMARY KEY ("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='rate_limit_attempts_pkey') THEN
    ALTER TABLE ONLY "public"."rate_limit_attempts"
    ADD CONSTRAINT "rate_limit_attempts_pkey" PRIMARY KEY ("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='receitas_pkey') THEN
    ALTER TABLE ONLY "public"."receitas"
    ADD CONSTRAINT "receitas_pkey" PRIMARY KEY ("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='templates_projeto_pkey') THEN
    ALTER TABLE ONLY "public"."templates_projeto"
    ADD CONSTRAINT "templates_projeto_pkey" PRIMARY KEY ("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='transferencias_pkey') THEN
    ALTER TABLE ONLY "public"."transferencias"
    ADD CONSTRAINT "transferencias_pkey" PRIMARY KEY ("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ultra_admin_modes_pkey') THEN
    ALTER TABLE ONLY "public"."ultra_admin_modes"
    ADD CONSTRAINT "ultra_admin_modes_pkey" PRIMARY KEY ("user_id");
  END IF;
END $wrap$;
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "public"."audit_logs" USING "btree" ("action");
CREATE INDEX IF NOT EXISTS "audit_logs_actor_idx" ON "public"."audit_logs" USING "btree" ("actor_id");
CREATE INDEX IF NOT EXISTS "audit_logs_created_idx" ON "public"."audit_logs" USING "btree" ("created_at" DESC);
CREATE INDEX IF NOT EXISTS "audit_logs_meta_emp_idx" ON "public"."audit_logs" USING "btree" ((("metadata" ->> 'empresa_id'::"text")));
CREATE INDEX IF NOT EXISTS "audit_logs_record_idx" ON "public"."audit_logs" USING "btree" ("target_id");
CREATE INDEX IF NOT EXISTS "centros_custo_empresa_idx" ON "public"."centros_custo" USING "btree" ("empresa_id") WHERE ("deleted_at" IS NULL);
CREATE INDEX IF NOT EXISTS "despesas_centro_custo_idx" ON "public"."despesas" USING "btree" ("centro_custo_id") WHERE ("deleted_at" IS NULL);
CREATE INDEX IF NOT EXISTS "despesas_data_competencia_idx" ON "public"."despesas" USING "btree" ("data_competencia") WHERE ("deleted_at" IS NULL);
CREATE UNIQUE INDEX IF NOT EXISTS "faturas_idempotency_key_unique" ON "public"."faturas" USING "btree" ("empresa_id", "idempotency_key") WHERE ("idempotency_key" IS NOT NULL);
CREATE INDEX IF NOT EXISTS "grupos_parcela_contraparte_idx" ON "public"."grupos_parcela" USING "btree" ("contraparte_id", "contraparte_tipo") WHERE ("deleted_at" IS NULL);
CREATE INDEX IF NOT EXISTS "grupos_parcela_empresa_idx" ON "public"."grupos_parcela" USING "btree" ("empresa_id") WHERE ("deleted_at" IS NULL);
CREATE INDEX IF NOT EXISTS "grupos_parcela_projeto_idx" ON "public"."grupos_parcela" USING "btree" ("projeto_id") WHERE ("deleted_at" IS NULL);
CREATE INDEX IF NOT EXISTS "idx_admin_audit_actor" ON "public"."admin_audit_logs" USING "btree" ("actor_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_admin_audit_category" ON "public"."admin_audit_logs" USING "btree" ("category", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_admin_audit_empresa" ON "public"."admin_audit_logs" USING "btree" ("empresa_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_alertas_empresa_lido" ON "public"."alertas" USING "btree" ("empresa_id", "lido", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_alertas_empresa_tipo" ON "public"."alertas" USING "btree" ("empresa_id", "tipo");
CREATE INDEX IF NOT EXISTS "idx_aprovacoes_aprovador_id" ON "public"."aprovacoes" USING "btree" ("aprovador_id") WHERE ("aprovador_id" IS NOT NULL);
CREATE INDEX IF NOT EXISTS "idx_aprovacoes_empresa" ON "public"."aprovacoes" USING "btree" ("empresa_id");
CREATE INDEX IF NOT EXISTS "idx_aprovacoes_ref" ON "public"."aprovacoes" USING "btree" ("referencia_tipo", "referencia_id");
CREATE INDEX IF NOT EXISTS "idx_aprovacoes_solicitante_id" ON "public"."aprovacoes" USING "btree" ("solicitante_id");
CREATE INDEX IF NOT EXISTS "idx_aprovacoes_status" ON "public"."aprovacoes" USING "btree" ("empresa_id", "status");
CREATE INDEX IF NOT EXISTS "idx_asaas_webhook_logs_receita_id" ON "public"."asaas_webhook_logs" USING "btree" ("receita_id") WHERE ("receita_id" IS NOT NULL);
CREATE INDEX IF NOT EXISTS "idx_audit_logs_archive_actor" ON "public"."audit_logs_archive" USING "btree" ("actor_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_audit_logs_archive_empresa_created" ON "public"."audit_logs_archive" USING "btree" ("empresa_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_audit_logs_archive_target" ON "public"."audit_logs_archive" USING "btree" ("target_table", "target_id");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_empresa_created" ON "public"."audit_logs" USING "btree" ("empresa_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_cartoes_empresa" ON "public"."cartoes" USING "btree" ("empresa_id");
CREATE INDEX IF NOT EXISTS "idx_cliente_portal_accounts_cliente" ON "public"."cliente_portal_accounts" USING "btree" ("cliente_id");
CREATE INDEX IF NOT EXISTS "idx_cliente_portal_accounts_email" ON "public"."cliente_portal_accounts" USING "btree" ("email");
CREATE INDEX IF NOT EXISTS "idx_cliente_portal_accounts_empresa" ON "public"."cliente_portal_accounts" USING "btree" ("empresa_id");
CREATE INDEX IF NOT EXISTS "idx_cliente_portal_accounts_token" ON "public"."cliente_portal_accounts" USING "btree" ("token_sessao");
CREATE INDEX IF NOT EXISTS "idx_clientes_empresa" ON "public"."clientes" USING "btree" ("empresa_id");
CREATE INDEX IF NOT EXISTS "idx_clientes_nome_trgm" ON "public"."clientes" USING "gin" ("nome" "public"."gin_trgm_ops");
CREATE INDEX IF NOT EXISTS "idx_contas_empresa" ON "public"."contas" USING "btree" ("empresa_id");
CREATE INDEX IF NOT EXISTS "idx_convites_email" ON "public"."convites" USING "btree" ("email") WHERE ("usado_em" IS NULL);
CREATE INDEX IF NOT EXISTS "idx_convites_empresa" ON "public"."convites" USING "btree" ("empresa_id");
CREATE INDEX IF NOT EXISTS "idx_convites_token" ON "public"."convites" USING "btree" ("token") WHERE ("usado_em" IS NULL);
CREATE INDEX IF NOT EXISTS "idx_critical_alerts_empresa" ON "public"."critical_alerts" USING "btree" ("empresa_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_critical_alerts_unnotified" ON "public"."critical_alerts" USING "btree" ("created_at" DESC) WHERE ("notified" = false);
CREATE INDEX IF NOT EXISTS "idx_data_deletion_requests_status" ON "public"."data_deletion_requests" USING "btree" ("status", "requested_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_data_deletion_requests_user" ON "public"."data_deletion_requests" USING "btree" ("user_id", "requested_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_ddr_notified_at_null" ON "public"."data_deletion_requests" USING "btree" ("requested_at" DESC) WHERE ("notified_at" IS NULL);
CREATE INDEX IF NOT EXISTS "idx_despesas_cartao_id" ON "public"."despesas" USING "btree" ("cartao_id") WHERE ("deleted_at" IS NULL);
CREATE INDEX IF NOT EXISTS "idx_despesas_categoria_id" ON "public"."despesas" USING "btree" ("categoria_id") WHERE ("deleted_at" IS NULL);
CREATE INDEX IF NOT EXISTS "idx_despesas_centro_custo_id" ON "public"."despesas" USING "btree" ("centro_custo_id") WHERE ("deleted_at" IS NULL);
CREATE INDEX IF NOT EXISTS "idx_despesas_conta_id" ON "public"."despesas" USING "btree" ("conta_id") WHERE ("deleted_at" IS NULL);
CREATE INDEX IF NOT EXISTS "idx_despesas_desc_trgm" ON "public"."despesas" USING "gin" ("descricao" "public"."gin_trgm_ops");
CREATE INDEX IF NOT EXISTS "idx_despesas_despesa_pai_id" ON "public"."despesas" USING "btree" ("despesa_pai_id") WHERE ("despesa_pai_id" IS NOT NULL);
CREATE INDEX IF NOT EXISTS "idx_despesas_empresa" ON "public"."despesas" USING "btree" ("empresa_id");
CREATE INDEX IF NOT EXISTS "idx_despesas_fatura" ON "public"."despesas" USING "btree" ("fatura_id");
CREATE INDEX IF NOT EXISTS "idx_despesas_fornecedor_id" ON "public"."despesas" USING "btree" ("fornecedor_id") WHERE ("deleted_at" IS NULL);
CREATE INDEX IF NOT EXISTS "idx_despesas_grupo_parcela" ON "public"."despesas" USING "btree" ("grupo_parcela") WHERE ("grupo_parcela" IS NOT NULL);
CREATE INDEX IF NOT EXISTS "idx_despesas_is_fatura_payment" ON "public"."despesas" USING "btree" ("is_fatura_payment") WHERE ("is_fatura_payment" = true);
CREATE INDEX IF NOT EXISTS "idx_despesas_pagamento" ON "public"."despesas" USING "btree" ("empresa_id", "data_pagamento") WHERE ("deleted_at" IS NULL);
CREATE INDEX IF NOT EXISTS "idx_despesas_projeto" ON "public"."despesas" USING "btree" ("projeto_id") WHERE ("deleted_at" IS NULL);
CREATE INDEX IF NOT EXISTS "idx_despesas_status" ON "public"."despesas" USING "btree" ("empresa_id", "status") WHERE ("deleted_at" IS NULL);
CREATE INDEX IF NOT EXISTS "idx_despesas_vencimento" ON "public"."despesas" USING "btree" ("empresa_id", "data_vencimento");
CREATE INDEX IF NOT EXISTS "idx_empresa_owners_pending_email" ON "public"."empresa_owners_pending" USING "btree" ("email") WHERE ("usado_em" IS NULL);
CREATE INDEX IF NOT EXISTS "idx_empresa_owners_pending_token" ON "public"."empresa_owners_pending" USING "btree" ("token") WHERE ("usado_em" IS NULL);
CREATE INDEX IF NOT EXISTS "idx_escopo_itens_escopo" ON "public"."escopo_itens" USING "btree" ("escopo_id");
CREATE INDEX IF NOT EXISTS "idx_escopos_aprovado_por" ON "public"."escopos" USING "btree" ("aprovado_por") WHERE ("aprovado_por" IS NOT NULL);
CREATE INDEX IF NOT EXISTS "idx_escopos_empresa" ON "public"."escopos" USING "btree" ("empresa_id");
CREATE INDEX IF NOT EXISTS "idx_escopos_projeto" ON "public"."escopos" USING "btree" ("projeto_id");
CREATE INDEX IF NOT EXISTS "idx_faturas_cartao" ON "public"."faturas" USING "btree" ("cartao_id");
CREATE INDEX IF NOT EXISTS "idx_faturas_conta_pagamento_id" ON "public"."faturas" USING "btree" ("conta_pagamento_id");
CREATE INDEX IF NOT EXISTS "idx_faturas_empresa" ON "public"."faturas" USING "btree" ("empresa_id");
CREATE INDEX IF NOT EXISTS "idx_faturas_periodo" ON "public"."faturas" USING "btree" ("cartao_id", "ano_referencia", "mes_referencia");
CREATE INDEX IF NOT EXISTS "idx_faturas_status" ON "public"."faturas" USING "btree" ("empresa_id", "status");
CREATE INDEX IF NOT EXISTS "idx_fluxos_disciplinas_empresa" ON "public"."fluxos_disciplinas" USING "btree" ("empresa_id");
CREATE INDEX IF NOT EXISTS "idx_folha_pagamento_pessoa_id" ON "public"."folha_pagamento" USING "btree" ("pessoa_id");
CREATE INDEX IF NOT EXISTS "idx_fornecedores_empresa" ON "public"."fornecedores" USING "btree" ("empresa_id");
CREATE INDEX IF NOT EXISTS "idx_impersonation_sessions_admin_active" ON "public"."impersonation_sessions" USING "btree" ("admin_id", "ended_at", "expires_at") WHERE ("ended_at" IS NULL);
CREATE INDEX IF NOT EXISTS "idx_impersonation_sessions_started" ON "public"."impersonation_sessions" USING "btree" ("started_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_leads_cliente_id" ON "public"."leads" USING "btree" ("cliente_id") WHERE ("cliente_id" IS NOT NULL);
CREATE INDEX IF NOT EXISTS "idx_leads_empresa" ON "public"."leads" USING "btree" ("empresa_id");
CREATE INDEX IF NOT EXISTS "idx_leads_responsavel" ON "public"."leads" USING "btree" ("responsavel_id");
CREATE INDEX IF NOT EXISTS "idx_leads_responsavel_id" ON "public"."leads" USING "btree" ("responsavel_id") WHERE ("responsavel_id" IS NOT NULL);
CREATE INDEX IF NOT EXISTS "idx_marcos_empresa" ON "public"."marcos_faturamento" USING "btree" ("empresa_id");
CREATE INDEX IF NOT EXISTS "idx_marcos_projeto" ON "public"."marcos_faturamento" USING "btree" ("projeto_id");
CREATE INDEX IF NOT EXISTS "idx_metas_empresa_id" ON "public"."metas" USING "btree" ("empresa_id");
CREATE INDEX IF NOT EXISTS "idx_metas_pessoa_id" ON "public"."metas" USING "btree" ("pessoa_id");
CREATE INDEX IF NOT EXISTS "idx_metas_projeto_id" ON "public"."metas" USING "btree" ("projeto_id");
CREATE INDEX IF NOT EXISTS "idx_metas_tipo" ON "public"."metas" USING "btree" ("tipo");
CREATE INDEX IF NOT EXISTS "idx_mfa_backup_codes_user" ON "public"."mfa_backup_codes" USING "btree" ("user_id") WHERE ("used_at" IS NULL);
CREATE INDEX IF NOT EXISTS "idx_orcamento_fases_empresa" ON "public"."projeto_orcamento_fases" USING "btree" ("empresa_id");
CREATE INDEX IF NOT EXISTS "idx_orcamento_fases_projeto" ON "public"."projeto_orcamento_fases" USING "btree" ("projeto_id");
CREATE INDEX IF NOT EXISTS "idx_orcamento_versoes_projeto" ON "public"."orcamento_versoes" USING "btree" ("projeto_id");
CREATE INDEX IF NOT EXISTS "idx_pessoas_empresa" ON "public"."pessoas" USING "btree" ("empresa_id");
CREATE INDEX IF NOT EXISTS "idx_pilar_pending_signups_asaas_payment" ON "public"."pilar_pending_signups" USING "btree" ("asaas_payment_id") WHERE ("asaas_payment_id" IS NOT NULL);
CREATE INDEX IF NOT EXISTS "idx_pilar_pending_signups_asaas_subscription" ON "public"."pilar_pending_signups" USING "btree" ("asaas_subscription_id") WHERE ("asaas_subscription_id" IS NOT NULL);
CREATE INDEX IF NOT EXISTS "idx_pilar_pending_signups_email" ON "public"."pilar_pending_signups" USING "btree" ("lower"("email"));
CREATE INDEX IF NOT EXISTS "idx_pilar_pending_signups_session" ON "public"."pilar_pending_signups" USING "btree" ("checkout_session_token");
CREATE INDEX IF NOT EXISTS "idx_pilar_subscriptions_asaas_sub" ON "public"."pilar_subscriptions" USING "btree" ("asaas_subscription_id") WHERE ("asaas_subscription_id" IS NOT NULL);
CREATE INDEX IF NOT EXISTS "idx_pilar_subscriptions_empresa" ON "public"."pilar_subscriptions" USING "btree" ("empresa_id");
CREATE INDEX IF NOT EXISTS "idx_pilar_subscriptions_status" ON "public"."pilar_subscriptions" USING "btree" ("status");
CREATE INDEX IF NOT EXISTS "idx_pilar_webhook_logs_payment" ON "public"."pilar_checkout_webhook_logs" USING "btree" ("asaas_payment_id");
CREATE INDEX IF NOT EXISTS "idx_pilar_webhook_logs_subscription" ON "public"."pilar_checkout_webhook_logs" USING "btree" ("asaas_subscription_id");
CREATE INDEX IF NOT EXISTS "idx_portal_download_logs_empresa" ON "public"."portal_download_logs" USING "btree" ("empresa_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_portal_entregas_projeto" ON "public"."portal_entregas" USING "btree" ("projeto_id");
CREATE INDEX IF NOT EXISTS "idx_projeto_disciplina_responsaveis_disciplina_id" ON "public"."projeto_disciplina_responsaveis" USING "btree" ("projeto_disciplina_id");
CREATE INDEX IF NOT EXISTS "idx_projeto_disciplina_responsaveis_pessoa_id" ON "public"."projeto_disciplina_responsaveis" USING "btree" ("pessoa_id");
CREATE INDEX IF NOT EXISTS "idx_projeto_disciplinas_ordem_etapa" ON "public"."projeto_disciplinas" USING "btree" ("projeto_id", "ordem_etapa");
CREATE INDEX IF NOT EXISTS "idx_projeto_disciplinas_projeto_id" ON "public"."projeto_disciplinas" USING "btree" ("projeto_id");
CREATE INDEX IF NOT EXISTS "idx_projetos_empresa" ON "public"."projetos" USING "btree" ("empresa_id");
CREATE INDEX IF NOT EXISTS "idx_projetos_nome_trgm" ON "public"."projetos" USING "gin" ("nome" "public"."gin_trgm_ops");
CREATE INDEX IF NOT EXISTS "idx_proposta_disc" ON "public"."proposta_disciplinas" USING "btree" ("proposta_id");
CREATE INDEX IF NOT EXISTS "idx_proposta_templates_empresa" ON "public"."proposta_templates" USING "btree" ("empresa_id");
CREATE INDEX IF NOT EXISTS "idx_proposta_templates_tipo" ON "public"."proposta_templates" USING "btree" ("empresa_id", "tipo") WHERE ("deleted_at" IS NULL);
CREATE INDEX IF NOT EXISTS "idx_propostas_cliente_id" ON "public"."propostas" USING "btree" ("cliente_id");
CREATE INDEX IF NOT EXISTS "idx_propostas_empresa" ON "public"."propostas" USING "btree" ("empresa_id");
CREATE INDEX IF NOT EXISTS "idx_propostas_lead_id" ON "public"."propostas" USING "btree" ("lead_id");
CREATE INDEX IF NOT EXISTS "idx_propostas_projeto_id" ON "public"."propostas" USING "btree" ("projeto_id");
CREATE INDEX IF NOT EXISTS "idx_propostas_status" ON "public"."propostas" USING "btree" ("empresa_id", "status");
CREATE INDEX IF NOT EXISTS "idx_propostas_template_id" ON "public"."propostas" USING "btree" ("template_id") WHERE ("template_id" IS NOT NULL);
CREATE INDEX IF NOT EXISTS "idx_rate_limit_lookup" ON "public"."rate_limit_attempts" USING "btree" ("action", "key", "attempted_at");
CREATE INDEX IF NOT EXISTS "idx_receitas_categoria_id" ON "public"."receitas" USING "btree" ("categoria_id") WHERE ("deleted_at" IS NULL);
CREATE INDEX IF NOT EXISTS "idx_receitas_centro_custo_id" ON "public"."receitas" USING "btree" ("centro_custo_id") WHERE ("deleted_at" IS NULL);
CREATE INDEX IF NOT EXISTS "idx_receitas_cliente_id" ON "public"."receitas" USING "btree" ("cliente_id") WHERE ("deleted_at" IS NULL);
CREATE INDEX IF NOT EXISTS "idx_receitas_conta_id" ON "public"."receitas" USING "btree" ("conta_id") WHERE ("deleted_at" IS NULL);
CREATE INDEX IF NOT EXISTS "idx_receitas_desc_trgm" ON "public"."receitas" USING "gin" ("descricao" "public"."gin_trgm_ops");
CREATE INDEX IF NOT EXISTS "idx_receitas_empresa" ON "public"."receitas" USING "btree" ("empresa_id");
CREATE INDEX IF NOT EXISTS "idx_receitas_grupo_parcela" ON "public"."receitas" USING "btree" ("grupo_parcela") WHERE ("grupo_parcela" IS NOT NULL);
CREATE INDEX IF NOT EXISTS "idx_receitas_projeto" ON "public"."receitas" USING "btree" ("projeto_id") WHERE ("deleted_at" IS NULL);
CREATE INDEX IF NOT EXISTS "idx_receitas_recebimento" ON "public"."receitas" USING "btree" ("empresa_id", "data_recebimento") WHERE ("deleted_at" IS NULL);
CREATE INDEX IF NOT EXISTS "idx_receitas_status" ON "public"."receitas" USING "btree" ("empresa_id", "status") WHERE ("deleted_at" IS NULL);
CREATE INDEX IF NOT EXISTS "idx_receitas_vencimento" ON "public"."receitas" USING "btree" ("empresa_id", "data_vencimento");
CREATE INDEX IF NOT EXISTS "idx_templates_projeto_empresa" ON "public"."templates_projeto" USING "btree" ("empresa_id");
CREATE INDEX IF NOT EXISTS "idx_templates_projeto_tipo" ON "public"."templates_projeto" USING "btree" ("empresa_id", "tipo_servico");
CREATE INDEX IF NOT EXISTS "lancamento_rateios_cc_idx" ON "public"."lancamento_rateios" USING "btree" ("centro_custo_id");
CREATE INDEX IF NOT EXISTS "lancamento_rateios_empresa_idx" ON "public"."lancamento_rateios" USING "btree" ("empresa_id");
CREATE INDEX IF NOT EXISTS "lancamento_rateios_lanc_idx" ON "public"."lancamento_rateios" USING "btree" ("lancamento_id", "tipo_lancamento");
CREATE UNIQUE INDEX IF NOT EXISTS "pessoas_cpf_empresa_active_unique" ON "public"."pessoas" USING "btree" ("empresa_id", "cpf") WHERE (("deleted_at" IS NULL) AND ("cpf" IS NOT NULL) AND ("cpf" <> ''::"text"));
CREATE UNIQUE INDEX IF NOT EXISTS "pessoas_email_empresa_active_unique" ON "public"."pessoas" USING "btree" ("empresa_id", "email") WHERE (("deleted_at" IS NULL) AND ("email" IS NOT NULL) AND ("email" <> ''::"text"));
CREATE INDEX IF NOT EXISTS "receitas_centro_custo_idx" ON "public"."receitas" USING "btree" ("centro_custo_id") WHERE ("deleted_at" IS NULL);
CREATE INDEX IF NOT EXISTS "receitas_data_competencia_idx" ON "public"."receitas" USING "btree" ("data_competencia") WHERE ("deleted_at" IS NULL);
CREATE INDEX IF NOT EXISTS "transferencias_data_idx" ON "public"."transferencias" USING "btree" ("data_transferencia");
CREATE INDEX IF NOT EXISTS "transferencias_destino_idx" ON "public"."transferencias" USING "btree" ("conta_destino_id");
CREATE INDEX IF NOT EXISTS "transferencias_empresa_idx" ON "public"."transferencias" USING "btree" ("empresa_id");
CREATE INDEX IF NOT EXISTS "transferencias_origem_idx" ON "public"."transferencias" USING "btree" ("conta_origem_id");
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_data_export_pending" ON "public"."data_export_requests" USING "btree" ("user_id") WHERE ("status" = 'pending'::"text");
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_pending_signup_email_active" ON "public"."pilar_pending_signups" USING "btree" ("email") WHERE ("payment_status" = 'pending'::"text");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_asaas_webhook_logs_event_payment" ON "public"."asaas_webhook_logs" USING "btree" ("event", "payment_id") WHERE ("payment_id" IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_pilar_checkout_webhook_logs_event_payment" ON "public"."pilar_checkout_webhook_logs" USING "btree" ("event", "asaas_payment_id") WHERE ("asaas_payment_id" IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_pilar_checkout_webhook_logs_event_sub" ON "public"."pilar_checkout_webhook_logs" USING "btree" ("event", "asaas_subscription_id") WHERE (("asaas_subscription_id" IS NOT NULL) AND ("asaas_payment_id" IS NULL));
DROP TRIGGER IF EXISTS "audit_company_features" ON "public"."empresas";
CREATE OR REPLACE TRIGGER "audit_company_features" AFTER UPDATE OF "features" ON "public"."empresas" FOR EACH ROW EXECUTE FUNCTION "public"."tg_audit_company_features"();
DROP TRIGGER IF EXISTS "audit_profile_changes" ON "public"."profiles";
CREATE OR REPLACE TRIGGER "audit_profile_changes" AFTER UPDATE OF "role", "features" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."tg_audit_profile_changes"();
DROP TRIGGER IF EXISTS "despesa_enforce_data" ON "public"."despesas";
CREATE OR REPLACE TRIGGER "despesa_enforce_data" BEFORE UPDATE ON "public"."despesas" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_despesa_data_pagamento"();
DROP TRIGGER IF EXISTS "escopo_aditivo_aprovado" ON "public"."escopos";
CREATE OR REPLACE TRIGGER "escopo_aditivo_aprovado" BEFORE UPDATE ON "public"."escopos" FOR EACH ROW EXECUTE FUNCTION "public"."aditivo_aprovado_handler"();
DROP TRIGGER IF EXISTS "escopos_audit" ON "public"."escopos";
CREATE OR REPLACE TRIGGER "escopos_audit" BEFORE INSERT OR UPDATE ON "public"."escopos" FOR EACH ROW EXECUTE FUNCTION "public"."handle_record_audit"();
DROP TRIGGER IF EXISTS "escopos_prevent_company_change" ON "public"."escopos";
CREATE OR REPLACE TRIGGER "escopos_prevent_company_change" BEFORE UPDATE ON "public"."escopos" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_company_change"();
DROP TRIGGER IF EXISTS "escopos_soft_delete" ON "public"."escopos";
CREATE OR REPLACE TRIGGER "escopos_soft_delete" BEFORE DELETE ON "public"."escopos" FOR EACH ROW EXECUTE FUNCTION "public"."soft_delete_generic"();
DROP TRIGGER IF EXISTS "feature_flags_touch_updated_at" ON "public"."feature_flags";
CREATE OR REPLACE TRIGGER "feature_flags_touch_updated_at" BEFORE UPDATE ON "public"."feature_flags" FOR EACH ROW EXECUTE FUNCTION "public"."tg_feature_flags_touch_updated_at"();
DROP TRIGGER IF EXISTS "fluxos_disciplinas_audit" ON "public"."fluxos_disciplinas";
CREATE OR REPLACE TRIGGER "fluxos_disciplinas_audit" BEFORE INSERT OR UPDATE ON "public"."fluxos_disciplinas" FOR EACH ROW EXECUTE FUNCTION "public"."handle_record_audit"();
DROP TRIGGER IF EXISTS "fluxos_disciplinas_prevent_company_change" ON "public"."fluxos_disciplinas";
CREATE OR REPLACE TRIGGER "fluxos_disciplinas_prevent_company_change" BEFORE UPDATE ON "public"."fluxos_disciplinas" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_company_change"();
DROP TRIGGER IF EXISTS "fluxos_disciplinas_soft_delete" ON "public"."fluxos_disciplinas";
CREATE OR REPLACE TRIGGER "fluxos_disciplinas_soft_delete" BEFORE DELETE ON "public"."fluxos_disciplinas" FOR EACH ROW EXECUTE FUNCTION "public"."soft_delete_generic"();
DROP TRIGGER IF EXISTS "marco_auto_receita" ON "public"."marcos_faturamento";
CREATE OR REPLACE TRIGGER "marco_auto_receita" BEFORE UPDATE ON "public"."marcos_faturamento" FOR EACH ROW EXECUTE FUNCTION "public"."auto_gerar_receita_from_marco"();
DROP TRIGGER IF EXISTS "marcos_audit" ON "public"."marcos_faturamento";
CREATE OR REPLACE TRIGGER "marcos_audit" BEFORE INSERT OR UPDATE ON "public"."marcos_faturamento" FOR EACH ROW EXECUTE FUNCTION "public"."handle_record_audit"();
DROP TRIGGER IF EXISTS "marcos_prevent_company_change" ON "public"."marcos_faturamento";
CREATE OR REPLACE TRIGGER "marcos_prevent_company_change" BEFORE UPDATE ON "public"."marcos_faturamento" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_company_change"();
DROP TRIGGER IF EXISTS "marcos_soft_delete" ON "public"."marcos_faturamento";
CREATE OR REPLACE TRIGGER "marcos_soft_delete" BEFORE DELETE ON "public"."marcos_faturamento" FOR EACH ROW EXECUTE FUNCTION "public"."soft_delete_generic"();
DROP TRIGGER IF EXISTS "orcamento_fases_audit" ON "public"."projeto_orcamento_fases";
CREATE OR REPLACE TRIGGER "orcamento_fases_audit" BEFORE INSERT OR UPDATE ON "public"."projeto_orcamento_fases" FOR EACH ROW EXECUTE FUNCTION "public"."handle_record_audit"();
DROP TRIGGER IF EXISTS "orcamento_fases_prevent_company_change" ON "public"."projeto_orcamento_fases";
CREATE OR REPLACE TRIGGER "orcamento_fases_prevent_company_change" BEFORE UPDATE ON "public"."projeto_orcamento_fases" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_company_change"();
DROP TRIGGER IF EXISTS "orcamento_fases_soft_delete" ON "public"."projeto_orcamento_fases";
CREATE OR REPLACE TRIGGER "orcamento_fases_soft_delete" BEFORE DELETE ON "public"."projeto_orcamento_fases" FOR EACH ROW EXECUTE FUNCTION "public"."soft_delete_generic"();
DROP TRIGGER IF EXISTS "projeto_auto_complete" ON "public"."projetos";
CREATE OR REPLACE TRIGGER "projeto_auto_complete" BEFORE UPDATE ON "public"."projetos" FOR EACH ROW EXECUTE FUNCTION "public"."auto_complete_disciplinas"();
DROP TRIGGER IF EXISTS "propostas_audit" ON "public"."propostas";
CREATE OR REPLACE TRIGGER "propostas_audit" BEFORE INSERT OR UPDATE ON "public"."propostas" FOR EACH ROW EXECUTE FUNCTION "public"."handle_record_audit"();
DROP TRIGGER IF EXISTS "propostas_prevent_company_change" ON "public"."propostas";
CREATE OR REPLACE TRIGGER "propostas_prevent_company_change" BEFORE UPDATE ON "public"."propostas" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_company_change"();
DROP TRIGGER IF EXISTS "propostas_soft_delete" ON "public"."propostas";
CREATE OR REPLACE TRIGGER "propostas_soft_delete" BEFORE DELETE ON "public"."propostas" FOR EACH ROW EXECUTE FUNCTION "public"."soft_delete_generic"();
DROP TRIGGER IF EXISTS "protect_ultra_admin" ON "public"."profiles";
CREATE OR REPLACE TRIGGER "protect_ultra_admin" BEFORE INSERT OR UPDATE OF "role" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."tg_protect_ultra_admin"();
DROP TRIGGER IF EXISTS "receita_enforce_data" ON "public"."receitas";
CREATE OR REPLACE TRIGGER "receita_enforce_data" BEFORE UPDATE ON "public"."receitas" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_receita_data_recebimento"();
DROP TRIGGER IF EXISTS "templates_projeto_audit" ON "public"."templates_projeto";
CREATE OR REPLACE TRIGGER "templates_projeto_audit" BEFORE INSERT OR UPDATE ON "public"."templates_projeto" FOR EACH ROW EXECUTE FUNCTION "public"."handle_record_audit"();
DROP TRIGGER IF EXISTS "templates_projeto_prevent_company_change" ON "public"."templates_projeto";
CREATE OR REPLACE TRIGGER "templates_projeto_prevent_company_change" BEFORE UPDATE ON "public"."templates_projeto" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_company_change"();
DROP TRIGGER IF EXISTS "templates_projeto_soft_delete" ON "public"."templates_projeto";
CREATE OR REPLACE TRIGGER "templates_projeto_soft_delete" BEFORE DELETE ON "public"."templates_projeto" FOR EACH ROW EXECUTE FUNCTION "public"."soft_delete_generic"();
DROP TRIGGER IF EXISTS "tg_cascade_feature_revocation" ON "public"."empresas";
CREATE OR REPLACE TRIGGER "tg_cascade_feature_revocation" AFTER UPDATE OF "features" ON "public"."empresas" FOR EACH ROW EXECUTE FUNCTION "public"."tg_cascade_feature_revocation"();
DROP TRIGGER IF EXISTS "tg_validate_convite_features_subset" ON "public"."convites";
CREATE OR REPLACE TRIGGER "tg_validate_convite_features_subset" BEFORE INSERT OR UPDATE OF "features", "empresa_id" ON "public"."convites" FOR EACH ROW EXECUTE FUNCTION "public"."tg_validate_convite_features_subset"();
DROP TRIGGER IF EXISTS "tg_validate_features_subset" ON "public"."profiles";
CREATE OR REPLACE TRIGGER "tg_validate_features_subset" BEFORE INSERT OR UPDATE OF "features", "empresa_id" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."tg_validate_features_subset"();
DROP TRIGGER IF EXISTS "tr_alocar_despesa_fatura" ON "public"."despesas";
CREATE OR REPLACE TRIGGER "tr_alocar_despesa_fatura" BEFORE INSERT OR UPDATE OF "cartao_id", "data_competencia", "data_vencimento" ON "public"."despesas" FOR EACH ROW EXECUTE FUNCTION "public"."tr_alocar_despesa_fatura"();
DROP TRIGGER IF EXISTS "tr_audit_cartoes" ON "public"."cartoes";
CREATE OR REPLACE TRIGGER "tr_audit_cartoes" BEFORE INSERT OR UPDATE ON "public"."cartoes" FOR EACH ROW EXECUTE FUNCTION "public"."handle_record_audit"();
DROP TRIGGER IF EXISTS "tr_audit_categorias" ON "public"."categorias_financeiras";
CREATE OR REPLACE TRIGGER "tr_audit_categorias" BEFORE INSERT OR UPDATE ON "public"."categorias_financeiras" FOR EACH ROW EXECUTE FUNCTION "public"."handle_record_audit"();
DROP TRIGGER IF EXISTS "tr_audit_clientes" ON "public"."clientes";
CREATE OR REPLACE TRIGGER "tr_audit_clientes" BEFORE INSERT OR UPDATE ON "public"."clientes" FOR EACH ROW EXECUTE FUNCTION "public"."handle_record_audit"();
DROP TRIGGER IF EXISTS "tr_audit_contas" ON "public"."contas";
CREATE OR REPLACE TRIGGER "tr_audit_contas" BEFORE INSERT OR UPDATE ON "public"."contas" FOR EACH ROW EXECUTE FUNCTION "public"."handle_record_audit"();
DROP TRIGGER IF EXISTS "tr_audit_despesas" ON "public"."despesas";
CREATE OR REPLACE TRIGGER "tr_audit_despesas" BEFORE INSERT OR UPDATE ON "public"."despesas" FOR EACH ROW EXECUTE FUNCTION "public"."handle_record_audit"();
DROP TRIGGER IF EXISTS "tr_audit_empresas" ON "public"."empresas";
CREATE OR REPLACE TRIGGER "tr_audit_empresas" BEFORE INSERT OR UPDATE ON "public"."empresas" FOR EACH ROW EXECUTE FUNCTION "public"."handle_record_audit"();
DROP TRIGGER IF EXISTS "tr_audit_faturas" ON "public"."faturas";
CREATE OR REPLACE TRIGGER "tr_audit_faturas" BEFORE INSERT OR UPDATE ON "public"."faturas" FOR EACH ROW EXECUTE FUNCTION "public"."handle_record_audit"();
DROP TRIGGER IF EXISTS "tr_audit_fornecedores" ON "public"."fornecedores";
CREATE OR REPLACE TRIGGER "tr_audit_fornecedores" BEFORE INSERT OR UPDATE ON "public"."fornecedores" FOR EACH ROW EXECUTE FUNCTION "public"."handle_record_audit"();
DROP TRIGGER IF EXISTS "tr_audit_leads" ON "public"."leads";
CREATE OR REPLACE TRIGGER "tr_audit_leads" BEFORE INSERT OR UPDATE ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."handle_record_audit"();
DROP TRIGGER IF EXISTS "tr_audit_pessoas" ON "public"."pessoas";
CREATE OR REPLACE TRIGGER "tr_audit_pessoas" BEFORE INSERT OR UPDATE ON "public"."pessoas" FOR EACH ROW EXECUTE FUNCTION "public"."handle_record_audit"();
DROP TRIGGER IF EXISTS "tr_audit_profiles" ON "public"."profiles";
CREATE OR REPLACE TRIGGER "tr_audit_profiles" BEFORE INSERT OR UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_record_audit"();
DROP TRIGGER IF EXISTS "tr_audit_projetos" ON "public"."projetos";
CREATE OR REPLACE TRIGGER "tr_audit_projetos" BEFORE INSERT OR UPDATE ON "public"."projetos" FOR EACH ROW EXECUTE FUNCTION "public"."handle_record_audit"();
DROP TRIGGER IF EXISTS "tr_audit_receitas" ON "public"."receitas";
CREATE OR REPLACE TRIGGER "tr_audit_receitas" BEFORE INSERT OR UPDATE ON "public"."receitas" FOR EACH ROW EXECUTE FUNCTION "public"."handle_record_audit"();
DROP TRIGGER IF EXISTS "tr_calculate_status_data" ON "public"."projetos";
CREATE OR REPLACE TRIGGER "tr_calculate_status_data" BEFORE INSERT OR UPDATE ON "public"."projetos" FOR EACH ROW EXECUTE FUNCTION "public"."calculate_status_data"();
DROP TRIGGER IF EXISTS "tr_link_pessoa_profile_before" ON "public"."pessoas";
CREATE OR REPLACE TRIGGER "tr_link_pessoa_profile_before" BEFORE INSERT OR UPDATE OF "email" ON "public"."pessoas" FOR EACH ROW EXECUTE FUNCTION "public"."link_pessoa_profile_before"();
DROP TRIGGER IF EXISTS "tr_link_profile_pessoa_after" ON "public"."profiles";
CREATE OR REPLACE TRIGGER "tr_link_profile_pessoa_after" AFTER INSERT OR UPDATE OF "email" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."link_profile_pessoa_after"();
DROP TRIGGER IF EXISTS "tr_pilar_link_subscription_on_owner_used" ON "public"."empresa_owners_pending";
CREATE OR REPLACE TRIGGER "tr_pilar_link_subscription_on_owner_used" AFTER UPDATE OF "usado_em" ON "public"."empresa_owners_pending" FOR EACH ROW EXECUTE FUNCTION "public"."tg_pilar_link_subscription_on_owner_used"();
DROP TRIGGER IF EXISTS "tr_pilar_pending_signups_touch" ON "public"."pilar_pending_signups";
CREATE OR REPLACE TRIGGER "tr_pilar_pending_signups_touch" BEFORE UPDATE ON "public"."pilar_pending_signups" FOR EACH ROW EXECUTE FUNCTION "public"."tg_pilar_touch_updated_at"();
DROP TRIGGER IF EXISTS "tr_pilar_subscriptions_touch" ON "public"."pilar_subscriptions";
CREATE OR REPLACE TRIGGER "tr_pilar_subscriptions_touch" BEFORE UPDATE ON "public"."pilar_subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."tg_pilar_touch_updated_at"();
DROP TRIGGER IF EXISTS "tr_recalc_fatura_total" ON "public"."despesas";
CREATE OR REPLACE TRIGGER "tr_recalc_fatura_total" AFTER INSERT OR DELETE OR UPDATE OF "valor", "fatura_id", "deleted_at" ON "public"."despesas" FOR EACH ROW EXECUTE FUNCTION "public"."tr_recalc_fatura_total"();
DROP TRIGGER IF EXISTS "tr_recalc_grupo_parcela_despesas" ON "public"."despesas";
CREATE OR REPLACE TRIGGER "tr_recalc_grupo_parcela_despesas" AFTER INSERT OR DELETE OR UPDATE OF "status", "deleted_at", "grupo_parcela" ON "public"."despesas" FOR EACH ROW EXECUTE FUNCTION "public"."tr_recalc_grupo_parcela"();
DROP TRIGGER IF EXISTS "tr_recalc_grupo_parcela_receitas" ON "public"."receitas";
CREATE OR REPLACE TRIGGER "tr_recalc_grupo_parcela_receitas" AFTER INSERT OR DELETE OR UPDATE OF "status", "deleted_at", "grupo_parcela" ON "public"."receitas" FOR EACH ROW EXECUTE FUNCTION "public"."tr_recalc_grupo_parcela"();
DROP TRIGGER IF EXISTS "tr_soft_del_cartoes" ON "public"."cartoes";
CREATE OR REPLACE TRIGGER "tr_soft_del_cartoes" BEFORE DELETE ON "public"."cartoes" FOR EACH ROW EXECUTE FUNCTION "public"."soft_delete_generic"();
DROP TRIGGER IF EXISTS "tr_soft_del_clientes" ON "public"."clientes";
CREATE OR REPLACE TRIGGER "tr_soft_del_clientes" BEFORE DELETE ON "public"."clientes" FOR EACH ROW EXECUTE FUNCTION "public"."soft_delete_generic"();
DROP TRIGGER IF EXISTS "tr_soft_del_contas" ON "public"."contas";
CREATE OR REPLACE TRIGGER "tr_soft_del_contas" BEFORE DELETE ON "public"."contas" FOR EACH ROW EXECUTE FUNCTION "public"."soft_delete_generic"();
DROP TRIGGER IF EXISTS "tr_soft_del_despesas" ON "public"."despesas";
CREATE OR REPLACE TRIGGER "tr_soft_del_despesas" BEFORE DELETE ON "public"."despesas" FOR EACH ROW EXECUTE FUNCTION "public"."soft_delete_generic"();
DROP TRIGGER IF EXISTS "tr_soft_del_faturas" ON "public"."faturas";
CREATE OR REPLACE TRIGGER "tr_soft_del_faturas" BEFORE DELETE ON "public"."faturas" FOR EACH ROW EXECUTE FUNCTION "public"."soft_delete_generic"();
DROP TRIGGER IF EXISTS "tr_soft_del_fornecedores" ON "public"."fornecedores";
CREATE OR REPLACE TRIGGER "tr_soft_del_fornecedores" BEFORE DELETE ON "public"."fornecedores" FOR EACH ROW EXECUTE FUNCTION "public"."soft_delete_generic"();
DROP TRIGGER IF EXISTS "tr_soft_del_leads" ON "public"."leads";
CREATE OR REPLACE TRIGGER "tr_soft_del_leads" BEFORE DELETE ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."soft_delete_generic"();
DROP TRIGGER IF EXISTS "tr_soft_del_pessoas" ON "public"."pessoas";
CREATE OR REPLACE TRIGGER "tr_soft_del_pessoas" BEFORE DELETE ON "public"."pessoas" FOR EACH ROW EXECUTE FUNCTION "public"."soft_delete_generic"();
DROP TRIGGER IF EXISTS "tr_soft_del_projetos" ON "public"."projetos";
CREATE OR REPLACE TRIGGER "tr_soft_del_projetos" BEFORE DELETE ON "public"."projetos" FOR EACH ROW EXECUTE FUNCTION "public"."soft_delete_generic"();
DROP TRIGGER IF EXISTS "tr_soft_del_receitas" ON "public"."receitas";
CREATE OR REPLACE TRIGGER "tr_soft_del_receitas" BEFORE DELETE ON "public"."receitas" FOR EACH ROW EXECUTE FUNCTION "public"."soft_delete_generic"();
DROP TRIGGER IF EXISTS "trg_notify_data_deletion_request" ON "public"."data_deletion_requests";
CREATE OR REPLACE TRIGGER "trg_notify_data_deletion_request" AFTER INSERT ON "public"."data_deletion_requests" FOR EACH ROW EXECUTE FUNCTION "public"."notify_data_deletion_request"();
DROP TRIGGER IF EXISTS "trigger_escopo_aprovado" ON "public"."escopos";
CREATE OR REPLACE TRIGGER "trigger_escopo_aprovado" AFTER UPDATE ON "public"."escopos" FOR EACH ROW EXECUTE FUNCTION "public"."handle_escopo_aprovado"();
DROP TRIGGER IF EXISTS "trigger_orcamento_versao" ON "public"."projeto_orcamento_fases";
CREATE OR REPLACE TRIGGER "trigger_orcamento_versao" AFTER INSERT OR UPDATE ON "public"."projeto_orcamento_fases" FOR EACH ROW EXECUTE FUNCTION "public"."handle_orcamento_versao"();
DROP TRIGGER IF EXISTS "validate_convite_features" ON "public"."convites";
CREATE OR REPLACE TRIGGER "validate_convite_features" BEFORE INSERT OR UPDATE OF "features", "cargo" ON "public"."convites" FOR EACH ROW EXECUTE FUNCTION "public"."tg_validate_convite_features"();
DROP TRIGGER IF EXISTS "validate_profile_features" ON "public"."profiles";
CREATE OR REPLACE TRIGGER "validate_profile_features" BEFORE INSERT OR UPDATE OF "features", "role" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."tg_validate_profile_features"();
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='alertas_empresa_id_fkey') THEN
    ALTER TABLE ONLY "public"."alertas"
    ADD CONSTRAINT "alertas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='alertas_lido_por_fkey') THEN
    ALTER TABLE ONLY "public"."alertas"
    ADD CONSTRAINT "alertas_lido_por_fkey" FOREIGN KEY ("lido_por") REFERENCES "auth"."users"("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='aprovacoes_aprovador_id_fkey') THEN
    ALTER TABLE ONLY "public"."aprovacoes"
    ADD CONSTRAINT "aprovacoes_aprovador_id_fkey" FOREIGN KEY ("aprovador_id") REFERENCES "auth"."users"("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='aprovacoes_created_by_fkey') THEN
    ALTER TABLE ONLY "public"."aprovacoes"
    ADD CONSTRAINT "aprovacoes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='aprovacoes_empresa_id_fkey') THEN
    ALTER TABLE ONLY "public"."aprovacoes"
    ADD CONSTRAINT "aprovacoes_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='aprovacoes_solicitante_id_fkey') THEN
    ALTER TABLE ONLY "public"."aprovacoes"
    ADD CONSTRAINT "aprovacoes_solicitante_id_fkey" FOREIGN KEY ("solicitante_id") REFERENCES "auth"."users"("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='aprovacoes_updated_by_fkey') THEN
    ALTER TABLE ONLY "public"."aprovacoes"
    ADD CONSTRAINT "aprovacoes_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='asaas_config_empresa_id_fkey') THEN
    ALTER TABLE ONLY "public"."asaas_config"
    ADD CONSTRAINT "asaas_config_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='asaas_webhook_logs_empresa_id_fkey') THEN
    ALTER TABLE ONLY "public"."asaas_webhook_logs"
    ADD CONSTRAINT "asaas_webhook_logs_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='asaas_webhook_logs_receita_id_fkey') THEN
    ALTER TABLE ONLY "public"."asaas_webhook_logs"
    ADD CONSTRAINT "asaas_webhook_logs_receita_id_fkey" FOREIGN KEY ("receita_id") REFERENCES "public"."receitas"("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='audit_logs_actor_id_fkey') THEN
    ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='cartoes_conta_pagamento_id_fkey') THEN
    ALTER TABLE ONLY "public"."cartoes"
    ADD CONSTRAINT "cartoes_conta_pagamento_id_fkey" FOREIGN KEY ("conta_pagamento_id") REFERENCES "public"."contas"("id") ON DELETE SET NULL;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='cartoes_empresa_id_fkey') THEN
    ALTER TABLE ONLY "public"."cartoes"
    ADD CONSTRAINT "cartoes_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='categorias_financeiras_empresa_id_fkey') THEN
    ALTER TABLE ONLY "public"."categorias_financeiras"
    ADD CONSTRAINT "categorias_financeiras_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='centros_custo_empresa_id_fkey') THEN
    ALTER TABLE ONLY "public"."centros_custo"
    ADD CONSTRAINT "centros_custo_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='cliente_portal_accounts_cliente_id_fkey') THEN
    ALTER TABLE ONLY "public"."cliente_portal_accounts"
    ADD CONSTRAINT "cliente_portal_accounts_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='cliente_portal_accounts_created_by_fkey') THEN
    ALTER TABLE ONLY "public"."cliente_portal_accounts"
    ADD CONSTRAINT "cliente_portal_accounts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='cliente_portal_accounts_empresa_id_fkey') THEN
    ALTER TABLE ONLY "public"."cliente_portal_accounts"
    ADD CONSTRAINT "cliente_portal_accounts_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='clientes_created_by_fkey') THEN
    ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='clientes_empresa_id_fkey') THEN
    ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='clientes_updated_by_fkey') THEN
    ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='contas_empresa_id_fkey') THEN
    ALTER TABLE ONLY "public"."contas"
    ADD CONSTRAINT "contas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='convites_criado_por_fkey') THEN
    ALTER TABLE ONLY "public"."convites"
    ADD CONSTRAINT "convites_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "auth"."users"("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='convites_empresa_id_fkey') THEN
    ALTER TABLE ONLY "public"."convites"
    ADD CONSTRAINT "convites_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='critical_alerts_empresa_id_fkey') THEN
    ALTER TABLE ONLY "public"."critical_alerts"
    ADD CONSTRAINT "critical_alerts_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='data_deletion_requests_empresa_id_fkey') THEN
    ALTER TABLE ONLY "public"."data_deletion_requests"
    ADD CONSTRAINT "data_deletion_requests_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE SET NULL;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='data_deletion_requests_processed_by_fkey') THEN
    ALTER TABLE ONLY "public"."data_deletion_requests"
    ADD CONSTRAINT "data_deletion_requests_processed_by_fkey" FOREIGN KEY ("processed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='data_deletion_requests_user_id_fkey') THEN
    ALTER TABLE ONLY "public"."data_deletion_requests"
    ADD CONSTRAINT "data_deletion_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='data_export_requests_empresa_id_fkey') THEN
    ALTER TABLE ONLY "public"."data_export_requests"
    ADD CONSTRAINT "data_export_requests_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE SET NULL;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='data_export_requests_user_id_fkey') THEN
    ALTER TABLE ONLY "public"."data_export_requests"
    ADD CONSTRAINT "data_export_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='despesas_cartao_id_fkey') THEN
    ALTER TABLE ONLY "public"."despesas"
    ADD CONSTRAINT "despesas_cartao_id_fkey" FOREIGN KEY ("cartao_id") REFERENCES "public"."cartoes"("id") ON DELETE SET NULL;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='despesas_categoria_id_fkey') THEN
    ALTER TABLE ONLY "public"."despesas"
    ADD CONSTRAINT "despesas_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias_financeiras"("id") ON DELETE SET NULL;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='despesas_centro_custo_id_fkey') THEN
    ALTER TABLE ONLY "public"."despesas"
    ADD CONSTRAINT "despesas_centro_custo_id_fkey" FOREIGN KEY ("centro_custo_id") REFERENCES "public"."centros_custo"("id") ON DELETE SET NULL;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='despesas_conta_id_fkey') THEN
    ALTER TABLE ONLY "public"."despesas"
    ADD CONSTRAINT "despesas_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "public"."contas"("id") ON DELETE SET NULL;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='despesas_created_by_fkey') THEN
    ALTER TABLE ONLY "public"."despesas"
    ADD CONSTRAINT "despesas_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='despesas_despesa_pai_id_fkey') THEN
    ALTER TABLE ONLY "public"."despesas"
    ADD CONSTRAINT "despesas_despesa_pai_id_fkey" FOREIGN KEY ("despesa_pai_id") REFERENCES "public"."despesas"("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='despesas_empresa_id_fkey') THEN
    ALTER TABLE ONLY "public"."despesas"
    ADD CONSTRAINT "despesas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='despesas_fornecedor_id_fkey') THEN
    ALTER TABLE ONLY "public"."despesas"
    ADD CONSTRAINT "despesas_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "public"."fornecedores"("id") ON DELETE SET NULL;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='despesas_projeto_id_fkey') THEN
    ALTER TABLE ONLY "public"."despesas"
    ADD CONSTRAINT "despesas_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "public"."projetos"("id") ON DELETE SET NULL;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='despesas_updated_by_fkey') THEN
    ALTER TABLE ONLY "public"."despesas"
    ADD CONSTRAINT "despesas_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='empresa_owners_pending_criado_por_fkey') THEN
    ALTER TABLE ONLY "public"."empresa_owners_pending"
    ADD CONSTRAINT "empresa_owners_pending_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "auth"."users"("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='empresas_created_by_fkey') THEN
    ALTER TABLE ONLY "public"."empresas"
    ADD CONSTRAINT "empresas_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='empresas_owner_id_fkey') THEN
    ALTER TABLE ONLY "public"."empresas"
    ADD CONSTRAINT "empresas_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='empresas_updated_by_fkey') THEN
    ALTER TABLE ONLY "public"."empresas"
    ADD CONSTRAINT "empresas_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='escopo_historico_escopo_id_fkey') THEN
    ALTER TABLE ONLY "public"."escopo_historico"
    ADD CONSTRAINT "escopo_historico_escopo_id_fkey" FOREIGN KEY ("escopo_id") REFERENCES "public"."escopos"("id") ON DELETE CASCADE;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='escopo_historico_usuario_id_fkey') THEN
    ALTER TABLE ONLY "public"."escopo_historico"
    ADD CONSTRAINT "escopo_historico_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "auth"."users"("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='escopo_itens_escopo_id_fkey') THEN
    ALTER TABLE ONLY "public"."escopo_itens"
    ADD CONSTRAINT "escopo_itens_escopo_id_fkey" FOREIGN KEY ("escopo_id") REFERENCES "public"."escopos"("id") ON DELETE CASCADE;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='escopos_aprovado_por_fkey') THEN
    ALTER TABLE ONLY "public"."escopos"
    ADD CONSTRAINT "escopos_aprovado_por_fkey" FOREIGN KEY ("aprovado_por") REFERENCES "auth"."users"("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='escopos_created_by_fkey') THEN
    ALTER TABLE ONLY "public"."escopos"
    ADD CONSTRAINT "escopos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='escopos_empresa_id_fkey') THEN
    ALTER TABLE ONLY "public"."escopos"
    ADD CONSTRAINT "escopos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='escopos_projeto_id_fkey') THEN
    ALTER TABLE ONLY "public"."escopos"
    ADD CONSTRAINT "escopos_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "public"."projetos"("id") ON DELETE CASCADE;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='escopos_updated_by_fkey') THEN
    ALTER TABLE ONLY "public"."escopos"
    ADD CONSTRAINT "escopos_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='faturas_cartao_id_fkey') THEN
    ALTER TABLE ONLY "public"."faturas"
    ADD CONSTRAINT "faturas_cartao_id_fkey" FOREIGN KEY ("cartao_id") REFERENCES "public"."cartoes"("id") ON DELETE RESTRICT;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='faturas_conta_pagamento_id_fkey') THEN
    ALTER TABLE ONLY "public"."faturas"
    ADD CONSTRAINT "faturas_conta_pagamento_id_fkey" FOREIGN KEY ("conta_pagamento_id") REFERENCES "public"."contas"("id") ON DELETE SET NULL;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='faturas_created_by_fkey') THEN
    ALTER TABLE ONLY "public"."faturas"
    ADD CONSTRAINT "faturas_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='faturas_empresa_id_fkey') THEN
    ALTER TABLE ONLY "public"."faturas"
    ADD CONSTRAINT "faturas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='faturas_updated_by_fkey') THEN
    ALTER TABLE ONLY "public"."faturas"
    ADD CONSTRAINT "faturas_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fluxos_disciplinas_created_by_fkey') THEN
    ALTER TABLE ONLY "public"."fluxos_disciplinas"
    ADD CONSTRAINT "fluxos_disciplinas_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fluxos_disciplinas_empresa_id_fkey') THEN
    ALTER TABLE ONLY "public"."fluxos_disciplinas"
    ADD CONSTRAINT "fluxos_disciplinas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fluxos_disciplinas_updated_by_fkey') THEN
    ALTER TABLE ONLY "public"."fluxos_disciplinas"
    ADD CONSTRAINT "fluxos_disciplinas_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='folha_pagamento_pessoa_id_fkey') THEN
    ALTER TABLE ONLY "public"."folha_pagamento"
    ADD CONSTRAINT "folha_pagamento_pessoa_id_fkey" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoas"("id") ON DELETE CASCADE;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fornecedores_empresa_id_fkey') THEN
    ALTER TABLE ONLY "public"."fornecedores"
    ADD CONSTRAINT "fornecedores_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='grupos_parcela_categoria_id_fkey') THEN
    ALTER TABLE ONLY "public"."grupos_parcela"
    ADD CONSTRAINT "grupos_parcela_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias_financeiras"("id") ON DELETE SET NULL;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='grupos_parcela_centro_custo_id_fkey') THEN
    ALTER TABLE ONLY "public"."grupos_parcela"
    ADD CONSTRAINT "grupos_parcela_centro_custo_id_fkey" FOREIGN KEY ("centro_custo_id") REFERENCES "public"."centros_custo"("id") ON DELETE SET NULL;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='grupos_parcela_empresa_id_fkey') THEN
    ALTER TABLE ONLY "public"."grupos_parcela"
    ADD CONSTRAINT "grupos_parcela_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='grupos_parcela_projeto_id_fkey') THEN
    ALTER TABLE ONLY "public"."grupos_parcela"
    ADD CONSTRAINT "grupos_parcela_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "public"."projetos"("id") ON DELETE SET NULL;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='grupos_parcela_renegociado_de_fkey') THEN
    ALTER TABLE ONLY "public"."grupos_parcela"
    ADD CONSTRAINT "grupos_parcela_renegociado_de_fkey" FOREIGN KEY ("renegociado_de") REFERENCES "public"."grupos_parcela"("id") ON DELETE SET NULL;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='impersonation_sessions_admin_id_fkey') THEN
    ALTER TABLE ONLY "public"."impersonation_sessions"
    ADD CONSTRAINT "impersonation_sessions_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='lancamento_rateios_centro_custo_id_fkey') THEN
    ALTER TABLE ONLY "public"."lancamento_rateios"
    ADD CONSTRAINT "lancamento_rateios_centro_custo_id_fkey" FOREIGN KEY ("centro_custo_id") REFERENCES "public"."centros_custo"("id") ON DELETE RESTRICT;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='lancamento_rateios_empresa_id_fkey') THEN
    ALTER TABLE ONLY "public"."lancamento_rateios"
    ADD CONSTRAINT "lancamento_rateios_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='leads_cliente_id_fkey') THEN
    ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE SET NULL;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='leads_created_by_fkey') THEN
    ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='leads_empresa_id_fkey') THEN
    ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='leads_responsavel_id_fkey') THEN
    ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='marcos_faturamento_created_by_fkey') THEN
    ALTER TABLE ONLY "public"."marcos_faturamento"
    ADD CONSTRAINT "marcos_faturamento_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='marcos_faturamento_empresa_id_fkey') THEN
    ALTER TABLE ONLY "public"."marcos_faturamento"
    ADD CONSTRAINT "marcos_faturamento_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='marcos_faturamento_projeto_id_fkey') THEN
    ALTER TABLE ONLY "public"."marcos_faturamento"
    ADD CONSTRAINT "marcos_faturamento_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "public"."projetos"("id") ON DELETE CASCADE;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='marcos_faturamento_receita_id_fkey') THEN
    ALTER TABLE ONLY "public"."marcos_faturamento"
    ADD CONSTRAINT "marcos_faturamento_receita_id_fkey" FOREIGN KEY ("receita_id") REFERENCES "public"."receitas"("id") ON DELETE SET NULL;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='marcos_faturamento_updated_by_fkey') THEN
    ALTER TABLE ONLY "public"."marcos_faturamento"
    ADD CONSTRAINT "marcos_faturamento_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='metas_empresa_id_fkey') THEN
    ALTER TABLE ONLY "public"."metas"
    ADD CONSTRAINT "metas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='metas_pessoa_id_fkey') THEN
    ALTER TABLE ONLY "public"."metas"
    ADD CONSTRAINT "metas_pessoa_id_fkey" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoas"("id") ON DELETE SET NULL;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='metas_projeto_id_fkey') THEN
    ALTER TABLE ONLY "public"."metas"
    ADD CONSTRAINT "metas_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "public"."projetos"("id") ON DELETE SET NULL;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='mfa_backup_codes_user_id_fkey') THEN
    ALTER TABLE ONLY "public"."mfa_backup_codes"
    ADD CONSTRAINT "mfa_backup_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='orcamento_versoes_criado_por_fkey') THEN
    ALTER TABLE ONLY "public"."orcamento_versoes"
    ADD CONSTRAINT "orcamento_versoes_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "auth"."users"("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='orcamento_versoes_empresa_id_fkey') THEN
    ALTER TABLE ONLY "public"."orcamento_versoes"
    ADD CONSTRAINT "orcamento_versoes_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='orcamento_versoes_projeto_id_fkey') THEN
    ALTER TABLE ONLY "public"."orcamento_versoes"
    ADD CONSTRAINT "orcamento_versoes_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "public"."projetos"("id") ON DELETE CASCADE;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pessoas_created_by_fkey') THEN
    ALTER TABLE ONLY "public"."pessoas"
    ADD CONSTRAINT "pessoas_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pessoas_empresa_id_fkey') THEN
    ALTER TABLE ONLY "public"."pessoas"
    ADD CONSTRAINT "pessoas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pessoas_profile_id_fkey') THEN
    ALTER TABLE ONLY "public"."pessoas"
    ADD CONSTRAINT "pessoas_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pessoas_updated_by_fkey') THEN
    ALTER TABLE ONLY "public"."pessoas"
    ADD CONSTRAINT "pessoas_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pilar_checkout_webhook_logs_pending_signup_id_fkey') THEN
    ALTER TABLE ONLY "public"."pilar_checkout_webhook_logs"
    ADD CONSTRAINT "pilar_checkout_webhook_logs_pending_signup_id_fkey" FOREIGN KEY ("pending_signup_id") REFERENCES "public"."pilar_pending_signups"("id") ON DELETE SET NULL;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pilar_checkout_webhook_logs_subscription_id_fkey') THEN
    ALTER TABLE ONLY "public"."pilar_checkout_webhook_logs"
    ADD CONSTRAINT "pilar_checkout_webhook_logs_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."pilar_subscriptions"("id") ON DELETE SET NULL;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pilar_pending_signups_empresa_owner_pending_id_fkey') THEN
    ALTER TABLE ONLY "public"."pilar_pending_signups"
    ADD CONSTRAINT "pilar_pending_signups_empresa_owner_pending_id_fkey" FOREIGN KEY ("empresa_owner_pending_id") REFERENCES "public"."empresa_owners_pending"("id") ON DELETE SET NULL;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pilar_pending_signups_plan_id_fkey') THEN
    ALTER TABLE ONLY "public"."pilar_pending_signups"
    ADD CONSTRAINT "pilar_pending_signups_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."pilar_subscription_plans"("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pilar_subscriptions_empresa_id_fkey') THEN
    ALTER TABLE ONLY "public"."pilar_subscriptions"
    ADD CONSTRAINT "pilar_subscriptions_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pilar_subscriptions_pending_signup_id_fkey') THEN
    ALTER TABLE ONLY "public"."pilar_subscriptions"
    ADD CONSTRAINT "pilar_subscriptions_pending_signup_id_fkey" FOREIGN KEY ("pending_signup_id") REFERENCES "public"."pilar_pending_signups"("id") ON DELETE SET NULL;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pilar_subscriptions_plan_id_fkey') THEN
    ALTER TABLE ONLY "public"."pilar_subscriptions"
    ADD CONSTRAINT "pilar_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."pilar_subscription_plans"("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='portal_download_logs_cliente_id_fkey') THEN
    ALTER TABLE ONLY "public"."portal_download_logs"
    ADD CONSTRAINT "portal_download_logs_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE SET NULL;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='portal_download_logs_empresa_id_fkey') THEN
    ALTER TABLE ONLY "public"."portal_download_logs"
    ADD CONSTRAINT "portal_download_logs_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='portal_entregas_created_by_fkey') THEN
    ALTER TABLE ONLY "public"."portal_entregas"
    ADD CONSTRAINT "portal_entregas_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='portal_entregas_empresa_id_fkey') THEN
    ALTER TABLE ONLY "public"."portal_entregas"
    ADD CONSTRAINT "portal_entregas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='portal_entregas_projeto_id_fkey') THEN
    ALTER TABLE ONLY "public"."portal_entregas"
    ADD CONSTRAINT "portal_entregas_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "public"."projetos"("id") ON DELETE CASCADE;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='profiles_created_by_fkey') THEN
    ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='profiles_empresa_id_fkey') THEN
    ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='profiles_id_fkey') THEN
    ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='profiles_updated_by_fkey') THEN
    ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='projeto_disciplina_responsaveis_pessoa_id_fkey') THEN
    ALTER TABLE ONLY "public"."projeto_disciplina_responsaveis"
    ADD CONSTRAINT "projeto_disciplina_responsaveis_pessoa_id_fkey" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoas"("id") ON DELETE CASCADE;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='projeto_disciplina_responsaveis_projeto_disciplina_id_fkey') THEN
    ALTER TABLE ONLY "public"."projeto_disciplina_responsaveis"
    ADD CONSTRAINT "projeto_disciplina_responsaveis_projeto_disciplina_id_fkey" FOREIGN KEY ("projeto_disciplina_id") REFERENCES "public"."projeto_disciplinas"("id") ON DELETE CASCADE;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='projeto_disciplinas_projeto_id_fkey') THEN
    ALTER TABLE ONLY "public"."projeto_disciplinas"
    ADD CONSTRAINT "projeto_disciplinas_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "public"."projetos"("id") ON DELETE CASCADE;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='projeto_orcamento_fases_created_by_fkey') THEN
    ALTER TABLE ONLY "public"."projeto_orcamento_fases"
    ADD CONSTRAINT "projeto_orcamento_fases_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='projeto_orcamento_fases_empresa_id_fkey') THEN
    ALTER TABLE ONLY "public"."projeto_orcamento_fases"
    ADD CONSTRAINT "projeto_orcamento_fases_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='projeto_orcamento_fases_projeto_id_fkey') THEN
    ALTER TABLE ONLY "public"."projeto_orcamento_fases"
    ADD CONSTRAINT "projeto_orcamento_fases_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "public"."projetos"("id") ON DELETE CASCADE;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='projeto_orcamento_fases_updated_by_fkey') THEN
    ALTER TABLE ONLY "public"."projeto_orcamento_fases"
    ADD CONSTRAINT "projeto_orcamento_fases_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='projetos_cliente_id_fkey') THEN
    ALTER TABLE ONLY "public"."projetos"
    ADD CONSTRAINT "projetos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE RESTRICT;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='projetos_created_by_fkey') THEN
    ALTER TABLE ONLY "public"."projetos"
    ADD CONSTRAINT "projetos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='projetos_empresa_id_fkey') THEN
    ALTER TABLE ONLY "public"."projetos"
    ADD CONSTRAINT "projetos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='projetos_updated_by_fkey') THEN
    ALTER TABLE ONLY "public"."projetos"
    ADD CONSTRAINT "projetos_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='proposta_disciplinas_empresa_id_fkey') THEN
    ALTER TABLE ONLY "public"."proposta_disciplinas"
    ADD CONSTRAINT "proposta_disciplinas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='proposta_disciplinas_proposta_id_fkey') THEN
    ALTER TABLE ONLY "public"."proposta_disciplinas"
    ADD CONSTRAINT "proposta_disciplinas_proposta_id_fkey" FOREIGN KEY ("proposta_id") REFERENCES "public"."propostas"("id") ON DELETE CASCADE;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='proposta_templates_created_by_fkey') THEN
    ALTER TABLE ONLY "public"."proposta_templates"
    ADD CONSTRAINT "proposta_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='proposta_templates_empresa_id_fkey') THEN
    ALTER TABLE ONLY "public"."proposta_templates"
    ADD CONSTRAINT "proposta_templates_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='propostas_cliente_id_fkey') THEN
    ALTER TABLE ONLY "public"."propostas"
    ADD CONSTRAINT "propostas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE SET NULL;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='propostas_created_by_fkey') THEN
    ALTER TABLE ONLY "public"."propostas"
    ADD CONSTRAINT "propostas_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='propostas_empresa_id_fkey') THEN
    ALTER TABLE ONLY "public"."propostas"
    ADD CONSTRAINT "propostas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='propostas_lead_id_fkey') THEN
    ALTER TABLE ONLY "public"."propostas"
    ADD CONSTRAINT "propostas_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE SET NULL;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='propostas_projeto_id_fkey') THEN
    ALTER TABLE ONLY "public"."propostas"
    ADD CONSTRAINT "propostas_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "public"."projetos"("id") ON DELETE SET NULL;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='propostas_template_id_fkey') THEN
    ALTER TABLE ONLY "public"."propostas"
    ADD CONSTRAINT "propostas_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."proposta_templates"("id") ON DELETE SET NULL;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='propostas_updated_by_fkey') THEN
    ALTER TABLE ONLY "public"."propostas"
    ADD CONSTRAINT "propostas_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='receitas_categoria_id_fkey') THEN
    ALTER TABLE ONLY "public"."receitas"
    ADD CONSTRAINT "receitas_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias_financeiras"("id") ON DELETE SET NULL;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='receitas_centro_custo_id_fkey') THEN
    ALTER TABLE ONLY "public"."receitas"
    ADD CONSTRAINT "receitas_centro_custo_id_fkey" FOREIGN KEY ("centro_custo_id") REFERENCES "public"."centros_custo"("id") ON DELETE SET NULL;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='receitas_cliente_id_fkey') THEN
    ALTER TABLE ONLY "public"."receitas"
    ADD CONSTRAINT "receitas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE SET NULL;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='receitas_conta_id_fkey') THEN
    ALTER TABLE ONLY "public"."receitas"
    ADD CONSTRAINT "receitas_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "public"."contas"("id") ON DELETE SET NULL;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='receitas_created_by_fkey') THEN
    ALTER TABLE ONLY "public"."receitas"
    ADD CONSTRAINT "receitas_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='receitas_empresa_id_fkey') THEN
    ALTER TABLE ONLY "public"."receitas"
    ADD CONSTRAINT "receitas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='receitas_projeto_id_fkey') THEN
    ALTER TABLE ONLY "public"."receitas"
    ADD CONSTRAINT "receitas_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "public"."projetos"("id") ON DELETE SET NULL;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='receitas_updated_by_fkey') THEN
    ALTER TABLE ONLY "public"."receitas"
    ADD CONSTRAINT "receitas_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='templates_projeto_created_by_fkey') THEN
    ALTER TABLE ONLY "public"."templates_projeto"
    ADD CONSTRAINT "templates_projeto_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='templates_projeto_empresa_id_fkey') THEN
    ALTER TABLE ONLY "public"."templates_projeto"
    ADD CONSTRAINT "templates_projeto_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='templates_projeto_updated_by_fkey') THEN
    ALTER TABLE ONLY "public"."templates_projeto"
    ADD CONSTRAINT "templates_projeto_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='transferencias_conta_destino_id_fkey') THEN
    ALTER TABLE ONLY "public"."transferencias"
    ADD CONSTRAINT "transferencias_conta_destino_id_fkey" FOREIGN KEY ("conta_destino_id") REFERENCES "public"."contas"("id") ON DELETE RESTRICT;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='transferencias_conta_origem_id_fkey') THEN
    ALTER TABLE ONLY "public"."transferencias"
    ADD CONSTRAINT "transferencias_conta_origem_id_fkey" FOREIGN KEY ("conta_origem_id") REFERENCES "public"."contas"("id") ON DELETE RESTRICT;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='transferencias_created_by_fkey') THEN
    ALTER TABLE ONLY "public"."transferencias"
    ADD CONSTRAINT "transferencias_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='transferencias_empresa_id_fkey') THEN
    ALTER TABLE ONLY "public"."transferencias"
    ADD CONSTRAINT "transferencias_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='transferencias_updated_by_fkey') THEN
    ALTER TABLE ONLY "public"."transferencias"
    ADD CONSTRAINT "transferencias_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ultra_admin_modes_user_id_fkey') THEN
    ALTER TABLE ONLY "public"."ultra_admin_modes"
    ADD CONSTRAINT "ultra_admin_modes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
  END IF;
END $wrap$;
DROP POLICY IF EXISTS "Alertas Delete" ON "public"."alertas";
CREATE POLICY "Alertas Delete" ON "public"."alertas" FOR DELETE USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."user_has_feature"('financeiro'::"text", 'editor'::"text")));
DROP POLICY IF EXISTS "Alertas Insert" ON "public"."alertas";
CREATE POLICY "Alertas Insert" ON "public"."alertas" FOR INSERT WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."user_has_feature"('financeiro'::"text", 'editor'::"text")));
DROP POLICY IF EXISTS "Alertas Read" ON "public"."alertas";
CREATE POLICY "Alertas Read" ON "public"."alertas" FOR SELECT USING (("empresa_id" = "public"."get_user_empresa_id"()));
DROP POLICY IF EXISTS "Alertas Update" ON "public"."alertas";
CREATE POLICY "Alertas Update" ON "public"."alertas" FOR UPDATE USING (("empresa_id" = "public"."get_user_empresa_id"())) WITH CHECK (("empresa_id" = "public"."get_user_empresa_id"()));
DROP POLICY IF EXISTS "ClientePortal Manage" ON "public"."cliente_portal_accounts";
CREATE POLICY "ClientePortal Manage" ON "public"."cliente_portal_accounts" USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."user_has_feature"('portal_cliente'::"text", 'editor'::"text"))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."user_has_feature"('portal_cliente'::"text", 'editor'::"text")));
DROP POLICY IF EXISTS "Enable delete access for authenticated users based on company" ON "public"."folha_pagamento";
CREATE POLICY "Enable delete access for authenticated users based on company" ON "public"."folha_pagamento" FOR DELETE TO "authenticated" USING (("empresa_id" = ( SELECT "public"."get_user_empresa_id"() AS "get_user_empresa_id")));
DROP POLICY IF EXISTS "Enable insert access for authenticated users based on company" ON "public"."folha_pagamento";
CREATE POLICY "Enable insert access for authenticated users based on company" ON "public"."folha_pagamento" FOR INSERT TO "authenticated" WITH CHECK (("empresa_id" = ( SELECT "public"."get_user_empresa_id"() AS "get_user_empresa_id")));
DROP POLICY IF EXISTS "Enable read access for authenticated users based on company" ON "public"."folha_pagamento";
CREATE POLICY "Enable read access for authenticated users based on company" ON "public"."folha_pagamento" FOR SELECT TO "authenticated" USING (("empresa_id" = ( SELECT "public"."get_user_empresa_id"() AS "get_user_empresa_id")));
DROP POLICY IF EXISTS "Enable update access for authenticated users based on company" ON "public"."folha_pagamento";
CREATE POLICY "Enable update access for authenticated users based on company" ON "public"."folha_pagamento" FOR UPDATE TO "authenticated" USING (("empresa_id" = ( SELECT "public"."get_user_empresa_id"() AS "get_user_empresa_id")));
DROP POLICY IF EXISTS "EscopoHist Insert" ON "public"."escopo_historico";
CREATE POLICY "EscopoHist Insert" ON "public"."escopo_historico" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."escopos" "e"
  WHERE (("e"."id" = "escopo_historico"."escopo_id") AND ("e"."empresa_id" = "public"."get_user_empresa_id"())))));
DROP POLICY IF EXISTS "EscopoHist Read" ON "public"."escopo_historico";
CREATE POLICY "EscopoHist Read" ON "public"."escopo_historico" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."escopos" "e"
  WHERE (("e"."id" = "escopo_historico"."escopo_id") AND ("e"."empresa_id" = "public"."get_user_empresa_id"())))));
DROP POLICY IF EXISTS "Ultra admin full convites" ON "public"."convites";
CREATE POLICY "Ultra admin full convites" ON "public"."convites" TO "authenticated" USING ("public"."is_ultra_admin"()) WITH CHECK ("public"."is_ultra_admin"());
DROP POLICY IF EXISTS "Ultra admin full empresas" ON "public"."empresas";
CREATE POLICY "Ultra admin full empresas" ON "public"."empresas" TO "authenticated" USING ("public"."is_ultra_admin"()) WITH CHECK ("public"."is_ultra_admin"());
DROP POLICY IF EXISTS "Ultra admin full profiles" ON "public"."profiles";
CREATE POLICY "Ultra admin full profiles" ON "public"."profiles" TO "authenticated" USING ("public"."is_ultra_admin"()) WITH CHECK ("public"."is_ultra_admin"());
DROP POLICY IF EXISTS "Usuario edita seu profile" ON "public"."profiles";
CREATE POLICY "Usuario edita seu profile" ON "public"."profiles" FOR UPDATE USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));
DROP POLICY IF EXISTS "Ver profiles da empresa" ON "public"."profiles";
CREATE POLICY "Ver profiles da empresa" ON "public"."profiles" FOR SELECT USING (("empresa_id" = "public"."get_user_empresa_id"()));
DROP POLICY IF EXISTS "Ver própria empresa" ON "public"."empresas";
CREATE POLICY "Ver própria empresa" ON "public"."empresas" FOR SELECT USING (("id" = "public"."get_user_empresa_id"()));
DROP POLICY IF EXISTS "admin_audit_company_read" ON "public"."admin_audit_logs";
CREATE POLICY "admin_audit_company_read" ON "public"."admin_audit_logs" FOR SELECT USING (("public"."is_company_admin"() AND ("empresa_id" = "public"."get_user_empresa_id"())));
ALTER TABLE "public"."admin_audit_logs" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_audit_no_client_write" ON "public"."admin_audit_logs";
CREATE POLICY "admin_audit_no_client_write" ON "public"."admin_audit_logs" FOR INSERT WITH CHECK (false);
DROP POLICY IF EXISTS "admin_audit_ultra_read" ON "public"."admin_audit_logs";
CREATE POLICY "admin_audit_ultra_read" ON "public"."admin_audit_logs" FOR SELECT USING ("public"."is_ultra_admin"());
ALTER TABLE "public"."alertas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."aprovacoes" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aprovacoes_select" ON "public"."aprovacoes";
CREATE POLICY "aprovacoes_select" ON "public"."aprovacoes" FOR SELECT USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."user_has_feature"('projetos'::"text", 'viewer'::"text")));
DROP POLICY IF EXISTS "aprovacoes_write" ON "public"."aprovacoes";
CREATE POLICY "aprovacoes_write" ON "public"."aprovacoes" USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."user_has_feature"('projetos'::"text", 'editor'::"text"))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."user_has_feature"('projetos'::"text", 'editor'::"text")));
ALTER TABLE "public"."asaas_config" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "asaas_config_empresa_insert" ON "public"."asaas_config";
CREATE POLICY "asaas_config_empresa_insert" ON "public"."asaas_config" FOR INSERT WITH CHECK (("empresa_id" IN ( SELECT "profiles"."empresa_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));
DROP POLICY IF EXISTS "asaas_config_empresa_select" ON "public"."asaas_config";
CREATE POLICY "asaas_config_empresa_select" ON "public"."asaas_config" FOR SELECT USING (("empresa_id" IN ( SELECT "profiles"."empresa_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));
DROP POLICY IF EXISTS "asaas_config_empresa_update" ON "public"."asaas_config";
CREATE POLICY "asaas_config_empresa_update" ON "public"."asaas_config" FOR UPDATE USING (("empresa_id" IN ( SELECT "profiles"."empresa_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));
ALTER TABLE "public"."asaas_webhook_logs" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "asaas_webhook_logs_select" ON "public"."asaas_webhook_logs";
CREATE POLICY "asaas_webhook_logs_select" ON "public"."asaas_webhook_logs" FOR SELECT USING (("empresa_id" IN ( SELECT "profiles"."empresa_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));
DROP POLICY IF EXISTS "audit admin read empresa" ON "public"."audit_logs";
CREATE POLICY "audit admin read empresa" ON "public"."audit_logs" FOR SELECT TO "authenticated" USING (("public"."is_company_admin"() AND ((("metadata" ->> 'empresa_id'::"text"))::"uuid" = "public"."get_user_empresa_id"())));
DROP POLICY IF EXISTS "audit ultra_admin full" ON "public"."audit_logs";
CREATE POLICY "audit ultra_admin full" ON "public"."audit_logs" FOR SELECT TO "authenticated" USING ("public"."is_ultra_admin"());
ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_logs_admin_read" ON "public"."audit_logs";
CREATE POLICY "audit_logs_admin_read" ON "public"."audit_logs" FOR SELECT USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND ("public"."current_effective_role"() = ANY (ARRAY['admin'::"text", 'ultra_admin'::"text"]))));
ALTER TABLE "public"."audit_logs_archive" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_logs_archive_admin_read" ON "public"."audit_logs_archive";
CREATE POLICY "audit_logs_archive_admin_read" ON "public"."audit_logs_archive" FOR SELECT USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND ("public"."current_effective_role"() = ANY (ARRAY['admin'::"text", 'ultra_admin'::"text"]))));
ALTER TABLE "public"."cartoes" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cartoes_select" ON "public"."cartoes";
CREATE POLICY "cartoes_select" ON "public"."cartoes" FOR SELECT USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND ("deleted_at" IS NULL) AND "public"."user_has_feature"('financeiro'::"text", 'viewer'::"text")));
DROP POLICY IF EXISTS "cartoes_write" ON "public"."cartoes";
CREATE POLICY "cartoes_write" ON "public"."cartoes" USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND ("deleted_at" IS NULL) AND "public"."user_has_feature"('financeiro'::"text", 'editor'::"text"))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."user_has_feature"('financeiro'::"text", 'editor'::"text")));
ALTER TABLE "public"."categorias_financeiras" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "categorias_financeiras_select" ON "public"."categorias_financeiras";
CREATE POLICY "categorias_financeiras_select" ON "public"."categorias_financeiras" FOR SELECT USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND ("deleted_at" IS NULL) AND "public"."user_has_feature"('financeiro'::"text", 'viewer'::"text")));
DROP POLICY IF EXISTS "categorias_financeiras_write" ON "public"."categorias_financeiras";
CREATE POLICY "categorias_financeiras_write" ON "public"."categorias_financeiras" USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND ("deleted_at" IS NULL) AND "public"."user_has_feature"('financeiro'::"text", 'editor'::"text"))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."user_has_feature"('financeiro'::"text", 'editor'::"text")));
ALTER TABLE "public"."centros_custo" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "centros_custo_delete" ON "public"."centros_custo";
CREATE POLICY "centros_custo_delete" ON "public"."centros_custo" FOR DELETE USING (("empresa_id" = "public"."get_user_empresa_id"()));
DROP POLICY IF EXISTS "centros_custo_insert" ON "public"."centros_custo";
CREATE POLICY "centros_custo_insert" ON "public"."centros_custo" FOR INSERT WITH CHECK (("empresa_id" = "public"."get_user_empresa_id"()));
DROP POLICY IF EXISTS "centros_custo_select" ON "public"."centros_custo";
CREATE POLICY "centros_custo_select" ON "public"."centros_custo" FOR SELECT USING (("empresa_id" = "public"."get_user_empresa_id"()));
DROP POLICY IF EXISTS "centros_custo_update" ON "public"."centros_custo";
CREATE POLICY "centros_custo_update" ON "public"."centros_custo" FOR UPDATE USING (("empresa_id" = "public"."get_user_empresa_id"())) WITH CHECK (("empresa_id" = "public"."get_user_empresa_id"()));
ALTER TABLE "public"."cliente_portal_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."clientes" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clientes_select" ON "public"."clientes";
CREATE POLICY "clientes_select" ON "public"."clientes" FOR SELECT USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."user_has_feature"('clientes'::"text", 'viewer'::"text")));
DROP POLICY IF EXISTS "clientes_write" ON "public"."clientes";
CREATE POLICY "clientes_write" ON "public"."clientes" USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."user_has_feature"('clientes'::"text", 'editor'::"text"))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."user_has_feature"('clientes'::"text", 'editor'::"text")));
ALTER TABLE "public"."contas" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contas_select" ON "public"."contas";
CREATE POLICY "contas_select" ON "public"."contas" FOR SELECT USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND ("deleted_at" IS NULL) AND "public"."user_has_feature"('financeiro'::"text", 'viewer'::"text")));
DROP POLICY IF EXISTS "contas_write" ON "public"."contas";
CREATE POLICY "contas_write" ON "public"."contas" USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND ("deleted_at" IS NULL) AND "public"."user_has_feature"('financeiro'::"text", 'editor'::"text"))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."user_has_feature"('financeiro'::"text", 'editor'::"text")));
ALTER TABLE "public"."convites" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "convites_admin_full" ON "public"."convites";
CREATE POLICY "convites_admin_full" ON "public"."convites" USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role"]))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role"])));
ALTER TABLE "public"."critical_alerts" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "critical_alerts_admin_read" ON "public"."critical_alerts";
CREATE POLICY "critical_alerts_admin_read" ON "public"."critical_alerts" FOR SELECT USING (("empresa_id" = "public"."get_user_empresa_id"()));
ALTER TABLE "public"."data_deletion_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."data_export_requests" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ddr_admin_read" ON "public"."data_deletion_requests";
CREATE POLICY "ddr_admin_read" ON "public"."data_deletion_requests" FOR SELECT USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND ("public"."current_effective_role"() = ANY (ARRAY['admin'::"text", 'ultra_admin'::"text"]))));
DROP POLICY IF EXISTS "ddr_admin_update" ON "public"."data_deletion_requests";
CREATE POLICY "ddr_admin_update" ON "public"."data_deletion_requests" FOR UPDATE USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND ("public"."current_effective_role"() = ANY (ARRAY['admin'::"text", 'ultra_admin'::"text"])))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND ("public"."current_effective_role"() = ANY (ARRAY['admin'::"text", 'ultra_admin'::"text"]))));
DROP POLICY IF EXISTS "ddr_no_direct_insert" ON "public"."data_deletion_requests";
CREATE POLICY "ddr_no_direct_insert" ON "public"."data_deletion_requests" FOR INSERT WITH CHECK (false);
DROP POLICY IF EXISTS "ddr_self_read" ON "public"."data_deletion_requests";
CREATE POLICY "ddr_self_read" ON "public"."data_deletion_requests" FOR SELECT USING (("user_id" = "auth"."uid"()));
ALTER TABLE "public"."despesas" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "despesas_select" ON "public"."despesas";
CREATE POLICY "despesas_select" ON "public"."despesas" FOR SELECT USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND ("deleted_at" IS NULL) AND "public"."user_has_feature"('financeiro'::"text", 'viewer'::"text")));
DROP POLICY IF EXISTS "despesas_write" ON "public"."despesas";
CREATE POLICY "despesas_write" ON "public"."despesas" USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND ("deleted_at" IS NULL) AND "public"."user_has_feature"('financeiro'::"text", 'editor'::"text"))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."user_has_feature"('financeiro'::"text", 'editor'::"text")));
ALTER TABLE "public"."disciplinas" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "disciplinas_select" ON "public"."disciplinas";
CREATE POLICY "disciplinas_select" ON "public"."disciplinas" FOR SELECT USING ("public"."user_has_feature"('projetos'::"text", 'viewer'::"text"));
DROP POLICY IF EXISTS "disciplinas_write" ON "public"."disciplinas";
CREATE POLICY "disciplinas_write" ON "public"."disciplinas" USING (("public"."current_effective_role"() = 'ultra_admin'::"text")) WITH CHECK (("public"."current_effective_role"() = 'ultra_admin'::"text"));
ALTER TABLE "public"."empresa_owners_pending" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."empresas" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "empresas_admin_update" ON "public"."empresas";
CREATE POLICY "empresas_admin_update" ON "public"."empresas" FOR UPDATE USING ((("id" = "public"."get_user_empresa_id"()) AND ("public"."current_effective_role"() = ANY (ARRAY['admin'::"text", 'ultra_admin'::"text"])))) WITH CHECK ((("id" = "public"."get_user_empresa_id"()) AND ("public"."current_effective_role"() = ANY (ARRAY['admin'::"text", 'ultra_admin'::"text"]))));
ALTER TABLE "public"."escopo_historico" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."escopo_itens" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "escopo_itens_select" ON "public"."escopo_itens";
CREATE POLICY "escopo_itens_select" ON "public"."escopo_itens" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."escopos" "e"
  WHERE (("e"."id" = "escopo_itens"."escopo_id") AND ("e"."empresa_id" = "public"."get_user_empresa_id"())))) AND "public"."user_has_feature"('projetos'::"text", 'viewer'::"text")));
DROP POLICY IF EXISTS "escopo_itens_write" ON "public"."escopo_itens";
CREATE POLICY "escopo_itens_write" ON "public"."escopo_itens" USING (((EXISTS ( SELECT 1
   FROM "public"."escopos" "e"
  WHERE (("e"."id" = "escopo_itens"."escopo_id") AND ("e"."empresa_id" = "public"."get_user_empresa_id"())))) AND "public"."user_has_feature"('projetos'::"text", 'editor'::"text"))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."escopos" "e"
  WHERE (("e"."id" = "escopo_itens"."escopo_id") AND ("e"."empresa_id" = "public"."get_user_empresa_id"())))) AND "public"."user_has_feature"('projetos'::"text", 'editor'::"text")));
ALTER TABLE "public"."escopos" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "escopos_select" ON "public"."escopos";
CREATE POLICY "escopos_select" ON "public"."escopos" FOR SELECT USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."user_has_feature"('projetos'::"text", 'viewer'::"text")));
DROP POLICY IF EXISTS "escopos_write" ON "public"."escopos";
CREATE POLICY "escopos_write" ON "public"."escopos" USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."user_has_feature"('projetos'::"text", 'editor'::"text"))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."user_has_feature"('projetos'::"text", 'editor'::"text")));
ALTER TABLE "public"."faturas" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "faturas_delete" ON "public"."faturas";
CREATE POLICY "faturas_delete" ON "public"."faturas" FOR DELETE USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."user_has_feature"('financeiro'::"text", 'editor'::"text")));
DROP POLICY IF EXISTS "faturas_insert" ON "public"."faturas";
CREATE POLICY "faturas_insert" ON "public"."faturas" FOR INSERT WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."user_has_feature"('financeiro'::"text", 'editor'::"text")));
DROP POLICY IF EXISTS "faturas_select" ON "public"."faturas";
CREATE POLICY "faturas_select" ON "public"."faturas" FOR SELECT USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND ("deleted_at" IS NULL)));
DROP POLICY IF EXISTS "faturas_update" ON "public"."faturas";
CREATE POLICY "faturas_update" ON "public"."faturas" FOR UPDATE USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND ("deleted_at" IS NULL) AND "public"."user_has_feature"('financeiro'::"text", 'editor'::"text"))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."user_has_feature"('financeiro'::"text", 'editor'::"text")));
ALTER TABLE "public"."feature_flags" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "feature_flags_ultra_admin_delete" ON "public"."feature_flags";
CREATE POLICY "feature_flags_ultra_admin_delete" ON "public"."feature_flags" FOR DELETE TO "authenticated" USING ("public"."has_role"(VARIADIC ARRAY['ultra_admin'::"public"."user_role"]));
DROP POLICY IF EXISTS "feature_flags_ultra_admin_insert" ON "public"."feature_flags";
CREATE POLICY "feature_flags_ultra_admin_insert" ON "public"."feature_flags" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"(VARIADIC ARRAY['ultra_admin'::"public"."user_role"]));
DROP POLICY IF EXISTS "feature_flags_ultra_admin_select" ON "public"."feature_flags";
CREATE POLICY "feature_flags_ultra_admin_select" ON "public"."feature_flags" FOR SELECT TO "authenticated" USING ("public"."has_role"(VARIADIC ARRAY['ultra_admin'::"public"."user_role"]));
DROP POLICY IF EXISTS "feature_flags_ultra_admin_update" ON "public"."feature_flags";
CREATE POLICY "feature_flags_ultra_admin_update" ON "public"."feature_flags" FOR UPDATE TO "authenticated" USING ("public"."has_role"(VARIADIC ARRAY['ultra_admin'::"public"."user_role"])) WITH CHECK ("public"."has_role"(VARIADIC ARRAY['ultra_admin'::"public"."user_role"]));
ALTER TABLE "public"."fluxos_disciplinas" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fluxos_disciplinas_select" ON "public"."fluxos_disciplinas";
CREATE POLICY "fluxos_disciplinas_select" ON "public"."fluxos_disciplinas" FOR SELECT USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."user_has_feature"('projetos'::"text", 'viewer'::"text")));
DROP POLICY IF EXISTS "fluxos_disciplinas_write" ON "public"."fluxos_disciplinas";
CREATE POLICY "fluxos_disciplinas_write" ON "public"."fluxos_disciplinas" USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."user_has_feature"('projetos'::"text", 'editor'::"text"))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."user_has_feature"('projetos'::"text", 'editor'::"text")));
ALTER TABLE "public"."folha_pagamento" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."fornecedores" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fornecedores_select" ON "public"."fornecedores";
CREATE POLICY "fornecedores_select" ON "public"."fornecedores" FOR SELECT USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND ("deleted_at" IS NULL) AND "public"."user_has_feature"('financeiro'::"text", 'viewer'::"text")));
DROP POLICY IF EXISTS "fornecedores_write" ON "public"."fornecedores";
CREATE POLICY "fornecedores_write" ON "public"."fornecedores" USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND ("deleted_at" IS NULL) AND "public"."user_has_feature"('financeiro'::"text", 'editor'::"text"))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."user_has_feature"('financeiro'::"text", 'editor'::"text")));
ALTER TABLE "public"."grupos_parcela" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "grupos_parcela_delete" ON "public"."grupos_parcela";
CREATE POLICY "grupos_parcela_delete" ON "public"."grupos_parcela" FOR DELETE USING (("empresa_id" = "public"."get_user_empresa_id"()));
DROP POLICY IF EXISTS "grupos_parcela_insert" ON "public"."grupos_parcela";
CREATE POLICY "grupos_parcela_insert" ON "public"."grupos_parcela" FOR INSERT WITH CHECK (("empresa_id" = "public"."get_user_empresa_id"()));
DROP POLICY IF EXISTS "grupos_parcela_select" ON "public"."grupos_parcela";
CREATE POLICY "grupos_parcela_select" ON "public"."grupos_parcela" FOR SELECT USING (("empresa_id" = "public"."get_user_empresa_id"()));
DROP POLICY IF EXISTS "grupos_parcela_update" ON "public"."grupos_parcela";
CREATE POLICY "grupos_parcela_update" ON "public"."grupos_parcela" FOR UPDATE USING (("empresa_id" = "public"."get_user_empresa_id"())) WITH CHECK (("empresa_id" = "public"."get_user_empresa_id"()));
ALTER TABLE "public"."impersonation_sessions" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "impersonation_sessions_admin_read" ON "public"."impersonation_sessions";
CREATE POLICY "impersonation_sessions_admin_read" ON "public"."impersonation_sessions" FOR SELECT USING (("admin_id" = "auth"."uid"()));
ALTER TABLE "public"."lancamento_rateios" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lancamento_rateios_delete" ON "public"."lancamento_rateios";
CREATE POLICY "lancamento_rateios_delete" ON "public"."lancamento_rateios" FOR DELETE USING (("empresa_id" = "public"."get_user_empresa_id"()));
DROP POLICY IF EXISTS "lancamento_rateios_insert" ON "public"."lancamento_rateios";
CREATE POLICY "lancamento_rateios_insert" ON "public"."lancamento_rateios" FOR INSERT WITH CHECK (("empresa_id" = "public"."get_user_empresa_id"()));
DROP POLICY IF EXISTS "lancamento_rateios_select" ON "public"."lancamento_rateios";
CREATE POLICY "lancamento_rateios_select" ON "public"."lancamento_rateios" FOR SELECT USING (("empresa_id" = "public"."get_user_empresa_id"()));
DROP POLICY IF EXISTS "lancamento_rateios_update" ON "public"."lancamento_rateios";
CREATE POLICY "lancamento_rateios_update" ON "public"."lancamento_rateios" FOR UPDATE USING (("empresa_id" = "public"."get_user_empresa_id"())) WITH CHECK (("empresa_id" = "public"."get_user_empresa_id"()));
ALTER TABLE "public"."leads" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "leads_select" ON "public"."leads";
CREATE POLICY "leads_select" ON "public"."leads" FOR SELECT USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."user_has_feature"('leads'::"text", 'viewer'::"text")));
DROP POLICY IF EXISTS "leads_write" ON "public"."leads";
CREATE POLICY "leads_write" ON "public"."leads" USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."user_has_feature"('leads'::"text", 'editor'::"text"))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."user_has_feature"('leads'::"text", 'editor'::"text")));
ALTER TABLE "public"."marcos_faturamento" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "marcos_faturamento_select" ON "public"."marcos_faturamento";
CREATE POLICY "marcos_faturamento_select" ON "public"."marcos_faturamento" FOR SELECT USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND ("deleted_at" IS NULL) AND "public"."user_has_feature"('financeiro'::"text", 'viewer'::"text")));
DROP POLICY IF EXISTS "marcos_faturamento_write" ON "public"."marcos_faturamento";
CREATE POLICY "marcos_faturamento_write" ON "public"."marcos_faturamento" USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND ("deleted_at" IS NULL) AND "public"."user_has_feature"('financeiro'::"text", 'editor'::"text"))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."user_has_feature"('financeiro'::"text", 'editor'::"text")));
ALTER TABLE "public"."metas" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "metas_select" ON "public"."metas";
CREATE POLICY "metas_select" ON "public"."metas" FOR SELECT USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."user_has_feature"('metas'::"text", 'viewer'::"text")));
DROP POLICY IF EXISTS "metas_write" ON "public"."metas";
CREATE POLICY "metas_write" ON "public"."metas" USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."user_has_feature"('metas'::"text", 'editor'::"text"))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."user_has_feature"('metas'::"text", 'editor'::"text")));
ALTER TABLE "public"."mfa_backup_codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."orcamento_versoes" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "orcamento_versoes_select" ON "public"."orcamento_versoes";
CREATE POLICY "orcamento_versoes_select" ON "public"."orcamento_versoes" FOR SELECT USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."user_has_feature"('projetos'::"text", 'viewer'::"text")));
DROP POLICY IF EXISTS "orcamento_versoes_write" ON "public"."orcamento_versoes";
CREATE POLICY "orcamento_versoes_write" ON "public"."orcamento_versoes" USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."user_has_feature"('projetos'::"text", 'editor'::"text"))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."user_has_feature"('projetos'::"text", 'editor'::"text")));
ALTER TABLE "public"."pessoas" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pessoas_select" ON "public"."pessoas";
CREATE POLICY "pessoas_select" ON "public"."pessoas" FOR SELECT USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."user_has_feature"('pessoas'::"text", 'viewer'::"text")));
DROP POLICY IF EXISTS "pessoas_write" ON "public"."pessoas";
CREATE POLICY "pessoas_write" ON "public"."pessoas" USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."user_has_feature"('pessoas'::"text", 'editor'::"text"))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."user_has_feature"('pessoas'::"text", 'editor'::"text")));
ALTER TABLE "public"."pilar_checkout_webhook_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."pilar_pending_signups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."pilar_subscription_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."pilar_subscriptions" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pilar_subscriptions_empresa_read" ON "public"."pilar_subscriptions";
CREATE POLICY "pilar_subscriptions_empresa_read" ON "public"."pilar_subscriptions" FOR SELECT USING (("empresa_id" = "public"."get_user_empresa_id"()));
DROP POLICY IF EXISTS "plans_public_read" ON "public"."pilar_subscription_plans";
CREATE POLICY "plans_public_read" ON "public"."pilar_subscription_plans" FOR SELECT USING (("ativo" = true));
ALTER TABLE "public"."portal_download_logs" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "portal_download_logs_admin" ON "public"."portal_download_logs";
CREATE POLICY "portal_download_logs_admin" ON "public"."portal_download_logs" FOR SELECT USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role"])));
ALTER TABLE "public"."portal_entregas" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "portal_entregas_manage" ON "public"."portal_entregas";
CREATE POLICY "portal_entregas_manage" ON "public"."portal_entregas" USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."user_has_feature"('portal_cliente'::"text", 'editor'::"text"))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."user_has_feature"('portal_cliente'::"text", 'editor'::"text")));
ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_admin_manage" ON "public"."profiles";
CREATE POLICY "profiles_admin_manage" ON "public"."profiles" USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND ("public"."current_effective_role"() = ANY (ARRAY['admin'::"text", 'ultra_admin'::"text"])))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND ("public"."current_effective_role"() = ANY (ARRAY['admin'::"text", 'ultra_admin'::"text"]))));
ALTER TABLE "public"."projeto_disciplina_responsaveis" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "projeto_disciplina_responsaveis_empresa" ON "public"."projeto_disciplina_responsaveis";
CREATE POLICY "projeto_disciplina_responsaveis_empresa" ON "public"."projeto_disciplina_responsaveis" USING ((EXISTS ( SELECT 1
   FROM ("public"."projeto_disciplinas" "pd"
     JOIN "public"."projetos" "p" ON (("p"."id" = "pd"."projeto_id")))
  WHERE (("pd"."id" = "projeto_disciplina_responsaveis"."projeto_disciplina_id") AND ("p"."empresa_id" = "public"."get_user_empresa_id"()))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM ("public"."projeto_disciplinas" "pd"
     JOIN "public"."projetos" "p" ON (("p"."id" = "pd"."projeto_id")))
  WHERE (("pd"."id" = "projeto_disciplina_responsaveis"."projeto_disciplina_id") AND ("p"."empresa_id" = "public"."get_user_empresa_id"())))) AND (EXISTS ( SELECT 1
   FROM "public"."pessoas" "pe"
  WHERE (("pe"."id" = "projeto_disciplina_responsaveis"."pessoa_id") AND ("pe"."empresa_id" = "public"."get_user_empresa_id"()))))));
ALTER TABLE "public"."projeto_disciplinas" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "projeto_disciplinas_empresa" ON "public"."projeto_disciplinas";
CREATE POLICY "projeto_disciplinas_empresa" ON "public"."projeto_disciplinas" USING ((EXISTS ( SELECT 1
   FROM "public"."projetos"
  WHERE (("projetos"."id" = "projeto_disciplinas"."projeto_id") AND ("projetos"."empresa_id" = "public"."get_user_empresa_id"())))));
ALTER TABLE "public"."projeto_orcamento_fases" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "projeto_orcamento_fases_select" ON "public"."projeto_orcamento_fases";
CREATE POLICY "projeto_orcamento_fases_select" ON "public"."projeto_orcamento_fases" FOR SELECT USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."user_has_feature"('projetos'::"text", 'viewer'::"text")));
DROP POLICY IF EXISTS "projeto_orcamento_fases_write" ON "public"."projeto_orcamento_fases";
CREATE POLICY "projeto_orcamento_fases_write" ON "public"."projeto_orcamento_fases" USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."user_has_feature"('projetos'::"text", 'editor'::"text"))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."user_has_feature"('projetos'::"text", 'editor'::"text")));
ALTER TABLE "public"."projetos" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "projetos_select" ON "public"."projetos";
CREATE POLICY "projetos_select" ON "public"."projetos" FOR SELECT USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND ("deleted_at" IS NULL) AND "public"."user_has_feature"('projetos'::"text", 'viewer'::"text")));
DROP POLICY IF EXISTS "projetos_write" ON "public"."projetos";
CREATE POLICY "projetos_write" ON "public"."projetos" USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND ("deleted_at" IS NULL) AND "public"."user_has_feature"('projetos'::"text", 'editor'::"text"))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."user_has_feature"('projetos'::"text", 'editor'::"text")));
ALTER TABLE "public"."proposta_disciplinas" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "proposta_disciplinas_select" ON "public"."proposta_disciplinas";
CREATE POLICY "proposta_disciplinas_select" ON "public"."proposta_disciplinas" FOR SELECT USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."user_has_feature"('projetos'::"text", 'viewer'::"text")));
DROP POLICY IF EXISTS "proposta_disciplinas_write" ON "public"."proposta_disciplinas";
CREATE POLICY "proposta_disciplinas_write" ON "public"."proposta_disciplinas" USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."user_has_feature"('projetos'::"text", 'editor'::"text"))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."user_has_feature"('projetos'::"text", 'editor'::"text")));
ALTER TABLE "public"."proposta_templates" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "proposta_templates_select" ON "public"."proposta_templates";
CREATE POLICY "proposta_templates_select" ON "public"."proposta_templates" FOR SELECT USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."user_has_feature"('propostas'::"text", 'viewer'::"text")));
DROP POLICY IF EXISTS "proposta_templates_write" ON "public"."proposta_templates";
CREATE POLICY "proposta_templates_write" ON "public"."proposta_templates" USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."user_has_feature"('propostas'::"text", 'editor'::"text"))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."user_has_feature"('propostas'::"text", 'editor'::"text")));
ALTER TABLE "public"."propostas" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "propostas_select" ON "public"."propostas";
CREATE POLICY "propostas_select" ON "public"."propostas" FOR SELECT USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."user_has_feature"('propostas'::"text", 'viewer'::"text")));
DROP POLICY IF EXISTS "propostas_write" ON "public"."propostas";
CREATE POLICY "propostas_write" ON "public"."propostas" USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."user_has_feature"('propostas'::"text", 'editor'::"text"))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."user_has_feature"('propostas'::"text", 'editor'::"text")));
ALTER TABLE "public"."rate_limit_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."receitas" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "receitas_select" ON "public"."receitas";
CREATE POLICY "receitas_select" ON "public"."receitas" FOR SELECT USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND ("deleted_at" IS NULL) AND "public"."user_has_feature"('financeiro'::"text", 'viewer'::"text")));
DROP POLICY IF EXISTS "receitas_write" ON "public"."receitas";
CREATE POLICY "receitas_write" ON "public"."receitas" USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND ("deleted_at" IS NULL) AND "public"."user_has_feature"('financeiro'::"text", 'editor'::"text"))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."user_has_feature"('financeiro'::"text", 'editor'::"text")));
DROP POLICY IF EXISTS "self_read_ultra_admin_modes" ON "public"."ultra_admin_modes";
CREATE POLICY "self_read_ultra_admin_modes" ON "public"."ultra_admin_modes" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));
ALTER TABLE "public"."templates_projeto" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "templates_projeto_select" ON "public"."templates_projeto";
CREATE POLICY "templates_projeto_select" ON "public"."templates_projeto" FOR SELECT USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND ("deleted_at" IS NULL) AND "public"."user_has_feature"('templates'::"text", 'viewer'::"text")));
DROP POLICY IF EXISTS "templates_projeto_write" ON "public"."templates_projeto";
CREATE POLICY "templates_projeto_write" ON "public"."templates_projeto" USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND ("deleted_at" IS NULL) AND "public"."user_has_feature"('templates'::"text", 'editor'::"text"))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."user_has_feature"('templates'::"text", 'editor'::"text")));
ALTER TABLE "public"."transferencias" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "transferencias_delete" ON "public"."transferencias";
CREATE POLICY "transferencias_delete" ON "public"."transferencias" FOR DELETE USING (("empresa_id" = "public"."get_user_empresa_id"()));
DROP POLICY IF EXISTS "transferencias_insert" ON "public"."transferencias";
CREATE POLICY "transferencias_insert" ON "public"."transferencias" FOR INSERT WITH CHECK (("empresa_id" = "public"."get_user_empresa_id"()));
DROP POLICY IF EXISTS "transferencias_select" ON "public"."transferencias";
CREATE POLICY "transferencias_select" ON "public"."transferencias" FOR SELECT USING (("empresa_id" = "public"."get_user_empresa_id"()));
DROP POLICY IF EXISTS "transferencias_update" ON "public"."transferencias";
CREATE POLICY "transferencias_update" ON "public"."transferencias" FOR UPDATE USING (("empresa_id" = "public"."get_user_empresa_id"())) WITH CHECK (("empresa_id" = "public"."get_user_empresa_id"()));
ALTER TABLE "public"."ultra_admin_modes" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user creates own export requests" ON "public"."data_export_requests";
CREATE POLICY "user creates own export requests" ON "public"."data_export_requests" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));
DROP POLICY IF EXISTS "user sees own export requests" ON "public"."data_export_requests";
CREATE POLICY "user sees own export requests" ON "public"."data_export_requests" FOR SELECT USING (("auth"."uid"() = "user_id"));
GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "service_role";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "service_role";
GRANT ALL ON FUNCTION "public"."_feature_catalog"() TO "anon";
GRANT ALL ON FUNCTION "public"."_feature_catalog"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_feature_catalog"() TO "service_role";
GRANT ALL ON FUNCTION "public"."_portal_create_account"("p_cliente_id" "uuid", "p_empresa_id" "uuid", "p_nome" "text", "p_email" "text", "p_senha" "text", "p_created_by" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."_portal_create_account"("p_cliente_id" "uuid", "p_empresa_id" "uuid", "p_nome" "text", "p_email" "text", "p_senha" "text", "p_created_by" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_portal_create_account"("p_cliente_id" "uuid", "p_empresa_id" "uuid", "p_nome" "text", "p_email" "text", "p_senha" "text", "p_created_by" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."_portal_reset_password"("p_account_id" "uuid", "p_nova_senha" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_portal_reset_password"("p_account_id" "uuid", "p_nova_senha" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_portal_reset_password"("p_account_id" "uuid", "p_nova_senha" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."_validate_features_payload"("p_features" "jsonb", "p_empresa_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."_validate_features_payload"("p_features" "jsonb", "p_empresa_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_validate_features_payload"("p_features" "jsonb", "p_empresa_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."aditivo_aprovado_handler"() TO "anon";
GRANT ALL ON FUNCTION "public"."aditivo_aprovado_handler"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."aditivo_aprovado_handler"() TO "service_role";
GRANT ALL ON FUNCTION "public"."admin_create_company_owner"("p_email" "text", "p_nome" "text", "p_company_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_create_company_owner"("p_email" "text", "p_nome" "text", "p_company_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_create_company_owner"("p_email" "text", "p_nome" "text", "p_company_name" "text") TO "service_role";
REVOKE ALL ON FUNCTION "public"."audit_log_cleanup"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."audit_log_cleanup"() TO "service_role";
REVOKE ALL ON FUNCTION "public"."audit_logs_archive_old"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."audit_logs_archive_old"() TO "service_role";
GRANT ALL ON FUNCTION "public"."auto_complete_disciplinas"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_complete_disciplinas"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_complete_disciplinas"() TO "service_role";
GRANT ALL ON FUNCTION "public"."auto_gerar_receita_from_marco"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_gerar_receita_from_marco"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_gerar_receita_from_marco"() TO "service_role";
GRANT ALL ON FUNCTION "public"."calculate_status_data"() TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_status_data"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_status_data"() TO "service_role";
GRANT ALL ON FUNCTION "public"."check_convite_rate_limit"("p_empresa_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_convite_rate_limit"("p_empresa_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_convite_rate_limit"("p_empresa_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."cleanup_expired_pending_signups"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_pending_signups"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_pending_signups"() TO "service_role";
REVOKE ALL ON FUNCTION "public"."cleanup_pending_signups"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cleanup_pending_signups"() TO "service_role";
GRANT ALL ON FUNCTION "public"."create_convite"("p_email" "text", "p_cargo" "text", "p_nome" "text", "p_features" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_convite"("p_email" "text", "p_cargo" "text", "p_nome" "text", "p_features" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_convite"("p_email" "text", "p_cargo" "text", "p_nome" "text", "p_features" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."create_portal_token"("p_projeto_id" "uuid", "p_cliente_id" "uuid", "p_email_cliente" "text", "p_dias_validade" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."create_portal_token"("p_projeto_id" "uuid", "p_cliente_id" "uuid", "p_email_cliente" "text", "p_dias_validade" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_portal_token"("p_projeto_id" "uuid", "p_cliente_id" "uuid", "p_email_cliente" "text", "p_dias_validade" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."create_projeto_completo"("p_codigo" "text", "p_nome" "text", "p_cliente_id" "uuid", "p_data_inicio" "date", "p_data_previsao" "date", "p_data_final" "date", "p_valor_contrato" numeric, "p_observacao" "text", "p_localizacao" "text", "p_parcelas" "text", "p_responsaveis" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_projeto_completo"("p_codigo" "text", "p_nome" "text", "p_cliente_id" "uuid", "p_data_inicio" "date", "p_data_previsao" "date", "p_data_final" "date", "p_valor_contrato" numeric, "p_observacao" "text", "p_localizacao" "text", "p_parcelas" "text", "p_responsaveis" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_projeto_completo"("p_codigo" "text", "p_nome" "text", "p_cliente_id" "uuid", "p_data_inicio" "date", "p_data_previsao" "date", "p_data_final" "date", "p_valor_contrato" numeric, "p_observacao" "text", "p_localizacao" "text", "p_parcelas" "text", "p_responsaveis" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."create_projeto_completo"("p_codigo" "text", "p_nome" "text", "p_cliente_id" "uuid", "p_data_inicio" "date", "p_data_previsao" "date", "p_data_final" "date", "p_valor_contrato" numeric, "p_observacao" "text", "p_localizacao" "text", "p_parcelas" "text", "p_area_m2" numeric, "p_disciplinas" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_projeto_completo"("p_codigo" "text", "p_nome" "text", "p_cliente_id" "uuid", "p_data_inicio" "date", "p_data_previsao" "date", "p_data_final" "date", "p_valor_contrato" numeric, "p_observacao" "text", "p_localizacao" "text", "p_parcelas" "text", "p_area_m2" numeric, "p_disciplinas" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_projeto_completo"("p_codigo" "text", "p_nome" "text", "p_cliente_id" "uuid", "p_data_inicio" "date", "p_data_previsao" "date", "p_data_final" "date", "p_valor_contrato" numeric, "p_observacao" "text", "p_localizacao" "text", "p_parcelas" "text", "p_area_m2" numeric, "p_disciplinas" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."create_projeto_completo"("p_codigo" "text", "p_nome" "text", "p_cliente_id" "uuid", "p_data_inicio" "date", "p_data_previsao" "date", "p_data_final" "date", "p_valor_contrato" numeric, "p_observacao" "text", "p_localizacao" "text", "p_parcelas" "text", "p_area_m2" numeric, "p_disciplinas" "jsonb", "p_prioridade" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_projeto_completo"("p_codigo" "text", "p_nome" "text", "p_cliente_id" "uuid", "p_data_inicio" "date", "p_data_previsao" "date", "p_data_final" "date", "p_valor_contrato" numeric, "p_observacao" "text", "p_localizacao" "text", "p_parcelas" "text", "p_area_m2" numeric, "p_disciplinas" "jsonb", "p_prioridade" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_projeto_completo"("p_codigo" "text", "p_nome" "text", "p_cliente_id" "uuid", "p_data_inicio" "date", "p_data_previsao" "date", "p_data_final" "date", "p_valor_contrato" numeric, "p_observacao" "text", "p_localizacao" "text", "p_parcelas" "text", "p_area_m2" numeric, "p_disciplinas" "jsonb", "p_prioridade" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."current_effective_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_effective_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_effective_role"() TO "service_role";
GRANT ALL ON TABLE "public"."impersonation_sessions" TO "anon";
GRANT ALL ON TABLE "public"."impersonation_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."impersonation_sessions" TO "service_role";
GRANT ALL ON FUNCTION "public"."current_impersonation"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_impersonation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_impersonation"() TO "service_role";
GRANT ALL ON FUNCTION "public"."enforce_despesa_data_pagamento"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_despesa_data_pagamento"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_despesa_data_pagamento"() TO "service_role";
GRANT ALL ON FUNCTION "public"."enforce_receita_data_recebimento"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_receita_data_recebimento"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_receita_data_recebimento"() TO "service_role";
GRANT ALL ON FUNCTION "public"."find_or_create_fatura"("p_cartao_id" "uuid", "p_data_compra" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."find_or_create_fatura"("p_cartao_id" "uuid", "p_data_compra" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_or_create_fatura"("p_cartao_id" "uuid", "p_data_compra" "date") TO "service_role";
GRANT ALL ON FUNCTION "public"."gerar_fatura"("p_cartao_id" "uuid", "p_mes" integer, "p_ano" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."gerar_fatura"("p_cartao_id" "uuid", "p_mes" integer, "p_ano" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."gerar_fatura"("p_cartao_id" "uuid", "p_mes" integer, "p_ano" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."get_cliente_projeto_detail"("p_projeto_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_cliente_projeto_detail"("p_projeto_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_cliente_projeto_detail"("p_projeto_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_cliente_projeto_detail"("p_projeto_id" "uuid", "p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_cliente_projeto_detail"("p_projeto_id" "uuid", "p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_cliente_projeto_detail"("p_projeto_id" "uuid", "p_token" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_cliente_projetos"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_cliente_projetos"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_cliente_projetos"() TO "service_role";
GRANT ALL ON FUNCTION "public"."get_cliente_projetos"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_cliente_projetos"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_cliente_projetos"("p_token" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_folha_preview"("p_mes" integer, "p_ano" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_folha_preview"("p_mes" integer, "p_ano" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_folha_preview"("p_mes" integer, "p_ano" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."get_lancamentos_kpis"("p_from" "text", "p_to" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_lancamentos_kpis"("p_from" "text", "p_to" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_lancamentos_kpis"("p_from" "text", "p_to" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_portal_propostas"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_portal_propostas"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_portal_propostas"("p_token" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_user_empresa_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_empresa_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_empresa_id"() TO "service_role";
GRANT ALL ON FUNCTION "public"."get_user_empresa_id_text"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_empresa_id_text"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_empresa_id_text"() TO "service_role";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "service_role";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "service_role";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "service_role";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "service_role";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "service_role";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "service_role";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "service_role";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "service_role";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "service_role";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "service_role";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "service_role";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "service_role";
GRANT ALL ON FUNCTION "public"."handle_escopo_aprovado"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_escopo_aprovado"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_escopo_aprovado"() TO "service_role";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";
GRANT ALL ON FUNCTION "public"."handle_orcamento_versao"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_orcamento_versao"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_orcamento_versao"() TO "service_role";
GRANT ALL ON FUNCTION "public"."handle_record_audit"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_record_audit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_record_audit"() TO "service_role";
GRANT ALL ON FUNCTION "public"."has_role"(VARIADIC "allowed_roles" "public"."user_role"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."has_role"(VARIADIC "allowed_roles" "public"."user_role"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"(VARIADIC "allowed_roles" "public"."user_role"[]) TO "service_role";
REVOKE ALL ON FUNCTION "public"."impersonation_sessions_cleanup"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."impersonation_sessions_cleanup"() TO "service_role";
GRANT ALL ON FUNCTION "public"."insert_audit_log"("p_action" "text", "p_target_table" "text", "p_target_id" "uuid", "p_diff" "jsonb", "p_actor_id" "uuid", "p_actor_email" "text", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."insert_audit_log"("p_action" "text", "p_target_table" "text", "p_target_id" "uuid", "p_diff" "jsonb", "p_actor_id" "uuid", "p_actor_email" "text", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_audit_log"("p_action" "text", "p_target_table" "text", "p_target_id" "uuid", "p_diff" "jsonb", "p_actor_id" "uuid", "p_actor_email" "text", "p_metadata" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."is_company_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_company_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_company_admin"() TO "service_role";
REVOKE ALL ON FUNCTION "public"."is_feature_flag_enabled"("p_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_feature_flag_enabled"("p_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_feature_flag_enabled"("p_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_feature_flag_enabled"("p_key" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."is_impersonating"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_impersonating"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_impersonating"() TO "service_role";
GRANT ALL ON FUNCTION "public"."is_ultra_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_ultra_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_ultra_admin"() TO "service_role";
GRANT ALL ON FUNCTION "public"."is_ultra_admin_scoped"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_ultra_admin_scoped"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_ultra_admin_scoped"() TO "service_role";
GRANT ALL ON FUNCTION "public"."link_pessoa_profile_before"() TO "anon";
GRANT ALL ON FUNCTION "public"."link_pessoa_profile_before"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."link_pessoa_profile_before"() TO "service_role";
GRANT ALL ON FUNCTION "public"."link_profile_pessoa_after"() TO "anon";
GRANT ALL ON FUNCTION "public"."link_profile_pessoa_after"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."link_profile_pessoa_after"() TO "service_role";
REVOKE ALL ON FUNCTION "public"."notify_data_deletion_request"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notify_data_deletion_request"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_data_deletion_request"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_data_deletion_request"() TO "service_role";
GRANT ALL ON FUNCTION "public"."pagar_fatura"("p_fatura_id" "uuid", "p_conta_id" "uuid", "p_valor_pago" numeric, "p_data_pagamento" "date", "p_idempotency_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."pagar_fatura"("p_fatura_id" "uuid", "p_conta_id" "uuid", "p_valor_pago" numeric, "p_data_pagamento" "date", "p_idempotency_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pagar_fatura"("p_fatura_id" "uuid", "p_conta_id" "uuid", "p_valor_pago" numeric, "p_data_pagamento" "date", "p_idempotency_key" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."pilar_set_ultra_admin_scope"("p_scoped" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."pilar_set_ultra_admin_scope"("p_scoped" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."pilar_set_ultra_admin_scope"("p_scoped" boolean) TO "service_role";
GRANT ALL ON FUNCTION "public"."portal_atualizar_status_proposta"("p_token" "text", "p_proposta_id" "uuid", "p_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."portal_atualizar_status_proposta"("p_token" "text", "p_proposta_id" "uuid", "p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."portal_atualizar_status_proposta"("p_token" "text", "p_proposta_id" "uuid", "p_status" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."portal_login"("p_email" "text", "p_senha" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."portal_login"("p_email" "text", "p_senha" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."portal_login"("p_email" "text", "p_senha" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."portal_verify_session"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."portal_verify_session"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."portal_verify_session"("p_token" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."prevent_company_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_company_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_company_change"() TO "service_role";
GRANT ALL ON FUNCTION "public"."recalc_grupo_parcela_status"("p_grupo_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."recalc_grupo_parcela_status"("p_grupo_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalc_grupo_parcela_status"("p_grupo_id" "uuid") TO "service_role";
REVOKE ALL ON FUNCTION "public"."request_data_deletion"("p_motivo" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."request_data_deletion"("p_motivo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."request_data_deletion"("p_motivo" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."request_data_export"() TO "anon";
GRANT ALL ON FUNCTION "public"."request_data_export"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."request_data_export"() TO "service_role";
GRANT ALL ON FUNCTION "public"."rpc_atualizar_status_atrasados"() TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_atualizar_status_atrasados"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_atualizar_status_atrasados"() TO "service_role";
GRANT ALL ON FUNCTION "public"."rpc_calcular_wip"("p_mes" integer, "p_ano" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_calcular_wip"("p_mes" integer, "p_ano" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_calcular_wip"("p_mes" integer, "p_ano" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."rpc_converter_lead_cliente"("p_lead_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_converter_lead_cliente"("p_lead_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_converter_lead_cliente"("p_lead_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."rpc_converter_proposta_projeto"("p_proposta_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_converter_proposta_projeto"("p_proposta_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_converter_proposta_projeto"("p_proposta_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."rpc_criar_transferencia"("p_conta_origem_id" "uuid", "p_conta_destino_id" "uuid", "p_valor" numeric, "p_data" "date", "p_descricao" "text", "p_status" "text", "p_observacao" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_criar_transferencia"("p_conta_origem_id" "uuid", "p_conta_destino_id" "uuid", "p_valor" numeric, "p_data" "date", "p_descricao" "text", "p_status" "text", "p_observacao" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_criar_transferencia"("p_conta_origem_id" "uuid", "p_conta_destino_id" "uuid", "p_valor" numeric, "p_data" "date", "p_descricao" "text", "p_status" "text", "p_observacao" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."rpc_daily_maintenance"() TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_daily_maintenance"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_daily_maintenance"() TO "service_role";
GRANT ALL ON FUNCTION "public"."rpc_dashboard_rentabilidade"() TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_dashboard_rentabilidade"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_dashboard_rentabilidade"() TO "service_role";
GRANT ALL ON FUNCTION "public"."rpc_editar_transferencia"("p_id" "uuid", "p_conta_origem_id" "uuid", "p_conta_destino_id" "uuid", "p_valor" numeric, "p_data" "date", "p_descricao" "text", "p_status" "text", "p_observacao" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_editar_transferencia"("p_id" "uuid", "p_conta_origem_id" "uuid", "p_conta_destino_id" "uuid", "p_valor" numeric, "p_data" "date", "p_descricao" "text", "p_status" "text", "p_observacao" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_editar_transferencia"("p_id" "uuid", "p_conta_origem_id" "uuid", "p_conta_destino_id" "uuid", "p_valor" numeric, "p_data" "date", "p_descricao" "text", "p_status" "text", "p_observacao" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."rpc_excluir_transferencia"("p_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_excluir_transferencia"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_excluir_transferencia"("p_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."rpc_faturar_marco"("p_marco_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_faturar_marco"("p_marco_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_faturar_marco"("p_marco_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."rpc_gerar_alertas"() TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_gerar_alertas"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_gerar_alertas"() TO "service_role";
GRANT ALL ON FUNCTION "public"."rpc_gerar_alertas"("p_empresa_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_gerar_alertas"("p_empresa_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_gerar_alertas"("p_empresa_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."rpc_gerar_despesas_recorrentes"() TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_gerar_despesas_recorrentes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_gerar_despesas_recorrentes"() TO "service_role";
GRANT ALL ON FUNCTION "public"."rpc_gerar_parcelas_dia_fixo"("p_projeto_id" "uuid", "p_num_parcelas" integer, "p_dia_fixo" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_gerar_parcelas_dia_fixo"("p_projeto_id" "uuid", "p_num_parcelas" integer, "p_dia_fixo" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_gerar_parcelas_dia_fixo"("p_projeto_id" "uuid", "p_num_parcelas" integer, "p_dia_fixo" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."rpc_gerar_parcelas_projeto"("p_projeto_id" "uuid", "p_num_parcelas" integer, "p_intervalo_dias" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_gerar_parcelas_projeto"("p_projeto_id" "uuid", "p_num_parcelas" integer, "p_intervalo_dias" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_gerar_parcelas_projeto"("p_projeto_id" "uuid", "p_num_parcelas" integer, "p_intervalo_dias" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."rpc_grupo_parcela_criar"("p_tipo_lancamento" "text", "p_descricao" "text", "p_total" numeric, "p_num_parcelas" integer, "p_primeira_data" "date", "p_periodicidade" "text", "p_contraparte_id" "uuid", "p_projeto_id" "uuid", "p_categoria_id" "uuid", "p_centro_custo_id" "uuid", "p_conta_id" "uuid", "p_cartao_id" "uuid", "p_forma_pagamento" "text", "p_observacao" "text", "p_tags" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_grupo_parcela_criar"("p_tipo_lancamento" "text", "p_descricao" "text", "p_total" numeric, "p_num_parcelas" integer, "p_primeira_data" "date", "p_periodicidade" "text", "p_contraparte_id" "uuid", "p_projeto_id" "uuid", "p_categoria_id" "uuid", "p_centro_custo_id" "uuid", "p_conta_id" "uuid", "p_cartao_id" "uuid", "p_forma_pagamento" "text", "p_observacao" "text", "p_tags" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_grupo_parcela_criar"("p_tipo_lancamento" "text", "p_descricao" "text", "p_total" numeric, "p_num_parcelas" integer, "p_primeira_data" "date", "p_periodicidade" "text", "p_contraparte_id" "uuid", "p_projeto_id" "uuid", "p_categoria_id" "uuid", "p_centro_custo_id" "uuid", "p_conta_id" "uuid", "p_cartao_id" "uuid", "p_forma_pagamento" "text", "p_observacao" "text", "p_tags" "text"[]) TO "service_role";
GRANT ALL ON FUNCTION "public"."rpc_grupo_parcela_editar_em_aberto"("p_grupo_id" "uuid", "p_novo_valor_parcela" numeric, "p_nova_categoria_id" "uuid", "p_novo_centro_custo_id" "uuid", "p_nova_conta_id" "uuid", "p_nova_observacao" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_grupo_parcela_editar_em_aberto"("p_grupo_id" "uuid", "p_novo_valor_parcela" numeric, "p_nova_categoria_id" "uuid", "p_novo_centro_custo_id" "uuid", "p_nova_conta_id" "uuid", "p_nova_observacao" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_grupo_parcela_editar_em_aberto"("p_grupo_id" "uuid", "p_novo_valor_parcela" numeric, "p_nova_categoria_id" "uuid", "p_novo_centro_custo_id" "uuid", "p_nova_conta_id" "uuid", "p_nova_observacao" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."rpc_grupo_parcela_quitar_antecipado"("p_grupo_id" "uuid", "p_data_pagamento" "date", "p_quantidade" integer, "p_desconto_total" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_grupo_parcela_quitar_antecipado"("p_grupo_id" "uuid", "p_data_pagamento" "date", "p_quantidade" integer, "p_desconto_total" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_grupo_parcela_quitar_antecipado"("p_grupo_id" "uuid", "p_data_pagamento" "date", "p_quantidade" integer, "p_desconto_total" numeric) TO "service_role";
GRANT ALL ON FUNCTION "public"."rpc_grupo_parcela_renegociar"("p_grupo_id" "uuid", "p_novo_total" numeric, "p_novo_num_parcelas" integer, "p_nova_primeira_data" "date", "p_observacao" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_grupo_parcela_renegociar"("p_grupo_id" "uuid", "p_novo_total" numeric, "p_novo_num_parcelas" integer, "p_nova_primeira_data" "date", "p_observacao" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_grupo_parcela_renegociar"("p_grupo_id" "uuid", "p_novo_total" numeric, "p_novo_num_parcelas" integer, "p_nova_primeira_data" "date", "p_observacao" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."rpc_lancamento_set_rateio"("p_lancamento_id" "uuid", "p_tipo_lancamento" "text", "p_rateios" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_lancamento_set_rateio"("p_lancamento_id" "uuid", "p_tipo_lancamento" "text", "p_rateios" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_lancamento_set_rateio"("p_lancamento_id" "uuid", "p_tipo_lancamento" "text", "p_rateios" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."rpc_projeto_rentabilidade"("p_projeto_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_projeto_rentabilidade"("p_projeto_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_projeto_rentabilidade"("p_projeto_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."rpc_sync_metas"() TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_sync_metas"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_sync_metas"() TO "service_role";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "postgres";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "anon";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "service_role";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "postgres";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "service_role";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "service_role";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."soft_delete_generic"() TO "anon";
GRANT ALL ON FUNCTION "public"."soft_delete_generic"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."soft_delete_generic"() TO "service_role";
GRANT ALL ON FUNCTION "public"."start_impersonation"("p_target_role" "text", "p_ip" "text", "p_user_agent" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."start_impersonation"("p_target_role" "text", "p_ip" "text", "p_user_agent" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."start_impersonation"("p_target_role" "text", "p_ip" "text", "p_user_agent" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."stop_impersonation"() TO "anon";
GRANT ALL ON FUNCTION "public"."stop_impersonation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."stop_impersonation"() TO "service_role";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."tg_audit_company_features"() TO "anon";
GRANT ALL ON FUNCTION "public"."tg_audit_company_features"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tg_audit_company_features"() TO "service_role";
GRANT ALL ON FUNCTION "public"."tg_audit_profile_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."tg_audit_profile_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tg_audit_profile_changes"() TO "service_role";
GRANT ALL ON FUNCTION "public"."tg_cascade_feature_revocation"() TO "anon";
GRANT ALL ON FUNCTION "public"."tg_cascade_feature_revocation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tg_cascade_feature_revocation"() TO "service_role";
GRANT ALL ON FUNCTION "public"."tg_feature_flags_touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."tg_feature_flags_touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tg_feature_flags_touch_updated_at"() TO "service_role";
GRANT ALL ON FUNCTION "public"."tg_pilar_link_subscription_on_owner_used"() TO "anon";
GRANT ALL ON FUNCTION "public"."tg_pilar_link_subscription_on_owner_used"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tg_pilar_link_subscription_on_owner_used"() TO "service_role";
GRANT ALL ON FUNCTION "public"."tg_pilar_touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."tg_pilar_touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tg_pilar_touch_updated_at"() TO "service_role";
GRANT ALL ON FUNCTION "public"."tg_protect_ultra_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."tg_protect_ultra_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tg_protect_ultra_admin"() TO "service_role";
GRANT ALL ON FUNCTION "public"."tg_validate_convite_features"() TO "anon";
GRANT ALL ON FUNCTION "public"."tg_validate_convite_features"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tg_validate_convite_features"() TO "service_role";
GRANT ALL ON FUNCTION "public"."tg_validate_convite_features_subset"() TO "anon";
GRANT ALL ON FUNCTION "public"."tg_validate_convite_features_subset"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tg_validate_convite_features_subset"() TO "service_role";
GRANT ALL ON FUNCTION "public"."tg_validate_features_subset"() TO "anon";
GRANT ALL ON FUNCTION "public"."tg_validate_features_subset"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tg_validate_features_subset"() TO "service_role";
GRANT ALL ON FUNCTION "public"."tg_validate_profile_features"() TO "anon";
GRANT ALL ON FUNCTION "public"."tg_validate_profile_features"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tg_validate_profile_features"() TO "service_role";
GRANT ALL ON FUNCTION "public"."tr_alocar_despesa_fatura"() TO "anon";
GRANT ALL ON FUNCTION "public"."tr_alocar_despesa_fatura"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tr_alocar_despesa_fatura"() TO "service_role";
GRANT ALL ON FUNCTION "public"."tr_recalc_fatura_total"() TO "anon";
GRANT ALL ON FUNCTION "public"."tr_recalc_fatura_total"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tr_recalc_fatura_total"() TO "service_role";
GRANT ALL ON FUNCTION "public"."tr_recalc_grupo_parcela"() TO "anon";
GRANT ALL ON FUNCTION "public"."tr_recalc_grupo_parcela"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tr_recalc_grupo_parcela"() TO "service_role";
GRANT ALL ON FUNCTION "public"."update_company_features"("p_features" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."update_company_features"("p_features" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_company_features"("p_features" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."update_projeto_completo"("p_projeto_id" "uuid", "p_codigo" "text", "p_nome" "text", "p_cliente_id" "uuid", "p_data_inicio" "date", "p_data_previsao" "date", "p_data_final" "date", "p_valor_contrato" numeric, "p_observacao" "text", "p_localizacao" "text", "p_parcelas" "text", "p_area_m2" numeric, "p_disciplinas" "jsonb", "p_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_projeto_completo"("p_projeto_id" "uuid", "p_codigo" "text", "p_nome" "text", "p_cliente_id" "uuid", "p_data_inicio" "date", "p_data_previsao" "date", "p_data_final" "date", "p_valor_contrato" numeric, "p_observacao" "text", "p_localizacao" "text", "p_parcelas" "text", "p_area_m2" numeric, "p_disciplinas" "jsonb", "p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_projeto_completo"("p_projeto_id" "uuid", "p_codigo" "text", "p_nome" "text", "p_cliente_id" "uuid", "p_data_inicio" "date", "p_data_previsao" "date", "p_data_final" "date", "p_valor_contrato" numeric, "p_observacao" "text", "p_localizacao" "text", "p_parcelas" "text", "p_area_m2" numeric, "p_disciplinas" "jsonb", "p_status" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."update_projeto_completo"("p_projeto_id" "uuid", "p_codigo" "text", "p_nome" "text", "p_cliente_id" "uuid", "p_data_inicio" "date", "p_data_previsao" "date", "p_data_final" "date", "p_valor_contrato" numeric, "p_observacao" "text", "p_localizacao" "text", "p_parcelas" "text", "p_area_m2" numeric, "p_disciplinas" "jsonb", "p_status" "text", "p_prioridade" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_projeto_completo"("p_projeto_id" "uuid", "p_codigo" "text", "p_nome" "text", "p_cliente_id" "uuid", "p_data_inicio" "date", "p_data_previsao" "date", "p_data_final" "date", "p_valor_contrato" numeric, "p_observacao" "text", "p_localizacao" "text", "p_parcelas" "text", "p_area_m2" numeric, "p_disciplinas" "jsonb", "p_status" "text", "p_prioridade" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_projeto_completo"("p_projeto_id" "uuid", "p_codigo" "text", "p_nome" "text", "p_cliente_id" "uuid", "p_data_inicio" "date", "p_data_previsao" "date", "p_data_final" "date", "p_valor_contrato" numeric, "p_observacao" "text", "p_localizacao" "text", "p_parcelas" "text", "p_area_m2" numeric, "p_disciplinas" "jsonb", "p_status" "text", "p_prioridade" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."update_user_access"("p_user_id" "uuid", "p_role" "text", "p_features" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_access"("p_user_id" "uuid", "p_role" "text", "p_features" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_access"("p_user_id" "uuid", "p_role" "text", "p_features" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."user_has_feature"("p_feature" "text", "p_min_level" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."user_has_feature"("p_feature" "text", "p_min_level" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_has_feature"("p_feature" "text", "p_min_level" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "service_role";
GRANT ALL ON TABLE "public"."admin_audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."admin_audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_audit_logs" TO "service_role";
GRANT ALL ON TABLE "public"."alertas" TO "anon";
GRANT ALL ON TABLE "public"."alertas" TO "authenticated";
GRANT ALL ON TABLE "public"."alertas" TO "service_role";
GRANT ALL ON TABLE "public"."aprovacoes" TO "anon";
GRANT ALL ON TABLE "public"."aprovacoes" TO "authenticated";
GRANT ALL ON TABLE "public"."aprovacoes" TO "service_role";
GRANT ALL ON TABLE "public"."asaas_config" TO "anon";
GRANT ALL ON TABLE "public"."asaas_config" TO "authenticated";
GRANT ALL ON TABLE "public"."asaas_config" TO "service_role";
GRANT ALL ON TABLE "public"."asaas_webhook_logs" TO "anon";
GRANT ALL ON TABLE "public"."asaas_webhook_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."asaas_webhook_logs" TO "service_role";
GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";
GRANT ALL ON TABLE "public"."audit_logs_archive" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs_archive" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs_archive" TO "service_role";
GRANT ALL ON TABLE "public"."cartoes" TO "anon";
GRANT ALL ON TABLE "public"."cartoes" TO "authenticated";
GRANT ALL ON TABLE "public"."cartoes" TO "service_role";
GRANT ALL ON TABLE "public"."categorias_financeiras" TO "anon";
GRANT ALL ON TABLE "public"."categorias_financeiras" TO "authenticated";
GRANT ALL ON TABLE "public"."categorias_financeiras" TO "service_role";
GRANT ALL ON TABLE "public"."centros_custo" TO "anon";
GRANT ALL ON TABLE "public"."centros_custo" TO "authenticated";
GRANT ALL ON TABLE "public"."centros_custo" TO "service_role";
GRANT ALL ON TABLE "public"."cliente_portal_accounts" TO "anon";
GRANT ALL ON TABLE "public"."cliente_portal_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."cliente_portal_accounts" TO "service_role";
GRANT ALL ON TABLE "public"."clientes" TO "anon";
GRANT ALL ON TABLE "public"."clientes" TO "authenticated";
GRANT ALL ON TABLE "public"."clientes" TO "service_role";
GRANT ALL ON TABLE "public"."contas" TO "anon";
GRANT ALL ON TABLE "public"."contas" TO "authenticated";
GRANT ALL ON TABLE "public"."contas" TO "service_role";
GRANT ALL ON TABLE "public"."convites" TO "anon";
GRANT ALL ON TABLE "public"."convites" TO "authenticated";
GRANT ALL ON TABLE "public"."convites" TO "service_role";
GRANT ALL ON TABLE "public"."critical_alerts" TO "anon";
GRANT ALL ON TABLE "public"."critical_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."critical_alerts" TO "service_role";
GRANT ALL ON TABLE "public"."data_deletion_requests" TO "anon";
GRANT ALL ON TABLE "public"."data_deletion_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."data_deletion_requests" TO "service_role";
GRANT ALL ON TABLE "public"."data_export_requests" TO "anon";
GRANT ALL ON TABLE "public"."data_export_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."data_export_requests" TO "service_role";
GRANT ALL ON TABLE "public"."despesas" TO "anon";
GRANT ALL ON TABLE "public"."despesas" TO "authenticated";
GRANT ALL ON TABLE "public"."despesas" TO "service_role";
GRANT ALL ON TABLE "public"."disciplinas" TO "anon";
GRANT ALL ON TABLE "public"."disciplinas" TO "authenticated";
GRANT ALL ON TABLE "public"."disciplinas" TO "service_role";
GRANT ALL ON TABLE "public"."empresa_owners_pending" TO "anon";
GRANT ALL ON TABLE "public"."empresa_owners_pending" TO "authenticated";
GRANT ALL ON TABLE "public"."empresa_owners_pending" TO "service_role";
GRANT ALL ON TABLE "public"."empresas" TO "anon";
GRANT ALL ON TABLE "public"."empresas" TO "authenticated";
GRANT ALL ON TABLE "public"."empresas" TO "service_role";
GRANT ALL ON TABLE "public"."escopo_historico" TO "anon";
GRANT ALL ON TABLE "public"."escopo_historico" TO "authenticated";
GRANT ALL ON TABLE "public"."escopo_historico" TO "service_role";
GRANT ALL ON TABLE "public"."escopo_itens" TO "anon";
GRANT ALL ON TABLE "public"."escopo_itens" TO "authenticated";
GRANT ALL ON TABLE "public"."escopo_itens" TO "service_role";
GRANT ALL ON TABLE "public"."escopos" TO "anon";
GRANT ALL ON TABLE "public"."escopos" TO "authenticated";
GRANT ALL ON TABLE "public"."escopos" TO "service_role";
GRANT ALL ON TABLE "public"."faturas" TO "anon";
GRANT ALL ON TABLE "public"."faturas" TO "authenticated";
GRANT ALL ON TABLE "public"."faturas" TO "service_role";
GRANT ALL ON TABLE "public"."feature_flags" TO "anon";
GRANT ALL ON TABLE "public"."feature_flags" TO "authenticated";
GRANT ALL ON TABLE "public"."feature_flags" TO "service_role";
GRANT ALL ON TABLE "public"."fluxos_disciplinas" TO "anon";
GRANT ALL ON TABLE "public"."fluxos_disciplinas" TO "authenticated";
GRANT ALL ON TABLE "public"."fluxos_disciplinas" TO "service_role";
GRANT ALL ON TABLE "public"."folha_pagamento" TO "anon";
GRANT ALL ON TABLE "public"."folha_pagamento" TO "authenticated";
GRANT ALL ON TABLE "public"."folha_pagamento" TO "service_role";
GRANT ALL ON TABLE "public"."fornecedores" TO "anon";
GRANT ALL ON TABLE "public"."fornecedores" TO "authenticated";
GRANT ALL ON TABLE "public"."fornecedores" TO "service_role";
GRANT ALL ON TABLE "public"."grupos_parcela" TO "anon";
GRANT ALL ON TABLE "public"."grupos_parcela" TO "authenticated";
GRANT ALL ON TABLE "public"."grupos_parcela" TO "service_role";
GRANT ALL ON TABLE "public"."lancamento_rateios" TO "anon";
GRANT ALL ON TABLE "public"."lancamento_rateios" TO "authenticated";
GRANT ALL ON TABLE "public"."lancamento_rateios" TO "service_role";
GRANT ALL ON TABLE "public"."receitas" TO "anon";
GRANT ALL ON TABLE "public"."receitas" TO "authenticated";
GRANT ALL ON TABLE "public"."receitas" TO "service_role";
GRANT ALL ON TABLE "public"."transferencias" TO "anon";
GRANT ALL ON TABLE "public"."transferencias" TO "authenticated";
GRANT ALL ON TABLE "public"."transferencias" TO "service_role";
GRANT ALL ON TABLE "public"."lancamentos" TO "anon";
GRANT ALL ON TABLE "public"."lancamentos" TO "authenticated";
GRANT ALL ON TABLE "public"."lancamentos" TO "service_role";
GRANT ALL ON TABLE "public"."leads" TO "anon";
GRANT ALL ON TABLE "public"."leads" TO "authenticated";
GRANT ALL ON TABLE "public"."leads" TO "service_role";
GRANT ALL ON TABLE "public"."marcos_faturamento" TO "anon";
GRANT ALL ON TABLE "public"."marcos_faturamento" TO "authenticated";
GRANT ALL ON TABLE "public"."marcos_faturamento" TO "service_role";
GRANT ALL ON TABLE "public"."metas" TO "anon";
GRANT ALL ON TABLE "public"."metas" TO "authenticated";
GRANT ALL ON TABLE "public"."metas" TO "service_role";
GRANT ALL ON TABLE "public"."mfa_backup_codes" TO "anon";
GRANT ALL ON TABLE "public"."mfa_backup_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."mfa_backup_codes" TO "service_role";
GRANT ALL ON TABLE "public"."orcamento_versoes" TO "anon";
GRANT ALL ON TABLE "public"."orcamento_versoes" TO "authenticated";
GRANT ALL ON TABLE "public"."orcamento_versoes" TO "service_role";
GRANT ALL ON TABLE "public"."pessoas" TO "anon";
GRANT ALL ON TABLE "public"."pessoas" TO "authenticated";
GRANT ALL ON TABLE "public"."pessoas" TO "service_role";
GRANT ALL ON TABLE "public"."pilar_checkout_webhook_logs" TO "anon";
GRANT ALL ON TABLE "public"."pilar_checkout_webhook_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."pilar_checkout_webhook_logs" TO "service_role";
GRANT ALL ON TABLE "public"."pilar_pending_signups" TO "anon";
GRANT ALL ON TABLE "public"."pilar_pending_signups" TO "authenticated";
GRANT ALL ON TABLE "public"."pilar_pending_signups" TO "service_role";
GRANT ALL ON TABLE "public"."pilar_subscription_plans" TO "anon";
GRANT ALL ON TABLE "public"."pilar_subscription_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."pilar_subscription_plans" TO "service_role";
GRANT ALL ON TABLE "public"."pilar_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."pilar_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."pilar_subscriptions" TO "service_role";
GRANT ALL ON TABLE "public"."portal_download_logs" TO "anon";
GRANT ALL ON TABLE "public"."portal_download_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."portal_download_logs" TO "service_role";
GRANT ALL ON TABLE "public"."portal_entregas" TO "anon";
GRANT ALL ON TABLE "public"."portal_entregas" TO "authenticated";
GRANT ALL ON TABLE "public"."portal_entregas" TO "service_role";
GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";
GRANT ALL ON TABLE "public"."projeto_disciplina_responsaveis" TO "anon";
GRANT ALL ON TABLE "public"."projeto_disciplina_responsaveis" TO "authenticated";
GRANT ALL ON TABLE "public"."projeto_disciplina_responsaveis" TO "service_role";
GRANT ALL ON TABLE "public"."projeto_disciplinas" TO "anon";
GRANT ALL ON TABLE "public"."projeto_disciplinas" TO "authenticated";
GRANT ALL ON TABLE "public"."projeto_disciplinas" TO "service_role";
GRANT ALL ON TABLE "public"."projeto_orcamento_fases" TO "anon";
GRANT ALL ON TABLE "public"."projeto_orcamento_fases" TO "authenticated";
GRANT ALL ON TABLE "public"."projeto_orcamento_fases" TO "service_role";
GRANT ALL ON TABLE "public"."projetos" TO "anon";
GRANT ALL ON TABLE "public"."projetos" TO "authenticated";
GRANT ALL ON TABLE "public"."projetos" TO "service_role";
GRANT ALL ON TABLE "public"."proposta_disciplinas" TO "anon";
GRANT ALL ON TABLE "public"."proposta_disciplinas" TO "authenticated";
GRANT ALL ON TABLE "public"."proposta_disciplinas" TO "service_role";
GRANT ALL ON TABLE "public"."proposta_templates" TO "anon";
GRANT ALL ON TABLE "public"."proposta_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."proposta_templates" TO "service_role";
GRANT ALL ON TABLE "public"."propostas" TO "anon";
GRANT ALL ON TABLE "public"."propostas" TO "authenticated";
GRANT ALL ON TABLE "public"."propostas" TO "service_role";
GRANT ALL ON TABLE "public"."rate_limit_attempts" TO "anon";
GRANT ALL ON TABLE "public"."rate_limit_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."rate_limit_attempts" TO "service_role";
GRANT ALL ON TABLE "public"."templates_projeto" TO "anon";
GRANT ALL ON TABLE "public"."templates_projeto" TO "authenticated";
GRANT ALL ON TABLE "public"."templates_projeto" TO "service_role";
GRANT ALL ON TABLE "public"."ultra_admin_modes" TO "anon";
GRANT ALL ON TABLE "public"."ultra_admin_modes" TO "authenticated";
GRANT ALL ON TABLE "public"."ultra_admin_modes" TO "service_role";
GRANT ALL ON TABLE "public"."view_cartao_resumo" TO "anon";
GRANT ALL ON TABLE "public"."view_cartao_resumo" TO "authenticated";
GRANT ALL ON TABLE "public"."view_cartao_resumo" TO "service_role";
GRANT ALL ON TABLE "public"."view_fatura_resumo" TO "anon";
GRANT ALL ON TABLE "public"."view_fatura_resumo" TO "authenticated";
GRANT ALL ON TABLE "public"."view_fatura_resumo" TO "service_role";
GRANT ALL ON TABLE "public"."view_financas_resumo" TO "anon";
GRANT ALL ON TABLE "public"."view_financas_resumo" TO "authenticated";
GRANT ALL ON TABLE "public"."view_financas_resumo" TO "service_role";
GRANT ALL ON TABLE "public"."view_folha_pagamento" TO "anon";
GRANT ALL ON TABLE "public"."view_folha_pagamento" TO "authenticated";
GRANT ALL ON TABLE "public"."view_folha_pagamento" TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
