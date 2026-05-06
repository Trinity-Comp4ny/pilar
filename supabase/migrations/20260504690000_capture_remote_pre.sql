-- Captura PRE: tipos, tabelas e funcoes referenciadas por migracoes posteriores.

SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET client_min_messages = warning;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace=n.oid WHERE n.nspname='public' AND t.typname='status_empresa') THEN
    CREATE TYPE "public"."status_empresa" AS ENUM (
    'active',
    'suspended',
    'cancelled'
);
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace=n.oid WHERE n.nspname='public' AND t.typname='status_financeiro') THEN
    CREATE TYPE "public"."status_financeiro" AS ENUM (
    'Pendente',
    'Pago',
    'Recebido',
    'Atrasado',
    'Cancelado'
);
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace=n.oid WHERE n.nspname='public' AND t.typname='status_projeto') THEN
    CREATE TYPE "public"."status_projeto" AS ENUM (
    'Planejamento',
    'Execução',
    'Paralisado',
    'Concluído',
    'Cancelado',
    'Em andamento',
    'Revisão'
);
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace=n.oid WHERE n.nspname='public' AND t.typname='tipo_categoria') THEN
    CREATE TYPE "public"."tipo_categoria" AS ENUM (
    'Receita',
    'Despesa'
);
  END IF;
END $wrap$;
DO $wrap$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace=n.oid WHERE n.nspname='public' AND t.typname='user_role') THEN
    CREATE TYPE "public"."user_role" AS ENUM (
    'user',
    'admin',
    'ultra_admin'
);
  END IF;
END $wrap$;
CREATE TABLE IF NOT EXISTS "public"."impersonation_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "admin_id" "uuid" NOT NULL,
    "admin_role" "text" NOT NULL,
    "target_role" "text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '00:30:00'::interval) NOT NULL,
    "ended_at" timestamp with time zone,
    "ip_address" "text",
    "user_agent" "text"
);
CREATE TABLE IF NOT EXISTS "public"."admin_audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_id" "uuid" NOT NULL,
    "actor_email" "text" NOT NULL,
    "actor_role" "text" NOT NULL,
    "action" "text" NOT NULL,
    "category" "text" NOT NULL,
    "target_type" "text",
    "target_id" "text",
    "target_name" "text",
    "empresa_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "ip_address" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "admin_audit_logs_actor_role_check" CHECK (("actor_role" = ANY (ARRAY['ultra_admin'::"text", 'admin'::"text"]))),
    CONSTRAINT "admin_audit_logs_category_check" CHECK (("category" = ANY (ARRAY['user'::"text", 'empresa'::"text", 'member'::"text", 'billing'::"text", 'impersonation'::"text"])))
);
CREATE TABLE IF NOT EXISTS "public"."alertas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "tipo" "text" NOT NULL,
    "severidade" "text" DEFAULT 'medium'::"text",
    "titulo" "text" NOT NULL,
    "mensagem" "text" NOT NULL,
    "referencia_tipo" "text",
    "referencia_id" "uuid",
    "lido" boolean DEFAULT false,
    "lido_por" "uuid",
    "lido_em" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "alertas_severidade_check" CHECK (("severidade" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "alertas_tipo_check" CHECK (("tipo" = ANY (ARRAY['horas_excedidas'::"text", 'pagamento_atrasado'::"text", 'superalocacao'::"text", 'margem_baixa'::"text", 'marco_proximo'::"text", 'orcamento_excedido'::"text", 'vencimento_proximo'::"text", 'recebimento_baixo'::"text"])))
);
CREATE TABLE IF NOT EXISTS "public"."aprovacoes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "tipo" "text" NOT NULL,
    "referencia_tipo" "text" NOT NULL,
    "referencia_id" "uuid" NOT NULL,
    "solicitante_id" "uuid",
    "aprovador_id" "uuid",
    "status" "text" DEFAULT 'pendente'::"text" NOT NULL,
    "justificativa" "text",
    "resposta" "text",
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    CONSTRAINT "aprovacoes_status_check" CHECK (("status" = ANY (ARRAY['pendente'::"text", 'aprovado'::"text", 'rejeitado'::"text"]))),
    CONSTRAINT "aprovacoes_tipo_check" CHECK (("tipo" = ANY (ARRAY['despesa_acima_limite'::"text", 'aditivo'::"text", 'contratacao'::"text", 'orcamento'::"text", 'proposta'::"text"])))
);
CREATE TABLE IF NOT EXISTS "public"."asaas_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "api_key" "text" NOT NULL,
    "ambiente" "text" DEFAULT 'sandbox'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "asaas_config_ambiente_check" CHECK (("ambiente" = ANY (ARRAY['sandbox'::"text", 'producao'::"text"])))
);
CREATE TABLE IF NOT EXISTS "public"."asaas_webhook_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid",
    "event" "text" NOT NULL,
    "payment_id" "text",
    "receita_id" "uuid",
    "payload" "jsonb",
    "processed_at" timestamp with time zone DEFAULT "now"()
);
CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_id" "uuid",
    "actor_email" "text",
    "action" "text" NOT NULL,
    "target_table" "text",
    "target_id" "uuid",
    "diff" "jsonb",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "empresa_id" "uuid"
);
CREATE TABLE IF NOT EXISTS "public"."audit_logs_archive" (
    "id" "uuid" NOT NULL,
    "empresa_id" "uuid",
    "actor_id" "uuid",
    "actor_email" "text",
    "action" "text" NOT NULL,
    "target_table" "text" NOT NULL,
    "target_id" "uuid",
    "old_data" "jsonb",
    "new_data" "jsonb",
    "diff" "jsonb",
    "ip_address" "text",
    "created_at" timestamp with time zone NOT NULL,
    "archived_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "audit_logs_archive_action_check" CHECK (("action" = ANY (ARRAY['INSERT'::"text", 'UPDATE'::"text", 'DELETE'::"text"])))
);
CREATE TABLE IF NOT EXISTS "public"."cartoes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "dia_fechamento" integer,
    "dia_vencimento" integer,
    "limite" numeric(12,2) NOT NULL,
    "cor" "text",
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "usado" numeric,
    "conta_pagamento_id" "uuid",
    "tipo" "text" DEFAULT 'credito'::"text" NOT NULL,
    CONSTRAINT "cartoes_dia_fechamento_check" CHECK ((("dia_fechamento" >= 1) AND ("dia_fechamento" <= 31))),
    CONSTRAINT "cartoes_dia_vencimento_check" CHECK ((("dia_vencimento" >= 1) AND ("dia_vencimento" <= 31))),
    CONSTRAINT "cartoes_tipo_check" CHECK (("tipo" = ANY (ARRAY['credito'::"text", 'debito'::"text"])))
);
CREATE TABLE IF NOT EXISTS "public"."categorias_financeiras" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "tipo" "public"."tipo_categoria" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone
);
CREATE TABLE IF NOT EXISTS "public"."centros_custo" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "codigo" "text",
    "nome" "text" NOT NULL,
    "descricao" "text",
    "ativo" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);
CREATE TABLE IF NOT EXISTS "public"."cliente_portal_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "ativo" boolean DEFAULT true,
    "ultimo_acesso" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "email" "text",
    "senha_hash" "text",
    "token_sessao" "text",
    "token_expira_em" timestamp with time zone
);
CREATE TABLE IF NOT EXISTS "public"."clientes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "cpf_cnpj" "text",
    "contato" "text" NOT NULL,
    "email" "text" NOT NULL,
    "endereco" "text",
    "deleted_at" timestamp with time zone,
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tipo_nf" "text",
    "origem" "text",
    "contas_bancarias" "jsonb" DEFAULT '[]'::"jsonb",
    "asaas_customer_id" "text",
    "chaves_pix" "jsonb" DEFAULT '[]'::"jsonb",
    "sobrenome" "text"
);
CREATE TABLE IF NOT EXISTS "public"."contas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "banco" "text" NOT NULL,
    "saldo_inicial" numeric(12,2) DEFAULT 0,
    "cor" "text",
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "saldo_atual" numeric,
    "tipo_chave_pix" "text",
    "chave_pix" "text",
    CONSTRAINT "contas_tipo_chave_pix_check" CHECK (("tipo_chave_pix" = ANY (ARRAY['cpf_cnpj'::"text", 'email'::"text", 'telefone'::"text", 'aleatoria'::"text"])))
);
CREATE TABLE IF NOT EXISTS "public"."convites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "cargo" "public"."user_role" DEFAULT 'user'::"public"."user_role" NOT NULL,
    "nome" "text",
    "token" "text" DEFAULT "encode"("extensions"."gen_random_bytes"(32), 'hex'::"text") NOT NULL,
    "criado_por" "uuid",
    "expira_em" timestamp with time zone DEFAULT ("now"() + '7 days'::interval) NOT NULL,
    "usado_em" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "features" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);
CREATE TABLE IF NOT EXISTS "public"."critical_alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid",
    "actor_id" "uuid",
    "actor_email" "text",
    "alert_type" "text" NOT NULL,
    "severity" "text" NOT NULL,
    "target_table" "text",
    "target_id" "uuid",
    "message" "text" NOT NULL,
    "metadata" "jsonb",
    "notified" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "critical_alerts_severity_check" CHECK (("severity" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"])))
);
CREATE TABLE IF NOT EXISTS "public"."data_deletion_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "empresa_id" "uuid",
    "motivo" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processed_at" timestamp with time zone,
    "processed_by" "uuid",
    "notes" "text",
    "notified_at" timestamp with time zone,
    CONSTRAINT "data_deletion_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'in_progress'::"text", 'completed'::"text", 'rejected'::"text"])))
);
CREATE TABLE IF NOT EXISTS "public"."data_export_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "empresa_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "download_url" "text",
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "data_export_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"])))
);
CREATE TABLE IF NOT EXISTS "public"."despesas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "descricao" "text" NOT NULL,
    "valor" numeric(12,2) NOT NULL,
    "data_vencimento" "date",
    "data_pagamento" "date",
    "status" "public"."status_financeiro" DEFAULT 'Pendente'::"public"."status_financeiro",
    "projeto_id" "uuid",
    "fornecedor_id" "uuid",
    "categoria_id" "uuid",
    "conta_id" "uuid",
    "cartao_id" "uuid",
    "nota_fiscal" "text",
    "observacao" "text",
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "grupo_parcela" "uuid",
    "parcela_numero" integer,
    "parcela_total" integer,
    "is_fatura_payment" boolean DEFAULT false NOT NULL,
    "fatura_id" "uuid",
    "recorrente" boolean DEFAULT false,
    "periodicidade" "text",
    "despesa_pai_id" "uuid",
    "data_competencia" "date",
    "centro_custo_id" "uuid",
    "tags" "text"[],
    "forma_pagamento" "text",
    CONSTRAINT "despesas_periodicidade_check" CHECK (("periodicidade" = ANY (ARRAY['mensal'::"text", 'trimestral'::"text", 'semestral'::"text", 'anual'::"text"])))
);
CREATE TABLE IF NOT EXISTS "public"."disciplinas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);
CREATE TABLE IF NOT EXISTS "public"."empresa_owners_pending" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "company_name" "text" NOT NULL,
    "nome" "text",
    "token" "text" DEFAULT "encode"("extensions"."gen_random_bytes"(32), 'hex'::"text") NOT NULL,
    "criado_por" "uuid",
    "expira_em" timestamp with time zone DEFAULT ("now"() + '7 days'::interval) NOT NULL,
    "usado_em" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);
CREATE TABLE IF NOT EXISTS "public"."empresas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid",
    "nome" "text" NOT NULL,
    "cnpj" "text",
    "status" "public"."status_empresa" DEFAULT 'active'::"public"."status_empresa",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "updated_by" "uuid",
    "email" "text",
    "contato" "text",
    "endereco" "text",
    "cidade" "text",
    "estado" "text",
    "cep" "text",
    "logo_url" "text",
    "onboarding_completed" boolean DEFAULT false,
    "features" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "pix_chave" "text",
    "pix_instrucoes" "text"
);
CREATE TABLE IF NOT EXISTS "public"."escopo_historico" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escopo_id" "uuid" NOT NULL,
    "acao" "text" NOT NULL,
    "usuario_id" "uuid",
    "usuario_nome" "text",
    "detalhes" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);
CREATE TABLE IF NOT EXISTS "public"."escopo_itens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escopo_id" "uuid" NOT NULL,
    "descricao" "text" NOT NULL,
    "disciplina" "text",
    "horas" numeric DEFAULT 0,
    "custo" numeric DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);
CREATE TABLE IF NOT EXISTS "public"."escopos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "projeto_id" "uuid" NOT NULL,
    "descricao" "text" NOT NULL,
    "tipo" "text" NOT NULL,
    "status" "text" DEFAULT 'rascunho'::"text",
    "horas_estimadas" numeric DEFAULT 0,
    "custo_estimado" numeric DEFAULT 0,
    "impacto_prazo_dias" integer DEFAULT 0,
    "valor_aditivo" numeric DEFAULT 0,
    "justificativa" "text",
    "aprovado_por" "uuid",
    "aprovado_em" timestamp with time zone,
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    CONSTRAINT "escopos_status_check" CHECK (("status" = ANY (ARRAY['rascunho'::"text", 'pendente_aprovacao'::"text", 'aprovado'::"text", 'rejeitado'::"text"]))),
    CONSTRAINT "escopos_tipo_check" CHECK (("tipo" = ANY (ARRAY['original'::"text", 'aditivo'::"text"])))
);
CREATE TABLE IF NOT EXISTS "public"."faturas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "cartao_id" "uuid" NOT NULL,
    "mes_referencia" integer NOT NULL,
    "ano_referencia" integer NOT NULL,
    "data_inicio" "date" NOT NULL,
    "data_fim" "date" NOT NULL,
    "data_vencimento" "date" NOT NULL,
    "valor_total" numeric(12,2) DEFAULT 0 NOT NULL,
    "valor_pago" numeric(12,2) DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'Aberta'::"text" NOT NULL,
    "conta_pagamento_id" "uuid",
    "data_pagamento" "date",
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "idempotency_key" "text",
    CONSTRAINT "faturas_ano_referencia_check" CHECK ((("ano_referencia" >= 2020) AND ("ano_referencia" <= 2100))),
    CONSTRAINT "faturas_mes_referencia_check" CHECK ((("mes_referencia" >= 1) AND ("mes_referencia" <= 12))),
    CONSTRAINT "faturas_status_check" CHECK (("status" = ANY (ARRAY['Aberta'::"text", 'Fechada'::"text", 'Paga'::"text", 'Parcial'::"text"])))
);
CREATE TABLE IF NOT EXISTS "public"."feature_flags" (
    "key" "text" NOT NULL,
    "description" "text",
    "enabled_for_all" boolean DEFAULT false NOT NULL,
    "percentage" integer DEFAULT 0 NOT NULL,
    "enabled_for_empresas" "uuid"[] DEFAULT ARRAY[]::"uuid"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "feature_flags_percentage_check" CHECK ((("percentage" >= 0) AND ("percentage" <= 100)))
);
CREATE TABLE IF NOT EXISTS "public"."fluxos_disciplinas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "descricao" "text",
    "etapas" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "ativo" boolean DEFAULT true,
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone
);
CREATE TABLE IF NOT EXISTS "public"."folha_pagamento" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "pessoa_id" "uuid" NOT NULL,
    "mes" integer NOT NULL,
    "ano" integer NOT NULL,
    "salario_fixo" numeric(10,2) DEFAULT 0,
    "total_area_projetada" numeric(10,2) DEFAULT 0,
    "valor_m2" numeric(10,2) DEFAULT 0,
    "adicional_variavel" numeric(10,2) DEFAULT 0,
    "total_receber" numeric(10,2) DEFAULT 0,
    "status" "text" DEFAULT 'pendente'::"text",
    "data_pagamento" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "folha_pagamento_mes_check" CHECK ((("mes" >= 1) AND ("mes" <= 12))),
    CONSTRAINT "folha_pagamento_status_check" CHECK (("status" = ANY (ARRAY['pendente'::"text", 'pago'::"text", 'cancelado'::"text"])))
);
CREATE TABLE IF NOT EXISTS "public"."fornecedores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "cnpj" "text",
    "contato" "text",
    "email" "text",
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);
CREATE TABLE IF NOT EXISTS "public"."grupos_parcela" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "tipo_lancamento" "text" NOT NULL,
    "tipo_grupo" "text" DEFAULT 'finito'::"text" NOT NULL,
    "descricao" "text",
    "total_original" numeric(12,2),
    "num_parcelas" integer,
    "periodicidade" "text" DEFAULT 'mensal'::"text",
    "dia_vencimento" integer,
    "contraparte_id" "uuid",
    "contraparte_tipo" "text",
    "projeto_id" "uuid",
    "categoria_id" "uuid",
    "centro_custo_id" "uuid",
    "observacao" "text",
    "status_agregado" "text" DEFAULT 'aberto'::"text" NOT NULL,
    "renegociado_de" "uuid",
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "grupos_parcela_check" CHECK (((("tipo_grupo" = 'finito'::"text") AND ("num_parcelas" IS NOT NULL) AND ("num_parcelas" > 0)) OR ("tipo_grupo" = 'recorrente'::"text"))),
    CONSTRAINT "grupos_parcela_contraparte_tipo_check" CHECK (("contraparte_tipo" = ANY (ARRAY['cliente'::"text", 'fornecedor'::"text"]))),
    CONSTRAINT "grupos_parcela_dia_vencimento_check" CHECK ((("dia_vencimento" >= 1) AND ("dia_vencimento" <= 31))),
    CONSTRAINT "grupos_parcela_periodicidade_check" CHECK (("periodicidade" = ANY (ARRAY['mensal'::"text", 'bimestral'::"text", 'trimestral'::"text", 'semestral'::"text", 'anual'::"text"]))),
    CONSTRAINT "grupos_parcela_status_agregado_check" CHECK (("status_agregado" = ANY (ARRAY['aberto'::"text", 'parcial'::"text", 'quitado'::"text", 'cancelado'::"text"]))),
    CONSTRAINT "grupos_parcela_tipo_grupo_check" CHECK (("tipo_grupo" = ANY (ARRAY['finito'::"text", 'recorrente'::"text"]))),
    CONSTRAINT "grupos_parcela_tipo_lancamento_check" CHECK (("tipo_lancamento" = ANY (ARRAY['receita'::"text", 'despesa'::"text"])))
);
CREATE TABLE IF NOT EXISTS "public"."lancamento_rateios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "lancamento_id" "uuid" NOT NULL,
    "tipo_lancamento" "text" NOT NULL,
    "centro_custo_id" "uuid" NOT NULL,
    "percentual" numeric(5,2) NOT NULL,
    "valor" numeric(12,2),
    "observacao" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "lancamento_rateios_percentual_check" CHECK ((("percentual" > (0)::numeric) AND ("percentual" <= (100)::numeric))),
    CONSTRAINT "lancamento_rateios_tipo_lancamento_check" CHECK (("tipo_lancamento" = ANY (ARRAY['receita'::"text", 'despesa'::"text"])))
);
CREATE TABLE IF NOT EXISTS "public"."receitas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "descricao" "text" NOT NULL,
    "valor" numeric(12,2) NOT NULL,
    "data_vencimento" "date",
    "data_recebimento" "date",
    "status" "public"."status_financeiro" DEFAULT 'Pendente'::"public"."status_financeiro",
    "projeto_id" "uuid",
    "cliente_id" "uuid",
    "categoria_id" "uuid",
    "conta_id" "uuid",
    "nota_fiscal" "text",
    "observacao" "text",
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "forma_pagamento" "text",
    "grupo_parcela" "uuid",
    "parcela_numero" integer,
    "parcela_total" integer,
    "asaas_payment_id" "text",
    "asaas_payment_url" "text",
    "asaas_payment_status" "text",
    "asaas_billing_type" "text",
    "data_competencia" "date",
    "centro_custo_id" "uuid",
    "tags" "text"[]
);
CREATE TABLE IF NOT EXISTS "public"."transferencias" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "conta_origem_id" "uuid" NOT NULL,
    "conta_destino_id" "uuid" NOT NULL,
    "valor" numeric(12,2) NOT NULL,
    "data_transferencia" "date" NOT NULL,
    "descricao" "text",
    "status" "text" DEFAULT 'Concluída'::"text" NOT NULL,
    "observacao" "text",
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "transferencias_contas_diferentes" CHECK (("conta_origem_id" <> "conta_destino_id")),
    CONSTRAINT "transferencias_status_check" CHECK (("status" = ANY (ARRAY['Concluída'::"text", 'Pendente'::"text"]))),
    CONSTRAINT "transferencias_valor_check" CHECK (("valor" > (0)::numeric))
);
CREATE TABLE IF NOT EXISTS "public"."leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "email" "text",
    "contato" "text",
    "status" "text" DEFAULT 'Novo'::"text",
    "origem" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "cliente_id" "uuid",
    "motivo_perda" "text",
    "convertido_em" timestamp with time zone,
    "valor_estimado" numeric(12,2),
    "responsavel_id" "uuid",
    "previsao_fechamento" "date",
    "empresa_lead" "text",
    "notas" "text",
    "sobrenome" "text"
);
CREATE TABLE IF NOT EXISTS "public"."marcos_faturamento" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "projeto_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "disciplina" "text",
    "percentual" numeric(5,2),
    "valor" numeric(12,2) NOT NULL,
    "data_prevista" "date",
    "data_faturada" "date",
    "receita_id" "uuid",
    "status" "text" DEFAULT 'pendente'::"text",
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    CONSTRAINT "marcos_faturamento_status_check" CHECK (("status" = ANY (ARRAY['pendente'::"text", 'faturado'::"text", 'recebido'::"text", 'cancelado'::"text"])))
);
CREATE TABLE IF NOT EXISTS "public"."metas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL,
    "alvo" numeric NOT NULL,
    "atual" numeric DEFAULT 0 NOT NULL,
    "prazo" "date",
    "categoria" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "tipo" "text" DEFAULT 'financeira'::"text" NOT NULL,
    "pessoa_id" "uuid",
    "projeto_id" "uuid",
    "empresa_id" "uuid",
    "descricao" "text",
    "unidade" "text" DEFAULT 'currency'::"text" NOT NULL,
    "auto_sync" boolean DEFAULT false,
    "sync_fonte" "text",
    "sync_filtro" "jsonb",
    "deleted_at" timestamp with time zone,
    CONSTRAINT "metas_categoria_check" CHECK (("categoria" = ANY (ARRAY['receita'::"text", 'lucro'::"text", 'economia'::"text", 'investimento'::"text"])))
);
CREATE TABLE IF NOT EXISTS "public"."mfa_backup_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "code_hash" "text" NOT NULL,
    "used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);
CREATE TABLE IF NOT EXISTS "public"."orcamento_versoes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "projeto_id" "uuid" NOT NULL,
    "versao" integer DEFAULT 1 NOT NULL,
    "dados" "jsonb" NOT NULL,
    "motivo" "text",
    "criado_por" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);
CREATE TABLE IF NOT EXISTS "public"."pessoas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "profile_id" "uuid",
    "nome" "text" NOT NULL,
    "cpf" "text",
    "cargo" "text",
    "email" "text" NOT NULL,
    "telefone" "text",
    "tipo_contrato" "text",
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "endereco" "text",
    "data_admissao" "date",
    "salario_fixo" numeric(12,2),
    "valor_m2" numeric(12,2),
    "data_demissao" "date",
    "contas_bancarias" "jsonb" DEFAULT '[]'::"jsonb",
    "horas_semanais" numeric DEFAULT 40,
    "status" "text" DEFAULT 'ativo'::"text" NOT NULL,
    "data_nascimento" "date",
    "rg" "text",
    "pis_nit" "text",
    "cnpj" "text",
    "razao_social" "text",
    "primeiro_nome" "text" NOT NULL,
    "sobrenome" "text" NOT NULL,
    "chaves_pix" "jsonb" DEFAULT '[]'::"jsonb",
    CONSTRAINT "pessoas_status_check" CHECK (("status" = ANY (ARRAY['ativo'::"text", 'inativo'::"text", 'afastado'::"text"]))),
    CONSTRAINT "pessoas_tipo_contrato_check" CHECK (("tipo_contrato" = ANY (ARRAY['clt'::"text", 'pj'::"text", 'estagiario'::"text", 'socio'::"text", 'terceirizado'::"text"])))
);
CREATE TABLE IF NOT EXISTS "public"."pilar_checkout_webhook_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event" "text" NOT NULL,
    "asaas_payment_id" "text",
    "asaas_subscription_id" "text",
    "pending_signup_id" "uuid",
    "subscription_id" "uuid",
    "payload" "jsonb",
    "processed" boolean DEFAULT false NOT NULL,
    "error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);
CREATE TABLE IF NOT EXISTS "public"."pilar_pending_signups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "nome" "text" NOT NULL,
    "company_name" "text" NOT NULL,
    "cpf_cnpj" "text" NOT NULL,
    "telefone" "text",
    "plan_id" "uuid" NOT NULL,
    "billing_cycle" "text" DEFAULT 'monthly'::"text" NOT NULL,
    "billing_type" "text" NOT NULL,
    "asaas_customer_id" "text",
    "asaas_subscription_id" "text",
    "asaas_payment_id" "text",
    "payment_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "paid_at" timestamp with time zone,
    "invite_dispatched_at" timestamp with time zone,
    "activated_at" timestamp with time zone,
    "empresa_owner_pending_id" "uuid",
    "payment_metadata" "jsonb",
    "checkout_session_token" "text" DEFAULT "encode"("extensions"."gen_random_bytes"(32), 'hex'::"text") NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pilar_pending_signups_billing_cycle_check" CHECK (("billing_cycle" = ANY (ARRAY['monthly'::"text", 'yearly'::"text"]))),
    CONSTRAINT "pilar_pending_signups_billing_type_check" CHECK (("billing_type" = ANY (ARRAY['CREDIT_CARD'::"text", 'PIX'::"text", 'BOLETO'::"text"]))),
    CONSTRAINT "pilar_pending_signups_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'failed'::"text", 'canceled'::"text"])))
);
CREATE TABLE IF NOT EXISTS "public"."pilar_subscription_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "nome" "text" NOT NULL,
    "descricao" "text",
    "preco_mensal" numeric(10,2) NOT NULL,
    "preco_anual" numeric(10,2),
    "max_usuarios" integer,
    "max_projetos" integer,
    "features" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "destaque" boolean DEFAULT false NOT NULL,
    "ativo" boolean DEFAULT true NOT NULL,
    "ordem" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);
CREATE TABLE IF NOT EXISTS "public"."pilar_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "billing_cycle" "text",
    "billing_type" "text",
    "asaas_customer_id" "text",
    "asaas_subscription_id" "text",
    "current_period_start" timestamp with time zone,
    "current_period_end" timestamp with time zone,
    "trial_ends_at" timestamp with time zone,
    "canceled_at" timestamp with time zone,
    "pending_signup_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pilar_subscriptions_billing_cycle_check" CHECK (("billing_cycle" = ANY (ARRAY['monthly'::"text", 'yearly'::"text"]))),
    CONSTRAINT "pilar_subscriptions_status_check" CHECK (("status" = ANY (ARRAY['trialing'::"text", 'active'::"text", 'overdue'::"text", 'canceled'::"text", 'expired'::"text"])))
);
CREATE TABLE IF NOT EXISTS "public"."portal_download_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "cliente_id" "uuid",
    "entrega_id" "uuid",
    "arquivo_path" "text",
    "ip" "text",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);
CREATE TABLE IF NOT EXISTS "public"."portal_entregas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "projeto_id" "uuid" NOT NULL,
    "titulo" "text" NOT NULL,
    "descricao" "text",
    "tipo" "text",
    "status" "text" DEFAULT 'pendente'::"text",
    "resposta_cliente" "text",
    "respondido_em" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "drive_url" "text",
    CONSTRAINT "portal_entregas_drive_url_format" CHECK ((("drive_url" IS NULL) OR ("drive_url" ~ '^https://(drive|docs)\.google\.com/.+'::"text"))),
    CONSTRAINT "portal_entregas_status_check" CHECK (("status" = ANY (ARRAY['pendente'::"text", 'aprovado'::"text", 'revisao_solicitada'::"text"]))),
    CONSTRAINT "portal_entregas_tipo_check" CHECK (("tipo" = ANY (ARRAY['documento'::"text", 'aprovacao'::"text", 'informacao'::"text"])))
);
CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "role" "public"."user_role" DEFAULT 'user'::"public"."user_role",
    "contato" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "updated_by" "uuid",
    "onboarding_completed" boolean DEFAULT false,
    "features" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "first_name" "text" DEFAULT ''::"text" NOT NULL,
    "last_name" "text" DEFAULT ''::"text" NOT NULL,
    "nome" "text" GENERATED ALWAYS AS (
CASE
    WHEN (("last_name" IS NOT NULL) AND ("last_name" <> ''::"text")) THEN (("first_name" || ' '::"text") || "last_name")
    ELSE "first_name"
END) STORED
);
CREATE TABLE IF NOT EXISTS "public"."projeto_disciplina_responsaveis" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "projeto_disciplina_id" "uuid" NOT NULL,
    "pessoa_id" "uuid" NOT NULL
);
CREATE TABLE IF NOT EXISTS "public"."projeto_disciplinas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "projeto_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "status" "text" DEFAULT 'Não Iniciado'::"text",
    "data_inicio" "date",
    "data_fim" "date",
    "data_fim_real" "date",
    "observacoes" "text",
    "prioridade" "text",
    "justificativa_atraso" "text",
    "horas_estimadas" numeric DEFAULT 0,
    "custo_hora" numeric DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "ordem_etapa" integer
);
CREATE TABLE IF NOT EXISTS "public"."projeto_orcamento_fases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "projeto_id" "uuid" NOT NULL,
    "disciplina" "text" NOT NULL,
    "horas_estimadas" numeric(8,2) DEFAULT 0,
    "custo_hora" numeric(10,2) DEFAULT 0,
    "custo_estimado" numeric(12,2) GENERATED ALWAYS AS (("horas_estimadas" * "custo_hora")) STORED,
    "margem_alvo_pct" numeric(5,2) DEFAULT 20.0,
    "valor_venda" numeric(12,2) DEFAULT 0,
    "observacao" "text",
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone
);
CREATE TABLE IF NOT EXISTS "public"."projetos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "cliente_id" "uuid",
    "codigo_projeto" "text",
    "nome" "text" NOT NULL,
    "localizacao" "text",
    "status" "public"."status_projeto" DEFAULT 'Planejamento'::"public"."status_projeto",
    "data_inicio" "date",
    "data_previsao" "date",
    "data_final" "date",
    "valor_contrato" numeric(12,2),
    "observacao" "text",
    "deleted_at" timestamp with time zone,
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "parcelas" "text",
    "area_m2" numeric DEFAULT 0,
    "disciplinas" "jsonb" DEFAULT '[]'::"jsonb",
    "status_data" "text",
    "custo_indireto_pct" numeric(5,2) DEFAULT 15.0,
    "latitude" double precision,
    "longitude" double precision,
    "prioridade" "text" DEFAULT 'Media'::"text" NOT NULL,
    CONSTRAINT "projetos_prioridade_check" CHECK (("prioridade" = ANY (ARRAY['Alta'::"text", 'Media'::"text", 'Baixa'::"text"])))
);
CREATE TABLE IF NOT EXISTS "public"."proposta_disciplinas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "proposta_id" "uuid" NOT NULL,
    "disciplina" "text" NOT NULL,
    "horas_estimadas" numeric(8,2) DEFAULT 0,
    "custo_hora" numeric(10,2) DEFAULT 0,
    "valor_venda" numeric(12,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);
CREATE TABLE IF NOT EXISTS "public"."proposta_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "descricao" "text",
    "arquivo_path" "text" NOT NULL,
    "variaveis" "text"[] DEFAULT '{}'::"text"[],
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "tipo" "text" DEFAULT 'proposta'::"text" NOT NULL,
    CONSTRAINT "proposta_templates_tipo_check" CHECK (("tipo" = ANY (ARRAY['proposta'::"text", 'contrato'::"text"])))
);
CREATE TABLE IF NOT EXISTS "public"."propostas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "lead_id" "uuid",
    "cliente_id" "uuid",
    "codigo" "text",
    "titulo" "text" NOT NULL,
    "area_m2" numeric(10,2),
    "localizacao" "text",
    "valor_proposto" numeric(12,2),
    "custo_estimado" numeric(12,2),
    "margem_estimada_pct" numeric(5,2),
    "prazo_estimado_dias" integer,
    "status" "text" DEFAULT 'rascunho'::"text",
    "validade" "date",
    "projeto_id" "uuid",
    "dados_simulacao" "jsonb" DEFAULT '{}'::"jsonb",
    "observacao" "text",
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "template_id" "uuid",
    "campos_extras" "jsonb" DEFAULT '{}'::"jsonb",
    "documento_path" "text",
    "conteudo" "jsonb" DEFAULT '{}'::"jsonb",
    "contrato_enviado" boolean DEFAULT false NOT NULL,
    "contrato_assinado" boolean DEFAULT false NOT NULL,
    "contrato_recusado" boolean DEFAULT false NOT NULL,
    CONSTRAINT "propostas_status_check" CHECK (("status" = ANY (ARRAY['rascunho'::"text", 'enviada'::"text", 'aceita'::"text", 'recusada'::"text", 'expirada'::"text"])))
);
CREATE TABLE IF NOT EXISTS "public"."rate_limit_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "action" "text" NOT NULL,
    "key" "text" NOT NULL,
    "attempted_at" timestamp with time zone DEFAULT "now"() NOT NULL
);
CREATE TABLE IF NOT EXISTS "public"."templates_projeto" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "tipo_servico" "text" NOT NULL,
    "descricao" "text",
    "fases" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "checklist" "jsonb" DEFAULT '[]'::"jsonb",
    "ativo" boolean DEFAULT true,
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone
);
CREATE TABLE IF NOT EXISTS "public"."ultra_admin_modes" (
    "user_id" "uuid" NOT NULL,
    "scoped" boolean DEFAULT false NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);
-- Captura PRE: tipos e funcoes que outras migracoes referenciam.
SET statement_timeout = 0;
CREATE OR REPLACE FUNCTION "public"."_feature_catalog"() RETURNS "text"[]
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT ARRAY[
    'dashboard',
    'relatorios',
    'leads',
    'propostas',
    'clientes',
    'projetos',
    'planejamento',
    'timesheet',
    'mapa',
    'financeiro',
    'pessoas',
    'metas',
    'portal_cliente',
    'ai_hub',
    'capacidade',
    'templates'
  ];
$$;
CREATE OR REPLACE FUNCTION "public"."_portal_create_account"("p_cliente_id" "uuid", "p_empresa_id" "uuid", "p_nome" "text", "p_email" "text", "p_senha" "text", "p_created_by" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
BEGIN
  INSERT INTO cliente_portal_accounts (cliente_id, empresa_id, nome, email, senha_hash, created_by)
  VALUES (p_cliente_id, p_empresa_id, p_nome, p_email, crypt(p_senha, gen_salt('bf')), p_created_by);
END;
$$;
CREATE OR REPLACE FUNCTION "public"."_portal_reset_password"("p_account_id" "uuid", "p_nova_senha" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
BEGIN
  UPDATE cliente_portal_accounts
  SET senha_hash = crypt(p_nova_senha, gen_salt('bf')),
      token_sessao = NULL,
      token_expira_em = NULL,
      updated_at = NOW()
  WHERE id = p_account_id;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."_validate_features_payload"("p_features" "jsonb", "p_empresa_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  v_key TEXT;
  v_value TEXT;
  v_empresa_features JSONB;
  v_catalog TEXT[] := public._feature_catalog();
BEGIN
  IF p_features IS NULL OR p_features = '{}'::jsonb THEN
    RETURN;
  END IF;

  IF jsonb_typeof(p_features) <> 'object' THEN
    RAISE EXCEPTION 'features deve ser um objeto JSON';
  END IF;

  SELECT features INTO v_empresa_features
  FROM public.empresas
  WHERE id = p_empresa_id;

  FOR v_key, v_value IN SELECT * FROM jsonb_each_text(p_features)
  LOOP
    IF NOT (v_key = ANY (v_catalog)) THEN
      RAISE EXCEPTION 'Feature desconhecida: %', v_key;
    END IF;

    IF v_value NOT IN ('viewer', 'editor') THEN
      RAISE EXCEPTION 'Nível inválido para %: % (use "viewer" ou "editor")', v_key, v_value;
    END IF;

    IF v_key <> 'dashboard'
       AND COALESCE((v_empresa_features ->> v_key)::BOOLEAN, FALSE) = FALSE THEN
      RAISE EXCEPTION 'Feature "%" não está habilitada na empresa', v_key;
    END IF;
  END LOOP;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."aditivo_aprovado_handler"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_projeto RECORD;
BEGIN
  -- Só roda quando escopo tipo "aditivo" é aprovado
  IF NEW.tipo = 'aditivo' AND NEW.status = 'aprovado' AND (OLD.status IS NULL OR OLD.status != 'aprovado') THEN
    -- Buscar projeto
    SELECT id, data_previsao, cliente_id, empresa_id INTO v_projeto
    FROM projetos WHERE id = NEW.projeto_id;

    -- Atualizar prazo do projeto se há impacto
    IF NEW.impacto_prazo_dias > 0 AND v_projeto.data_previsao IS NOT NULL THEN
      UPDATE projetos
      SET data_previsao = data_previsao + (NEW.impacto_prazo_dias || ' days')::interval
      WHERE id = NEW.projeto_id;
    END IF;

    -- Gerar receita do aditivo se há valor
    IF NEW.valor_aditivo > 0 THEN
      INSERT INTO receitas (empresa_id, descricao, valor, data_vencimento, status, projeto_id, cliente_id)
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
CREATE OR REPLACE FUNCTION "public"."admin_create_company_owner"("p_email" "text", "p_nome" "text", "p_company_name" "text" DEFAULT 'Minha Empresa'::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  caller_role user_role;
BEGIN
  -- Verifica se quem chama é admin (ou será chamado com service_role)
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  
  IF caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Apenas administradores podem criar donos de empresa';
  END IF;

  -- Retorna as instruções para criação via Supabase Admin API
  -- (o usuário precisa ser criado via auth.admin.createUser com os metadados corretos)
  RETURN json_build_object(
    'instruction', 'Use supabase auth admin createUser com os seguintes metadados',
    'email', p_email,
    'user_metadata', json_build_object(
      'is_company_owner', 'true',
      'company_name', p_company_name,
      'nome', p_nome
    )
  );
END;
$$;
CREATE OR REPLACE FUNCTION "public"."audit_log_cleanup"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_count INTEGER := 0;
  v_archive_count INTEGER := 0;
BEGIN
  -- Hot tier: > 5 anos sai pra sempre
  DELETE FROM public.audit_logs
  WHERE created_at < NOW() - INTERVAL '1825 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Archive tier: > 5 anos sai pra sempre (caso tenha sobrado)
  DELETE FROM public.audit_logs_archive
  WHERE created_at < NOW() - INTERVAL '1825 days';
  GET DIAGNOSTICS v_archive_count = ROW_COUNT;

  RETURN v_count + v_archive_count;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."audit_logs_archive_old"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH moved AS (
    DELETE FROM public.audit_logs
    WHERE created_at < NOW() - INTERVAL '365 days'
    RETURNING id, empresa_id, actor_id, actor_email, action,
              target_table, target_id, old_data, new_data, diff,
              ip_address, created_at
  )
  INSERT INTO public.audit_logs_archive (
    id, empresa_id, actor_id, actor_email, action,
    target_table, target_id, old_data, new_data, diff,
    ip_address, created_at
  )
  SELECT id, empresa_id, actor_id, actor_email, action,
         target_table, target_id, old_data, new_data, diff,
         ip_address, created_at
  FROM moved
  ON CONFLICT (id) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."auto_complete_disciplinas"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  disciplina JSONB;
  updated_disciplinas JSONB := '[]'::jsonb;
BEGIN
  -- Só roda quando status muda para Concluído
  IF NEW.status = 'Concluído' AND (OLD.status IS NULL OR OLD.status != 'Concluído') THEN
    -- Marcar todas as disciplinas como Concluído
    IF NEW.disciplinas IS NOT NULL AND jsonb_array_length(NEW.disciplinas) > 0 THEN
      FOR disciplina IN SELECT * FROM jsonb_array_elements(NEW.disciplinas)
      LOOP
        updated_disciplinas := updated_disciplinas || jsonb_build_array(
          disciplina || jsonb_build_object(
            'status', 'Concluído',
            'data_final', COALESCE(disciplina->>'data_final', to_char(CURRENT_DATE, 'YYYY-MM-DD'))
          )
        );
      END LOOP;
      NEW.disciplinas := updated_disciplinas;
    END IF;

    -- Garantir data_final
    IF NEW.data_final IS NULL THEN
      NEW.data_final := CURRENT_DATE;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."auto_gerar_receita_from_marco"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_receita_id UUID;
  v_projeto RECORD;
BEGIN
  -- Só roda quando marco muda para "faturado" e não tem receita vinculada
  IF NEW.status = 'faturado' AND (OLD.status IS NULL OR OLD.status != 'faturado') AND NEW.receita_id IS NULL THEN
    -- Busca dados do projeto
    SELECT id, cliente_id, empresa_id INTO v_projeto
    FROM projetos WHERE id = NEW.projeto_id;

    -- Cria receita automaticamente
    INSERT INTO receitas (empresa_id, descricao, valor, data_vencimento, status, projeto_id, cliente_id)
    VALUES (
      NEW.empresa_id,
      'Marco: ' || NEW.nome,
      NEW.valor,
      COALESCE(NEW.data_prevista, CURRENT_DATE),
      'Pendente',
      NEW.projeto_id,
      v_projeto.cliente_id
    )
    RETURNING id INTO v_receita_id;

    -- Vincula receita ao marco
    NEW.receita_id := v_receita_id;
  END IF;

  -- Quando marco é "recebido", atualiza receita para Recebido
  IF NEW.status = 'recebido' AND OLD.status = 'faturado' AND NEW.receita_id IS NOT NULL THEN
    UPDATE receitas SET status = 'Recebido', data_recebimento = CURRENT_DATE
    WHERE id = NEW.receita_id;
  END IF;

  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."calculate_status_data"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Se projeto está concluído, verifica se foi no prazo ou com atraso
  IF NEW.status = 'Concluído' AND NEW.data_final IS NOT NULL AND NEW.data_previsao IS NOT NULL THEN
    IF NEW.data_final <= NEW.data_previsao THEN
      NEW.status_data := 'concluido_no_prazo';
    ELSE
      NEW.status_data := 'concluido_com_atraso';
    END IF;
  -- Se projeto está cancelado
  ELSIF NEW.status = 'Cancelado' THEN
    NEW.status_data := 'cancelado';
  -- Se projeto tem data de previsão
  ELSIF NEW.data_previsao IS NOT NULL THEN
    DECLARE
      dias_diferenca INTEGER;
    BEGIN
      dias_diferenca := NEW.data_previsao - CURRENT_DATE;
      
      IF dias_diferenca < 0 THEN
        NEW.status_data := 'em_atraso';
      ELSIF dias_diferenca <= 7 THEN
        NEW.status_data := 'atencao';
      ELSE
        NEW.status_data := 'no_prazo';
      END IF;
    END;
  ELSE
    NEW.status_data := NULL;
  END IF;
  
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."check_convite_rate_limit"("p_empresa_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_count_minute INTEGER;
  v_count_hour INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count_minute
  FROM public.convites
  WHERE empresa_id = p_empresa_id
    AND created_at > NOW() - INTERVAL '1 minute';

  IF v_count_minute >= 5 THEN
    RAISE EXCEPTION 'Limite de convites por minuto excedido (5/min). Aguarde antes de tentar novamente.'
      USING ERRCODE = '54000';
  END IF;

  SELECT COUNT(*) INTO v_count_hour
  FROM public.convites
  WHERE empresa_id = p_empresa_id
    AND created_at > NOW() - INTERVAL '1 hour';

  IF v_count_hour >= 50 THEN
    RAISE EXCEPTION 'Limite de convites por hora excedido (50/hora). Aguarde antes de tentar novamente.'
      USING ERRCODE = '54000';
  END IF;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."cleanup_expired_pending_signups"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.pilar_pending_signups
  WHERE
    (payment_status IN ('failed', 'canceled') AND created_at < now() - interval '90 days')
    OR (payment_status = 'pending' AND created_at < now() - interval '7 days');

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."cleanup_pending_signups"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.pilar_pending_signups
  WHERE payment_status IN ('failed', 'canceled')
    AND created_at < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."create_convite"("p_email" "text", "p_cargo" "text", "p_nome" "text" DEFAULT NULL::"text", "p_features" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_empresa_id UUID;
  v_cargo public.user_role;
  v_features JSONB;
  v_token TEXT;
BEGIN
  v_empresa_id := public.get_user_empresa_id();

  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem criar convites';
  END IF;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa';
  END IF;

  -- Cargo: admin ou user. Não permitir promoção a ultra_admin via convite.
  BEGIN
    v_cargo := p_cargo::public.user_role;
  EXCEPTION WHEN OTHERS THEN
    v_cargo := 'user';
  END;

  IF v_cargo = 'ultra_admin' THEN
    RAISE EXCEPTION 'ultra_admin não pode ser concedido via convite';
  END IF;

  -- Roles legados forçados para 'user'
  IF v_cargo IN ('financeiro', 'marketing', 'operacional') THEN
    v_cargo := 'user';
  END IF;

  -- Features: admin não usa
  IF v_cargo = 'admin' THEN
    v_features := '{}'::jsonb;
  ELSE
    v_features := COALESCE(p_features, '{}'::jsonb);
  END IF;

  -- Invalida convites antigos não usados
  UPDATE public.convites
  SET usado_em = NOW()
  WHERE email = lower(trim(p_email))
    AND empresa_id = v_empresa_id
    AND usado_em IS NULL;

  -- O trigger validate_convite_features valida estrutura + empresa.features
  INSERT INTO public.convites (empresa_id, email, cargo, nome, features, criado_por)
  VALUES (v_empresa_id, lower(trim(p_email)), v_cargo, p_nome, v_features, auth.uid())
  RETURNING token INTO v_token;

  RETURN v_token;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."create_portal_token"("p_projeto_id" "uuid", "p_cliente_id" "uuid", "p_email_cliente" "text" DEFAULT NULL::"text", "p_dias_validade" integer DEFAULT 30) RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  v_empresa_id UUID;
  v_projeto_empresa UUID;
  v_token_plain TEXT;
  v_token_hash TEXT;
  v_dias_clamped INTEGER;
BEGIN
  v_empresa_id := public.get_user_empresa_id();

  IF NOT public.has_role('admin', 'operacional') THEN
    RAISE EXCEPTION 'Apenas admin ou operacional podem gerar tokens de portal';
  END IF;

  SELECT empresa_id INTO v_projeto_empresa
  FROM public.projetos
  WHERE id = p_projeto_id AND deleted_at IS NULL;

  IF v_projeto_empresa IS NULL THEN
    RAISE EXCEPTION 'Projeto não encontrado';
  END IF;

  IF v_projeto_empresa <> v_empresa_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  -- Clamp: 1 dia mínimo, 90 dias máximo (compliance/segurança).
  v_dias_clamped := GREATEST(1, LEAST(90, COALESCE(p_dias_validade, 30)));

  v_token_plain := encode(gen_random_bytes(32), 'hex');
  v_token_hash := encode(extensions.digest(v_token_plain, 'sha256'), 'hex');

  INSERT INTO public.portal_tokens (
    projeto_id, cliente_id, empresa_id, email_cliente,
    token_hash, expira_em
  ) VALUES (
    p_projeto_id, p_cliente_id, v_empresa_id, p_email_cliente,
    v_token_hash, NOW() + (v_dias_clamped || ' days')::INTERVAL
  );

  RETURN v_token_plain;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."create_projeto_completo"("p_codigo" "text", "p_nome" "text", "p_cliente_id" "uuid", "p_data_inicio" "date", "p_data_previsao" "date", "p_data_final" "date", "p_valor_contrato" numeric, "p_observacao" "text", "p_localizacao" "text", "p_parcelas" "text", "p_responsaveis" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_projeto_id UUID;
  v_empresa_id UUID;
  v_resp JSONB;
BEGIN
  -- Get empresa_id from current user
  v_empresa_id := public.get_user_empresa_id();
  
  -- Insert Projeto
  INSERT INTO public.projetos (
    empresa_id, codigo_projeto, nome, cliente_id, data_inicio, data_previsao, data_final, 
    valor_contrato, observacao, localizacao, parcelas, status
  ) VALUES (
    v_empresa_id, p_codigo, p_nome, p_cliente_id, p_data_inicio, p_data_previsao, p_data_final, 
    p_valor_contrato, p_observacao, p_localizacao, p_parcelas, 'Planejamento'
  )
  RETURNING id INTO v_projeto_id;

  -- Insert Responsaveis
  IF p_responsaveis IS NOT NULL AND jsonb_array_length(p_responsaveis) > 0 THEN
    FOR v_resp IN SELECT * FROM jsonb_array_elements(p_responsaveis)
    LOOP
      INSERT INTO public.projetos_responsaveis (
        empresa_id, projeto_id, pessoa_id, responsabilidade
      ) VALUES (
        v_empresa_id, v_projeto_id, (v_resp->>'pessoa_id')::UUID, v_resp->>'responsabilidade'
      );
    END LOOP;
  END IF;

  RETURN v_projeto_id;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."create_projeto_completo"("p_codigo" "text", "p_nome" "text", "p_cliente_id" "uuid", "p_data_inicio" "date", "p_data_previsao" "date", "p_data_final" "date", "p_valor_contrato" numeric, "p_observacao" "text", "p_localizacao" "text", "p_parcelas" "text", "p_area_m2" numeric, "p_disciplinas" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_projeto_id UUID;
  v_empresa_id UUID;
BEGIN
  -- Get empresa_id from current user
  v_empresa_id := public.get_user_empresa_id();
  
  -- Insert Projeto com disciplinas
  INSERT INTO public.projetos (
    empresa_id, codigo_projeto, nome, cliente_id, data_inicio, data_previsao, data_final, 
    valor_contrato, observacao, localizacao, parcelas, area_m2, disciplinas, status
  ) VALUES (
    v_empresa_id, p_codigo, p_nome, p_cliente_id, p_data_inicio, p_data_previsao, p_data_final, 
    p_valor_contrato, p_observacao, p_localizacao, p_parcelas, p_area_m2, 
    COALESCE(p_disciplinas, '[]'::jsonb), 'Planejamento'
  )
  RETURNING id INTO v_projeto_id;

  RETURN v_projeto_id;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."create_projeto_completo"("p_codigo" "text", "p_nome" "text", "p_cliente_id" "uuid", "p_data_inicio" "date" DEFAULT NULL::"date", "p_data_previsao" "date" DEFAULT NULL::"date", "p_data_final" "date" DEFAULT NULL::"date", "p_valor_contrato" numeric DEFAULT 0, "p_observacao" "text" DEFAULT ''::"text", "p_localizacao" "text" DEFAULT ''::"text", "p_parcelas" "text" DEFAULT NULL::"text", "p_area_m2" numeric DEFAULT 0, "p_disciplinas" "jsonb" DEFAULT '[]'::"jsonb", "p_prioridade" "text" DEFAULT 'Media'::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_empresa_id UUID;
  v_user_id UUID;
  v_projeto_id UUID;
BEGIN
  v_user_id := auth.uid();
  SELECT empresa_id INTO v_empresa_id FROM public.profiles WHERE id = v_user_id;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não vinculado a uma empresa';
  END IF;

  INSERT INTO public.projetos (
    empresa_id, codigo_projeto, nome, cliente_id,
    data_inicio, data_previsao, data_final,
    valor_contrato, observacao, localizacao,
    parcelas, area_m2, disciplinas, prioridade,
    created_by, updated_by
  ) VALUES (
    v_empresa_id, p_codigo, p_nome, p_cliente_id,
    p_data_inicio, p_data_previsao, p_data_final,
    p_valor_contrato, p_observacao, p_localizacao,
    p_parcelas, p_area_m2, p_disciplinas, p_prioridade,
    v_user_id, v_user_id
  ) RETURNING id INTO v_projeto_id;

  RETURN v_projeto_id;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."current_effective_role"() RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_target TEXT;
  v_real TEXT;
BEGIN
  SELECT target_role INTO v_target
  FROM public.impersonation_sessions
  WHERE admin_id = auth.uid()
    AND ended_at IS NULL
    AND expires_at > NOW()
  ORDER BY started_at DESC
  LIMIT 1;

  IF v_target IS NOT NULL THEN
    RETURN v_target;
  END IF;

  SELECT role::TEXT INTO v_real FROM public.profiles WHERE id = auth.uid();
  RETURN v_real;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."current_impersonation"() RETURNS "public"."impersonation_sessions"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT *
  FROM public.impersonation_sessions
  WHERE admin_id = auth.uid()
    AND ended_at IS NULL
    AND expires_at > NOW()
  ORDER BY started_at DESC
  LIMIT 1;
$$;
CREATE OR REPLACE FUNCTION "public"."enforce_despesa_data_pagamento"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Se status mudou para Pago, garantir data_pagamento
  IF NEW.status = 'Pago' AND NEW.data_pagamento IS NULL THEN
    NEW.data_pagamento := COALESCE(OLD.data_pagamento, NEW.data_vencimento, CURRENT_DATE);
  END IF;

  -- Se status voltou para Pendente, limpar data_pagamento
  IF NEW.status = 'Pendente' AND OLD.status = 'Pago' THEN
    NEW.data_pagamento := NULL;
  END IF;

  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."enforce_receita_data_recebimento"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Se status mudou para Recebido, garantir data_recebimento
  IF NEW.status = 'Recebido' AND NEW.data_recebimento IS NULL THEN
    NEW.data_recebimento := COALESCE(OLD.data_recebimento, NEW.data_vencimento, CURRENT_DATE);
  END IF;

  -- Se status voltou para Pendente, limpar data_recebimento
  IF NEW.status = 'Pendente' AND OLD.status = 'Recebido' THEN
    NEW.data_recebimento := NULL;
  END IF;

  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."find_or_create_fatura"("p_cartao_id" "uuid", "p_data_compra" "date") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_cartao record;
  v_empresa_id uuid;
  v_dia_compra int;
  v_mes_ref int;
  v_ano_ref int;
  v_fatura_id uuid;
  v_data_inicio date;
  v_data_fim date;
  v_data_venc date;
  v_max_dia int;
BEGIN
  SELECT id, empresa_id, dia_fechamento, dia_vencimento
  INTO v_cartao
  FROM cartoes_credito
  WHERE id = p_cartao_id AND deleted_at IS NULL;

  IF v_cartao IS NULL OR v_cartao.dia_fechamento IS NULL THEN
    RETURN NULL;
  END IF;

  v_empresa_id := v_cartao.empresa_id;
  v_dia_compra := EXTRACT(DAY FROM p_data_compra)::int;

  -- Se compra antes do fechamento → fatura do mês corrente
  -- Se compra >= fechamento → fatura do mês seguinte
  IF v_dia_compra < v_cartao.dia_fechamento THEN
    v_mes_ref := EXTRACT(MONTH FROM p_data_compra)::int;
    v_ano_ref := EXTRACT(YEAR FROM p_data_compra)::int;
  ELSE
    v_mes_ref := EXTRACT(MONTH FROM p_data_compra)::int + 1;
    v_ano_ref := EXTRACT(YEAR FROM p_data_compra)::int;
    IF v_mes_ref > 12 THEN
      v_mes_ref := 1;
      v_ano_ref := v_ano_ref + 1;
    END IF;
  END IF;

  -- Tenta achar fatura existente
  SELECT id INTO v_fatura_id
  FROM faturas
  WHERE cartao_id = p_cartao_id
    AND mes_referencia = v_mes_ref
    AND ano_referencia = v_ano_ref
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_fatura_id IS NOT NULL THEN
    RETURN v_fatura_id;
  END IF;

  -- Cria a fatura (mesma lógica do RPC gerar_fatura, sem requerer auth.uid)
  v_max_dia := EXTRACT(DAY FROM (DATE_TRUNC('month', make_date(v_ano_ref, v_mes_ref, 1)) + INTERVAL '1 month - 1 day'))::int;
  v_data_fim := make_date(v_ano_ref, v_mes_ref, LEAST(v_cartao.dia_fechamento, v_max_dia));
  v_data_inicio := (v_data_fim - INTERVAL '1 month')::date + INTERVAL '1 day';
  v_data_venc := make_date(v_ano_ref, v_mes_ref, LEAST(v_cartao.dia_vencimento, v_max_dia));
  IF v_cartao.dia_vencimento < v_cartao.dia_fechamento THEN
    v_data_venc := v_data_venc + INTERVAL '1 month';
  END IF;

  INSERT INTO faturas (
    empresa_id, cartao_id, mes_referencia, ano_referencia,
    data_inicio, data_fim, data_vencimento, status
  ) VALUES (
    v_empresa_id, p_cartao_id, v_mes_ref, v_ano_ref,
    v_data_inicio, v_data_fim, v_data_venc, 'Aberta'
  )
  ON CONFLICT (cartao_id, mes_referencia, ano_referencia)
  DO UPDATE SET updated_at = now()
  RETURNING id INTO v_fatura_id;

  RETURN v_fatura_id;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."gerar_fatura"("p_cartao_id" "uuid", "p_mes" integer, "p_ano" integer) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_fatura_id UUID;
  v_dia_fechamento INTEGER;
  v_dia_vencimento INTEGER;
  v_data_inicio DATE;
  v_data_fim DATE;
  v_data_vencimento DATE;
  v_empresa_id UUID;
  v_valor_total DECIMAL(12,2);
  v_max_day_fim INTEGER;
  v_max_day_venc INTEGER;
BEGIN
  -- Buscar dados do cartão
  SELECT dia_fechamento, dia_vencimento, empresa_id
  INTO v_dia_fechamento, v_dia_vencimento, v_empresa_id
  FROM cartoes_credito WHERE id = p_cartao_id AND deleted_at IS NULL;

  IF v_dia_fechamento IS NULL THEN
    RAISE EXCEPTION 'Cartão não encontrado';
  END IF;

  -- Verificação de segurança
  IF v_empresa_id != public.get_user_empresa_id() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  -- Calcular datas do ciclo
  -- data_fim = dia_fechamento do mês de referência (limitado ao último dia do mês)
  v_max_day_fim := EXTRACT(DAY FROM (DATE_TRUNC('month', make_date(p_ano, p_mes, 1)) + INTERVAL '1 month - 1 day'))::INTEGER;
  v_data_fim := make_date(p_ano, p_mes, LEAST(v_dia_fechamento, v_max_day_fim));

  -- data_inicio = dia_fechamento+1 do mês anterior
  v_data_inicio := (v_data_fim - INTERVAL '1 month')::DATE + INTERVAL '1 day';

  -- data_vencimento = dia_vencimento do mês de referência
  v_max_day_venc := EXTRACT(DAY FROM (DATE_TRUNC('month', make_date(p_ano, p_mes, 1)) + INTERVAL '1 month - 1 day'))::INTEGER;
  v_data_vencimento := make_date(p_ano, p_mes, LEAST(v_dia_vencimento, v_max_day_venc));

  -- Se dia_vencimento < dia_fechamento, o vencimento é no mês seguinte
  IF v_dia_vencimento < v_dia_fechamento THEN
    v_data_vencimento := v_data_vencimento + INTERVAL '1 month';
  END IF;

  -- Upsert da fatura
  INSERT INTO faturas (empresa_id, cartao_id, mes_referencia, ano_referencia,
                       data_inicio, data_fim, data_vencimento, status)
  VALUES (v_empresa_id, p_cartao_id, p_mes, p_ano,
          v_data_inicio, v_data_fim, v_data_vencimento, 'Aberta')
  ON CONFLICT (cartao_id, mes_referencia, ano_referencia)
  DO UPDATE SET updated_at = NOW()
  RETURNING id INTO v_fatura_id;

  -- Associar despesas não vinculadas ao ciclo
  UPDATE despesas
  SET fatura_id = v_fatura_id
  WHERE cartao_id = p_cartao_id
    AND deleted_at IS NULL
    AND data_vencimento >= v_data_inicio
    AND data_vencimento <= v_data_fim
    AND fatura_id IS NULL;

  -- Atualizar total da fatura
  SELECT COALESCE(SUM(valor), 0) INTO v_valor_total
  FROM despesas
  WHERE fatura_id = v_fatura_id
    AND cartao_id IS NOT NULL
    AND deleted_at IS NULL;

  UPDATE faturas SET valor_total = v_valor_total WHERE id = v_fatura_id;

  RETURN v_fatura_id;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."get_cliente_projeto_detail"("p_projeto_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_cliente_id UUID;
  v_empresa_id UUID;
  result JSON;
BEGIN
  SELECT cpa.cliente_id, cpa.empresa_id
  INTO v_cliente_id, v_empresa_id
  FROM cliente_portal_accounts cpa
  WHERE cpa.auth_user_id = auth.uid() AND cpa.ativo = true;

  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT json_build_object(
    'projeto_id', p.id,
    'cliente_id', p.cliente_id,
    'empresa_id', p.empresa_id,
    'projeto_nome', p.nome,
    'projeto_status', p.status,
    'projeto_codigo', p.codigo_projeto,
    'data_inicio', p.data_inicio,
    'data_previsao', p.data_previsao,
    'data_final', p.data_final,
    'valor_contrato', p.valor_contrato,
    'disciplinas', p.disciplinas,
    'cliente_nome', c.nome,
    'empresa_nome', e.nome
  ) INTO result
  FROM projetos p
  JOIN clientes c ON c.id = p.cliente_id
  JOIN empresas e ON e.id = p.empresa_id
  WHERE p.id = p_projeto_id
    AND p.cliente_id = v_cliente_id
    AND p.empresa_id = v_empresa_id
    AND p.deleted_at IS NULL;

  IF result IS NULL THEN
    RAISE EXCEPTION 'Projeto não encontrado ou acesso negado';
  END IF;

  RETURN result;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."get_cliente_projeto_detail"("p_projeto_id" "uuid", "p_token" "text" DEFAULT NULL::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_cliente_id UUID;
  v_empresa_id UUID;
  result JSON;
BEGIN
  SELECT cpa.cliente_id, cpa.empresa_id
  INTO v_cliente_id, v_empresa_id
  FROM cliente_portal_accounts cpa
  WHERE cpa.token_sessao = p_token
    AND cpa.token_expira_em > NOW()
    AND cpa.ativo = true;

  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida';
  END IF;

  SELECT json_build_object(
    'projeto_id', p.id,
    'cliente_id', p.cliente_id,
    'empresa_id', p.empresa_id,
    'projeto_nome', p.nome,
    'projeto_status', p.status,
    'projeto_codigo', p.codigo_projeto,
    'data_inicio', p.data_inicio,
    'data_previsao', p.data_previsao,
    'data_final', p.data_final,
    'valor_contrato', p.valor_contrato,
    'disciplinas', p.disciplinas,
    'cliente_nome', c.nome,
    'empresa_nome', e.nome
  ) INTO result
  FROM projetos p
  JOIN clientes c ON c.id = p.cliente_id
  JOIN empresas e ON e.id = p.empresa_id
  WHERE p.id = p_projeto_id
    AND p.cliente_id = v_cliente_id
    AND p.empresa_id = v_empresa_id
    AND p.deleted_at IS NULL;

  IF result IS NULL THEN
    RAISE EXCEPTION 'Projeto não encontrado';
  END IF;

  RETURN result;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."get_cliente_projetos"() RETURNS SETOF json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_cliente_id UUID;
  v_empresa_id UUID;
BEGIN
  SELECT cpa.cliente_id, cpa.empresa_id
  INTO v_cliente_id, v_empresa_id
  FROM cliente_portal_accounts cpa
  WHERE cpa.auth_user_id = auth.uid() AND cpa.ativo = true;

  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  -- Atualiza último acesso
  UPDATE cliente_portal_accounts
  SET ultimo_acesso = NOW()
  WHERE auth_user_id = auth.uid();

  RETURN QUERY
  SELECT json_build_object(
    'projeto_id', p.id,
    'projeto_nome', p.nome,
    'projeto_codigo', p.codigo_projeto,
    'projeto_status', p.status,
    'data_inicio', p.data_inicio,
    'data_previsao', p.data_previsao,
    'valor_contrato', p.valor_contrato,
    'disciplinas', p.disciplinas,
    'empresa_nome', e.nome
  )
  FROM projetos p
  JOIN empresas e ON e.id = p.empresa_id
  WHERE p.cliente_id = v_cliente_id
    AND p.empresa_id = v_empresa_id
    AND p.deleted_at IS NULL
  ORDER BY
    CASE p.status
      WHEN 'Em andamento' THEN 1
      WHEN 'Revisão' THEN 2
      WHEN 'Planejamento' THEN 3
      WHEN 'Paralisado' THEN 4
      WHEN 'Concluído' THEN 5
      WHEN 'Cancelado' THEN 6
    END,
    p.created_at DESC;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."get_cliente_projetos"("p_token" "text" DEFAULT NULL::"text") RETURNS SETOF json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_cliente_id UUID;
  v_empresa_id UUID;
BEGIN
  -- Valida sessão via token
  SELECT cpa.cliente_id, cpa.empresa_id
  INTO v_cliente_id, v_empresa_id
  FROM cliente_portal_accounts cpa
  WHERE cpa.token_sessao = p_token
    AND cpa.token_expira_em > NOW()
    AND cpa.ativo = true;

  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida';
  END IF;

  RETURN QUERY
  SELECT json_build_object(
    'projeto_id', p.id,
    'projeto_nome', p.nome,
    'projeto_codigo', p.codigo_projeto,
    'projeto_status', p.status,
    'data_inicio', p.data_inicio,
    'data_previsao', p.data_previsao,
    'valor_contrato', p.valor_contrato,
    'disciplinas', p.disciplinas,
    'empresa_nome', e.nome
  )
  FROM projetos p
  JOIN empresas e ON e.id = p.empresa_id
  WHERE p.cliente_id = v_cliente_id
    AND p.empresa_id = v_empresa_id
    AND p.deleted_at IS NULL
  ORDER BY
    CASE p.status
      WHEN 'Em andamento' THEN 1
      WHEN 'Revisão' THEN 2
      WHEN 'Planejamento' THEN 3
      WHEN 'Paralisado' THEN 4
      WHEN 'Concluído' THEN 5
      WHEN 'Cancelado' THEN 6
    END,
    p.created_at DESC;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."get_folha_preview"("p_mes" integer, "p_ano" integer) RETURNS TABLE("pessoa_id" "uuid", "nome" "text", "cargo" "text", "salario_fixo" numeric, "valor_m2" numeric, "total_area" numeric, "total_variavel" numeric, "total_receber" numeric, "projetos_nomes" "text"[])
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_empresa_id UUID;
BEGIN
  v_empresa_id := public.get_user_empresa_id();

  RETURN QUERY
  WITH projetos_periodo AS (
    SELECT
      pr.id,
      pr.nome as projeto_nome,
      pr.area_m2,
      pr.disciplinas
    FROM public.projetos pr
    WHERE pr.empresa_id = v_empresa_id
    AND EXTRACT(MONTH FROM pr.data_inicio) = p_mes
    AND EXTRACT(YEAR FROM pr.data_inicio) = p_ano
  ),
  calculo_por_pessoa AS (
    SELECT
      pe.id as p_id,
      pe.nome as p_nome,
      pe.cargo as p_cargo,
      COALESCE(pe.salario_fixo, 0) as p_salario_fixo,
      COALESCE(pe.valor_m2, 0) as p_valor_m2,
      COALESCE(SUM(pp.area_m2) FILTER (WHERE pp.id IS NOT NULL), 0) as soma_area,
      array_agg(pp.projeto_nome) FILTER (WHERE pp.id IS NOT NULL) as lista_projetos
    FROM public.pessoas pe
    LEFT JOIN projetos_periodo pp ON EXISTS (
      SELECT 1
      FROM jsonb_array_elements(pp.disciplinas) as d
      WHERE (d->>'responsavel_id')::uuid = pe.id
    )
    WHERE pe.empresa_id = v_empresa_id
      AND pe.deleted_at IS NULL
      AND pe.status = 'ativo'
    GROUP BY pe.id
  )
  SELECT
    c.p_id,
    c.p_nome,
    c.p_cargo,
    c.p_salario_fixo,
    c.p_valor_m2,
    c.soma_area,
    (c.soma_area * c.p_valor_m2)::DECIMAL(10,2) as v_variavel,
    (c.p_salario_fixo + (c.soma_area * c.p_valor_m2))::DECIMAL(10,2) as v_total,
    COALESCE(c.lista_projetos, ARRAY[]::TEXT[])
  FROM calculo_por_pessoa c
  ORDER BY c.p_nome;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."get_lancamentos_kpis"("p_from" "text" DEFAULT NULL::"text", "p_to" "text" DEFAULT NULL::"text") RETURNS json
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  v_recebido  numeric := 0;
  v_a_receber numeric := 0;
  v_pago      numeric := 0;
  v_a_pagar   numeric := 0;
BEGIN
  SELECT
    COALESCE(SUM(valor) FILTER (WHERE status = 'Recebido'), 0),
    COALESCE(SUM(valor) FILTER (WHERE status <> 'Recebido'), 0)
  INTO v_recebido, v_a_receber
  FROM public.receitas
  WHERE deleted_at IS NULL
    AND (p_from IS NULL OR data_vencimento >= p_from::date)
    AND (p_to   IS NULL OR data_vencimento <= p_to::date);

  SELECT
    COALESCE(SUM(valor) FILTER (WHERE status = 'Pago'), 0),
    COALESCE(SUM(valor) FILTER (WHERE status <> 'Pago'), 0)
  INTO v_pago, v_a_pagar
  FROM public.despesas
  WHERE deleted_at IS NULL
    AND (p_from IS NULL OR data_vencimento >= p_from::date)
    AND (p_to   IS NULL OR data_vencimento <= p_to::date);

  RETURN json_build_object(
    'recebido',   v_recebido,
    'a_receber',  v_a_receber,
    'pago',       v_pago,
    'a_pagar',    v_a_pagar
  );
END;
$$;
CREATE OR REPLACE FUNCTION "public"."get_portal_propostas"("p_token" "text") RETURNS TABLE("id" "uuid", "codigo" "text", "titulo" "text", "valor_proposto" numeric, "prazo_estimado_dias" integer, "localizacao" "text", "area_m2" numeric, "validade" "date", "status" "text", "observacao" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_cliente_id uuid;
BEGIN
  SELECT pt.cliente_id INTO v_cliente_id
  FROM portal_tokens pt
  WHERE pt.token = p_token
    AND pt.ativo = true
    AND (pt.expira_em IS NULL OR pt.expira_em > now());

  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Token inválido ou expirado';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.codigo,
    p.titulo,
    p.valor_proposto,
    p.prazo_estimado_dias,
    p.localizacao,
    p.area_m2,
    p.validade,
    p.status,
    p.observacao,
    p.created_at
  FROM propostas p
  WHERE p.cliente_id = v_cliente_id
    AND p.deleted_at IS NULL
    AND p.status != 'rascunho'
  ORDER BY p.created_at DESC;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."get_user_empresa_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT empresa_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;
CREATE OR REPLACE FUNCTION "public"."get_user_empresa_id_text"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT empresa_id::text FROM profiles WHERE id = auth.uid();
$$;
CREATE OR REPLACE FUNCTION "public"."handle_escopo_aprovado"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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
CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
DECLARE
  v_token            TEXT;
  v_meta_nome        TEXT;
  v_email            TEXT;
  v_convite          RECORD;
  v_owner_pending    RECORD;
  v_pending_signup   RECORD;
  v_empresa_id       UUID;
BEGIN
  -- Email é obrigatório. Sem email não há como cruzar com convite.
  IF NEW.email IS NULL OR length(trim(NEW.email)) = 0 THEN
    RAISE EXCEPTION 'Cadastro inválido: email ausente';
  END IF;

  v_email := lower(trim(NEW.email));

  -- Único campo de identificação aceito do metadata é o token.
  -- Demais flags (is_company_owner, empresa_id_convite, cargo_convite,
  -- role, company_name) são deliberadamente ignoradas.
  v_token := NEW.raw_user_meta_data->>'invite_token';

  -- Nome é cosmético; cap em 200 chars pra evitar lixo.
  v_meta_nome := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'nome', '')), '');
  IF v_meta_nome IS NOT NULL AND length(v_meta_nome) > 200 THEN
    v_meta_nome := substring(v_meta_nome FROM 1 FOR 200);
  END IF;

  -- Sem token = sem caminho legítimo. Bloqueia self-signup público.
  IF v_token IS NULL OR length(v_token) = 0 THEN
    RAISE EXCEPTION 'Cadastro não autorizado. Entre em contato com a equipe comercial.';
  END IF;

  -- ===========================================================================
  -- CENÁRIO 1: FUNCIONÁRIO CONVIDADO
  -- ===========================================================================
  SELECT id, empresa_id, email, cargo, nome, features
  INTO v_convite
  FROM public.convites
  WHERE token = v_token
    AND email = v_email
    AND usado_em IS NULL
    AND expira_em > NOW();

  IF v_convite.id IS NOT NULL THEN
    INSERT INTO public.profiles (
      id, empresa_id, nome, email, role, features, onboarding_completed
    )
    VALUES (
      NEW.id,
      v_convite.empresa_id,
      COALESCE(v_convite.nome, v_meta_nome, NEW.email),
      NEW.email,
      v_convite.cargo,                                  -- role vem do convite
      COALESCE(v_convite.features, '{}'::jsonb),
      FALSE
    );

    UPDATE public.convites
    SET usado_em = NOW()
    WHERE id = v_convite.id;

    RETURN NEW;
  END IF;

  -- ===========================================================================
  -- CENÁRIO 2: NOVO OWNER (self-service checkout pago)
  -- ===========================================================================
  SELECT id, email, company_name, nome
  INTO v_owner_pending
  FROM public.empresa_owners_pending
  WHERE token = v_token
    AND email = v_email
    AND usado_em IS NULL
    AND expira_em > NOW();

  IF v_owner_pending.id IS NOT NULL THEN
    -- Defesa em profundidade: empresa_owners_pending só deveria existir
    -- após pilar-checkout-webhook confirmar pagamento. Reconfere aqui.
    -- Se alguém conseguir burlar e inserir direto, ainda bloqueia.
    SELECT id, payment_status
    INTO v_pending_signup
    FROM public.pilar_pending_signups
    WHERE empresa_owner_pending_id = v_owner_pending.id
      AND payment_status = 'paid'
    LIMIT 1;

    IF v_pending_signup.id IS NULL THEN
      RAISE EXCEPTION 'Cadastro de novo owner sem pagamento confirmado';
    END IF;

    INSERT INTO public.empresas (
      owner_id, nome, features, onboarding_completed
    )
    VALUES (
      NEW.id,
      v_owner_pending.company_name,
      jsonb_build_object(
        'dashboard',     true,
        'relatorios',    true,
        'leads',         true,
        'propostas',     true,
        'clientes',      true,
        'projetos',      true,
        'planejamento',  true,
        'timesheet',     true,
        'mapa',          true,
        'financeiro',    true,
        'pessoas',       true,
        'metas',         true,
        'portal_cliente', true,
        'ai_hub',        false,
        'capacidade',    false,
        'templates',     false
      ),
      FALSE
    )
    RETURNING id INTO v_empresa_id;

    INSERT INTO public.profiles (
      id, empresa_id, nome, email, role, features, onboarding_completed
    )
    VALUES (
      NEW.id,
      v_empresa_id,
      COALESCE(v_owner_pending.nome, v_meta_nome, NEW.email),
      NEW.email,
      'admin',                                          -- role fixo, nunca metadata
      '{}'::jsonb,
      FALSE
    );

    UPDATE public.empresa_owners_pending
    SET usado_em = NOW()
    WHERE id = v_owner_pending.id;

    RETURN NEW;
  END IF;

  -- Token presente mas não bate com nada válido.
  RAISE EXCEPTION 'Token de convite inválido ou expirado';
END;
$$;
CREATE OR REPLACE FUNCTION "public"."handle_orcamento_versao"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_dados JSONB;
  v_versao INTEGER;
  v_empresa_id UUID;
BEGIN
  -- Pegar empresa_id do projeto
  SELECT empresa_id INTO v_empresa_id FROM projetos WHERE id = NEW.projeto_id;

  -- Snapshot atual do orçamento
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'disciplina', disciplina,
    'horas_estimadas', horas_estimadas,
    'custo_hora', custo_hora,
    'valor_venda', valor_venda,
    'margem_alvo_pct', margem_alvo_pct
  )), '[]'::JSONB)
  INTO v_dados
  FROM projeto_orcamento_fases
  WHERE projeto_id = NEW.projeto_id AND deleted_at IS NULL;

  -- Próxima versão
  SELECT COALESCE(MAX(versao), 0) + 1 INTO v_versao
  FROM orcamento_versoes
  WHERE projeto_id = NEW.projeto_id;

  -- Salvar versão
  INSERT INTO orcamento_versoes (empresa_id, projeto_id, versao, dados, criado_por, motivo)
  VALUES (v_empresa_id, NEW.projeto_id, v_versao, v_dados, auth.uid(), 'Atualização automática');

  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."handle_record_audit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- 1. Auto-Tenant
  IF TG_OP = 'INSERT' THEN
    BEGIN
      IF NEW.empresa_id IS NULL THEN
         NEW.empresa_id := public.get_user_empresa_id();
      END IF;
    EXCEPTION WHEN undefined_column THEN NULL; END;

    BEGIN
      NEW.created_by := auth.uid();
    EXCEPTION WHEN undefined_column THEN NULL; END;
  END IF;

  -- 2. Auto-Timestamp
  BEGIN
    NEW.updated_at = NOW();
  EXCEPTION WHEN undefined_column THEN NULL; END;
  
  -- 3. Auditoria de Edição
  BEGIN
    NEW.updated_by := auth.uid();
  EXCEPTION WHEN undefined_column THEN NULL; END;

  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."has_role"(VARIADIC "allowed_roles" "public"."user_role"[]) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_role public.user_role;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  RETURN v_role = 'ultra_admin' OR v_role = ANY(allowed_roles);
END;
$$;
CREATE OR REPLACE FUNCTION "public"."impersonation_sessions_cleanup"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Encerra sessões expiradas que ainda não foram explicitamente fechadas
  UPDATE public.impersonation_sessions
  SET ended_at = expires_at
  WHERE ended_at IS NULL
    AND expires_at < NOW();
  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Apaga registros > 90 dias
  DELETE FROM public.impersonation_sessions
  WHERE started_at < NOW() - INTERVAL '90 days';

  RETURN v_count;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."insert_audit_log"("p_action" "text", "p_target_table" "text" DEFAULT NULL::"text", "p_target_id" "uuid" DEFAULT NULL::"uuid", "p_diff" "jsonb" DEFAULT NULL::"jsonb", "p_actor_id" "uuid" DEFAULT NULL::"uuid", "p_actor_email" "text" DEFAULT NULL::"text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.audit_logs (
    actor_id, actor_email, action, target_table, target_id, diff, metadata
  ) VALUES (
    COALESCE(p_actor_id, auth.uid()),
    p_actor_email,
    p_action,
    p_target_table,
    p_target_id,
    p_diff,
    COALESCE(p_metadata, '{}'::jsonb)
  );
END;
$$;
CREATE OR REPLACE FUNCTION "public"."is_company_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(
    (SELECT role = 'admin' FROM public.profiles WHERE id = auth.uid()),
    FALSE
  );
$$;
CREATE OR REPLACE FUNCTION "public"."is_feature_flag_enabled"("p_key" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_empresa_id UUID;
  v_flag public.feature_flags%ROWTYPE;
  v_bucket INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT empresa_id INTO v_empresa_id
  FROM public.profiles
  WHERE id = auth.uid();

  SELECT * INTO v_flag
  FROM public.feature_flags
  WHERE key = p_key;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF v_flag.enabled_for_all THEN
    RETURN TRUE;
  END IF;

  IF v_empresa_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_empresa_id = ANY (v_flag.enabled_for_empresas) THEN
    RETURN TRUE;
  END IF;

  IF v_flag.percentage > 0 THEN
    -- 8 hex chars => até 0xFFFFFFFF; mod 100 dá bucket [0,99]
    v_bucket := ('x' || substr(md5(p_key || ':' || v_empresa_id::TEXT), 1, 8))::BIT(32)::INT & 2147483647;
    v_bucket := v_bucket % 100;
    IF v_bucket < v_flag.percentage THEN
      RETURN TRUE;
    END IF;
  END IF;

  RETURN FALSE;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."is_impersonating"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.impersonation_sessions
    WHERE admin_id = auth.uid()
      AND ended_at IS NULL
      AND expires_at > NOW()
  );
$$;
CREATE OR REPLACE FUNCTION "public"."is_ultra_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(
    (SELECT role = 'ultra_admin' FROM public.profiles WHERE id = auth.uid()),
    FALSE
  );
$$;
CREATE OR REPLACE FUNCTION "public"."is_ultra_admin_scoped"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(
    (SELECT scoped FROM public.ultra_admin_modes WHERE user_id = auth.uid()),
    FALSE
  );
$$;
CREATE OR REPLACE FUNCTION "public"."link_pessoa_profile_before"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    IF NEW.email IS NOT NULL THEN
        -- Attempt to find a profile with this email
        NEW.profile_id := (SELECT id FROM public.profiles WHERE email = NEW.email LIMIT 1);
    END IF;
    RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."link_profile_pessoa_after"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- When a profile is created/updated, link it to any existing pessoa with same email
    UPDATE public.pessoas
    SET profile_id = NEW.id
    WHERE email = NEW.email;
    RETURN NULL;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."notify_data_deletion_request"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  v_url    TEXT;
  v_secret TEXT;
  v_endpoint TEXT;
  v_pg_net_available BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_net'
  ) INTO v_pg_net_available;

  IF NOT v_pg_net_available THEN
    RAISE NOTICE 'pg_net não habilitado — pulando notificação para request %.', NEW.id;
    PERFORM pg_notify(
      'data_deletion_request',
      json_build_object('request_id', NEW.id, 'user_id', NEW.user_id, 'empresa_id', NEW.empresa_id)::text
    );
    RETURN NEW;
  END IF;

  BEGIN
    v_url    := current_setting('app.settings.supabase_url', true);
    v_secret := current_setting('app.settings.data_deletion_notify_secret', true);
  EXCEPTION WHEN OTHERS THEN
    v_url    := NULL;
    v_secret := NULL;
  END;

  IF v_url IS NULL OR v_url = '' OR v_secret IS NULL OR v_secret = '' THEN
    RAISE NOTICE 'supabase_url ou data_deletion_notify_secret não configurados — pulando notificação para request %.', NEW.id;
    RETURN NEW;
  END IF;

  v_endpoint := rtrim(v_url, '/') || '/functions/v1/send-data-deletion-notification';

  PERFORM net.http_post(
    url     := v_endpoint,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-pilar-secret', v_secret
    ),
    body    := jsonb_build_object('request_id', NEW.id),
    timeout_milliseconds := 10000
  );

  PERFORM pg_notify(
    'data_deletion_request',
    json_build_object('request_id', NEW.id, 'user_id', NEW.user_id, 'empresa_id', NEW.empresa_id)::text
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_data_deletion_request falhou para request %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."pagar_fatura"("p_fatura_id" "uuid", "p_conta_id" "uuid", "p_valor_pago" numeric DEFAULT NULL::numeric, "p_data_pagamento" "date" DEFAULT CURRENT_DATE, "p_idempotency_key" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_fatura RECORD;
  v_valor_a_pagar numeric(12,2);
  v_empresa_id uuid;
  v_existing_fatura_id uuid;
BEGIN
  v_empresa_id := public.get_user_empresa_id();

  -- 0. Idempotency check: se a chave já foi usada para essa empresa
  --    e bate com a fatura solicitada, retorna sem reaplicar o pagamento.
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_fatura_id
    FROM public.faturas
    WHERE empresa_id = v_empresa_id
      AND idempotency_key = p_idempotency_key
    LIMIT 1;

    IF v_existing_fatura_id IS NOT NULL THEN
      IF v_existing_fatura_id <> p_fatura_id THEN
        RAISE EXCEPTION 'Idempotency key reutilizada para outra fatura';
      END IF;
      -- Já foi processada com essa chave — sucesso silencioso.
      RETURN;
    END IF;
  END IF;

  -- 1. Lock e buscar fatura
  SELECT f.*, cc.nome as cartao_nome
  INTO v_fatura
  FROM public.faturas f
  JOIN public.cartoes cc ON f.cartao_id = cc.id
  WHERE f.id = p_fatura_id
    AND f.deleted_at IS NULL
  FOR UPDATE;

  IF v_fatura IS NULL THEN
    RAISE EXCEPTION 'Fatura não encontrada';
  END IF;

  IF v_fatura.empresa_id <> v_empresa_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF v_fatura.status = 'Paga' THEN
    RAISE EXCEPTION 'Fatura já está paga';
  END IF;

  v_valor_a_pagar := COALESCE(p_valor_pago, v_fatura.valor_total - v_fatura.valor_pago);

  IF v_valor_a_pagar <= 0 THEN
    RAISE EXCEPTION 'Valor de pagamento inválido';
  END IF;

  -- 2. Atualizar fatura (incluindo gravação da idempotency_key)
  UPDATE public.faturas SET
    valor_pago = valor_pago + v_valor_a_pagar,
    conta_pagamento_id = p_conta_id,
    data_pagamento = p_data_pagamento,
    status = CASE
      WHEN (valor_pago + v_valor_a_pagar) >= valor_total THEN 'Paga'
      ELSE 'Parcial'
    END,
    idempotency_key = COALESCE(idempotency_key, p_idempotency_key)
  WHERE id = p_fatura_id;

  -- 3. Se totalmente paga, marcar despesas do cartão como Pago
  IF (v_fatura.valor_pago + v_valor_a_pagar) >= v_fatura.valor_total THEN
    UPDATE public.despesas SET
      status = 'Pago',
      data_pagamento = p_data_pagamento
    WHERE fatura_id = p_fatura_id
      AND cartao_id IS NOT NULL
      AND deleted_at IS NULL
      AND status = 'Pendente';
  END IF;

  -- 4. Criar débito na conta bancária (marcado como pagamento de fatura)
  INSERT INTO public.despesas (
    empresa_id,
    descricao,
    valor,
    data_vencimento,
    data_pagamento,
    status,
    conta_id,
    cartao_id,
    fatura_id,
    observacao,
    is_fatura_payment
  ) VALUES (
    v_fatura.empresa_id,
    'Pgto Fatura ' || v_fatura.cartao_nome || ' ' ||
      LPAD(v_fatura.mes_referencia::TEXT, 2, '0') || '/' || v_fatura.ano_referencia,
    v_valor_a_pagar,
    v_fatura.data_vencimento,
    p_data_pagamento,
    'Pago',
    p_conta_id,
    NULL,
    p_fatura_id,
    'Pagamento de fatura de cartão de crédito',
    true
  );
END;
$$;
CREATE OR REPLACE FUNCTION "public"."pilar_set_ultra_admin_scope"("p_scoped" boolean) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_role public.user_role;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();

  IF v_role IS DISTINCT FROM 'ultra_admin' THEN
    RAISE EXCEPTION 'Apenas ultra_admin pode alterar o scoped mode';
  END IF;

  INSERT INTO public.ultra_admin_modes (user_id, scoped, updated_at)
  VALUES (auth.uid(), p_scoped, NOW())
  ON CONFLICT (user_id) DO UPDATE
    SET scoped = EXCLUDED.scoped,
        updated_at = EXCLUDED.updated_at;

  RETURN p_scoped;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."portal_atualizar_status_proposta"("p_token" "text", "p_proposta_id" "uuid", "p_status" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_cliente_id uuid;
  v_empresa_id uuid;
  v_proposta_status text;
BEGIN
  IF p_status NOT IN ('aceita', 'recusada') THEN
    RAISE EXCEPTION 'Status inválido: apenas aceita ou recusada são permitidos';
  END IF;

  SELECT pt.cliente_id, pt.empresa_id INTO v_cliente_id, v_empresa_id
  FROM portal_tokens pt
  WHERE pt.token = p_token
    AND pt.ativo = true
    AND (pt.expira_em IS NULL OR pt.expira_em > now());

  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Token inválido ou expirado';
  END IF;

  SELECT p.status INTO v_proposta_status
  FROM propostas p
  WHERE p.id = p_proposta_id
    AND p.cliente_id = v_cliente_id
    AND p.deleted_at IS NULL;

  IF v_proposta_status IS NULL THEN
    RAISE EXCEPTION 'Proposta não encontrada';
  END IF;

  IF v_proposta_status != 'enviada' THEN
    RAISE EXCEPTION 'Apenas propostas com status "enviada" podem ser aceitas ou recusadas';
  END IF;

  UPDATE propostas
  SET status = p_status, updated_at = now()
  WHERE id = p_proposta_id;

  RETURN json_build_object('ok', true, 'status', p_status);
END;
$$;
CREATE OR REPLACE FUNCTION "public"."portal_login"("p_email" "text", "p_senha" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  v_account RECORD;
  v_token TEXT;
BEGIN
  SELECT id, cliente_id, empresa_id, nome, email, senha_hash, ativo
  INTO v_account
  FROM cliente_portal_accounts
  WHERE email = lower(trim(p_email));

  IF v_account IS NULL THEN
    RAISE EXCEPTION 'Email ou senha inválidos';
  END IF;

  IF NOT v_account.ativo THEN
    RAISE EXCEPTION 'Acesso desativado';
  END IF;

  IF v_account.senha_hash IS NULL OR crypt(p_senha, v_account.senha_hash) != v_account.senha_hash THEN
    RAISE EXCEPTION 'Email ou senha inválidos';
  END IF;

  -- Gera token de sessão
  v_token := encode(gen_random_bytes(32), 'hex');

  -- Atualiza token e último acesso
  UPDATE cliente_portal_accounts
  SET token_sessao = v_token,
      token_expira_em = NOW() + INTERVAL '30 days',
      ultimo_acesso = NOW()
  WHERE id = v_account.id;

  RETURN json_build_object(
    'token', v_token,
    'id', v_account.id,
    'cliente_id', v_account.cliente_id,
    'empresa_id', v_account.empresa_id,
    'nome', v_account.nome,
    'email', v_account.email
  );
END;
$$;
CREATE OR REPLACE FUNCTION "public"."portal_verify_session"("p_token" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_account RECORD;
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RETURN NULL;
  END IF;

  SELECT id, cliente_id, empresa_id, nome, email
  INTO v_account
  FROM cliente_portal_accounts
  WHERE token_sessao = p_token
    AND token_expira_em > NOW()
    AND ativo = true;

  IF v_account IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN json_build_object(
    'id', v_account.id,
    'cliente_id', v_account.cliente_id,
    'empresa_id', v_account.empresa_id,
    'nome', v_account.nome,
    'email', v_account.email
  );
END;
$$;
CREATE OR REPLACE FUNCTION "public"."prevent_company_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.empresa_id IS DISTINCT FROM OLD.empresa_id THEN
    RAISE EXCEPTION 'Segurança: Não é permitido alterar a empresa de um usuário ou registro manualmente.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."recalc_grupo_parcela_status"("p_grupo_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_tipo text;
  v_total int := 0;
  v_pagos int := 0;
  v_cancelados int := 0;
  v_status text;
BEGIN
  SELECT tipo_lancamento INTO v_tipo
  FROM grupos_parcela WHERE id = p_grupo_id;

  IF v_tipo IS NULL THEN RETURN; END IF;

  IF v_tipo = 'receita' THEN
    SELECT
      COUNT(*) FILTER (WHERE deleted_at IS NULL),
      COUNT(*) FILTER (WHERE status::text = 'Recebido' AND deleted_at IS NULL),
      COUNT(*) FILTER (WHERE status::text = 'Cancelado' AND deleted_at IS NULL)
    INTO v_total, v_pagos, v_cancelados
    FROM receitas WHERE grupo_parcela = p_grupo_id;
  ELSE
    SELECT
      COUNT(*) FILTER (WHERE deleted_at IS NULL),
      COUNT(*) FILTER (WHERE status::text = 'Pago' AND deleted_at IS NULL),
      COUNT(*) FILTER (WHERE status::text = 'Cancelado' AND deleted_at IS NULL)
    INTO v_total, v_pagos, v_cancelados
    FROM despesas WHERE grupo_parcela = p_grupo_id;
  END IF;

  IF v_total = 0 THEN
    v_status := 'cancelado';
  ELSIF v_cancelados = v_total THEN
    v_status := 'cancelado';
  ELSIF v_pagos + v_cancelados = v_total THEN
    v_status := 'quitado';
  ELSIF v_pagos > 0 THEN
    v_status := 'parcial';
  ELSE
    v_status := 'aberto';
  END IF;

  UPDATE grupos_parcela
  SET status_agregado = v_status, updated_at = now()
  WHERE id = p_grupo_id;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."request_data_deletion"("p_motivo" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_empresa_id UUID;
  v_request_id UUID;
  v_existing UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- Não permitir duplicatas pendentes
  SELECT id INTO v_existing
  FROM public.data_deletion_requests
  WHERE user_id = v_user_id
    AND status IN ('pending', 'in_progress')
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  -- Best-effort: pega empresa do profile
  BEGIN
    SELECT empresa_id INTO v_empresa_id FROM public.profiles WHERE id = v_user_id;
  EXCEPTION WHEN OTHERS THEN
    v_empresa_id := NULL;
  END;

  INSERT INTO public.data_deletion_requests (user_id, empresa_id, motivo)
  VALUES (v_user_id, v_empresa_id, NULLIF(TRIM(COALESCE(p_motivo, '')), ''))
  RETURNING id INTO v_request_id;

  -- Hook de notificação ao admin (placeholder: log no servidor).
  -- TODO: trocar por pg_notify + edge function "notify-admin-deletion-request"
  --       que dispara email real via Resend.
  RAISE NOTICE 'LGPD data deletion requested: user=% empresa=% request=%',
    v_user_id, v_empresa_id, v_request_id;

  PERFORM pg_notify(
    'data_deletion_request',
    json_build_object(
      'request_id', v_request_id,
      'user_id', v_user_id,
      'empresa_id', v_empresa_id
    )::text
  );

  RETURN v_request_id;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."request_data_export"() RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_empresa_id UUID;
  v_id UUID;
BEGIN
  SELECT empresa_id INTO v_empresa_id
  FROM public.profiles
  WHERE id = auth.uid();

  INSERT INTO public.data_export_requests (user_id, empresa_id)
  VALUES (auth.uid(), v_empresa_id)
  RETURNING id INTO v_id;

  RETURN json_build_object('id', v_id, 'status', 'pending');
EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object('error', 'already_pending');
END;
$$;
CREATE OR REPLACE FUNCTION "public"."rpc_atualizar_status_atrasados"() RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  receitas_atualizadas INTEGER := 0;
  despesas_atualizadas INTEGER := 0;
BEGIN
  -- Marcar receitas pendentes vencidas como Atrasado
  UPDATE receitas
  SET status = 'Atrasado'
  WHERE status = 'Pendente'
    AND data_vencimento < CURRENT_DATE
    AND deleted_at IS NULL;
  GET DIAGNOSTICS receitas_atualizadas = ROW_COUNT;

  -- Marcar despesas pendentes vencidas como Atrasado
  UPDATE despesas
  SET status = 'Atrasado'
  WHERE status = 'Pendente'
    AND data_vencimento < CURRENT_DATE
    AND deleted_at IS NULL;
  GET DIAGNOSTICS despesas_atualizadas = ROW_COUNT;

  RETURN json_build_object(
    'receitas_atualizadas', receitas_atualizadas,
    'despesas_atualizadas', despesas_atualizadas
  );
END;
$$;
CREATE OR REPLACE FUNCTION "public"."rpc_calcular_wip"("p_mes" integer, "p_ano" integer) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_empresa_id UUID;
  v_projeto RECORD;
  v_horas NUMERIC;
  v_custo NUMERIC;
  v_faturado NUMERIC;
  v_recebido NUMERIC;
  v_custo_hora_medio NUMERIC;
  v_count INTEGER := 0;
BEGIN
  v_empresa_id := public.get_user_empresa_id();

  FOR v_projeto IN
    SELECT p.id, p.nome
    FROM projetos p
    WHERE p.empresa_id = v_empresa_id
      AND p.deleted_at IS NULL
      AND p.status IN ('Planejamento', 'Em andamento', 'Revisão', 'Concluído')
  LOOP
    -- Custo/hora médio do orçamento
    SELECT COALESCE(
      CASE WHEN SUM(horas_estimadas) > 0
        THEN SUM(horas_estimadas * custo_hora) / SUM(horas_estimadas)
        ELSE 0
      END, 0)
    INTO v_custo_hora_medio
    FROM projeto_orcamento_fases
    WHERE projeto_id = v_projeto.id AND deleted_at IS NULL;

    -- Horas realizadas (aprovadas) até o fim do mês
    SELECT COALESCE(SUM(horas), 0) INTO v_horas
    FROM timesheets
    WHERE projeto_id = v_projeto.id
      AND status = 'aprovado'
      AND deleted_at IS NULL
      AND data <= (make_date(p_ano, p_mes, 1) + INTERVAL '1 month - 1 day')::DATE;

    v_custo := v_horas * v_custo_hora_medio;

    -- Faturado (marcos faturados/recebidos) até o fim do mês
    SELECT COALESCE(SUM(valor), 0) INTO v_faturado
    FROM marcos_faturamento
    WHERE projeto_id = v_projeto.id
      AND status IN ('faturado', 'recebido')
      AND deleted_at IS NULL
      AND data_faturada <= (make_date(p_ano, p_mes, 1) + INTERVAL '1 month - 1 day')::DATE;

    -- Recebido (receitas efetivamente recebidas)
    SELECT COALESCE(SUM(valor), 0) INTO v_recebido
    FROM receitas
    WHERE projeto_id = v_projeto.id
      AND status = 'Recebido'
      AND deleted_at IS NULL
      AND data_recebimento <= (make_date(p_ano, p_mes, 1) + INTERVAL '1 month - 1 day')::DATE;

    -- Skip se tudo zero
    IF v_horas = 0 AND v_faturado = 0 AND v_recebido = 0 THEN
      CONTINUE;
    END IF;

    -- Upsert
    INSERT INTO wip_snapshots (empresa_id, projeto_id, mes, ano, horas_realizadas, custo_realizado, faturado, recebido)
    VALUES (v_empresa_id, v_projeto.id, p_mes, p_ano, v_horas, v_custo, v_faturado, v_recebido)
    ON CONFLICT (projeto_id, mes, ano) DO UPDATE SET
      horas_realizadas = EXCLUDED.horas_realizadas,
      custo_realizado = EXCLUDED.custo_realizado,
      faturado = EXCLUDED.faturado,
      recebido = EXCLUDED.recebido;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."rpc_converter_lead_cliente"("p_lead_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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
CREATE OR REPLACE FUNCTION "public"."rpc_converter_proposta_projeto"("p_proposta_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  v_proposta RECORD;
  v_empresa_id UUID;
  v_projeto_id UUID;
  v_disc RECORD;
  v_disciplinas_json JSONB := '[]'::JSONB;
  v_codigo TEXT;
  v_seq INT;
BEGIN
  -- Buscar proposta
  SELECT * INTO v_proposta FROM propostas WHERE id = p_proposta_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposta não encontrada';
  END IF;

  IF v_proposta.projeto_id IS NOT NULL THEN
    RAISE EXCEPTION 'Proposta já foi convertida em projeto';
  END IF;

  v_empresa_id := v_proposta.empresa_id;

  -- Gerar codigo sequencial único por empresa
  SELECT COALESCE(MAX(
    CASE WHEN codigo_projeto ~ '^PRJ-\d+$'
      THEN CAST(SUBSTRING(codigo_projeto FROM 5) AS INT)
      ELSE 0
    END
  ), 0) + 1
  INTO v_seq
  FROM projetos
  WHERE empresa_id = v_empresa_id;

  v_codigo := 'PRJ-' || LPAD(v_seq::TEXT, 4, '0');

  -- Montar JSON de disciplinas a partir de proposta_disciplinas
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'nome', pd.disciplina,
    'horas_estimadas', pd.horas_estimadas,
    'custo_hora', pd.custo_hora,
    'valor_venda', pd.valor_venda
  )), '[]'::JSONB)
  INTO v_disciplinas_json
  FROM proposta_disciplinas pd
  WHERE pd.proposta_id = p_proposta_id;

  -- Criar projeto
  INSERT INTO projetos (
    empresa_id, codigo_projeto, nome, cliente_id, valor_contrato,
    area_m2, localizacao, status, prioridade, disciplinas,
    data_inicio, data_previsao, observacao
  ) VALUES (
    v_empresa_id,
    v_codigo,
    v_proposta.titulo,
    v_proposta.cliente_id,
    COALESCE(v_proposta.valor_proposto, 0),
    v_proposta.area_m2,
    v_proposta.localizacao,
    'Planejamento',
    'Media',
    v_disciplinas_json,
    CURRENT_DATE,
    CASE WHEN v_proposta.prazo_estimado_dias IS NOT NULL
      THEN CURRENT_DATE + (v_proposta.prazo_estimado_dias || ' days')::INTERVAL
      ELSE NULL
    END,
    v_proposta.observacao
  )
  RETURNING id INTO v_projeto_id;

  -- Criar orcamento por fase/disciplina a partir de proposta_disciplinas
  FOR v_disc IN
    SELECT disciplina, horas_estimadas, custo_hora, valor_venda
    FROM proposta_disciplinas
    WHERE proposta_id = p_proposta_id
  LOOP
    INSERT INTO projeto_orcamento_fases (
      empresa_id, projeto_id, disciplina, horas_estimadas, custo_hora, valor_venda, margem_alvo_pct
    ) VALUES (
      v_empresa_id, v_projeto_id, v_disc.disciplina,
      v_disc.horas_estimadas, v_disc.custo_hora, v_disc.valor_venda,
      CASE WHEN v_disc.custo_hora > 0 AND v_disc.horas_estimadas > 0 AND v_disc.valor_venda > 0
        THEN ROUND(((v_disc.valor_venda - (v_disc.horas_estimadas * v_disc.custo_hora)) / v_disc.valor_venda) * 100, 2)
        ELSE 20.0
      END
    );
  END LOOP;

  -- Atualizar proposta: vincular ao projeto e marcar como aceita
  UPDATE propostas
  SET projeto_id = v_projeto_id,
      status = 'aceita'
  WHERE id = p_proposta_id;

  RETURN v_projeto_id;
END;
$_$;
CREATE OR REPLACE FUNCTION "public"."rpc_criar_transferencia"("p_conta_origem_id" "uuid", "p_conta_destino_id" "uuid", "p_valor" numeric, "p_data" "date", "p_descricao" "text" DEFAULT NULL::"text", "p_status" "text" DEFAULT 'Concluída'::"text", "p_observacao" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_empresa_id uuid;
  v_id uuid;
BEGIN
  v_empresa_id := public.get_user_empresa_id();

  IF p_conta_origem_id = p_conta_destino_id THEN
    RAISE EXCEPTION 'Conta de origem e destino devem ser diferentes';
  END IF;

  IF p_valor <= 0 THEN
    RAISE EXCEPTION 'Valor deve ser positivo';
  END IF;

  IF p_status NOT IN ('Concluída', 'Pendente') THEN
    RAISE EXCEPTION 'Status inválido';
  END IF;

  -- Verifica que ambas as contas pertencem à empresa
  IF NOT EXISTS (
    SELECT 1 FROM contas WHERE id = p_conta_origem_id AND empresa_id = v_empresa_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Conta de origem não encontrada';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM contas WHERE id = p_conta_destino_id AND empresa_id = v_empresa_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Conta de destino não encontrada';
  END IF;

  INSERT INTO transferencias (
    empresa_id, conta_origem_id, conta_destino_id,
    valor, data_transferencia, descricao, status, observacao,
    created_by, updated_by
  ) VALUES (
    v_empresa_id, p_conta_origem_id, p_conta_destino_id,
    p_valor, p_data, p_descricao, p_status, p_observacao,
    auth.uid(), auth.uid()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."rpc_daily_maintenance"() RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_atrasados JSON;
  v_alertas INTEGER;
  v_empresa_id UUID;
BEGIN
  v_empresa_id := public.get_user_empresa_id();
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não associado a uma empresa';
  END IF;

  SELECT rpc_atualizar_status_atrasados() INTO v_atrasados;

  SELECT rpc_gerar_alertas() INTO v_alertas;

  UPDATE projetos
  SET updated_at = NOW()
  WHERE empresa_id = v_empresa_id
    AND deleted_at IS NULL
    AND status IN ('Planejamento', 'Em andamento');

  RETURN json_build_object(
    'atrasados', v_atrasados,
    'alertas_gerados', v_alertas
  );
END;
$$;
CREATE OR REPLACE FUNCTION "public"."rpc_dashboard_rentabilidade"() RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  result JSON;
  v_empresa_id UUID;
BEGIN
  v_empresa_id := public.get_user_empresa_id();

  SELECT json_agg(proj_data) INTO result
  FROM (
    SELECT json_build_object(
      'projeto_id', p.id,
      'projeto_nome', p.nome,
      'codigo_projeto', p.codigo_projeto,
      'status', p.status,
      'valor_contrato', COALESCE(p.valor_contrato, 0),
      'receitas_total', COALESCE((
        SELECT SUM(r.valor) FROM receitas r
        WHERE r.projeto_id = p.id AND r.deleted_at IS NULL AND r.status IN ('Recebido', 'Pendente')
      ), 0),
      'receitas_recebidas', COALESCE((
        SELECT SUM(r.valor) FROM receitas r
        WHERE r.projeto_id = p.id AND r.deleted_at IS NULL AND r.status = 'Recebido'
      ), 0),
      'despesas_diretas', COALESCE((
        SELECT SUM(d.valor) FROM despesas d
        WHERE d.projeto_id = p.id AND d.deleted_at IS NULL AND d.status IN ('Pago', 'Pendente')
      ), 0),
      'horas_orcadas', COALESCE((
        SELECT SUM(o.horas_estimadas) FROM projeto_orcamento_fases o
        WHERE o.projeto_id = p.id AND o.deleted_at IS NULL
      ), 0),
      'horas_consumidas', COALESCE((
        SELECT SUM(t.horas) FROM timesheets t
        WHERE t.projeto_id = p.id AND t.deleted_at IS NULL AND t.status = 'aprovado'
      ), 0)
    ) AS proj_data
    FROM projetos p
    WHERE p.empresa_id = v_empresa_id
      AND p.deleted_at IS NULL
      AND p.status IN ('Planejamento', 'Em andamento', 'Concluído')
    ORDER BY p.created_at DESC
  ) sub;

  RETURN COALESCE(result, '[]'::json);
END;
$$;
CREATE OR REPLACE FUNCTION "public"."rpc_editar_transferencia"("p_id" "uuid", "p_conta_origem_id" "uuid", "p_conta_destino_id" "uuid", "p_valor" numeric, "p_data" "date", "p_descricao" "text" DEFAULT NULL::"text", "p_status" "text" DEFAULT 'Concluída'::"text", "p_observacao" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_empresa_id uuid;
BEGIN
  v_empresa_id := public.get_user_empresa_id();

  IF p_conta_origem_id = p_conta_destino_id THEN
    RAISE EXCEPTION 'Conta de origem e destino devem ser diferentes';
  END IF;

  IF p_valor <= 0 THEN
    RAISE EXCEPTION 'Valor deve ser positivo';
  END IF;

  UPDATE transferencias SET
    conta_origem_id = p_conta_origem_id,
    conta_destino_id = p_conta_destino_id,
    valor = p_valor,
    data_transferencia = p_data,
    descricao = p_descricao,
    status = p_status,
    observacao = p_observacao,
    updated_by = auth.uid(),
    updated_at = now()
  WHERE id = p_id AND empresa_id = v_empresa_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transferência não encontrada';
  END IF;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."rpc_excluir_transferencia"("p_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_empresa_id uuid;
BEGIN
  v_empresa_id := public.get_user_empresa_id();

  UPDATE transferencias SET
    deleted_at = now(),
    updated_by = auth.uid(),
    updated_at = now()
  WHERE id = p_id AND empresa_id = v_empresa_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transferência não encontrada';
  END IF;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."rpc_faturar_marco"("p_marco_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_marco RECORD;
  v_projeto RECORD;
  v_receita_id UUID;
BEGIN
  -- Buscar o marco
  SELECT * INTO v_marco FROM marcos_faturamento WHERE id = p_marco_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Marco não encontrado';
  END IF;

  IF v_marco.status != 'pendente' THEN
    RAISE EXCEPTION 'Apenas marcos pendentes podem ser faturados';
  END IF;

  -- Buscar dados do projeto
  SELECT id, cliente_id, empresa_id, nome FROM projetos
  WHERE id = v_marco.projeto_id AND deleted_at IS NULL
  INTO v_projeto;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Projeto não encontrado';
  END IF;

  -- Criar receita
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

  -- Atualizar o marco
  UPDATE marcos_faturamento
  SET status = 'faturado',
      data_faturada = CURRENT_DATE,
      receita_id = v_receita_id
  WHERE id = p_marco_id;

  RETURN v_receita_id;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."rpc_gerar_alertas"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  alert_count INTEGER := 0;
  r RECORD;
  v_empresa_id UUID;
BEGIN
  v_empresa_id := public.get_user_empresa_id();
  
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não associado a uma empresa';
  END IF;

  FOR r IN
    SELECT p.id, p.nome,
      COALESCE(SUM(t.horas), 0) AS horas_consumidas,
      COALESCE(SUM(o.horas_estimadas), 0) AS horas_orcadas,
      COALESCE((SELECT SUM(rv.valor) FROM receitas rv WHERE rv.projeto_id = p.id AND rv.deleted_at IS NULL AND rv.status = 'Recebido'), 0) AS recebido,
      COALESCE(p.valor_contrato, 0) AS valor_contrato
    FROM projetos p
    LEFT JOIN timesheets t ON t.projeto_id = p.id AND t.deleted_at IS NULL AND t.status = 'aprovado'
    LEFT JOIN projeto_orcamento_fases o ON o.projeto_id = p.id AND o.deleted_at IS NULL
    WHERE p.empresa_id = v_empresa_id AND p.deleted_at IS NULL AND p.status = 'Em andamento'
    GROUP BY p.id, p.nome, p.valor_contrato
    HAVING COALESCE(SUM(o.horas_estimadas), 0) > 0
  LOOP
    IF r.horas_orcadas > 0 AND (r.horas_consumidas / r.horas_orcadas) > 0.8
       AND r.valor_contrato > 0 AND (r.recebido / r.valor_contrato) < 0.5 THEN
      IF NOT EXISTS (
        SELECT 1 FROM alertas a
        WHERE a.empresa_id = v_empresa_id AND a.tipo = 'horas_excedidas'
          AND a.referencia_id = r.id AND a.created_at > NOW() - INTERVAL '7 days'
      ) THEN
        INSERT INTO alertas (empresa_id, tipo, severidade, titulo, mensagem, referencia_tipo, referencia_id)
        VALUES (v_empresa_id, 'horas_excedidas', 'high',
          'Horas excedidas: ' || r.nome,
          'Projeto consumiu ' || ROUND((r.horas_consumidas / r.horas_orcadas * 100)::numeric, 0) || '% das horas mas faturou apenas ' || ROUND((r.recebido / NULLIF(r.valor_contrato, 0) * 100)::numeric, 0) || '%',
          'projeto', r.id);
        alert_count := alert_count + 1;
      END IF;
    END IF;
  END LOOP;

  FOR r IN
    SELECT rv.id, rv.descricao, rv.data_vencimento, rv.valor,
      c.nome AS cliente_nome
    FROM receitas rv
    LEFT JOIN clientes c ON c.id = rv.cliente_id
    WHERE rv.empresa_id = v_empresa_id AND rv.deleted_at IS NULL
      AND rv.status = 'Pendente'
      AND rv.data_vencimento < CURRENT_DATE - INTERVAL '15 days'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM alertas a
      WHERE a.empresa_id = v_empresa_id AND a.tipo = 'pagamento_atrasado'
        AND a.referencia_id = r.id AND a.created_at > NOW() - INTERVAL '7 days'
    ) THEN
      INSERT INTO alertas (empresa_id, tipo, severidade, titulo, mensagem, referencia_tipo, referencia_id)
      VALUES (v_empresa_id, 'pagamento_atrasado', 'high',
        'Pagamento atrasado: ' || COALESCE(r.cliente_nome, r.descricao),
        'Receita de R$ ' || r.valor || ' vencida em ' || TO_CHAR(r.data_vencimento, 'DD/MM/YYYY'),
        'cliente', r.id);
      alert_count := alert_count + 1;
    END IF;
  END LOOP;

  RETURN alert_count;
END;
$_$;
CREATE OR REPLACE FUNCTION "public"."rpc_gerar_alertas"("p_empresa_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  alert_count INTEGER := 0;
  r RECORD;
BEGIN
  -- 1. Projetos com horas consumidas > 80% e faturamento < 50%
  FOR r IN
    SELECT p.id, p.nome,
      COALESCE(SUM(t.horas), 0) AS horas_consumidas,
      COALESCE(SUM(o.horas_estimadas), 0) AS horas_orcadas,
      COALESCE((SELECT SUM(rv.valor) FROM receitas rv WHERE rv.projeto_id = p.id AND rv.deleted_at IS NULL AND rv.status = 'Recebido'), 0) AS recebido,
      COALESCE(p.valor_contrato, 0) AS valor_contrato
    FROM projetos p
    LEFT JOIN timesheets t ON t.projeto_id = p.id AND t.deleted_at IS NULL AND t.status = 'aprovado'
    LEFT JOIN projeto_orcamento_fases o ON o.projeto_id = p.id AND o.deleted_at IS NULL
    WHERE p.empresa_id = p_empresa_id AND p.deleted_at IS NULL AND p.status = 'Em andamento'
    GROUP BY p.id, p.nome, p.valor_contrato
    HAVING COALESCE(SUM(o.horas_estimadas), 0) > 0
  LOOP
    IF r.horas_orcadas > 0 AND (r.horas_consumidas / r.horas_orcadas) > 0.8
       AND r.valor_contrato > 0 AND (r.recebido / r.valor_contrato) < 0.5 THEN
      IF NOT EXISTS (
        SELECT 1 FROM alertas a
        WHERE a.empresa_id = p_empresa_id AND a.tipo = 'horas_excedidas'
          AND a.referencia_id = r.id AND a.created_at > NOW() - INTERVAL '7 days'
      ) THEN
        INSERT INTO alertas (empresa_id, tipo, severidade, titulo, mensagem, referencia_tipo, referencia_id)
        VALUES (p_empresa_id, 'horas_excedidas', 'high',
          'Horas excedidas: ' || r.nome,
          'Projeto consumiu ' || ROUND((r.horas_consumidas / r.horas_orcadas * 100)::numeric, 0) || '% das horas mas faturou apenas ' || ROUND((r.recebido / NULLIF(r.valor_contrato, 0) * 100)::numeric, 0) || '%',
          'projeto', r.id);
        alert_count := alert_count + 1;
      END IF;
    END IF;
  END LOOP;

  -- 2. Receitas atrasadas > 15 dias
  FOR r IN
    SELECT rv.id, rv.descricao, rv.data_vencimento, rv.valor,
      c.nome AS cliente_nome, rv.projeto_id
    FROM receitas rv
    LEFT JOIN clientes c ON c.id = rv.cliente_id
    WHERE rv.empresa_id = p_empresa_id AND rv.deleted_at IS NULL
      AND rv.status = 'Pendente'
      AND rv.data_vencimento < CURRENT_DATE - INTERVAL '15 days'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM alertas a
      WHERE a.empresa_id = p_empresa_id AND a.tipo = 'pagamento_atrasado'
        AND a.referencia_id = r.id AND a.created_at > NOW() - INTERVAL '7 days'
    ) THEN
      INSERT INTO alertas (empresa_id, tipo, severidade, titulo, mensagem, referencia_tipo, referencia_id)
      VALUES (p_empresa_id, 'pagamento_atrasado', 'high',
        'Pagamento atrasado: ' || COALESCE(r.cliente_nome, r.descricao),
        'Receita de R$ ' || TO_CHAR(r.valor, 'FM999G999D00') || ' vencida em ' || TO_CHAR(r.data_vencimento, 'DD/MM/YYYY'),
        'receita', r.id);
      alert_count := alert_count + 1;
    END IF;
  END LOOP;

  -- 3. Receitas vencendo nos próximos 7 dias (alerta preventivo)
  FOR r IN
    SELECT rv.id, rv.descricao, rv.data_vencimento, rv.valor,
      c.nome AS cliente_nome, p.nome AS projeto_nome
    FROM receitas rv
    LEFT JOIN clientes c ON c.id = rv.cliente_id
    LEFT JOIN projetos p ON p.id = rv.projeto_id
    WHERE rv.empresa_id = p_empresa_id AND rv.deleted_at IS NULL
      AND rv.status = 'Pendente'
      AND rv.data_vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM alertas a
      WHERE a.empresa_id = p_empresa_id AND a.tipo = 'vencimento_proximo'
        AND a.referencia_id = r.id AND a.created_at > NOW() - INTERVAL '7 days'
    ) THEN
      INSERT INTO alertas (empresa_id, tipo, severidade, titulo, mensagem, referencia_tipo, referencia_id)
      VALUES (p_empresa_id, 'vencimento_proximo', 'medium',
        'Vencimento próximo: ' || COALESCE(r.projeto_nome, r.descricao),
        'Receita "' || r.descricao || '" de R$ ' || TO_CHAR(r.valor, 'FM999G999D00') || ' vence em ' || TO_CHAR(r.data_vencimento, 'DD/MM/YYYY'),
        'receita', r.id);
      alert_count := alert_count + 1;
    END IF;
  END LOOP;

  -- 4. Marcos de faturamento pendentes com data prevista nos próximos 7 dias
  FOR r IN
    SELECT mf.id, mf.nome, mf.data_prevista, mf.valor,
      p.nome AS projeto_nome
    FROM marcos_faturamento mf
    JOIN projetos p ON p.id = mf.projeto_id
    WHERE p.empresa_id = p_empresa_id AND mf.deleted_at IS NULL
      AND mf.status = 'pendente'
      AND mf.data_prevista BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM alertas a
      WHERE a.empresa_id = p_empresa_id AND a.tipo = 'marco_proximo'
        AND a.referencia_id = r.id AND a.created_at > NOW() - INTERVAL '7 days'
    ) THEN
      INSERT INTO alertas (empresa_id, tipo, severidade, titulo, mensagem, referencia_tipo, referencia_id)
      VALUES (p_empresa_id, 'marco_proximo', 'medium',
        'Marco próximo: ' || r.projeto_nome,
        'Marco "' || r.nome || '" de R$ ' || TO_CHAR(r.valor, 'FM999G999D00') || ' previsto para ' || TO_CHAR(r.data_prevista, 'DD/MM/YYYY'),
        'marco', r.id);
      alert_count := alert_count + 1;
    END IF;
  END LOOP;

  -- 5. Projetos com recebimento baixo vs progresso das disciplinas
  FOR r IN
    SELECT p.id, p.nome, p.valor_contrato,
      COALESCE((SELECT SUM(rv.valor) FROM receitas rv WHERE rv.projeto_id = p.id AND rv.deleted_at IS NULL AND rv.status IN ('Recebido', 'Pago')), 0) AS recebido,
      COALESCE(p.valor_contrato, 0) AS contrato,
      (SELECT COUNT(*) FILTER (WHERE d.elem->>'status' = 'Concluído') * 100.0 / NULLIF(COUNT(*), 0)
       FROM jsonb_array_elements(p.disciplinas::jsonb) AS d(elem)) AS progresso_pct
    FROM projetos p
    WHERE p.empresa_id = p_empresa_id AND p.deleted_at IS NULL
      AND p.status = 'Em andamento'
      AND p.valor_contrato > 0
      AND jsonb_array_length(COALESCE(p.disciplinas::jsonb, '[]'::jsonb)) > 0
  LOOP
    -- Se progresso > 60% mas recebimento < 30%, alerta
    IF r.progresso_pct IS NOT NULL AND r.progresso_pct > 60
       AND r.contrato > 0 AND (r.recebido / r.contrato) < 0.3 THEN
      IF NOT EXISTS (
        SELECT 1 FROM alertas a
        WHERE a.empresa_id = p_empresa_id AND a.tipo = 'recebimento_baixo'
          AND a.referencia_id = r.id AND a.created_at > NOW() - INTERVAL '14 days'
      ) THEN
        INSERT INTO alertas (empresa_id, tipo, severidade, titulo, mensagem, referencia_tipo, referencia_id)
        VALUES (p_empresa_id, 'recebimento_baixo', 'critical',
          'Recebimento baixo: ' || r.nome,
          'Projeto ' || ROUND(r.progresso_pct::numeric, 0) || '% concluído mas apenas ' || ROUND((r.recebido / r.contrato * 100)::numeric, 0) || '% recebido (R$ ' || TO_CHAR(r.recebido, 'FM999G999D00') || ' de R$ ' || TO_CHAR(r.contrato, 'FM999G999D00') || ')',
          'projeto', r.id);
        alert_count := alert_count + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN alert_count;
END;
$_$;
CREATE OR REPLACE FUNCTION "public"."rpc_gerar_despesas_recorrentes"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_despesa RECORD;
  v_proxima_data DATE;
  v_count INTEGER := 0;
  v_empresa_id UUID;
BEGIN
  v_empresa_id := public.get_user_empresa_id();

  FOR v_despesa IN
    SELECT d.*
    FROM despesas d
    WHERE d.empresa_id = v_empresa_id
      AND d.recorrente = TRUE
      AND d.deleted_at IS NULL
      AND d.periodicidade IS NOT NULL
      -- Só gera se não existe filha no futuro
      AND NOT EXISTS (
        SELECT 1 FROM despesas filha
        WHERE filha.despesa_pai_id = d.id
          AND filha.deleted_at IS NULL
          AND filha.data_vencimento > CURRENT_DATE
      )
  LOOP
    -- Calcular próxima data
    v_proxima_data := CASE v_despesa.periodicidade
      WHEN 'mensal' THEN v_despesa.data_vencimento + INTERVAL '1 month'
      WHEN 'trimestral' THEN v_despesa.data_vencimento + INTERVAL '3 months'
      WHEN 'semestral' THEN v_despesa.data_vencimento + INTERVAL '6 months'
      WHEN 'anual' THEN v_despesa.data_vencimento + INTERVAL '1 year'
      ELSE v_despesa.data_vencimento + INTERVAL '1 month'
    END;

    -- Ajustar se data já passou (avançar até o futuro)
    WHILE v_proxima_data <= CURRENT_DATE LOOP
      v_proxima_data := CASE v_despesa.periodicidade
        WHEN 'mensal' THEN v_proxima_data + INTERVAL '1 month'
        WHEN 'trimestral' THEN v_proxima_data + INTERVAL '3 months'
        WHEN 'semestral' THEN v_proxima_data + INTERVAL '6 months'
        WHEN 'anual' THEN v_proxima_data + INTERVAL '1 year'
        ELSE v_proxima_data + INTERVAL '1 month'
      END;
    END LOOP;

    -- Criar próxima ocorrência
    INSERT INTO despesas (
      empresa_id, descricao, valor, data_vencimento, status,
      projeto_id, fornecedor_id, categoria_id, conta_id,
      recorrente, periodicidade, despesa_pai_id, observacao
    ) VALUES (
      v_despesa.empresa_id,
      v_despesa.descricao,
      v_despesa.valor,
      v_proxima_data,
      'Pendente',
      v_despesa.projeto_id,
      v_despesa.fornecedor_id,
      v_despesa.categoria_id,
      v_despesa.conta_id,
      TRUE,
      v_despesa.periodicidade,
      v_despesa.id,
      v_despesa.observacao
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."rpc_gerar_parcelas_dia_fixo"("p_projeto_id" "uuid", "p_num_parcelas" integer, "p_dia_fixo" integer) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_projeto RECORD;
  v_valor_parcela NUMERIC;
  v_caller_empresa_id UUID;
  v_data_venc DATE;
  v_ano INTEGER;
  v_mes INTEGER;
  v_dia_efetivo INTEGER;
  v_ultimo_dia INTEGER;
  v_start_mes INTEGER;
  v_start_ano INTEGER;
  i INTEGER;
  parcelas_criadas INTEGER := 0;
BEGIN
  v_caller_empresa_id := public.get_user_empresa_id();

  SELECT id, valor_contrato, cliente_id, empresa_id, nome, codigo_projeto
  INTO v_projeto
  FROM projetos
  WHERE id = p_projeto_id AND deleted_at IS NULL;

  IF v_projeto IS NULL THEN
    RAISE EXCEPTION 'Projeto não encontrado';
  END IF;

  IF v_projeto.empresa_id != v_caller_empresa_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF v_projeto.valor_contrato IS NULL OR v_projeto.valor_contrato <= 0 THEN
    RAISE EXCEPTION 'Projeto sem valor de contrato';
  END IF;

  IF p_num_parcelas < 1 OR p_num_parcelas > 60 THEN
    RAISE EXCEPTION 'Número de parcelas deve ser entre 1 e 60';
  END IF;

  IF p_dia_fixo < 1 OR p_dia_fixo > 31 THEN
    RAISE EXCEPTION 'Dia fixo deve estar entre 1 e 31';
  END IF;

  v_valor_parcela := ROUND(v_projeto.valor_contrato / p_num_parcelas, 2);

  IF EXTRACT(DAY FROM CURRENT_DATE)::INTEGER >= p_dia_fixo THEN
    v_start_mes := EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER + 1;
    v_start_ano := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
    IF v_start_mes > 12 THEN
      v_start_mes := 1;
      v_start_ano := v_start_ano + 1;
    END IF;
  ELSE
    v_start_mes := EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER;
    v_start_ano := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  END IF;

  FOR i IN 0..(p_num_parcelas - 1) LOOP
    v_mes := ((v_start_mes - 1 + i) % 12) + 1;
    v_ano := v_start_ano + ((v_start_mes - 1 + i) / 12);

    v_ultimo_dia := EXTRACT(DAY FROM (DATE_TRUNC('MONTH', MAKE_DATE(v_ano, v_mes, 1)) + INTERVAL '1 month - 1 day'))::INTEGER;
    v_dia_efetivo := LEAST(p_dia_fixo, v_ultimo_dia);
    v_data_venc := MAKE_DATE(v_ano, v_mes, v_dia_efetivo);

    -- Pula fim de semana (domingo=0, sábado=6 no PG)
    WHILE EXTRACT(DOW FROM v_data_venc) IN (0, 6) LOOP
      v_data_venc := v_data_venc + 1;
    END LOOP;

    INSERT INTO receitas (empresa_id, descricao, valor, data_vencimento, status, projeto_id, cliente_id)
    VALUES (
      v_projeto.empresa_id,
      v_projeto.codigo_projeto || ' - Parcela ' || (i + 1) || '/' || p_num_parcelas,
      v_valor_parcela,
      v_data_venc,
      'Pendente',
      p_projeto_id,
      v_projeto.cliente_id
    );
    parcelas_criadas := parcelas_criadas + 1;
  END LOOP;

  IF p_num_parcelas > 1 THEN
    UPDATE receitas
    SET valor = v_projeto.valor_contrato - (v_valor_parcela * (p_num_parcelas - 1))
    WHERE projeto_id = p_projeto_id
      AND descricao LIKE '%Parcela ' || p_num_parcelas || '/' || p_num_parcelas
      AND deleted_at IS NULL;
  END IF;

  RETURN parcelas_criadas;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."rpc_gerar_parcelas_projeto"("p_projeto_id" "uuid", "p_num_parcelas" integer DEFAULT 1, "p_intervalo_dias" integer DEFAULT 30) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_projeto RECORD;
  v_valor_parcela NUMERIC;
  v_data_base DATE;
  i INTEGER;
  parcelas_criadas INTEGER := 0;
BEGIN
  -- Busca dados do projeto
  SELECT id, valor_contrato, cliente_id, empresa_id, data_inicio, nome, codigo_projeto
  INTO v_projeto
  FROM projetos
  WHERE id = p_projeto_id AND deleted_at IS NULL;

  IF v_projeto IS NULL THEN
    RAISE EXCEPTION 'Projeto não encontrado';
  END IF;

  IF v_projeto.valor_contrato IS NULL OR v_projeto.valor_contrato <= 0 THEN
    RAISE EXCEPTION 'Projeto sem valor de contrato';
  END IF;

  IF p_num_parcelas < 1 OR p_num_parcelas > 60 THEN
    RAISE EXCEPTION 'Número de parcelas deve ser entre 1 e 60';
  END IF;

  v_valor_parcela := ROUND(v_projeto.valor_contrato / p_num_parcelas, 2);
  v_data_base := COALESCE(v_projeto.data_inicio, CURRENT_DATE);

  FOR i IN 1..p_num_parcelas LOOP
    INSERT INTO receitas (empresa_id, descricao, valor, data_vencimento, status, projeto_id, cliente_id)
    VALUES (
      v_projeto.empresa_id,
      v_projeto.codigo_projeto || ' - Parcela ' || i || '/' || p_num_parcelas,
      v_valor_parcela,
      v_data_base + ((i - 1) * p_intervalo_dias),
      'Pendente',
      p_projeto_id,
      v_projeto.cliente_id
    );
    parcelas_criadas := parcelas_criadas + 1;
  END LOOP;

  -- Ajusta última parcela para fechar o valor exato (evita centavos perdidos)
  IF p_num_parcelas > 1 THEN
    UPDATE receitas
    SET valor = v_projeto.valor_contrato - (v_valor_parcela * (p_num_parcelas - 1))
    WHERE projeto_id = p_projeto_id
      AND descricao LIKE '%Parcela ' || p_num_parcelas || '/' || p_num_parcelas
      AND deleted_at IS NULL;
  END IF;

  RETURN parcelas_criadas;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."rpc_grupo_parcela_criar"("p_tipo_lancamento" "text", "p_descricao" "text", "p_total" numeric, "p_num_parcelas" integer, "p_primeira_data" "date", "p_periodicidade" "text" DEFAULT 'mensal'::"text", "p_contraparte_id" "uuid" DEFAULT NULL::"uuid", "p_projeto_id" "uuid" DEFAULT NULL::"uuid", "p_categoria_id" "uuid" DEFAULT NULL::"uuid", "p_centro_custo_id" "uuid" DEFAULT NULL::"uuid", "p_conta_id" "uuid" DEFAULT NULL::"uuid", "p_cartao_id" "uuid" DEFAULT NULL::"uuid", "p_forma_pagamento" "text" DEFAULT NULL::"text", "p_observacao" "text" DEFAULT NULL::"text", "p_tags" "text"[] DEFAULT NULL::"text"[]) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_empresa_id uuid;
  v_grupo_id uuid;
  v_valor_parcela numeric(12,2);
  v_diferenca numeric(12,2);
  v_data_venc date;
  v_interval interval;
  i integer;
  v_status_inicial text;
  v_contraparte_tipo text;
BEGIN
  v_empresa_id := public.get_user_empresa_id();
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa';
  END IF;

  IF p_tipo_lancamento NOT IN ('receita','despesa') THEN
    RAISE EXCEPTION 'tipo_lancamento inválido: %', p_tipo_lancamento;
  END IF;

  IF p_num_parcelas < 1 OR p_num_parcelas > 360 THEN
    RAISE EXCEPTION 'num_parcelas deve ser 1-360';
  END IF;

  IF p_total IS NULL OR p_total <= 0 THEN
    RAISE EXCEPTION 'total deve ser positivo';
  END IF;

  v_interval := CASE p_periodicidade
    WHEN 'mensal' THEN INTERVAL '1 month'
    WHEN 'bimestral' THEN INTERVAL '2 months'
    WHEN 'trimestral' THEN INTERVAL '3 months'
    WHEN 'semestral' THEN INTERVAL '6 months'
    WHEN 'anual' THEN INTERVAL '1 year'
    ELSE INTERVAL '1 month'
  END;

  v_contraparte_tipo := CASE p_tipo_lancamento
    WHEN 'receita' THEN 'cliente'
    ELSE 'fornecedor'
  END;

  v_status_inicial := CASE p_tipo_lancamento
    WHEN 'receita' THEN 'Pendente'
    ELSE 'Pendente'
  END;

  v_valor_parcela := ROUND(p_total / p_num_parcelas, 2);
  v_diferenca := p_total - (v_valor_parcela * p_num_parcelas);

  -- Cria grupo
  INSERT INTO grupos_parcela (
    empresa_id, tipo_lancamento, tipo_grupo, descricao,
    total_original, num_parcelas, periodicidade,
    contraparte_id, contraparte_tipo, projeto_id, categoria_id,
    centro_custo_id, observacao, created_by, updated_by
  ) VALUES (
    v_empresa_id, p_tipo_lancamento, 'finito', p_descricao,
    p_total, p_num_parcelas, p_periodicidade,
    p_contraparte_id, v_contraparte_tipo, p_projeto_id, p_categoria_id,
    p_centro_custo_id, p_observacao, auth.uid(), auth.uid()
  ) RETURNING id INTO v_grupo_id;

  -- Cria parcelas filhas
  FOR i IN 1..p_num_parcelas LOOP
    v_data_venc := (p_primeira_data + ((i - 1) * v_interval))::date;

    IF p_tipo_lancamento = 'receita' THEN
      INSERT INTO receitas (
        empresa_id, descricao, valor, data_vencimento, data_competencia,
        status, projeto_id, cliente_id, categoria_id, conta_id,
        centro_custo_id, tags, forma_pagamento, observacao,
        grupo_parcela, parcela_numero, parcela_total,
        created_by, updated_by
      ) VALUES (
        v_empresa_id, p_descricao,
        CASE WHEN i = p_num_parcelas THEN v_valor_parcela + v_diferenca ELSE v_valor_parcela END,
        v_data_venc, v_data_venc,
        v_status_inicial::status_financeiro, p_projeto_id, p_contraparte_id,
        p_categoria_id, p_conta_id, p_centro_custo_id, p_tags,
        p_forma_pagamento, p_observacao,
        v_grupo_id, i, p_num_parcelas,
        auth.uid(), auth.uid()
      );
    ELSE
      INSERT INTO despesas (
        empresa_id, descricao, valor, data_vencimento, data_competencia,
        status, projeto_id, fornecedor_id, categoria_id, conta_id,
        cartao_id, centro_custo_id, tags, forma_pagamento, observacao,
        grupo_parcela, parcela_numero, parcela_total,
        created_by, updated_by
      ) VALUES (
        v_empresa_id, p_descricao,
        CASE WHEN i = p_num_parcelas THEN v_valor_parcela + v_diferenca ELSE v_valor_parcela END,
        v_data_venc, v_data_venc,
        v_status_inicial::status_financeiro, p_projeto_id, p_contraparte_id,
        p_categoria_id, p_conta_id, p_cartao_id, p_centro_custo_id, p_tags,
        p_forma_pagamento, p_observacao,
        v_grupo_id, i, p_num_parcelas,
        auth.uid(), auth.uid()
      );
    END IF;
  END LOOP;

  RETURN v_grupo_id;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."rpc_grupo_parcela_editar_em_aberto"("p_grupo_id" "uuid", "p_novo_valor_parcela" numeric DEFAULT NULL::numeric, "p_nova_categoria_id" "uuid" DEFAULT NULL::"uuid", "p_novo_centro_custo_id" "uuid" DEFAULT NULL::"uuid", "p_nova_conta_id" "uuid" DEFAULT NULL::"uuid", "p_nova_observacao" "text" DEFAULT NULL::"text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_empresa_id uuid;
  v_tipo text;
  v_afetadas integer := 0;
BEGIN
  v_empresa_id := public.get_user_empresa_id();

  SELECT tipo_lancamento INTO v_tipo
  FROM grupos_parcela WHERE id = p_grupo_id AND empresa_id = v_empresa_id;

  IF v_tipo IS NULL THEN
    RAISE EXCEPTION 'Grupo não encontrado ou acesso negado';
  END IF;

  IF v_tipo = 'receita' THEN
    UPDATE receitas SET
      valor = COALESCE(p_novo_valor_parcela, valor),
      categoria_id = COALESCE(p_nova_categoria_id, categoria_id),
      centro_custo_id = COALESCE(p_novo_centro_custo_id, centro_custo_id),
      conta_id = COALESCE(p_nova_conta_id, conta_id),
      observacao = COALESCE(p_nova_observacao, observacao),
      updated_by = auth.uid(),
      updated_at = now()
    WHERE grupo_parcela = p_grupo_id
      AND empresa_id = v_empresa_id
      AND status::text IN ('Pendente', 'Atrasado')
      AND deleted_at IS NULL;
    GET DIAGNOSTICS v_afetadas = ROW_COUNT;
  ELSE
    UPDATE despesas SET
      valor = COALESCE(p_novo_valor_parcela, valor),
      categoria_id = COALESCE(p_nova_categoria_id, categoria_id),
      centro_custo_id = COALESCE(p_novo_centro_custo_id, centro_custo_id),
      conta_id = COALESCE(p_nova_conta_id, conta_id),
      observacao = COALESCE(p_nova_observacao, observacao),
      updated_by = auth.uid(),
      updated_at = now()
    WHERE grupo_parcela = p_grupo_id
      AND empresa_id = v_empresa_id
      AND status::text IN ('Pendente', 'Atrasado')
      AND deleted_at IS NULL;
    GET DIAGNOSTICS v_afetadas = ROW_COUNT;
  END IF;

  UPDATE grupos_parcela
  SET updated_at = now(), updated_by = auth.uid(),
      categoria_id = COALESCE(p_nova_categoria_id, categoria_id),
      centro_custo_id = COALESCE(p_novo_centro_custo_id, centro_custo_id),
      observacao = COALESCE(p_nova_observacao, observacao)
  WHERE id = p_grupo_id;

  RETURN v_afetadas;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."rpc_grupo_parcela_quitar_antecipado"("p_grupo_id" "uuid", "p_data_pagamento" "date" DEFAULT CURRENT_DATE, "p_quantidade" integer DEFAULT NULL::integer, "p_desconto_total" numeric DEFAULT 0) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_empresa_id uuid;
  v_tipo text;
  v_afetadas integer := 0;
  v_status_pago text;
  v_data_field text;
  v_ids uuid[];
  v_id uuid;
BEGIN
  v_empresa_id := public.get_user_empresa_id();

  SELECT tipo_lancamento INTO v_tipo
  FROM grupos_parcela WHERE id = p_grupo_id AND empresa_id = v_empresa_id;

  IF v_tipo IS NULL THEN
    RAISE EXCEPTION 'Grupo não encontrado';
  END IF;

  IF v_tipo = 'receita' THEN
    SELECT array_agg(id ORDER BY parcela_numero) INTO v_ids
    FROM (
      SELECT id, parcela_numero FROM receitas
      WHERE grupo_parcela = p_grupo_id
        AND status::text IN ('Pendente','Atrasado')
        AND deleted_at IS NULL
      ORDER BY parcela_numero NULLS LAST
      LIMIT COALESCE(p_quantidade, 9999)
    ) sub;

    IF v_ids IS NULL OR array_length(v_ids,1) = 0 THEN RETURN 0; END IF;

    UPDATE receitas
    SET status = 'Recebido'::status_financeiro,
        data_recebimento = p_data_pagamento,
        observacao = CASE WHEN p_desconto_total > 0
          THEN COALESCE(observacao,'') || E'\n[Quitação antecipada — desconto rateado]'
          ELSE observacao END,
        updated_by = auth.uid(),
        updated_at = now()
    WHERE id = ANY(v_ids);
    GET DIAGNOSTICS v_afetadas = ROW_COUNT;
  ELSE
    SELECT array_agg(id ORDER BY parcela_numero) INTO v_ids
    FROM (
      SELECT id, parcela_numero FROM despesas
      WHERE grupo_parcela = p_grupo_id
        AND status::text IN ('Pendente','Atrasado')
        AND deleted_at IS NULL
      ORDER BY parcela_numero NULLS LAST
      LIMIT COALESCE(p_quantidade, 9999)
    ) sub;

    IF v_ids IS NULL OR array_length(v_ids,1) = 0 THEN RETURN 0; END IF;

    UPDATE despesas
    SET status = 'Pago'::status_financeiro,
        data_pagamento = p_data_pagamento,
        observacao = CASE WHEN p_desconto_total > 0
          THEN COALESCE(observacao,'') || E'\n[Quitação antecipada — desconto rateado]'
          ELSE observacao END,
        updated_by = auth.uid(),
        updated_at = now()
    WHERE id = ANY(v_ids);
    GET DIAGNOSTICS v_afetadas = ROW_COUNT;
  END IF;

  RETURN v_afetadas;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."rpc_grupo_parcela_renegociar"("p_grupo_id" "uuid", "p_novo_total" numeric, "p_novo_num_parcelas" integer, "p_nova_primeira_data" "date", "p_observacao" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_empresa_id uuid;
  v_grupo record;
  v_novo_grupo_id uuid;
BEGIN
  v_empresa_id := public.get_user_empresa_id();

  SELECT * INTO v_grupo
  FROM grupos_parcela WHERE id = p_grupo_id AND empresa_id = v_empresa_id;

  IF v_grupo IS NULL THEN
    RAISE EXCEPTION 'Grupo não encontrado ou acesso negado';
  END IF;

  -- Cancela parcelas em aberto do grupo antigo
  IF v_grupo.tipo_lancamento = 'receita' THEN
    UPDATE receitas
    SET status = 'Cancelado'::status_financeiro,
        observacao = COALESCE(observacao,'') || E'\n[Renegociado em ' || CURRENT_DATE || ']',
        updated_by = auth.uid(),
        updated_at = now()
    WHERE grupo_parcela = p_grupo_id
      AND status::text IN ('Pendente','Atrasado')
      AND deleted_at IS NULL;
  ELSE
    UPDATE despesas
    SET status = 'Cancelado'::status_financeiro,
        observacao = COALESCE(observacao,'') || E'\n[Renegociado em ' || CURRENT_DATE || ']',
        updated_by = auth.uid(),
        updated_at = now()
    WHERE grupo_parcela = p_grupo_id
      AND status::text IN ('Pendente','Atrasado')
      AND deleted_at IS NULL;
  END IF;

  -- Cria novo grupo via rpc_grupo_parcela_criar
  v_novo_grupo_id := public.rpc_grupo_parcela_criar(
    v_grupo.tipo_lancamento,
    v_grupo.descricao || ' (renegociado)',
    p_novo_total,
    p_novo_num_parcelas,
    p_nova_primeira_data,
    v_grupo.periodicidade,
    v_grupo.contraparte_id,
    v_grupo.projeto_id,
    v_grupo.categoria_id,
    v_grupo.centro_custo_id,
    NULL, NULL, NULL,
    p_observacao,
    NULL
  );

  -- Marca link com grupo antigo
  UPDATE grupos_parcela
  SET renegociado_de = p_grupo_id, updated_at = now(), updated_by = auth.uid()
  WHERE id = v_novo_grupo_id;

  RETURN v_novo_grupo_id;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."rpc_lancamento_set_rateio"("p_lancamento_id" "uuid", "p_tipo_lancamento" "text", "p_rateios" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_empresa_id uuid;
  v_valor_total numeric(12,2);
  v_soma numeric(7,2) := 0;
  v_count int := 0;
  r jsonb;
BEGIN
  v_empresa_id := public.get_user_empresa_id();

  IF p_tipo_lancamento NOT IN ('receita','despesa') THEN
    RAISE EXCEPTION 'tipo_lancamento inválido';
  END IF;

  -- Verifica posse do lançamento + pega valor
  IF p_tipo_lancamento = 'receita' THEN
    SELECT valor INTO v_valor_total
    FROM receitas WHERE id = p_lancamento_id AND empresa_id = v_empresa_id AND deleted_at IS NULL;
  ELSE
    SELECT valor INTO v_valor_total
    FROM despesas WHERE id = p_lancamento_id AND empresa_id = v_empresa_id AND deleted_at IS NULL;
  END IF;

  IF v_valor_total IS NULL THEN
    RAISE EXCEPTION 'Lançamento não encontrado';
  END IF;

  -- Valida soma percentuais
  FOR r IN SELECT * FROM jsonb_array_elements(p_rateios) LOOP
    v_soma := v_soma + (r->>'percentual')::numeric;
  END LOOP;

  IF jsonb_array_length(p_rateios) > 0 AND ABS(v_soma - 100) > 0.01 THEN
    RAISE EXCEPTION 'Soma dos percentuais deve ser 100 (atual: %)', v_soma;
  END IF;

  -- Limpa rateio anterior
  DELETE FROM lancamento_rateios
  WHERE lancamento_id = p_lancamento_id
    AND tipo_lancamento = p_tipo_lancamento;

  -- Insere novo rateio
  FOR r IN SELECT * FROM jsonb_array_elements(p_rateios) LOOP
    INSERT INTO lancamento_rateios (
      empresa_id, lancamento_id, tipo_lancamento,
      centro_custo_id, percentual, valor, observacao,
      created_by
    ) VALUES (
      v_empresa_id, p_lancamento_id, p_tipo_lancamento,
      (r->>'centro_custo_id')::uuid,
      (r->>'percentual')::numeric,
      ROUND(v_valor_total * ((r->>'percentual')::numeric / 100), 2),
      r->>'observacao',
      auth.uid()
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."rpc_projeto_rentabilidade"("p_projeto_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  result JSON;
  v_empresa_id UUID;
BEGIN
  v_empresa_id := public.get_user_empresa_id();

  SELECT json_build_object(
    'projeto_id', p.id,
    'projeto_nome', p.nome,
    'valor_contrato', COALESCE(p.valor_contrato, 0),
    'custo_indireto_pct', COALESCE(p.custo_indireto_pct, 15.0),
    'receitas_total', COALESCE((
      SELECT SUM(r.valor) FROM receitas r
      WHERE r.projeto_id = p.id AND r.deleted_at IS NULL AND r.status IN ('Recebido', 'Pendente')
    ), 0),
    'receitas_recebidas', COALESCE((
      SELECT SUM(r.valor) FROM receitas r
      WHERE r.projeto_id = p.id AND r.deleted_at IS NULL AND r.status = 'Recebido'
    ), 0),
    'despesas_diretas', COALESCE((
      SELECT SUM(d.valor) FROM despesas d
      WHERE d.projeto_id = p.id AND d.deleted_at IS NULL AND d.status IN ('Pago', 'Pendente')
    ), 0),
    'horas_orcadas', COALESCE((
      SELECT SUM(o.horas_estimadas) FROM projeto_orcamento_fases o
      WHERE o.projeto_id = p.id AND o.deleted_at IS NULL
    ), 0),
    'horas_consumidas', COALESCE((
      SELECT SUM(t.horas) FROM timesheets t
      WHERE t.projeto_id = p.id AND t.deleted_at IS NULL AND t.status = 'aprovado'
    ), 0),
    'custo_orcado', COALESCE((
      SELECT SUM(o.horas_estimadas * o.custo_hora) FROM projeto_orcamento_fases o
      WHERE o.projeto_id = p.id AND o.deleted_at IS NULL
    ), 0),
    'marcos_total', (
      SELECT COUNT(*) FROM marcos_faturamento m
      WHERE m.projeto_id = p.id AND m.deleted_at IS NULL
    ),
    'marcos_faturados', (
      SELECT COUNT(*) FROM marcos_faturamento m
      WHERE m.projeto_id = p.id AND m.deleted_at IS NULL AND m.status IN ('faturado', 'recebido')
    )
  ) INTO result
  FROM projetos p
  WHERE p.id = p_projeto_id AND p.empresa_id = v_empresa_id AND p.deleted_at IS NULL;

  RETURN result;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."rpc_sync_metas"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_meta RECORD;
  v_valor NUMERIC;
  v_count INTEGER := 0;
  v_empresa_id UUID;
BEGIN
  v_empresa_id := public.get_user_empresa_id();

  FOR v_meta IN
    SELECT * FROM metas
    WHERE empresa_id = v_empresa_id
      AND auto_sync = TRUE
      AND sync_fonte IS NOT NULL
  LOOP
    v_valor := NULL;

    CASE v_meta.sync_fonte
      WHEN 'receita_total' THEN
        SELECT COALESCE(SUM(valor), 0) INTO v_valor
        FROM receitas
        WHERE empresa_id = v_empresa_id
          AND status = 'Recebido'
          AND deleted_at IS NULL
          AND data_vencimento >= date_trunc('year', CURRENT_DATE);

      WHEN 'receita_mes' THEN
        SELECT COALESCE(SUM(valor), 0) INTO v_valor
        FROM receitas
        WHERE empresa_id = v_empresa_id
          AND status = 'Recebido'
          AND deleted_at IS NULL
          AND date_trunc('month', data_vencimento) = date_trunc('month', CURRENT_DATE);

      WHEN 'projetos_concluidos' THEN
        SELECT COUNT(*) INTO v_valor
        FROM projetos
        WHERE empresa_id = v_empresa_id
          AND status = 'Concluído'
          AND deleted_at IS NULL
          AND date_trunc('year', COALESCE(data_final, created_at)) = date_trunc('year', CURRENT_DATE);

      WHEN 'projetos_ativos' THEN
        SELECT COUNT(*) INTO v_valor
        FROM projetos
        WHERE empresa_id = v_empresa_id
          AND status IN ('Planejamento', 'Em andamento')
          AND deleted_at IS NULL;

      WHEN 'margem_media' THEN
        SELECT COALESCE(AVG(
          CASE WHEN r.total > 0 THEN ((r.total - d.total) / r.total) * 100 ELSE 0 END
        ), 0) INTO v_valor
        FROM (
          SELECT projeto_id, COALESCE(SUM(valor), 0) AS total
          FROM receitas WHERE empresa_id = v_empresa_id AND status = 'Recebido' AND deleted_at IS NULL
          GROUP BY projeto_id
        ) r
        JOIN (
          SELECT projeto_id, COALESCE(SUM(valor), 0) AS total
          FROM despesas WHERE empresa_id = v_empresa_id AND status = 'Pago' AND deleted_at IS NULL AND projeto_id IS NOT NULL
          GROUP BY projeto_id
        ) d ON r.projeto_id = d.projeto_id
        WHERE r.total > 0;

      WHEN 'leads_convertidos' THEN
        SELECT COUNT(*) INTO v_valor
        FROM leads
        WHERE empresa_id = v_empresa_id
          AND status = 'Ganho'
          AND deleted_at IS NULL
          AND date_trunc('year', COALESCE(convertido_em, created_at)) = date_trunc('year', CURRENT_DATE);

      WHEN 'horas_faturadas' THEN
        SELECT COALESCE(SUM(horas), 0) INTO v_valor
        FROM timesheets
        WHERE empresa_id = v_empresa_id
          AND status = 'aprovado'
          AND deleted_at IS NULL
          AND date_trunc('year', data) = date_trunc('year', CURRENT_DATE);

      ELSE
        CONTINUE;
    END CASE;

    IF v_valor IS NOT NULL THEN
      UPDATE metas SET atual = v_valor, updated_at = NOW() WHERE id = v_meta.id;
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."soft_delete_generic"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
BEGIN
  EXECUTE format('UPDATE %I.%I SET deleted_at = NOW() WHERE id = $1', TG_TABLE_SCHEMA, TG_TABLE_NAME) USING OLD.id;
  RETURN NULL;
END;
$_$;
CREATE OR REPLACE FUNCTION "public"."start_impersonation"("p_target_role" "text", "p_ip" "text" DEFAULT NULL::"text", "p_user_agent" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_role TEXT;
  v_session_id UUID;
BEGIN
  SELECT role::TEXT INTO v_role FROM public.profiles WHERE id = auth.uid();

  IF v_role IS NULL OR v_role NOT IN ('admin', 'ultra_admin') THEN
    RAISE EXCEPTION 'Apenas admin ou ultra_admin podem impersonar' USING ERRCODE = '42501';
  END IF;

  IF p_target_role IN ('admin', 'ultra_admin') THEN
    RAISE EXCEPTION 'Impersonation de admin/ultra_admin não permitido' USING ERRCODE = '42501';
  END IF;

  IF p_target_role NOT IN ('user') THEN
    RAISE EXCEPTION 'target_role inválido: %', p_target_role USING ERRCODE = '22023';
  END IF;

  UPDATE public.impersonation_sessions
  SET ended_at = NOW()
  WHERE admin_id = auth.uid()
    AND ended_at IS NULL;

  INSERT INTO public.impersonation_sessions (admin_id, admin_role, target_role, ip_address, user_agent)
  VALUES (auth.uid(), v_role, p_target_role, p_ip, p_user_agent)
  RETURNING id INTO v_session_id;

  RETURN v_session_id;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."stop_impersonation"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.impersonation_sessions
  SET ended_at = NOW()
  WHERE admin_id = auth.uid()
    AND ended_at IS NULL;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."tg_audit_company_features"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_actor UUID := COALESCE(auth.uid(), NEW.updated_by, OLD.updated_by);
  v_email TEXT;
BEGIN
  SELECT email INTO v_email FROM public.profiles WHERE id = v_actor;

  IF OLD.features IS DISTINCT FROM NEW.features THEN
    PERFORM public.insert_audit_log(
      'company_features_change', 'empresas', OLD.id,
      jsonb_build_object('features', jsonb_build_object('old', OLD.features, 'new', NEW.features)),
      v_actor, v_email,
      jsonb_build_object('empresa_id', OLD.id)
    );
  END IF;

  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."tg_audit_profile_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_empresa_id UUID := COALESCE(NEW.empresa_id, OLD.empresa_id);
  v_actor      UUID := COALESCE(auth.uid(), NEW.updated_by, OLD.updated_by);
  v_email      TEXT;
BEGIN
  SELECT email INTO v_email FROM public.profiles WHERE id = v_actor;

  IF OLD.role IS DISTINCT FROM NEW.role THEN
    PERFORM public.insert_audit_log(
      'role_change', 'profiles', OLD.id,
      jsonb_build_object('role', jsonb_build_object('old', OLD.role, 'new', NEW.role)),
      v_actor, v_email,
      jsonb_build_object('empresa_id', v_empresa_id, 'target_email', OLD.email)
    );
  END IF;

  IF OLD.features IS DISTINCT FROM NEW.features THEN
    PERFORM public.insert_audit_log(
      'features_change', 'profiles', OLD.id,
      jsonb_build_object('features', jsonb_build_object('old', OLD.features, 'new', NEW.features)),
      v_actor, v_email,
      jsonb_build_object('empresa_id', v_empresa_id, 'target_email', OLD.email)
    );
  END IF;

  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."tg_cascade_feature_revocation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  feat_key TEXT;
  is_enabled BOOLEAN;
BEGIN
  -- Para cada feature que mudou de true → false/null, revogar dos usuários
  FOR feat_key IN SELECT jsonb_object_keys(OLD.features)
  LOOP
    is_enabled := (NEW.features ->> feat_key)::boolean;

    IF is_enabled IS NOT TRUE AND (OLD.features ->> feat_key)::boolean IS TRUE THEN
      UPDATE public.profiles
      SET features = features - feat_key
      WHERE empresa_id = NEW.id
        AND features ? feat_key;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."tg_feature_flags_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."tg_pilar_link_subscription_on_owner_used"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_signup RECORD;
  v_empresa_id UUID;
  v_period_end TIMESTAMPTZ;
BEGIN
  IF NEW.usado_em IS NULL OR OLD.usado_em IS NOT NULL THEN RETURN NEW; END IF;
  SELECT * INTO v_signup FROM public.pilar_pending_signups
  WHERE empresa_owner_pending_id = NEW.id AND payment_status = 'paid' AND activated_at IS NULL LIMIT 1;
  IF v_signup.id IS NULL THEN RETURN NEW; END IF;
  SELECT id INTO v_empresa_id FROM public.empresas
  WHERE owner_id = (SELECT id FROM auth.users WHERE lower(email) = lower(NEW.email) LIMIT 1)
  ORDER BY created_at DESC LIMIT 1;
  IF v_empresa_id IS NULL THEN RETURN NEW; END IF;
  v_period_end := CASE WHEN v_signup.billing_cycle = 'yearly' THEN NOW() + INTERVAL '1 year' ELSE NOW() + INTERVAL '1 month' END;
  INSERT INTO public.pilar_subscriptions (
    empresa_id, plan_id, status, billing_cycle, billing_type,
    asaas_customer_id, asaas_subscription_id,
    current_period_start, current_period_end, pending_signup_id
  ) VALUES (
    v_empresa_id, v_signup.plan_id, 'active', v_signup.billing_cycle, v_signup.billing_type,
    v_signup.asaas_customer_id, v_signup.asaas_subscription_id,
    COALESCE(v_signup.paid_at, NOW()), v_period_end, v_signup.id
  ) ON CONFLICT (empresa_id) DO NOTHING;
  UPDATE public.pilar_pending_signups SET activated_at = NOW() WHERE id = v_signup.id;
  RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION "public"."tg_pilar_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION "public"."tg_protect_ultra_admin"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Bypass: conexão direta (postgres/supabase_admin) OU service_role via JWT
  IF current_user IN ('postgres', 'supabase_admin')
     OR current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Não pode promover ninguém a ultra_admin via SQL de usuário comum
  IF (TG_OP = 'INSERT' AND NEW.role = 'ultra_admin')
     OR (TG_OP = 'UPDATE' AND NEW.role = 'ultra_admin' AND OLD.role <> 'ultra_admin') THEN
    RAISE EXCEPTION 'Promoção a ultra_admin requer SQL com service_role';
  END IF;

  -- Não pode rebaixar um ultra_admin
  IF TG_OP = 'UPDATE' AND OLD.role = 'ultra_admin' AND NEW.role <> 'ultra_admin' THEN
    RAISE EXCEPTION 'Rebaixamento de ultra_admin requer SQL com service_role';
  END IF;

  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."tg_validate_convite_features"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.cargo = 'admin' THEN
    NEW.features := '{}'::jsonb;
    RETURN NEW;
  END IF;

  PERFORM public._validate_features_payload(NEW.features, NEW.empresa_id);
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."tg_validate_convite_features_subset"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  company_features JSONB;
  feat_key TEXT;
BEGIN
  IF NEW.features IS NULL OR NEW.features = '{}'::jsonb THEN
    RETURN NEW;
  END IF;

  IF NEW.empresa_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT features INTO company_features
  FROM public.empresas
  WHERE id = NEW.empresa_id;

  FOR feat_key IN SELECT jsonb_object_keys(NEW.features)
  LOOP
    IF feat_key = 'dashboard' THEN
      CONTINUE;
    END IF;

    IF (company_features ->> feat_key)::boolean IS NOT TRUE THEN
      RAISE EXCEPTION
        'Feature "%" não está habilitada para esta empresa', feat_key
        USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."tg_validate_features_subset"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  company_features JSONB;
  feat_key TEXT;
BEGIN
  -- Só valida se profiles.features mudou e há empresa
  IF NEW.features IS NULL OR NEW.features = '{}'::jsonb THEN
    RETURN NEW;
  END IF;

  IF NEW.empresa_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT features INTO company_features
  FROM public.empresas
  WHERE id = NEW.empresa_id;

  -- Para cada feature em profiles.features, verificar se está ativa na empresa
  FOR feat_key IN SELECT jsonb_object_keys(NEW.features)
  LOOP
    -- Features core (dashboard) sempre permitidas
    IF feat_key = 'dashboard' THEN
      CONTINUE;
    END IF;

    IF (company_features ->> feat_key)::boolean IS NOT TRUE THEN
      RAISE EXCEPTION
        'Feature "%" não está habilitada para esta empresa', feat_key
        USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."tg_validate_profile_features"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Ultra_admin não precisa de features (bypass total). Mantém vazio.
  IF NEW.role = 'ultra_admin' THEN
    NEW.features := '{}'::jsonb;
    RETURN NEW;
  END IF;

  -- Admin e user: features são validadas contra o plano da empresa.
  PERFORM public._validate_features_payload(NEW.features, NEW.empresa_id);
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."tr_alocar_despesa_fatura"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_fatura_id uuid;
  v_data_ref date;
BEGIN
  -- Pula pagamentos de fatura (não devem ir para outra fatura)
  IF COALESCE(NEW.is_fatura_payment, false) THEN
    RETURN NEW;
  END IF;

  -- Só age quando cartao_id presente e fatura_id ainda vazio
  IF NEW.cartao_id IS NULL OR NEW.fatura_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Usa data_competencia (data da compra) se houver, senão data_vencimento, senão hoje
  v_data_ref := COALESCE(NEW.data_competencia, NEW.data_vencimento, CURRENT_DATE);

  v_fatura_id := public.find_or_create_fatura(NEW.cartao_id, v_data_ref);

  IF v_fatura_id IS NOT NULL THEN
    NEW.fatura_id := v_fatura_id;
  END IF;

  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."tr_recalc_fatura_total"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_fatura_id uuid;
  v_total numeric(12,2);
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_fatura_id := OLD.fatura_id;
  ELSE
    v_fatura_id := NEW.fatura_id;
    -- Se mudou de fatura, recalcula a antiga também
    IF TG_OP = 'UPDATE' AND OLD.fatura_id IS DISTINCT FROM NEW.fatura_id
       AND OLD.fatura_id IS NOT NULL THEN
      SELECT COALESCE(SUM(valor), 0) INTO v_total
      FROM despesas
      WHERE fatura_id = OLD.fatura_id
        AND cartao_id IS NOT NULL
        AND COALESCE(is_fatura_payment, false) = false
        AND deleted_at IS NULL;
      UPDATE faturas SET valor_total = v_total WHERE id = OLD.fatura_id;
    END IF;
  END IF;

  IF v_fatura_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  SELECT COALESCE(SUM(valor), 0) INTO v_total
  FROM despesas
  WHERE fatura_id = v_fatura_id
    AND cartao_id IS NOT NULL
    AND COALESCE(is_fatura_payment, false) = false
    AND deleted_at IS NULL;

  UPDATE faturas SET valor_total = v_total WHERE id = v_fatura_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;
CREATE OR REPLACE FUNCTION "public"."tr_recalc_grupo_parcela"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.grupo_parcela IS NOT NULL THEN
      PERFORM recalc_grupo_parcela_status(OLD.grupo_parcela);
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.grupo_parcela IS NOT NULL THEN
    PERFORM recalc_grupo_parcela_status(NEW.grupo_parcela);
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.grupo_parcela IS DISTINCT FROM NEW.grupo_parcela
     AND OLD.grupo_parcela IS NOT NULL THEN
    PERFORM recalc_grupo_parcela_status(OLD.grupo_parcela);
  END IF;

  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."update_company_features"("p_features" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_empresa_id UUID;
  v_key TEXT;
  v_value TEXT;
  v_catalog TEXT[] := public._feature_catalog();
  v_clean JSONB := '{}'::jsonb;
BEGIN
  v_empresa_id := public.get_user_empresa_id();

  IF NOT (public.has_role('admin') OR public.is_ultra_admin()) THEN
    RAISE EXCEPTION 'Apenas administradores podem editar features da empresa';
  END IF;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa';
  END IF;

  IF jsonb_typeof(p_features) <> 'object' THEN
    RAISE EXCEPTION 'features deve ser um objeto JSON';
  END IF;

  -- Sanitiza payload: só chaves do catálogo, valores boolean
  FOR v_key, v_value IN SELECT * FROM jsonb_each_text(p_features)
  LOOP
    IF NOT (v_key = ANY (v_catalog)) THEN
      CONTINUE;  -- ignora chaves desconhecidas
    END IF;
    IF v_value NOT IN ('true', 'false') THEN
      RAISE EXCEPTION 'Valor inválido para %: % (use boolean)', v_key, v_value;
    END IF;
    v_clean := v_clean || jsonb_build_object(v_key, (v_value = 'true'));
  END LOOP;

  UPDATE public.empresas
  SET features = v_clean,
      updated_at = NOW(),
      updated_by = auth.uid()
  WHERE id = v_empresa_id;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."update_projeto_completo"("p_projeto_id" "uuid", "p_codigo" "text", "p_nome" "text", "p_cliente_id" "uuid", "p_data_inicio" "date", "p_data_previsao" "date", "p_data_final" "date", "p_valor_contrato" numeric, "p_observacao" "text", "p_localizacao" "text", "p_parcelas" "text", "p_area_m2" numeric, "p_disciplinas" "jsonb", "p_status" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_empresa_id UUID;
BEGIN
  -- Get empresa_id from current user
  v_empresa_id := public.get_user_empresa_id();
  
  -- Update Projeto
  UPDATE public.projetos
  SET 
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
    disciplinas = COALESCE(p_disciplinas, '[]'::jsonb),
    status = p_status::status_projeto,
    updated_at = NOW()
  WHERE id = p_projeto_id 
    AND empresa_id = v_empresa_id;

  RETURN FOUND;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."update_projeto_completo"("p_projeto_id" "uuid", "p_codigo" "text", "p_nome" "text", "p_cliente_id" "uuid", "p_data_inicio" "date" DEFAULT NULL::"date", "p_data_previsao" "date" DEFAULT NULL::"date", "p_data_final" "date" DEFAULT NULL::"date", "p_valor_contrato" numeric DEFAULT 0, "p_observacao" "text" DEFAULT ''::"text", "p_localizacao" "text" DEFAULT ''::"text", "p_parcelas" "text" DEFAULT NULL::"text", "p_area_m2" numeric DEFAULT 0, "p_disciplinas" "jsonb" DEFAULT '[]'::"jsonb", "p_status" "text" DEFAULT 'Planejamento'::"text", "p_prioridade" "text" DEFAULT 'Media'::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

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
CREATE OR REPLACE FUNCTION "public"."update_user_access"("p_user_id" "uuid", "p_role" "text", "p_features" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_caller_empresa UUID;
  v_target_empresa UUID;
  v_target_role public.user_role;
  v_new_role public.user_role;
BEGIN
  v_caller_empresa := public.get_user_empresa_id();

  IF NOT (public.has_role('admin') OR public.is_ultra_admin()) THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar acessos';
  END IF;

  SELECT empresa_id, role INTO v_target_empresa, v_target_role
  FROM public.profiles WHERE id = p_user_id;

  IF v_target_empresa IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;

  -- Admin de empresa só pode editar membros da própria empresa
  IF NOT public.is_ultra_admin() AND v_target_empresa <> v_caller_empresa THEN
    RAISE EXCEPTION 'Sem permissão para editar usuário de outra empresa';
  END IF;

  IF v_target_role = 'ultra_admin' THEN
    RAISE EXCEPTION 'Ultra admin só pode ser editado via SQL direto';
  END IF;

  BEGIN
    v_new_role := p_role::public.user_role;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Role inválido: %', p_role;
  END;

  IF v_new_role = 'ultra_admin' THEN
    RAISE EXCEPTION 'Promoção a ultra_admin requer SQL direto';
  END IF;

  IF v_new_role IN ('financeiro', 'marketing', 'operacional') THEN
    v_new_role := 'user';
  END IF;

  -- Trigger validate_profile_features valida features ao escrever
  UPDATE public.profiles
  SET role = v_new_role,
      features = CASE WHEN v_new_role = 'admin' THEN '{}'::jsonb ELSE COALESCE(p_features, '{}'::jsonb) END,
      updated_at = NOW(),
      updated_by = auth.uid()
  WHERE id = p_user_id;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."user_has_feature"("p_feature" "text", "p_min_level" "text" DEFAULT 'viewer'::"text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_role public.user_role;
  v_empresa_features JSONB;
  v_profile_features JSONB;
  v_user_level TEXT;
BEGIN
  IF p_min_level NOT IN ('viewer', 'editor') THEN
    RAISE EXCEPTION 'p_min_level deve ser "viewer" ou "editor"';
  END IF;

  IF NOT (p_feature = ANY (public._feature_catalog())) THEN
    RETURN FALSE;
  END IF;

  SELECT p.role, e.features, p.features
  INTO v_role, v_empresa_features, v_profile_features
  FROM public.profiles p
  LEFT JOIN public.empresas e ON e.id = p.empresa_id
  WHERE p.id = auth.uid();

  IF v_role IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Ultra admin: bypass total (cross-empresa, plataforma)
  IF v_role = 'ultra_admin' THEN
    RETURN TRUE;
  END IF;

  -- Empresa precisa ter feature ativa (exceto core 'dashboard' que é universal)
  IF p_feature <> 'dashboard'
     AND COALESCE((v_empresa_features ->> p_feature)::BOOLEAN, FALSE) = FALSE THEN
    RETURN FALSE;
  END IF;

  -- Admin e user seguem mesma regra granular: precisam ter level explícito no profile.
  -- (Diferença admin↔user é exclusiva pra operações administrativas — convites,
  -- billing, audit — que checam role diretamente, não user_has_feature.)
  v_user_level := v_profile_features ->> p_feature;

  IF v_user_level IS NULL THEN
    RETURN FALSE;
  END IF;

  -- viewer: passa em viewer/editor required ; editor: só passa em editor required
  IF p_min_level = 'viewer' THEN
    RETURN v_user_level IN ('viewer', 'editor');
  ELSE -- 'editor'
    RETURN v_user_level = 'editor';
  END IF;
END;
$$;
