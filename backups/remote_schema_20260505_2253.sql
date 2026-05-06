


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."status_empresa" AS ENUM (
    'active',
    'suspended',
    'cancelled'
);


ALTER TYPE "public"."status_empresa" OWNER TO "postgres";


CREATE TYPE "public"."status_financeiro" AS ENUM (
    'Pendente',
    'Pago',
    'Recebido',
    'Atrasado',
    'Cancelado'
);


ALTER TYPE "public"."status_financeiro" OWNER TO "postgres";


CREATE TYPE "public"."status_projeto" AS ENUM (
    'Planejamento',
    'Execução',
    'Paralisado',
    'Concluído',
    'Cancelado',
    'Em andamento',
    'Revisão'
);


ALTER TYPE "public"."status_projeto" OWNER TO "postgres";


CREATE TYPE "public"."tipo_categoria" AS ENUM (
    'Receita',
    'Despesa'
);


ALTER TYPE "public"."tipo_categoria" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'admin',
    'financeiro',
    'marketing',
    'operacional',
    'user',
    'ultra_admin'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


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


ALTER FUNCTION "public"."_feature_catalog"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_portal_create_account"("p_cliente_id" "uuid", "p_empresa_id" "uuid", "p_nome" "text", "p_email" "text", "p_senha" "text", "p_created_by" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
BEGIN
  INSERT INTO cliente_portal_accounts (cliente_id, empresa_id, nome, email, senha_hash, created_by)
  VALUES (p_cliente_id, p_empresa_id, p_nome, p_email, crypt(p_senha, gen_salt('bf')), p_created_by);
END;
$$;


ALTER FUNCTION "public"."_portal_create_account"("p_cliente_id" "uuid", "p_empresa_id" "uuid", "p_nome" "text", "p_email" "text", "p_senha" "text", "p_created_by" "uuid") OWNER TO "postgres";


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


ALTER FUNCTION "public"."_portal_reset_password"("p_account_id" "uuid", "p_nova_senha" "text") OWNER TO "postgres";


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


ALTER FUNCTION "public"."_validate_features_payload"("p_features" "jsonb", "p_empresa_id" "uuid") OWNER TO "postgres";


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


ALTER FUNCTION "public"."aditivo_aprovado_handler"() OWNER TO "postgres";


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


ALTER FUNCTION "public"."admin_create_company_owner"("p_email" "text", "p_nome" "text", "p_company_name" "text") OWNER TO "postgres";


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


ALTER FUNCTION "public"."auto_complete_disciplinas"() OWNER TO "postgres";


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


ALTER FUNCTION "public"."auto_gerar_receita_from_marco"() OWNER TO "postgres";


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


ALTER FUNCTION "public"."calculate_status_data"() OWNER TO "postgres";


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


ALTER FUNCTION "public"."create_convite"("p_email" "text", "p_cargo" "text", "p_nome" "text", "p_features" "jsonb") OWNER TO "postgres";


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


ALTER FUNCTION "public"."create_projeto_completo"("p_codigo" "text", "p_nome" "text", "p_cliente_id" "uuid", "p_data_inicio" "date", "p_data_previsao" "date", "p_data_final" "date", "p_valor_contrato" numeric, "p_observacao" "text", "p_localizacao" "text", "p_parcelas" "text", "p_responsaveis" "jsonb") OWNER TO "postgres";


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


ALTER FUNCTION "public"."create_projeto_completo"("p_codigo" "text", "p_nome" "text", "p_cliente_id" "uuid", "p_data_inicio" "date", "p_data_previsao" "date", "p_data_final" "date", "p_valor_contrato" numeric, "p_observacao" "text", "p_localizacao" "text", "p_parcelas" "text", "p_area_m2" numeric, "p_disciplinas" "jsonb") OWNER TO "postgres";


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


ALTER FUNCTION "public"."create_projeto_completo"("p_codigo" "text", "p_nome" "text", "p_cliente_id" "uuid", "p_data_inicio" "date", "p_data_previsao" "date", "p_data_final" "date", "p_valor_contrato" numeric, "p_observacao" "text", "p_localizacao" "text", "p_parcelas" "text", "p_area_m2" numeric, "p_disciplinas" "jsonb", "p_prioridade" "text") OWNER TO "postgres";


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


ALTER FUNCTION "public"."enforce_despesa_data_pagamento"() OWNER TO "postgres";


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


ALTER FUNCTION "public"."enforce_receita_data_recebimento"() OWNER TO "postgres";


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


ALTER FUNCTION "public"."gerar_fatura"("p_cartao_id" "uuid", "p_mes" integer, "p_ano" integer) OWNER TO "postgres";


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


ALTER FUNCTION "public"."get_cliente_projeto_detail"("p_projeto_id" "uuid") OWNER TO "postgres";


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


ALTER FUNCTION "public"."get_cliente_projeto_detail"("p_projeto_id" "uuid", "p_token" "text") OWNER TO "postgres";


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


ALTER FUNCTION "public"."get_cliente_projetos"() OWNER TO "postgres";


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


ALTER FUNCTION "public"."get_cliente_projetos"("p_token" "text") OWNER TO "postgres";


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


ALTER FUNCTION "public"."get_folha_preview"("p_mes" integer, "p_ano" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_empresa_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT empresa_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;


ALTER FUNCTION "public"."get_user_empresa_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_empresa_id_text"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT empresa_id::text FROM profiles WHERE id = auth.uid();
$$;


ALTER FUNCTION "public"."get_user_empresa_id_text"() OWNER TO "postgres";


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


ALTER FUNCTION "public"."handle_escopo_aprovado"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_convite RECORD;
  v_owner_pending RECORD;
  v_empresa_id UUID;
  v_token TEXT;
BEGIN
  v_token := NEW.raw_user_meta_data->>'invite_token';

  IF v_token IS NOT NULL THEN
    -- CENÁRIO 1: FUNCIONÁRIO CONVIDADO
    SELECT id, empresa_id, email, cargo, nome, features
    INTO v_convite
    FROM public.convites
    WHERE token = v_token
      AND email = lower(NEW.email)
      AND usado_em IS NULL
      AND expira_em > NOW();

    IF v_convite.id IS NOT NULL THEN
      INSERT INTO public.profiles (id, empresa_id, nome, email, role, features, onboarding_completed)
      VALUES (
        NEW.id,
        v_convite.empresa_id,
        COALESCE(v_convite.nome, NEW.email),
        NEW.email,
        v_convite.cargo,
        COALESCE(v_convite.features, '{}'::jsonb),
        FALSE
      );

      UPDATE public.convites SET usado_em = NOW() WHERE id = v_convite.id;
      RETURN NEW;
    END IF;

    -- CENÁRIO 2: NOVO DONO DE EMPRESA
    SELECT id, email, company_name, nome
    INTO v_owner_pending
    FROM public.empresa_owners_pending
    WHERE token = v_token
      AND email = lower(NEW.email)
      AND usado_em IS NULL
      AND expira_em > NOW();

    IF v_owner_pending.id IS NOT NULL THEN
      INSERT INTO public.empresas (owner_id, nome, features, onboarding_completed)
      VALUES (
        NEW.id,
        v_owner_pending.company_name,
        jsonb_build_object(
          'dashboard', true, 'relatorios', true, 'leads', true,
          'propostas', true, 'clientes', true, 'projetos', true,
          'planejamento', true, 'timesheet', true, 'mapa', true,
          'financeiro', true, 'pessoas', true, 'metas', true,
          'portal_cliente', true,
          'ai_hub', false, 'capacidade', false, 'templates', false
        ),
        FALSE
      )
      RETURNING id INTO v_empresa_id;

      INSERT INTO public.profiles (id, empresa_id, nome, email, role, features, onboarding_completed)
      VALUES (
        NEW.id,
        v_empresa_id,
        COALESCE(v_owner_pending.nome, NEW.email),
        NEW.email,
        'admin',
        '{}'::jsonb,
        FALSE
      );

      UPDATE public.empresa_owners_pending SET usado_em = NOW() WHERE id = v_owner_pending.id;
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Token de convite inválido ou expirado';
  END IF;

  RAISE EXCEPTION 'Cadastro não autorizado. Entre em contato com a equipe comercial.';
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


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


ALTER FUNCTION "public"."handle_orcamento_versao"() OWNER TO "postgres";


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


ALTER FUNCTION "public"."handle_record_audit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"(VARIADIC "allowed_roles" "public"."user_role"[]) RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_role public.user_role;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  -- ultra_admin tem bypass total: passa em qualquer verificação de role
  RETURN v_role = 'ultra_admin' OR v_role = ANY(allowed_roles);
END;
$$;


ALTER FUNCTION "public"."has_role"(VARIADIC "allowed_roles" "public"."user_role"[]) OWNER TO "postgres";


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


ALTER FUNCTION "public"."insert_audit_log"("p_action" "text", "p_target_table" "text", "p_target_id" "uuid", "p_diff" "jsonb", "p_actor_id" "uuid", "p_actor_email" "text", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_company_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(
    (
      SELECT
        role = 'admin'
        OR (role = 'ultra_admin' AND public.is_ultra_admin_scoped())
      FROM public.profiles
      WHERE id = auth.uid()
    ),
    FALSE
  );
$$;


ALTER FUNCTION "public"."is_company_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_ultra_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(
    (SELECT role = 'ultra_admin' FROM public.profiles WHERE id = auth.uid()),
    FALSE
  ) AND NOT public.is_ultra_admin_scoped();
$$;


ALTER FUNCTION "public"."is_ultra_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_ultra_admin_scoped"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(
    (SELECT scoped FROM public.ultra_admin_modes WHERE user_id = auth.uid()),
    FALSE
  );
$$;


ALTER FUNCTION "public"."is_ultra_admin_scoped"() OWNER TO "postgres";


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


ALTER FUNCTION "public"."link_pessoa_profile_before"() OWNER TO "postgres";


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


ALTER FUNCTION "public"."link_profile_pessoa_after"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pagar_fatura"("p_fatura_id" "uuid", "p_conta_id" "uuid", "p_valor_pago" numeric DEFAULT NULL::numeric, "p_data_pagamento" "date" DEFAULT CURRENT_DATE) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_fatura RECORD;
  v_valor_a_pagar DECIMAL(12,2);
BEGIN
  -- Lock e buscar fatura
  SELECT f.*, cc.nome as cartao_nome
  INTO v_fatura
  FROM faturas f
  JOIN cartoes_credito cc ON f.cartao_id = cc.id
  WHERE f.id = p_fatura_id
    AND f.deleted_at IS NULL
  FOR UPDATE;

  IF v_fatura IS NULL THEN
    RAISE EXCEPTION 'Fatura não encontrada';
  END IF;

  IF v_fatura.empresa_id != public.get_user_empresa_id() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF v_fatura.status = 'Paga' THEN
    RAISE EXCEPTION 'Fatura já está paga';
  END IF;

  -- Calcular valor a pagar
  v_valor_a_pagar := COALESCE(p_valor_pago, v_fatura.valor_total - v_fatura.valor_pago);

  IF v_valor_a_pagar <= 0 THEN
    RAISE EXCEPTION 'Valor de pagamento inválido';
  END IF;

  -- 1. Atualizar fatura
  UPDATE faturas SET
    valor_pago = valor_pago + v_valor_a_pagar,
    conta_pagamento_id = p_conta_id,
    data_pagamento = p_data_pagamento,
    status = CASE
      WHEN (valor_pago + v_valor_a_pagar) >= valor_total THEN 'Paga'
      ELSE 'Parcial'
    END
  WHERE id = p_fatura_id;

  -- 2. Se totalmente paga, marcar despesas do cartão como Pago
  IF (v_fatura.valor_pago + v_valor_a_pagar) >= v_fatura.valor_total THEN
    UPDATE despesas SET
      status = 'Pago',
      data_pagamento = p_data_pagamento
    WHERE fatura_id = p_fatura_id
      AND cartao_id IS NOT NULL
      AND deleted_at IS NULL
      AND status = 'Pendente';
  END IF;

  -- 3. Criar débito na conta bancária (marcado como pagamento de fatura)
  INSERT INTO despesas (
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


ALTER FUNCTION "public"."pagar_fatura"("p_fatura_id" "uuid", "p_conta_id" "uuid", "p_valor_pago" numeric, "p_data_pagamento" "date") OWNER TO "postgres";


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


ALTER FUNCTION "public"."pilar_set_ultra_admin_scope"("p_scoped" boolean) OWNER TO "postgres";


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


ALTER FUNCTION "public"."portal_login"("p_email" "text", "p_senha" "text") OWNER TO "postgres";


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


ALTER FUNCTION "public"."portal_verify_session"("p_token" "text") OWNER TO "postgres";


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


ALTER FUNCTION "public"."prevent_company_change"() OWNER TO "postgres";


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


ALTER FUNCTION "public"."rpc_atualizar_status_atrasados"() OWNER TO "postgres";


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


ALTER FUNCTION "public"."rpc_calcular_wip"("p_mes" integer, "p_ano" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_converter_lead_cliente"("p_lead_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."rpc_converter_lead_cliente"("p_lead_id" "uuid") OWNER TO "postgres";


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


ALTER FUNCTION "public"."rpc_converter_proposta_projeto"("p_proposta_id" "uuid") OWNER TO "postgres";


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


ALTER FUNCTION "public"."rpc_daily_maintenance"() OWNER TO "postgres";


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


ALTER FUNCTION "public"."rpc_dashboard_rentabilidade"() OWNER TO "postgres";


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


ALTER FUNCTION "public"."rpc_faturar_marco"("p_marco_id" "uuid") OWNER TO "postgres";


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


ALTER FUNCTION "public"."rpc_gerar_alertas"() OWNER TO "postgres";


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


ALTER FUNCTION "public"."rpc_gerar_alertas"("p_empresa_id" "uuid") OWNER TO "postgres";


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


ALTER FUNCTION "public"."rpc_gerar_despesas_recorrentes"() OWNER TO "postgres";


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


ALTER FUNCTION "public"."rpc_gerar_parcelas_projeto"("p_projeto_id" "uuid", "p_num_parcelas" integer, "p_intervalo_dias" integer) OWNER TO "postgres";


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


ALTER FUNCTION "public"."rpc_projeto_rentabilidade"("p_projeto_id" "uuid") OWNER TO "postgres";


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


ALTER FUNCTION "public"."rpc_sync_metas"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."soft_delete_generic"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
BEGIN
  EXECUTE format('UPDATE %I.%I SET deleted_at = NOW() WHERE id = $1', TG_TABLE_SCHEMA, TG_TABLE_NAME) USING OLD.id;
  RETURN NULL;
END;
$_$;


ALTER FUNCTION "public"."soft_delete_generic"() OWNER TO "postgres";


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


ALTER FUNCTION "public"."tg_audit_company_features"() OWNER TO "postgres";


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


ALTER FUNCTION "public"."tg_audit_profile_changes"() OWNER TO "postgres";


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


ALTER FUNCTION "public"."tg_pilar_link_subscription_on_owner_used"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tg_pilar_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;


ALTER FUNCTION "public"."tg_pilar_touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tg_protect_ultra_admin"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Service role e postgres bypassam (SQL direto)
  IF current_setting('role', true) IN ('service_role', 'postgres') THEN
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


ALTER FUNCTION "public"."tg_protect_ultra_admin"() OWNER TO "postgres";


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


ALTER FUNCTION "public"."tg_validate_convite_features"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tg_validate_profile_features"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Admin/ultra_admin não usam features (sempre vazio)
  IF NEW.role IN ('admin', 'ultra_admin') THEN
    NEW.features := '{}'::jsonb;
    RETURN NEW;
  END IF;

  PERFORM public._validate_features_payload(NEW.features, NEW.empresa_id);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."tg_validate_profile_features"() OWNER TO "postgres";


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


ALTER FUNCTION "public"."update_company_features"("p_features" "jsonb") OWNER TO "postgres";


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


ALTER FUNCTION "public"."update_projeto_completo"("p_projeto_id" "uuid", "p_codigo" "text", "p_nome" "text", "p_cliente_id" "uuid", "p_data_inicio" "date", "p_data_previsao" "date", "p_data_final" "date", "p_valor_contrato" numeric, "p_observacao" "text", "p_localizacao" "text", "p_parcelas" "text", "p_area_m2" numeric, "p_disciplinas" "jsonb", "p_status" "text") OWNER TO "postgres";


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


ALTER FUNCTION "public"."update_projeto_completo"("p_projeto_id" "uuid", "p_codigo" "text", "p_nome" "text", "p_cliente_id" "uuid", "p_data_inicio" "date", "p_data_previsao" "date", "p_data_final" "date", "p_valor_contrato" numeric, "p_observacao" "text", "p_localizacao" "text", "p_parcelas" "text", "p_area_m2" numeric, "p_disciplinas" "jsonb", "p_status" "text", "p_prioridade" "text") OWNER TO "postgres";


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


ALTER FUNCTION "public"."update_user_access"("p_user_id" "uuid", "p_role" "text", "p_features" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_has_feature"("p_feature" "text", "p_min_level" "text" DEFAULT 'viewer'::"text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_role public.user_role;
  v_empresa_features JSONB;
  v_profile_features JSONB;
  v_user_level TEXT;
  v_scoped BOOLEAN;
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

  v_scoped := public.is_ultra_admin_scoped();

  -- Ultra admin bypass total — apenas se NÃO scoped
  IF v_role = 'ultra_admin' AND NOT v_scoped THEN
    RETURN TRUE;
  END IF;

  -- Empresa precisa ter feature ativa (exceto core 'dashboard')
  IF p_feature <> 'dashboard'
     AND COALESCE((v_empresa_features ->> p_feature)::BOOLEAN, FALSE) = FALSE THEN
    RETURN FALSE;
  END IF;

  -- Admin (ou ultra_admin scoped) bypassa nível granular
  IF v_role = 'admin' OR (v_role = 'ultra_admin' AND v_scoped) THEN
    RETURN TRUE;
  END IF;

  -- User: precisa ter level explícito
  v_user_level := v_profile_features ->> p_feature;
  IF v_user_level IS NULL THEN
    IF p_feature = 'dashboard' AND p_min_level = 'viewer' THEN
      RETURN TRUE;
    END IF;
    RETURN FALSE;
  END IF;

  IF p_min_level = 'viewer' THEN
    RETURN v_user_level IN ('viewer', 'editor');
  END IF;

  RETURN v_user_level = 'editor';
END;
$$;


ALTER FUNCTION "public"."user_has_feature"("p_feature" "text", "p_min_level" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_portal_token"("p_token" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'projeto_id', pt.projeto_id,
    'cliente_id', pt.cliente_id,
    'empresa_id', pt.empresa_id,
    'projeto_nome', p.nome,
    'projeto_status', p.status,
    'projeto_codigo', p.codigo_projeto,
    'cliente_nome', c.nome,
    'empresa_nome', e.nome
  ) INTO result
  FROM portal_tokens pt
  JOIN projetos p ON p.id = pt.projeto_id
  JOIN clientes c ON c.id = pt.cliente_id
  JOIN empresas e ON e.id = pt.empresa_id
  WHERE pt.token = p_token
    AND pt.ativo = true
    AND (pt.expira_em IS NULL OR pt.expira_em > NOW());

  IF result IS NULL THEN
    RAISE EXCEPTION 'Token inválido ou expirado';
  END IF;

  -- Atualiza último acesso
  UPDATE portal_tokens SET ultimo_acesso = NOW() WHERE token = p_token;

  RETURN result;
END;
$$;


ALTER FUNCTION "public"."verify_portal_token"("p_token" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."ai_insights" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "tipo" "text" NOT NULL,
    "referencia_id" "uuid",
    "referencia_tipo" "text",
    "conteudo" "jsonb" NOT NULL,
    "resumo" "text",
    "status" "text" DEFAULT 'ativo'::"text",
    "mes_referencia" integer,
    "ano_referencia" integer,
    "modelo_ia" "text",
    "tokens_entrada" integer,
    "tokens_saida" integer,
    "custo_estimado" numeric(8,6),
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "ai_insights_status_check" CHECK (("status" = ANY (ARRAY['ativo'::"text", 'descartado'::"text", 'aplicado'::"text"])))
);


ALTER TABLE "public"."ai_insights" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_usage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "mes" integer NOT NULL,
    "ano" integer NOT NULL,
    "total_requests" integer DEFAULT 0,
    "total_tokens_entrada" integer DEFAULT 0,
    "total_tokens_saida" integer DEFAULT 0,
    "custo_estimado_total" numeric(10,4) DEFAULT 0,
    "limite_requests" integer DEFAULT 100,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ai_usage" OWNER TO "postgres";


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


ALTER TABLE "public"."alertas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."alocacoes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "pessoa_id" "uuid" NOT NULL,
    "projeto_id" "uuid" NOT NULL,
    "disciplina" "text" NOT NULL,
    "semana_inicio" "date" NOT NULL,
    "horas_alocadas" numeric DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."alocacoes" OWNER TO "postgres";


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


ALTER TABLE "public"."aprovacoes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."asaas_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "api_key" "text" NOT NULL,
    "ambiente" "text" DEFAULT 'sandbox'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "asaas_config_ambiente_check" CHECK (("ambiente" = ANY (ARRAY['sandbox'::"text", 'producao'::"text"])))
);


ALTER TABLE "public"."asaas_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."asaas_webhook_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid",
    "event" "text" NOT NULL,
    "payment_id" "text",
    "receita_id" "uuid",
    "payload" "jsonb",
    "processed_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."asaas_webhook_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_id" "uuid",
    "actor_email" "text",
    "action" "text" NOT NULL,
    "target_table" "text",
    "target_id" "uuid",
    "diff" "jsonb",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cartoes_credito" (
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
    "usado" "text",
    "user_id" "text",
    "conta_pagamento_id" "uuid",
    CONSTRAINT "cartoes_credito_dia_fechamento_check" CHECK ((("dia_fechamento" >= 1) AND ("dia_fechamento" <= 31))),
    CONSTRAINT "cartoes_credito_dia_vencimento_check" CHECK ((("dia_vencimento" >= 1) AND ("dia_vencimento" <= 31)))
);


ALTER TABLE "public"."cartoes_credito" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categorias_financeiras" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "tipo" "public"."tipo_categoria" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."categorias_financeiras" OWNER TO "postgres";


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


ALTER TABLE "public"."cliente_portal_accounts" OWNER TO "postgres";


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
    "asaas_customer_id" "text"
);


ALTER TABLE "public"."clientes" OWNER TO "postgres";


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
    "saldo_atual" "text",
    "user_id" "text"
);


ALTER TABLE "public"."contas" OWNER TO "postgres";


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


ALTER TABLE "public"."convites" OWNER TO "postgres";


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


ALTER TABLE "public"."critical_alerts" OWNER TO "postgres";


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
    CONSTRAINT "despesas_periodicidade_check" CHECK (("periodicidade" = ANY (ARRAY['mensal'::"text", 'trimestral'::"text", 'semestral'::"text", 'anual'::"text"])))
);


ALTER TABLE "public"."despesas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."disciplinas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."disciplinas" OWNER TO "postgres";


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


ALTER TABLE "public"."empresa_owners_pending" OWNER TO "postgres";


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
    "features" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."empresas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."escopo_historico" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escopo_id" "uuid" NOT NULL,
    "acao" "text" NOT NULL,
    "usuario_id" "uuid",
    "usuario_nome" "text",
    "detalhes" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."escopo_historico" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."escopo_itens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escopo_id" "uuid" NOT NULL,
    "descricao" "text" NOT NULL,
    "disciplina" "text",
    "horas" numeric DEFAULT 0,
    "custo" numeric DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."escopo_itens" OWNER TO "postgres";


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


ALTER TABLE "public"."escopos" OWNER TO "postgres";


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
    CONSTRAINT "faturas_ano_referencia_check" CHECK ((("ano_referencia" >= 2020) AND ("ano_referencia" <= 2100))),
    CONSTRAINT "faturas_mes_referencia_check" CHECK ((("mes_referencia" >= 1) AND ("mes_referencia" <= 12))),
    CONSTRAINT "faturas_status_check" CHECK (("status" = ANY (ARRAY['Aberta'::"text", 'Fechada'::"text", 'Paga'::"text", 'Parcial'::"text"])))
);


ALTER TABLE "public"."faturas" OWNER TO "postgres";


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


ALTER TABLE "public"."fluxos_disciplinas" OWNER TO "postgres";


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


ALTER TABLE "public"."folha_pagamento" OWNER TO "postgres";


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


ALTER TABLE "public"."fornecedores" OWNER TO "postgres";


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
    "convertido_em" timestamp with time zone
);


ALTER TABLE "public"."leads" OWNER TO "postgres";


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


ALTER TABLE "public"."marcos_faturamento" OWNER TO "postgres";


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
    CONSTRAINT "metas_categoria_check" CHECK (("categoria" = ANY (ARRAY['receita'::"text", 'lucro'::"text", 'economia'::"text", 'investimento'::"text"])))
);


ALTER TABLE "public"."metas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mfa_backup_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "code_hash" "text" NOT NULL,
    "used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."mfa_backup_codes" OWNER TO "postgres";


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


ALTER TABLE "public"."orcamento_versoes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pessoas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "profile_id" "uuid",
    "nome" "text" NOT NULL,
    "cpf" "text" NOT NULL,
    "cargo" "text",
    "email" "text" NOT NULL,
    "telefone" "text" NOT NULL,
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
    "horas_semanais" numeric DEFAULT 40
);


ALTER TABLE "public"."pessoas" OWNER TO "postgres";


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


ALTER TABLE "public"."pilar_checkout_webhook_logs" OWNER TO "postgres";


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


ALTER TABLE "public"."pilar_pending_signups" OWNER TO "postgres";


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


ALTER TABLE "public"."pilar_subscription_plans" OWNER TO "postgres";


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


ALTER TABLE "public"."pilar_subscriptions" OWNER TO "postgres";


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


ALTER TABLE "public"."portal_download_logs" OWNER TO "postgres";


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
    CONSTRAINT "portal_entregas_status_check" CHECK (("status" = ANY (ARRAY['pendente'::"text", 'aprovado'::"text", 'revisao_solicitada'::"text"]))),
    CONSTRAINT "portal_entregas_tipo_check" CHECK (("tipo" = ANY (ARRAY['documento'::"text", 'aprovacao'::"text", 'informacao'::"text"])))
);


ALTER TABLE "public"."portal_entregas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."portal_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "projeto_id" "uuid" NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "token" "text" DEFAULT "encode"("extensions"."gen_random_bytes"(32), 'hex'::"text") NOT NULL,
    "email_cliente" "text",
    "ativo" boolean DEFAULT true,
    "ultimo_acesso" timestamp with time zone,
    "expira_em" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."portal_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "email" "text" NOT NULL,
    "role" "public"."user_role" DEFAULT 'user'::"public"."user_role",
    "contato" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "updated_by" "uuid",
    "onboarding_completed" boolean DEFAULT false,
    "features" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."projeto_disciplina_responsaveis" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "projeto_disciplina_id" "uuid" NOT NULL,
    "pessoa_id" "uuid" NOT NULL
);


ALTER TABLE "public"."projeto_disciplina_responsaveis" OWNER TO "postgres";


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
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."projeto_disciplinas" OWNER TO "postgres";


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


ALTER TABLE "public"."projeto_orcamento_fases" OWNER TO "postgres";


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


ALTER TABLE "public"."projetos" OWNER TO "postgres";


COMMENT ON COLUMN "public"."projetos"."disciplinas" IS 'DEPRECATED: migrated to projeto_disciplinas table. Will be removed in future migration.';



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


ALTER TABLE "public"."proposta_disciplinas" OWNER TO "postgres";


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
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."proposta_templates" OWNER TO "postgres";


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


ALTER TABLE "public"."propostas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rate_limit_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "action" "text" NOT NULL,
    "key" "text" NOT NULL,
    "attempted_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rate_limit_attempts" OWNER TO "postgres";


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
    "asaas_billing_type" "text"
);


ALTER TABLE "public"."receitas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."saude_operacional_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "mes" integer NOT NULL,
    "ano" integer NOT NULL,
    "score" numeric NOT NULL,
    "breakdown" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."saude_operacional_snapshots" OWNER TO "postgres";


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


ALTER TABLE "public"."templates_projeto" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."timesheets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "pessoa_id" "uuid" NOT NULL,
    "projeto_id" "uuid" NOT NULL,
    "disciplina" "text" NOT NULL,
    "data" "date" NOT NULL,
    "horas" numeric(5,2) NOT NULL,
    "descricao" "text",
    "status" "text" DEFAULT 'pendente'::"text",
    "aprovado_por" "uuid",
    "aprovado_em" timestamp with time zone,
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    CONSTRAINT "timesheets_horas_check" CHECK ((("horas" > (0)::numeric) AND ("horas" <= (24)::numeric))),
    CONSTRAINT "timesheets_status_check" CHECK (("status" = ANY (ARRAY['pendente'::"text", 'aprovado'::"text", 'rejeitado'::"text"])))
);


ALTER TABLE "public"."timesheets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ultra_admin_modes" (
    "user_id" "uuid" NOT NULL,
    "scoped" boolean DEFAULT false NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ultra_admin_modes" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_cartao_resumo" AS
 SELECT "id",
    "nome",
    "empresa_id",
    "dia_fechamento",
    "dia_vencimento",
    "cor",
    "limite",
    "conta_pagamento_id",
    COALESCE(( SELECT "sum"("d"."valor") AS "sum"
           FROM "public"."despesas" "d"
          WHERE (("d"."cartao_id" = "cc"."id") AND ("d"."status" = 'Pendente'::"public"."status_financeiro") AND ("d"."deleted_at" IS NULL))), (0)::numeric) AS "usado",
    ("limite" - COALESCE(( SELECT "sum"("d"."valor") AS "sum"
           FROM "public"."despesas" "d"
          WHERE (("d"."cartao_id" = "cc"."id") AND ("d"."status" = 'Pendente'::"public"."status_financeiro") AND ("d"."deleted_at" IS NULL))), (0)::numeric)) AS "disponivel"
   FROM "public"."cartoes_credito" "cc"
  WHERE ("deleted_at" IS NULL);


ALTER VIEW "public"."view_cartao_resumo" OWNER TO "postgres";


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
     JOIN "public"."cartoes_credito" "cc" ON (("f"."cartao_id" = "cc"."id")))
     LEFT JOIN "public"."contas" "c" ON (("f"."conta_pagamento_id" = "c"."id")))
  WHERE ("f"."deleted_at" IS NULL);


ALTER VIEW "public"."view_fatura_resumo" OWNER TO "postgres";


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


ALTER VIEW "public"."view_financas_resumo" OWNER TO "postgres";


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


ALTER VIEW "public"."view_folha_pagamento" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wip_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "projeto_id" "uuid" NOT NULL,
    "mes" integer NOT NULL,
    "ano" integer NOT NULL,
    "horas_realizadas" numeric(10,2) DEFAULT 0,
    "custo_realizado" numeric(14,2) DEFAULT 0,
    "faturado" numeric(14,2) DEFAULT 0,
    "recebido" numeric(14,2) DEFAULT 0,
    "wip_saldo" numeric(14,2) GENERATED ALWAYS AS (("custo_realizado" - "faturado")) STORED,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    CONSTRAINT "wip_snapshots_mes_check" CHECK ((("mes" >= 1) AND ("mes" <= 12)))
);


ALTER TABLE "public"."wip_snapshots" OWNER TO "postgres";


ALTER TABLE ONLY "public"."ai_insights"
    ADD CONSTRAINT "ai_insights_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_usage"
    ADD CONSTRAINT "ai_usage_empresa_id_mes_ano_key" UNIQUE ("empresa_id", "mes", "ano");



ALTER TABLE ONLY "public"."ai_usage"
    ADD CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."alertas"
    ADD CONSTRAINT "alertas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."alocacoes"
    ADD CONSTRAINT "alocacoes_pessoa_id_projeto_id_disciplina_semana_inicio_key" UNIQUE ("pessoa_id", "projeto_id", "disciplina", "semana_inicio");



ALTER TABLE ONLY "public"."alocacoes"
    ADD CONSTRAINT "alocacoes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."aprovacoes"
    ADD CONSTRAINT "aprovacoes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."asaas_config"
    ADD CONSTRAINT "asaas_config_empresa_id_key" UNIQUE ("empresa_id");



ALTER TABLE ONLY "public"."asaas_config"
    ADD CONSTRAINT "asaas_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."asaas_webhook_logs"
    ADD CONSTRAINT "asaas_webhook_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cartoes_credito"
    ADD CONSTRAINT "cartoes_credito_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cartoes_credito"
    ADD CONSTRAINT "cartoes_unique_empresa_nome" UNIQUE ("empresa_id", "nome");



ALTER TABLE ONLY "public"."categorias_financeiras"
    ADD CONSTRAINT "categorias_financeiras_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categorias_financeiras"
    ADD CONSTRAINT "categorias_unique_empresa_nome_tipo" UNIQUE ("empresa_id", "nome", "tipo");



ALTER TABLE ONLY "public"."cliente_portal_accounts"
    ADD CONSTRAINT "cliente_portal_accounts_cliente_id_empresa_id_key" UNIQUE ("cliente_id", "empresa_id");



ALTER TABLE ONLY "public"."cliente_portal_accounts"
    ADD CONSTRAINT "cliente_portal_accounts_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."cliente_portal_accounts"
    ADD CONSTRAINT "cliente_portal_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_contato_key" UNIQUE ("contato");



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_cpf_cnpj_key" UNIQUE ("cpf_cnpj");



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_unique_empresa_cpf_cnpj" UNIQUE ("empresa_id", "cpf_cnpj");



ALTER TABLE ONLY "public"."contas"
    ADD CONSTRAINT "contas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contas"
    ADD CONSTRAINT "contas_unique_empresa_nome" UNIQUE ("empresa_id", "nome");



ALTER TABLE ONLY "public"."convites"
    ADD CONSTRAINT "convites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."convites"
    ADD CONSTRAINT "convites_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."critical_alerts"
    ADD CONSTRAINT "critical_alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."despesas"
    ADD CONSTRAINT "despesas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."disciplinas"
    ADD CONSTRAINT "disciplinas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."empresa_owners_pending"
    ADD CONSTRAINT "empresa_owners_pending_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."empresa_owners_pending"
    ADD CONSTRAINT "empresa_owners_pending_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."empresa_owners_pending"
    ADD CONSTRAINT "empresa_owners_pending_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."empresas"
    ADD CONSTRAINT "empresas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."escopo_historico"
    ADD CONSTRAINT "escopo_historico_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."escopo_itens"
    ADD CONSTRAINT "escopo_itens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."escopos"
    ADD CONSTRAINT "escopos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."faturas"
    ADD CONSTRAINT "faturas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."faturas"
    ADD CONSTRAINT "faturas_unique_cartao_mes" UNIQUE ("cartao_id", "mes_referencia", "ano_referencia");



ALTER TABLE ONLY "public"."fluxos_disciplinas"
    ADD CONSTRAINT "fluxos_disciplinas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."folha_pagamento"
    ADD CONSTRAINT "folha_pagamento_pessoa_id_mes_ano_key" UNIQUE ("pessoa_id", "mes", "ano");



ALTER TABLE ONLY "public"."folha_pagamento"
    ADD CONSTRAINT "folha_pagamento_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fornecedores"
    ADD CONSTRAINT "fornecedores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fornecedores"
    ADD CONSTRAINT "fornecedores_unique_empresa_cnpj" UNIQUE ("empresa_id", "cnpj");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marcos_faturamento"
    ADD CONSTRAINT "marcos_faturamento_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."metas"
    ADD CONSTRAINT "metas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mfa_backup_codes"
    ADD CONSTRAINT "mfa_backup_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."projeto_orcamento_fases"
    ADD CONSTRAINT "orcamento_unique_projeto_disciplina" UNIQUE ("projeto_id", "disciplina");



ALTER TABLE ONLY "public"."orcamento_versoes"
    ADD CONSTRAINT "orcamento_versoes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pessoas"
    ADD CONSTRAINT "pessoas_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."pessoas"
    ADD CONSTRAINT "pessoas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pessoas"
    ADD CONSTRAINT "pessoas_telefone_key" UNIQUE ("telefone");



ALTER TABLE ONLY "public"."pilar_checkout_webhook_logs"
    ADD CONSTRAINT "pilar_checkout_webhook_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pilar_pending_signups"
    ADD CONSTRAINT "pilar_pending_signups_checkout_session_token_key" UNIQUE ("checkout_session_token");



ALTER TABLE ONLY "public"."pilar_pending_signups"
    ADD CONSTRAINT "pilar_pending_signups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pilar_subscription_plans"
    ADD CONSTRAINT "pilar_subscription_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pilar_subscription_plans"
    ADD CONSTRAINT "pilar_subscription_plans_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."pilar_subscriptions"
    ADD CONSTRAINT "pilar_subscriptions_empresa_id_key" UNIQUE ("empresa_id");



ALTER TABLE ONLY "public"."pilar_subscriptions"
    ADD CONSTRAINT "pilar_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."portal_download_logs"
    ADD CONSTRAINT "portal_download_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."portal_entregas"
    ADD CONSTRAINT "portal_entregas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."portal_tokens"
    ADD CONSTRAINT "portal_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."portal_tokens"
    ADD CONSTRAINT "portal_tokens_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."projeto_disciplina_responsaveis"
    ADD CONSTRAINT "projeto_disciplina_responsave_projeto_disciplina_id_pessoa__key" UNIQUE ("projeto_disciplina_id", "pessoa_id");



ALTER TABLE ONLY "public"."projeto_disciplina_responsaveis"
    ADD CONSTRAINT "projeto_disciplina_responsaveis_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."projeto_disciplinas"
    ADD CONSTRAINT "projeto_disciplinas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."projeto_orcamento_fases"
    ADD CONSTRAINT "projeto_orcamento_fases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."projetos"
    ADD CONSTRAINT "projetos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."projetos"
    ADD CONSTRAINT "projetos_unique_empresa_codigo" UNIQUE ("empresa_id", "codigo_projeto");



ALTER TABLE ONLY "public"."proposta_disciplinas"
    ADD CONSTRAINT "proposta_disciplinas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."proposta_templates"
    ADD CONSTRAINT "proposta_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."propostas"
    ADD CONSTRAINT "propostas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rate_limit_attempts"
    ADD CONSTRAINT "rate_limit_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."receitas"
    ADD CONSTRAINT "receitas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saude_operacional_snapshots"
    ADD CONSTRAINT "saude_operacional_snapshots_empresa_id_mes_ano_key" UNIQUE ("empresa_id", "mes", "ano");



ALTER TABLE ONLY "public"."saude_operacional_snapshots"
    ADD CONSTRAINT "saude_operacional_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."templates_projeto"
    ADD CONSTRAINT "templates_projeto_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."timesheets"
    ADD CONSTRAINT "timesheets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."timesheets"
    ADD CONSTRAINT "timesheets_unique_entry" UNIQUE ("pessoa_id", "projeto_id", "disciplina", "data");



ALTER TABLE ONLY "public"."ultra_admin_modes"
    ADD CONSTRAINT "ultra_admin_modes_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."wip_snapshots"
    ADD CONSTRAINT "wip_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wip_snapshots"
    ADD CONSTRAINT "wip_unique_projeto_periodo" UNIQUE ("projeto_id", "mes", "ano");



CREATE INDEX "audit_logs_action_idx" ON "public"."audit_logs" USING "btree" ("action");



CREATE INDEX "audit_logs_actor_idx" ON "public"."audit_logs" USING "btree" ("actor_id");



CREATE INDEX "audit_logs_created_idx" ON "public"."audit_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "audit_logs_meta_emp_idx" ON "public"."audit_logs" USING "btree" ((("metadata" ->> 'empresa_id'::"text")));



CREATE INDEX "audit_logs_record_idx" ON "public"."audit_logs" USING "btree" ("target_id");



CREATE INDEX "idx_ai_insights_empresa" ON "public"."ai_insights" USING "btree" ("empresa_id");



CREATE INDEX "idx_ai_insights_ref" ON "public"."ai_insights" USING "btree" ("referencia_id");



CREATE INDEX "idx_ai_insights_tipo" ON "public"."ai_insights" USING "btree" ("empresa_id", "tipo");



CREATE INDEX "idx_alertas_empresa_lido" ON "public"."alertas" USING "btree" ("empresa_id", "lido", "created_at" DESC);



CREATE INDEX "idx_alertas_empresa_tipo" ON "public"."alertas" USING "btree" ("empresa_id", "tipo");



CREATE INDEX "idx_alocacoes_empresa" ON "public"."alocacoes" USING "btree" ("empresa_id");



CREATE INDEX "idx_alocacoes_pessoa" ON "public"."alocacoes" USING "btree" ("pessoa_id", "semana_inicio");



CREATE INDEX "idx_alocacoes_projeto" ON "public"."alocacoes" USING "btree" ("projeto_id");



CREATE INDEX "idx_aprovacoes_empresa" ON "public"."aprovacoes" USING "btree" ("empresa_id");



CREATE INDEX "idx_aprovacoes_ref" ON "public"."aprovacoes" USING "btree" ("referencia_tipo", "referencia_id");



CREATE INDEX "idx_aprovacoes_status" ON "public"."aprovacoes" USING "btree" ("empresa_id", "status");



CREATE INDEX "idx_cartoes_empresa" ON "public"."cartoes_credito" USING "btree" ("empresa_id");



CREATE INDEX "idx_cliente_portal_accounts_cliente" ON "public"."cliente_portal_accounts" USING "btree" ("cliente_id");



CREATE INDEX "idx_cliente_portal_accounts_email" ON "public"."cliente_portal_accounts" USING "btree" ("email");



CREATE INDEX "idx_cliente_portal_accounts_empresa" ON "public"."cliente_portal_accounts" USING "btree" ("empresa_id");



CREATE INDEX "idx_cliente_portal_accounts_token" ON "public"."cliente_portal_accounts" USING "btree" ("token_sessao");



CREATE INDEX "idx_clientes_empresa" ON "public"."clientes" USING "btree" ("empresa_id");



CREATE INDEX "idx_clientes_nome_trgm" ON "public"."clientes" USING "gin" ("nome" "public"."gin_trgm_ops");



CREATE INDEX "idx_contas_empresa" ON "public"."contas" USING "btree" ("empresa_id");



CREATE INDEX "idx_convites_email" ON "public"."convites" USING "btree" ("email") WHERE ("usado_em" IS NULL);



CREATE INDEX "idx_convites_empresa" ON "public"."convites" USING "btree" ("empresa_id");



CREATE INDEX "idx_convites_token" ON "public"."convites" USING "btree" ("token") WHERE ("usado_em" IS NULL);



CREATE INDEX "idx_critical_alerts_empresa" ON "public"."critical_alerts" USING "btree" ("empresa_id", "created_at" DESC);



CREATE INDEX "idx_critical_alerts_unnotified" ON "public"."critical_alerts" USING "btree" ("created_at" DESC) WHERE ("notified" = false);



CREATE INDEX "idx_despesas_desc_trgm" ON "public"."despesas" USING "gin" ("descricao" "public"."gin_trgm_ops");



CREATE INDEX "idx_despesas_empresa" ON "public"."despesas" USING "btree" ("empresa_id");



CREATE INDEX "idx_despesas_fatura" ON "public"."despesas" USING "btree" ("fatura_id");



CREATE INDEX "idx_despesas_grupo_parcela" ON "public"."despesas" USING "btree" ("grupo_parcela") WHERE ("grupo_parcela" IS NOT NULL);



CREATE INDEX "idx_despesas_is_fatura_payment" ON "public"."despesas" USING "btree" ("is_fatura_payment") WHERE ("is_fatura_payment" = true);



CREATE INDEX "idx_despesas_pagamento" ON "public"."despesas" USING "btree" ("empresa_id", "data_pagamento") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_despesas_projeto" ON "public"."despesas" USING "btree" ("projeto_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_despesas_status" ON "public"."despesas" USING "btree" ("empresa_id", "status") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_despesas_vencimento" ON "public"."despesas" USING "btree" ("empresa_id", "data_vencimento");



CREATE INDEX "idx_empresa_owners_pending_email" ON "public"."empresa_owners_pending" USING "btree" ("email") WHERE ("usado_em" IS NULL);



CREATE INDEX "idx_empresa_owners_pending_token" ON "public"."empresa_owners_pending" USING "btree" ("token") WHERE ("usado_em" IS NULL);



CREATE INDEX "idx_escopo_itens_escopo" ON "public"."escopo_itens" USING "btree" ("escopo_id");



CREATE INDEX "idx_escopos_empresa" ON "public"."escopos" USING "btree" ("empresa_id");



CREATE INDEX "idx_escopos_projeto" ON "public"."escopos" USING "btree" ("projeto_id");



CREATE INDEX "idx_faturas_cartao" ON "public"."faturas" USING "btree" ("cartao_id");



CREATE INDEX "idx_faturas_empresa" ON "public"."faturas" USING "btree" ("empresa_id");



CREATE INDEX "idx_faturas_periodo" ON "public"."faturas" USING "btree" ("cartao_id", "ano_referencia", "mes_referencia");



CREATE INDEX "idx_faturas_status" ON "public"."faturas" USING "btree" ("empresa_id", "status");



CREATE INDEX "idx_fluxos_disciplinas_empresa" ON "public"."fluxos_disciplinas" USING "btree" ("empresa_id");



CREATE INDEX "idx_fornecedores_empresa" ON "public"."fornecedores" USING "btree" ("empresa_id");



CREATE INDEX "idx_leads_empresa" ON "public"."leads" USING "btree" ("empresa_id");



CREATE INDEX "idx_marcos_empresa" ON "public"."marcos_faturamento" USING "btree" ("empresa_id");



CREATE INDEX "idx_marcos_projeto" ON "public"."marcos_faturamento" USING "btree" ("projeto_id");



CREATE INDEX "idx_metas_empresa_id" ON "public"."metas" USING "btree" ("empresa_id");



CREATE INDEX "idx_metas_pessoa_id" ON "public"."metas" USING "btree" ("pessoa_id");



CREATE INDEX "idx_metas_projeto_id" ON "public"."metas" USING "btree" ("projeto_id");



CREATE INDEX "idx_metas_tipo" ON "public"."metas" USING "btree" ("tipo");



CREATE INDEX "idx_mfa_backup_codes_user" ON "public"."mfa_backup_codes" USING "btree" ("user_id") WHERE ("used_at" IS NULL);



CREATE INDEX "idx_orcamento_fases_empresa" ON "public"."projeto_orcamento_fases" USING "btree" ("empresa_id");



CREATE INDEX "idx_orcamento_fases_projeto" ON "public"."projeto_orcamento_fases" USING "btree" ("projeto_id");



CREATE INDEX "idx_orcamento_versoes_projeto" ON "public"."orcamento_versoes" USING "btree" ("projeto_id");



CREATE INDEX "idx_pessoas_empresa" ON "public"."pessoas" USING "btree" ("empresa_id");



CREATE INDEX "idx_pilar_pending_signups_asaas_payment" ON "public"."pilar_pending_signups" USING "btree" ("asaas_payment_id") WHERE ("asaas_payment_id" IS NOT NULL);



CREATE INDEX "idx_pilar_pending_signups_asaas_subscription" ON "public"."pilar_pending_signups" USING "btree" ("asaas_subscription_id") WHERE ("asaas_subscription_id" IS NOT NULL);



CREATE INDEX "idx_pilar_pending_signups_email" ON "public"."pilar_pending_signups" USING "btree" ("lower"("email"));



CREATE INDEX "idx_pilar_pending_signups_session" ON "public"."pilar_pending_signups" USING "btree" ("checkout_session_token");



CREATE INDEX "idx_pilar_subscriptions_asaas_sub" ON "public"."pilar_subscriptions" USING "btree" ("asaas_subscription_id") WHERE ("asaas_subscription_id" IS NOT NULL);



CREATE INDEX "idx_pilar_subscriptions_empresa" ON "public"."pilar_subscriptions" USING "btree" ("empresa_id");



CREATE INDEX "idx_pilar_subscriptions_status" ON "public"."pilar_subscriptions" USING "btree" ("status");



CREATE INDEX "idx_pilar_webhook_logs_payment" ON "public"."pilar_checkout_webhook_logs" USING "btree" ("asaas_payment_id");



CREATE INDEX "idx_pilar_webhook_logs_subscription" ON "public"."pilar_checkout_webhook_logs" USING "btree" ("asaas_subscription_id");



CREATE INDEX "idx_portal_download_logs_empresa" ON "public"."portal_download_logs" USING "btree" ("empresa_id", "created_at" DESC);



CREATE INDEX "idx_portal_entregas_projeto" ON "public"."portal_entregas" USING "btree" ("projeto_id");



CREATE INDEX "idx_portal_tokens_projeto" ON "public"."portal_tokens" USING "btree" ("projeto_id");



CREATE INDEX "idx_portal_tokens_token" ON "public"."portal_tokens" USING "btree" ("token");



CREATE INDEX "idx_projeto_disciplina_responsaveis_disciplina_id" ON "public"."projeto_disciplina_responsaveis" USING "btree" ("projeto_disciplina_id");



CREATE INDEX "idx_projeto_disciplina_responsaveis_pessoa_id" ON "public"."projeto_disciplina_responsaveis" USING "btree" ("pessoa_id");



CREATE INDEX "idx_projeto_disciplinas_projeto_id" ON "public"."projeto_disciplinas" USING "btree" ("projeto_id");



CREATE INDEX "idx_projetos_empresa" ON "public"."projetos" USING "btree" ("empresa_id");



CREATE INDEX "idx_projetos_nome_trgm" ON "public"."projetos" USING "gin" ("nome" "public"."gin_trgm_ops");



CREATE INDEX "idx_proposta_disc" ON "public"."proposta_disciplinas" USING "btree" ("proposta_id");



CREATE INDEX "idx_proposta_templates_empresa" ON "public"."proposta_templates" USING "btree" ("empresa_id");



CREATE INDEX "idx_propostas_empresa" ON "public"."propostas" USING "btree" ("empresa_id");



CREATE INDEX "idx_propostas_status" ON "public"."propostas" USING "btree" ("empresa_id", "status");



CREATE INDEX "idx_rate_limit_lookup" ON "public"."rate_limit_attempts" USING "btree" ("action", "key", "attempted_at");



CREATE INDEX "idx_receitas_desc_trgm" ON "public"."receitas" USING "gin" ("descricao" "public"."gin_trgm_ops");



CREATE INDEX "idx_receitas_empresa" ON "public"."receitas" USING "btree" ("empresa_id");



CREATE INDEX "idx_receitas_grupo_parcela" ON "public"."receitas" USING "btree" ("grupo_parcela") WHERE ("grupo_parcela" IS NOT NULL);



CREATE INDEX "idx_receitas_projeto" ON "public"."receitas" USING "btree" ("projeto_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_receitas_recebimento" ON "public"."receitas" USING "btree" ("empresa_id", "data_recebimento") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_receitas_status" ON "public"."receitas" USING "btree" ("empresa_id", "status") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_receitas_vencimento" ON "public"."receitas" USING "btree" ("empresa_id", "data_vencimento");



CREATE INDEX "idx_templates_projeto_empresa" ON "public"."templates_projeto" USING "btree" ("empresa_id");



CREATE INDEX "idx_templates_projeto_tipo" ON "public"."templates_projeto" USING "btree" ("empresa_id", "tipo_servico");



CREATE INDEX "idx_timesheets_aprovados" ON "public"."timesheets" USING "btree" ("projeto_id", "status") WHERE (("status" = 'aprovado'::"text") AND ("deleted_at" IS NULL));



CREATE INDEX "idx_timesheets_empresa" ON "public"."timesheets" USING "btree" ("empresa_id");



CREATE INDEX "idx_timesheets_empresa_data" ON "public"."timesheets" USING "btree" ("empresa_id", "data");



CREATE INDEX "idx_timesheets_pessoa_data" ON "public"."timesheets" USING "btree" ("pessoa_id", "data");



CREATE INDEX "idx_timesheets_projeto" ON "public"."timesheets" USING "btree" ("projeto_id");



CREATE INDEX "idx_timesheets_status" ON "public"."timesheets" USING "btree" ("empresa_id", "status");



CREATE INDEX "idx_wip_empresa" ON "public"."wip_snapshots" USING "btree" ("empresa_id");



CREATE INDEX "idx_wip_periodo" ON "public"."wip_snapshots" USING "btree" ("empresa_id", "ano", "mes");



CREATE UNIQUE INDEX "pessoas_cpf_empresa_active_unique" ON "public"."pessoas" USING "btree" ("empresa_id", "cpf") WHERE (("deleted_at" IS NULL) AND ("cpf" IS NOT NULL) AND ("cpf" <> ''::"text"));



CREATE OR REPLACE TRIGGER "alocacoes_audit" BEFORE INSERT OR UPDATE ON "public"."alocacoes" FOR EACH ROW EXECUTE FUNCTION "public"."handle_record_audit"();



CREATE OR REPLACE TRIGGER "alocacoes_prevent_company_change" BEFORE UPDATE ON "public"."alocacoes" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_company_change"();



CREATE OR REPLACE TRIGGER "audit_company_features" AFTER UPDATE OF "features" ON "public"."empresas" FOR EACH ROW EXECUTE FUNCTION "public"."tg_audit_company_features"();



CREATE OR REPLACE TRIGGER "audit_profile_changes" AFTER UPDATE OF "role", "features" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."tg_audit_profile_changes"();



CREATE OR REPLACE TRIGGER "despesa_enforce_data" BEFORE UPDATE ON "public"."despesas" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_despesa_data_pagamento"();



CREATE OR REPLACE TRIGGER "escopo_aditivo_aprovado" BEFORE UPDATE ON "public"."escopos" FOR EACH ROW EXECUTE FUNCTION "public"."aditivo_aprovado_handler"();



CREATE OR REPLACE TRIGGER "escopos_audit" BEFORE INSERT OR UPDATE ON "public"."escopos" FOR EACH ROW EXECUTE FUNCTION "public"."handle_record_audit"();



CREATE OR REPLACE TRIGGER "escopos_prevent_company_change" BEFORE UPDATE ON "public"."escopos" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_company_change"();



CREATE OR REPLACE TRIGGER "escopos_soft_delete" BEFORE DELETE ON "public"."escopos" FOR EACH ROW EXECUTE FUNCTION "public"."soft_delete_generic"();



CREATE OR REPLACE TRIGGER "fluxos_disciplinas_audit" BEFORE INSERT OR UPDATE ON "public"."fluxos_disciplinas" FOR EACH ROW EXECUTE FUNCTION "public"."handle_record_audit"();



CREATE OR REPLACE TRIGGER "fluxos_disciplinas_prevent_company_change" BEFORE UPDATE ON "public"."fluxos_disciplinas" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_company_change"();



CREATE OR REPLACE TRIGGER "fluxos_disciplinas_soft_delete" BEFORE DELETE ON "public"."fluxos_disciplinas" FOR EACH ROW EXECUTE FUNCTION "public"."soft_delete_generic"();



CREATE OR REPLACE TRIGGER "marco_auto_receita" BEFORE UPDATE ON "public"."marcos_faturamento" FOR EACH ROW EXECUTE FUNCTION "public"."auto_gerar_receita_from_marco"();



CREATE OR REPLACE TRIGGER "marcos_audit" BEFORE INSERT OR UPDATE ON "public"."marcos_faturamento" FOR EACH ROW EXECUTE FUNCTION "public"."handle_record_audit"();



CREATE OR REPLACE TRIGGER "marcos_prevent_company_change" BEFORE UPDATE ON "public"."marcos_faturamento" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_company_change"();



CREATE OR REPLACE TRIGGER "marcos_soft_delete" BEFORE DELETE ON "public"."marcos_faturamento" FOR EACH ROW EXECUTE FUNCTION "public"."soft_delete_generic"();



CREATE OR REPLACE TRIGGER "orcamento_fases_audit" BEFORE INSERT OR UPDATE ON "public"."projeto_orcamento_fases" FOR EACH ROW EXECUTE FUNCTION "public"."handle_record_audit"();



CREATE OR REPLACE TRIGGER "orcamento_fases_prevent_company_change" BEFORE UPDATE ON "public"."projeto_orcamento_fases" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_company_change"();



CREATE OR REPLACE TRIGGER "orcamento_fases_soft_delete" BEFORE DELETE ON "public"."projeto_orcamento_fases" FOR EACH ROW EXECUTE FUNCTION "public"."soft_delete_generic"();



CREATE OR REPLACE TRIGGER "projeto_auto_complete" BEFORE UPDATE ON "public"."projetos" FOR EACH ROW EXECUTE FUNCTION "public"."auto_complete_disciplinas"();



CREATE OR REPLACE TRIGGER "propostas_audit" BEFORE INSERT OR UPDATE ON "public"."propostas" FOR EACH ROW EXECUTE FUNCTION "public"."handle_record_audit"();



CREATE OR REPLACE TRIGGER "propostas_prevent_company_change" BEFORE UPDATE ON "public"."propostas" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_company_change"();



CREATE OR REPLACE TRIGGER "propostas_soft_delete" BEFORE DELETE ON "public"."propostas" FOR EACH ROW EXECUTE FUNCTION "public"."soft_delete_generic"();



CREATE OR REPLACE TRIGGER "protect_ultra_admin" BEFORE INSERT OR UPDATE OF "role" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."tg_protect_ultra_admin"();



CREATE OR REPLACE TRIGGER "receita_enforce_data" BEFORE UPDATE ON "public"."receitas" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_receita_data_recebimento"();



CREATE OR REPLACE TRIGGER "templates_projeto_audit" BEFORE INSERT OR UPDATE ON "public"."templates_projeto" FOR EACH ROW EXECUTE FUNCTION "public"."handle_record_audit"();



CREATE OR REPLACE TRIGGER "templates_projeto_prevent_company_change" BEFORE UPDATE ON "public"."templates_projeto" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_company_change"();



CREATE OR REPLACE TRIGGER "templates_projeto_soft_delete" BEFORE DELETE ON "public"."templates_projeto" FOR EACH ROW EXECUTE FUNCTION "public"."soft_delete_generic"();



CREATE OR REPLACE TRIGGER "timesheets_audit" BEFORE INSERT OR UPDATE ON "public"."timesheets" FOR EACH ROW EXECUTE FUNCTION "public"."handle_record_audit"();



CREATE OR REPLACE TRIGGER "timesheets_prevent_company_change" BEFORE UPDATE ON "public"."timesheets" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_company_change"();



CREATE OR REPLACE TRIGGER "timesheets_soft_delete" BEFORE DELETE ON "public"."timesheets" FOR EACH ROW EXECUTE FUNCTION "public"."soft_delete_generic"();



CREATE OR REPLACE TRIGGER "tr_audit_cartoes" BEFORE INSERT OR UPDATE ON "public"."cartoes_credito" FOR EACH ROW EXECUTE FUNCTION "public"."handle_record_audit"();



CREATE OR REPLACE TRIGGER "tr_audit_categorias" BEFORE INSERT OR UPDATE ON "public"."categorias_financeiras" FOR EACH ROW EXECUTE FUNCTION "public"."handle_record_audit"();



CREATE OR REPLACE TRIGGER "tr_audit_clientes" BEFORE INSERT OR UPDATE ON "public"."clientes" FOR EACH ROW EXECUTE FUNCTION "public"."handle_record_audit"();



CREATE OR REPLACE TRIGGER "tr_audit_contas" BEFORE INSERT OR UPDATE ON "public"."contas" FOR EACH ROW EXECUTE FUNCTION "public"."handle_record_audit"();



CREATE OR REPLACE TRIGGER "tr_audit_despesas" BEFORE INSERT OR UPDATE ON "public"."despesas" FOR EACH ROW EXECUTE FUNCTION "public"."handle_record_audit"();



CREATE OR REPLACE TRIGGER "tr_audit_empresas" BEFORE INSERT OR UPDATE ON "public"."empresas" FOR EACH ROW EXECUTE FUNCTION "public"."handle_record_audit"();



CREATE OR REPLACE TRIGGER "tr_audit_faturas" BEFORE INSERT OR UPDATE ON "public"."faturas" FOR EACH ROW EXECUTE FUNCTION "public"."handle_record_audit"();



CREATE OR REPLACE TRIGGER "tr_audit_fornecedores" BEFORE INSERT OR UPDATE ON "public"."fornecedores" FOR EACH ROW EXECUTE FUNCTION "public"."handle_record_audit"();



CREATE OR REPLACE TRIGGER "tr_audit_leads" BEFORE INSERT OR UPDATE ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."handle_record_audit"();



CREATE OR REPLACE TRIGGER "tr_audit_pessoas" BEFORE INSERT OR UPDATE ON "public"."pessoas" FOR EACH ROW EXECUTE FUNCTION "public"."handle_record_audit"();



CREATE OR REPLACE TRIGGER "tr_audit_profiles" BEFORE INSERT OR UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_record_audit"();



CREATE OR REPLACE TRIGGER "tr_audit_projetos" BEFORE INSERT OR UPDATE ON "public"."projetos" FOR EACH ROW EXECUTE FUNCTION "public"."handle_record_audit"();



CREATE OR REPLACE TRIGGER "tr_audit_receitas" BEFORE INSERT OR UPDATE ON "public"."receitas" FOR EACH ROW EXECUTE FUNCTION "public"."handle_record_audit"();



CREATE OR REPLACE TRIGGER "tr_calculate_status_data" BEFORE INSERT OR UPDATE ON "public"."projetos" FOR EACH ROW EXECUTE FUNCTION "public"."calculate_status_data"();



CREATE OR REPLACE TRIGGER "tr_link_pessoa_profile_before" BEFORE INSERT OR UPDATE OF "email" ON "public"."pessoas" FOR EACH ROW EXECUTE FUNCTION "public"."link_pessoa_profile_before"();



CREATE OR REPLACE TRIGGER "tr_link_profile_pessoa_after" AFTER INSERT OR UPDATE OF "email" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."link_profile_pessoa_after"();



CREATE OR REPLACE TRIGGER "tr_pilar_link_subscription_on_owner_used" AFTER UPDATE OF "usado_em" ON "public"."empresa_owners_pending" FOR EACH ROW EXECUTE FUNCTION "public"."tg_pilar_link_subscription_on_owner_used"();



CREATE OR REPLACE TRIGGER "tr_pilar_pending_signups_touch" BEFORE UPDATE ON "public"."pilar_pending_signups" FOR EACH ROW EXECUTE FUNCTION "public"."tg_pilar_touch_updated_at"();



CREATE OR REPLACE TRIGGER "tr_pilar_subscriptions_touch" BEFORE UPDATE ON "public"."pilar_subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."tg_pilar_touch_updated_at"();



CREATE OR REPLACE TRIGGER "tr_soft_del_cartoes" BEFORE DELETE ON "public"."cartoes_credito" FOR EACH ROW EXECUTE FUNCTION "public"."soft_delete_generic"();



CREATE OR REPLACE TRIGGER "tr_soft_del_clientes" BEFORE DELETE ON "public"."clientes" FOR EACH ROW EXECUTE FUNCTION "public"."soft_delete_generic"();



CREATE OR REPLACE TRIGGER "tr_soft_del_contas" BEFORE DELETE ON "public"."contas" FOR EACH ROW EXECUTE FUNCTION "public"."soft_delete_generic"();



CREATE OR REPLACE TRIGGER "tr_soft_del_despesas" BEFORE DELETE ON "public"."despesas" FOR EACH ROW EXECUTE FUNCTION "public"."soft_delete_generic"();



CREATE OR REPLACE TRIGGER "tr_soft_del_faturas" BEFORE DELETE ON "public"."faturas" FOR EACH ROW EXECUTE FUNCTION "public"."soft_delete_generic"();



CREATE OR REPLACE TRIGGER "tr_soft_del_fornecedores" BEFORE DELETE ON "public"."fornecedores" FOR EACH ROW EXECUTE FUNCTION "public"."soft_delete_generic"();



CREATE OR REPLACE TRIGGER "tr_soft_del_leads" BEFORE DELETE ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."soft_delete_generic"();



CREATE OR REPLACE TRIGGER "tr_soft_del_pessoas" BEFORE DELETE ON "public"."pessoas" FOR EACH ROW EXECUTE FUNCTION "public"."soft_delete_generic"();



CREATE OR REPLACE TRIGGER "tr_soft_del_projetos" BEFORE DELETE ON "public"."projetos" FOR EACH ROW EXECUTE FUNCTION "public"."soft_delete_generic"();



CREATE OR REPLACE TRIGGER "tr_soft_del_receitas" BEFORE DELETE ON "public"."receitas" FOR EACH ROW EXECUTE FUNCTION "public"."soft_delete_generic"();



CREATE OR REPLACE TRIGGER "trigger_escopo_aprovado" AFTER UPDATE ON "public"."escopos" FOR EACH ROW EXECUTE FUNCTION "public"."handle_escopo_aprovado"();



CREATE OR REPLACE TRIGGER "trigger_orcamento_versao" AFTER INSERT OR UPDATE ON "public"."projeto_orcamento_fases" FOR EACH ROW EXECUTE FUNCTION "public"."handle_orcamento_versao"();



CREATE OR REPLACE TRIGGER "validate_convite_features" BEFORE INSERT OR UPDATE OF "features", "cargo" ON "public"."convites" FOR EACH ROW EXECUTE FUNCTION "public"."tg_validate_convite_features"();



CREATE OR REPLACE TRIGGER "validate_profile_features" BEFORE INSERT OR UPDATE OF "features", "role" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."tg_validate_profile_features"();



ALTER TABLE ONLY "public"."ai_insights"
    ADD CONSTRAINT "ai_insights_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."ai_insights"
    ADD CONSTRAINT "ai_insights_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_usage"
    ADD CONSTRAINT "ai_usage_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."alertas"
    ADD CONSTRAINT "alertas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."alertas"
    ADD CONSTRAINT "alertas_lido_por_fkey" FOREIGN KEY ("lido_por") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."alocacoes"
    ADD CONSTRAINT "alocacoes_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."alocacoes"
    ADD CONSTRAINT "alocacoes_pessoa_id_fkey" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."alocacoes"
    ADD CONSTRAINT "alocacoes_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "public"."projetos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."aprovacoes"
    ADD CONSTRAINT "aprovacoes_aprovador_id_fkey" FOREIGN KEY ("aprovador_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."aprovacoes"
    ADD CONSTRAINT "aprovacoes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."aprovacoes"
    ADD CONSTRAINT "aprovacoes_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."aprovacoes"
    ADD CONSTRAINT "aprovacoes_solicitante_id_fkey" FOREIGN KEY ("solicitante_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."aprovacoes"
    ADD CONSTRAINT "aprovacoes_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."asaas_config"
    ADD CONSTRAINT "asaas_config_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."asaas_webhook_logs"
    ADD CONSTRAINT "asaas_webhook_logs_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id");



ALTER TABLE ONLY "public"."asaas_webhook_logs"
    ADD CONSTRAINT "asaas_webhook_logs_receita_id_fkey" FOREIGN KEY ("receita_id") REFERENCES "public"."receitas"("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cartoes_credito"
    ADD CONSTRAINT "cartoes_credito_conta_pagamento_id_fkey" FOREIGN KEY ("conta_pagamento_id") REFERENCES "public"."contas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cartoes_credito"
    ADD CONSTRAINT "cartoes_credito_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."categorias_financeiras"
    ADD CONSTRAINT "categorias_financeiras_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cliente_portal_accounts"
    ADD CONSTRAINT "cliente_portal_accounts_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cliente_portal_accounts"
    ADD CONSTRAINT "cliente_portal_accounts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."cliente_portal_accounts"
    ADD CONSTRAINT "cliente_portal_accounts_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."contas"
    ADD CONSTRAINT "contas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."convites"
    ADD CONSTRAINT "convites_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."convites"
    ADD CONSTRAINT "convites_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."critical_alerts"
    ADD CONSTRAINT "critical_alerts_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."despesas"
    ADD CONSTRAINT "despesas_cartao_id_fkey" FOREIGN KEY ("cartao_id") REFERENCES "public"."cartoes_credito"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."despesas"
    ADD CONSTRAINT "despesas_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias_financeiras"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."despesas"
    ADD CONSTRAINT "despesas_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "public"."contas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."despesas"
    ADD CONSTRAINT "despesas_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."despesas"
    ADD CONSTRAINT "despesas_despesa_pai_id_fkey" FOREIGN KEY ("despesa_pai_id") REFERENCES "public"."despesas"("id");



ALTER TABLE ONLY "public"."despesas"
    ADD CONSTRAINT "despesas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."despesas"
    ADD CONSTRAINT "despesas_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "public"."fornecedores"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."despesas"
    ADD CONSTRAINT "despesas_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "public"."projetos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."despesas"
    ADD CONSTRAINT "despesas_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."empresa_owners_pending"
    ADD CONSTRAINT "empresa_owners_pending_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."empresas"
    ADD CONSTRAINT "empresas_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."empresas"
    ADD CONSTRAINT "empresas_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."empresas"
    ADD CONSTRAINT "empresas_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."escopo_historico"
    ADD CONSTRAINT "escopo_historico_escopo_id_fkey" FOREIGN KEY ("escopo_id") REFERENCES "public"."escopos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."escopo_historico"
    ADD CONSTRAINT "escopo_historico_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."escopo_itens"
    ADD CONSTRAINT "escopo_itens_escopo_id_fkey" FOREIGN KEY ("escopo_id") REFERENCES "public"."escopos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."escopos"
    ADD CONSTRAINT "escopos_aprovado_por_fkey" FOREIGN KEY ("aprovado_por") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."escopos"
    ADD CONSTRAINT "escopos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."escopos"
    ADD CONSTRAINT "escopos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."escopos"
    ADD CONSTRAINT "escopos_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "public"."projetos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."escopos"
    ADD CONSTRAINT "escopos_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."faturas"
    ADD CONSTRAINT "faturas_cartao_id_fkey" FOREIGN KEY ("cartao_id") REFERENCES "public"."cartoes_credito"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."faturas"
    ADD CONSTRAINT "faturas_conta_pagamento_id_fkey" FOREIGN KEY ("conta_pagamento_id") REFERENCES "public"."contas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."faturas"
    ADD CONSTRAINT "faturas_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."faturas"
    ADD CONSTRAINT "faturas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."faturas"
    ADD CONSTRAINT "faturas_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."fluxos_disciplinas"
    ADD CONSTRAINT "fluxos_disciplinas_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."fluxos_disciplinas"
    ADD CONSTRAINT "fluxos_disciplinas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fluxos_disciplinas"
    ADD CONSTRAINT "fluxos_disciplinas_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."folha_pagamento"
    ADD CONSTRAINT "folha_pagamento_pessoa_id_fkey" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fornecedores"
    ADD CONSTRAINT "fornecedores_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marcos_faturamento"
    ADD CONSTRAINT "marcos_faturamento_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."marcos_faturamento"
    ADD CONSTRAINT "marcos_faturamento_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marcos_faturamento"
    ADD CONSTRAINT "marcos_faturamento_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "public"."projetos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marcos_faturamento"
    ADD CONSTRAINT "marcos_faturamento_receita_id_fkey" FOREIGN KEY ("receita_id") REFERENCES "public"."receitas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."marcos_faturamento"
    ADD CONSTRAINT "marcos_faturamento_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."metas"
    ADD CONSTRAINT "metas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."metas"
    ADD CONSTRAINT "metas_pessoa_id_fkey" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."metas"
    ADD CONSTRAINT "metas_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "public"."projetos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."mfa_backup_codes"
    ADD CONSTRAINT "mfa_backup_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orcamento_versoes"
    ADD CONSTRAINT "orcamento_versoes_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."orcamento_versoes"
    ADD CONSTRAINT "orcamento_versoes_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orcamento_versoes"
    ADD CONSTRAINT "orcamento_versoes_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "public"."projetos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pessoas"
    ADD CONSTRAINT "pessoas_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."pessoas"
    ADD CONSTRAINT "pessoas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pessoas"
    ADD CONSTRAINT "pessoas_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."pessoas"
    ADD CONSTRAINT "pessoas_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."pilar_checkout_webhook_logs"
    ADD CONSTRAINT "pilar_checkout_webhook_logs_pending_signup_id_fkey" FOREIGN KEY ("pending_signup_id") REFERENCES "public"."pilar_pending_signups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pilar_checkout_webhook_logs"
    ADD CONSTRAINT "pilar_checkout_webhook_logs_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."pilar_subscriptions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pilar_pending_signups"
    ADD CONSTRAINT "pilar_pending_signups_empresa_owner_pending_id_fkey" FOREIGN KEY ("empresa_owner_pending_id") REFERENCES "public"."empresa_owners_pending"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pilar_pending_signups"
    ADD CONSTRAINT "pilar_pending_signups_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."pilar_subscription_plans"("id");



ALTER TABLE ONLY "public"."pilar_subscriptions"
    ADD CONSTRAINT "pilar_subscriptions_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pilar_subscriptions"
    ADD CONSTRAINT "pilar_subscriptions_pending_signup_id_fkey" FOREIGN KEY ("pending_signup_id") REFERENCES "public"."pilar_pending_signups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pilar_subscriptions"
    ADD CONSTRAINT "pilar_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."pilar_subscription_plans"("id");



ALTER TABLE ONLY "public"."portal_download_logs"
    ADD CONSTRAINT "portal_download_logs_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."portal_download_logs"
    ADD CONSTRAINT "portal_download_logs_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."portal_entregas"
    ADD CONSTRAINT "portal_entregas_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."portal_entregas"
    ADD CONSTRAINT "portal_entregas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."portal_entregas"
    ADD CONSTRAINT "portal_entregas_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "public"."projetos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."portal_tokens"
    ADD CONSTRAINT "portal_tokens_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."portal_tokens"
    ADD CONSTRAINT "portal_tokens_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."portal_tokens"
    ADD CONSTRAINT "portal_tokens_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."portal_tokens"
    ADD CONSTRAINT "portal_tokens_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "public"."projetos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."projeto_disciplina_responsaveis"
    ADD CONSTRAINT "projeto_disciplina_responsaveis_pessoa_id_fkey" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."projeto_disciplina_responsaveis"
    ADD CONSTRAINT "projeto_disciplina_responsaveis_projeto_disciplina_id_fkey" FOREIGN KEY ("projeto_disciplina_id") REFERENCES "public"."projeto_disciplinas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."projeto_disciplinas"
    ADD CONSTRAINT "projeto_disciplinas_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "public"."projetos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."projeto_orcamento_fases"
    ADD CONSTRAINT "projeto_orcamento_fases_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."projeto_orcamento_fases"
    ADD CONSTRAINT "projeto_orcamento_fases_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."projeto_orcamento_fases"
    ADD CONSTRAINT "projeto_orcamento_fases_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "public"."projetos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."projeto_orcamento_fases"
    ADD CONSTRAINT "projeto_orcamento_fases_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."projetos"
    ADD CONSTRAINT "projetos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."projetos"
    ADD CONSTRAINT "projetos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."projetos"
    ADD CONSTRAINT "projetos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."projetos"
    ADD CONSTRAINT "projetos_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."proposta_disciplinas"
    ADD CONSTRAINT "proposta_disciplinas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposta_disciplinas"
    ADD CONSTRAINT "proposta_disciplinas_proposta_id_fkey" FOREIGN KEY ("proposta_id") REFERENCES "public"."propostas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposta_templates"
    ADD CONSTRAINT "proposta_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."proposta_templates"
    ADD CONSTRAINT "proposta_templates_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."propostas"
    ADD CONSTRAINT "propostas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."propostas"
    ADD CONSTRAINT "propostas_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."propostas"
    ADD CONSTRAINT "propostas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."propostas"
    ADD CONSTRAINT "propostas_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."propostas"
    ADD CONSTRAINT "propostas_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "public"."projetos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."propostas"
    ADD CONSTRAINT "propostas_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."proposta_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."propostas"
    ADD CONSTRAINT "propostas_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."receitas"
    ADD CONSTRAINT "receitas_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias_financeiras"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."receitas"
    ADD CONSTRAINT "receitas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."receitas"
    ADD CONSTRAINT "receitas_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "public"."contas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."receitas"
    ADD CONSTRAINT "receitas_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."receitas"
    ADD CONSTRAINT "receitas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."receitas"
    ADD CONSTRAINT "receitas_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "public"."projetos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."receitas"
    ADD CONSTRAINT "receitas_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."saude_operacional_snapshots"
    ADD CONSTRAINT "saude_operacional_snapshots_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."templates_projeto"
    ADD CONSTRAINT "templates_projeto_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."templates_projeto"
    ADD CONSTRAINT "templates_projeto_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."templates_projeto"
    ADD CONSTRAINT "templates_projeto_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."timesheets"
    ADD CONSTRAINT "timesheets_aprovado_por_fkey" FOREIGN KEY ("aprovado_por") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."timesheets"
    ADD CONSTRAINT "timesheets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."timesheets"
    ADD CONSTRAINT "timesheets_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."timesheets"
    ADD CONSTRAINT "timesheets_pessoa_id_fkey" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."timesheets"
    ADD CONSTRAINT "timesheets_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "public"."projetos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."timesheets"
    ADD CONSTRAINT "timesheets_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."ultra_admin_modes"
    ADD CONSTRAINT "ultra_admin_modes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wip_snapshots"
    ADD CONSTRAINT "wip_snapshots_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."wip_snapshots"
    ADD CONSTRAINT "wip_snapshots_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wip_snapshots"
    ADD CONSTRAINT "wip_snapshots_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "public"."projetos"("id") ON DELETE CASCADE;



CREATE POLICY "AI Insights Full Admin" ON "public"."ai_insights" USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role"]))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role"])));



CREATE POLICY "AI Insights Insert Auth" ON "public"."ai_insights" FOR INSERT WITH CHECK (("empresa_id" = "public"."get_user_empresa_id"()));



CREATE POLICY "AI Insights Read" ON "public"."ai_insights" FOR SELECT USING (("empresa_id" = "public"."get_user_empresa_id"()));



CREATE POLICY "AI Usage Read" ON "public"."ai_usage" FOR SELECT USING (("empresa_id" = "public"."get_user_empresa_id"()));



CREATE POLICY "AI Usage Upsert" ON "public"."ai_usage" USING (("empresa_id" = "public"."get_user_empresa_id"())) WITH CHECK (("empresa_id" = "public"."get_user_empresa_id"()));



CREATE POLICY "Admin edita empresa" ON "public"."empresas" FOR UPDATE USING ((("id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role"])));



CREATE POLICY "Admin gere profiles" ON "public"."profiles" USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role"]))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role"])));



CREATE POLICY "Alertas Delete Admin" ON "public"."alertas" FOR DELETE USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role"])));



CREATE POLICY "Alertas Insert Admin" ON "public"."alertas" FOR INSERT WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role"])));



CREATE POLICY "Alertas Read" ON "public"."alertas" FOR SELECT USING (("empresa_id" = "public"."get_user_empresa_id"()));



CREATE POLICY "Alertas Update" ON "public"."alertas" FOR UPDATE USING (("empresa_id" = "public"."get_user_empresa_id"())) WITH CHECK (("empresa_id" = "public"."get_user_empresa_id"()));



CREATE POLICY "Alocacoes Full Admin/Op" ON "public"."alocacoes" USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role", 'operacional'::"public"."user_role"]))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role", 'operacional'::"public"."user_role"])));



CREATE POLICY "Alocacoes Read" ON "public"."alocacoes" FOR SELECT USING (("empresa_id" = "public"."get_user_empresa_id"()));



CREATE POLICY "Aprovacoes read all" ON "public"."aprovacoes" FOR SELECT USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND ("deleted_at" IS NULL)));



CREATE POLICY "Aprovacoes write admin" ON "public"."aprovacoes" USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role", 'financeiro'::"public"."user_role"]) AND ("deleted_at" IS NULL))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role", 'financeiro'::"public"."user_role"]) AND ("deleted_at" IS NULL)));



CREATE POLICY "Cartoes Full Access" ON "public"."cartoes_credito" USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role", 'financeiro'::"public"."user_role"]) AND ("deleted_at" IS NULL))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role", 'financeiro'::"public"."user_role"]) AND ("deleted_at" IS NULL)));



CREATE POLICY "Cartoes Read Only" ON "public"."cartoes_credito" FOR SELECT USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND ("deleted_at" IS NULL)));



CREATE POLICY "Categorias Full Access" ON "public"."categorias_financeiras" USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role", 'financeiro'::"public"."user_role"]))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role", 'financeiro'::"public"."user_role"])));



CREATE POLICY "Categorias Read Only" ON "public"."categorias_financeiras" FOR SELECT USING (("empresa_id" = "public"."get_user_empresa_id"()));



CREATE POLICY "ClientePortal Admin/Op" ON "public"."cliente_portal_accounts" USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role", 'operacional'::"public"."user_role"]))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role", 'operacional'::"public"."user_role"])));



CREATE POLICY "Clientes Full" ON "public"."clientes" USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role", 'marketing'::"public"."user_role"]) AND ("deleted_at" IS NULL))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role", 'marketing'::"public"."user_role"]) AND ("deleted_at" IS NULL)));



CREATE POLICY "Clientes Read" ON "public"."clientes" FOR SELECT USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['financeiro'::"public"."user_role", 'operacional'::"public"."user_role"]) AND ("deleted_at" IS NULL)));



CREATE POLICY "Contas Full Access" ON "public"."contas" USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role", 'financeiro'::"public"."user_role"]) AND ("deleted_at" IS NULL))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role", 'financeiro'::"public"."user_role"]) AND ("deleted_at" IS NULL)));



CREATE POLICY "Contas Read Only" ON "public"."contas" FOR SELECT USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND ("deleted_at" IS NULL)));



CREATE POLICY "Despesas Full Access" ON "public"."despesas" USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role", 'financeiro'::"public"."user_role"]) AND ("deleted_at" IS NULL))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role", 'financeiro'::"public"."user_role"]) AND ("deleted_at" IS NULL)));



CREATE POLICY "Despesas Read Only" ON "public"."despesas" FOR SELECT USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND ("deleted_at" IS NULL)));



CREATE POLICY "Enable delete access for admin users" ON "public"."disciplinas" FOR DELETE USING ("public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role"]));



CREATE POLICY "Enable delete access for admin users" ON "public"."metas" FOR DELETE USING ("public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role"]));



CREATE POLICY "Enable delete access for authenticated users based on company" ON "public"."folha_pagamento" FOR DELETE TO "authenticated" USING (("empresa_id" = ( SELECT "public"."get_user_empresa_id"() AS "get_user_empresa_id")));



CREATE POLICY "Enable insert access for authenticated users based on company" ON "public"."folha_pagamento" FOR INSERT TO "authenticated" WITH CHECK (("empresa_id" = ( SELECT "public"."get_user_empresa_id"() AS "get_user_empresa_id")));



CREATE POLICY "Enable read access for all users" ON "public"."disciplinas" FOR SELECT USING (true);



CREATE POLICY "Enable read access for authenticated users based on company" ON "public"."folha_pagamento" FOR SELECT TO "authenticated" USING (("empresa_id" = ( SELECT "public"."get_user_empresa_id"() AS "get_user_empresa_id")));



CREATE POLICY "Enable update access for admin users" ON "public"."disciplinas" FOR UPDATE USING ("public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role"]));



CREATE POLICY "Enable update access for admin users" ON "public"."metas" FOR UPDATE USING ("public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role"]));



CREATE POLICY "Enable update access for authenticated users based on company" ON "public"."folha_pagamento" FOR UPDATE TO "authenticated" USING (("empresa_id" = ( SELECT "public"."get_user_empresa_id"() AS "get_user_empresa_id")));



CREATE POLICY "Enable write access for admin users" ON "public"."disciplinas" FOR INSERT WITH CHECK ("public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role"]));



CREATE POLICY "Enable write access for admin users" ON "public"."metas" FOR INSERT WITH CHECK ("public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role"]));



CREATE POLICY "EscopoHist Insert" ON "public"."escopo_historico" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."escopos" "e"
  WHERE (("e"."id" = "escopo_historico"."escopo_id") AND ("e"."empresa_id" = "public"."get_user_empresa_id"())))));



CREATE POLICY "EscopoHist Read" ON "public"."escopo_historico" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."escopos" "e"
  WHERE (("e"."id" = "escopo_historico"."escopo_id") AND ("e"."empresa_id" = "public"."get_user_empresa_id"())))));



CREATE POLICY "EscopoItens Full" ON "public"."escopo_itens" USING ((EXISTS ( SELECT 1
   FROM "public"."escopos" "e"
  WHERE (("e"."id" = "escopo_itens"."escopo_id") AND ("e"."empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role", 'operacional'::"public"."user_role"]))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."escopos" "e"
  WHERE (("e"."id" = "escopo_itens"."escopo_id") AND ("e"."empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role", 'operacional'::"public"."user_role"])))));



CREATE POLICY "EscopoItens Read" ON "public"."escopo_itens" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."escopos" "e"
  WHERE (("e"."id" = "escopo_itens"."escopo_id") AND ("e"."empresa_id" = "public"."get_user_empresa_id"())))));



CREATE POLICY "Escopos Full Admin/Op" ON "public"."escopos" USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role", 'operacional'::"public"."user_role"]) AND ("deleted_at" IS NULL))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role", 'operacional'::"public"."user_role"]) AND ("deleted_at" IS NULL)));



CREATE POLICY "Escopos Read Fin" ON "public"."escopos" FOR SELECT USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['financeiro'::"public"."user_role"]) AND ("deleted_at" IS NULL)));



CREATE POLICY "Fluxos Full Admin/Op" ON "public"."fluxos_disciplinas" USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role", 'operacional'::"public"."user_role"]) AND ("deleted_at" IS NULL))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role", 'operacional'::"public"."user_role"]) AND ("deleted_at" IS NULL)));



CREATE POLICY "Fluxos Read All" ON "public"."fluxos_disciplinas" FOR SELECT USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND ("deleted_at" IS NULL)));



CREATE POLICY "Fornecedores Full Access" ON "public"."fornecedores" USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role", 'financeiro'::"public"."user_role"]) AND ("deleted_at" IS NULL))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role", 'financeiro'::"public"."user_role"]) AND ("deleted_at" IS NULL)));



CREATE POLICY "Fornecedores Read Only" ON "public"."fornecedores" FOR SELECT USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND ("deleted_at" IS NULL)));



CREATE POLICY "Leads Full" ON "public"."leads" USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role", 'marketing'::"public"."user_role"]) AND ("deleted_at" IS NULL))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role", 'marketing'::"public"."user_role"]) AND ("deleted_at" IS NULL)));



CREATE POLICY "Leads Read" ON "public"."leads" FOR SELECT USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['financeiro'::"public"."user_role"]) AND ("deleted_at" IS NULL)));



CREATE POLICY "Marcos Full Admin/Fin" ON "public"."marcos_faturamento" USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role", 'financeiro'::"public"."user_role"]) AND ("deleted_at" IS NULL))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role", 'financeiro'::"public"."user_role"]) AND ("deleted_at" IS NULL)));



CREATE POLICY "Marcos Read Op" ON "public"."marcos_faturamento" FOR SELECT USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['operacional'::"public"."user_role"]) AND ("deleted_at" IS NULL)));



CREATE POLICY "Metas read by company" ON "public"."metas" FOR SELECT USING (("empresa_id" = "public"."get_user_empresa_id"()));



CREATE POLICY "Orcamento Full Admin/Op" ON "public"."projeto_orcamento_fases" USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role", 'operacional'::"public"."user_role"]) AND ("deleted_at" IS NULL))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role", 'operacional'::"public"."user_role"]) AND ("deleted_at" IS NULL)));



CREATE POLICY "Orcamento Read Financeiro" ON "public"."projeto_orcamento_fases" FOR SELECT USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['financeiro'::"public"."user_role"]) AND ("deleted_at" IS NULL)));



CREATE POLICY "Pessoas Full" ON "public"."pessoas" USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role"]) AND ("deleted_at" IS NULL))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role"]) AND ("deleted_at" IS NULL)));



CREATE POLICY "Pessoas Read" ON "public"."pessoas" FOR SELECT USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND ("deleted_at" IS NULL)));



CREATE POLICY "PortalEntregas Full Admin/Op" ON "public"."portal_entregas" USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role", 'operacional'::"public"."user_role"]))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role", 'operacional'::"public"."user_role"])));



CREATE POLICY "PortalTokens Full Admin" ON "public"."portal_tokens" USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role", 'operacional'::"public"."user_role"]))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role", 'operacional'::"public"."user_role"])));



CREATE POLICY "Projetos Full" ON "public"."projetos" USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role", 'operacional'::"public"."user_role"]) AND ("deleted_at" IS NULL))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role", 'operacional'::"public"."user_role"]) AND ("deleted_at" IS NULL)));



CREATE POLICY "Projetos Read" ON "public"."projetos" FOR SELECT USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['financeiro'::"public"."user_role"]) AND ("deleted_at" IS NULL)));



CREATE POLICY "PropostaDisc Full" ON "public"."proposta_disciplinas" USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role", 'operacional'::"public"."user_role", 'marketing'::"public"."user_role"]))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role", 'operacional'::"public"."user_role", 'marketing'::"public"."user_role"])));



CREATE POLICY "PropostaDisc Read" ON "public"."proposta_disciplinas" FOR SELECT USING (("empresa_id" = "public"."get_user_empresa_id"()));



CREATE POLICY "PropostaTemplates Full" ON "public"."proposta_templates" USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role", 'operacional'::"public"."user_role", 'marketing'::"public"."user_role"]) AND ("deleted_at" IS NULL))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role", 'operacional'::"public"."user_role", 'marketing'::"public"."user_role"])));



CREATE POLICY "PropostaTemplates Read" ON "public"."proposta_templates" FOR SELECT USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND ("deleted_at" IS NULL)));



CREATE POLICY "Propostas Full Admin/Op/Mkt" ON "public"."propostas" USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role", 'operacional'::"public"."user_role", 'marketing'::"public"."user_role"]) AND ("deleted_at" IS NULL))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role", 'operacional'::"public"."user_role", 'marketing'::"public"."user_role"]) AND ("deleted_at" IS NULL)));



CREATE POLICY "Propostas Read Fin" ON "public"."propostas" FOR SELECT USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['financeiro'::"public"."user_role"]) AND ("deleted_at" IS NULL)));



CREATE POLICY "Receitas Full Access" ON "public"."receitas" USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role", 'financeiro'::"public"."user_role"]) AND ("deleted_at" IS NULL))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role", 'financeiro'::"public"."user_role"]) AND ("deleted_at" IS NULL)));



CREATE POLICY "Receitas Read Only" ON "public"."receitas" FOR SELECT USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND ("deleted_at" IS NULL)));



CREATE POLICY "Saude Read" ON "public"."saude_operacional_snapshots" FOR SELECT USING (("empresa_id" = "public"."get_user_empresa_id"()));



CREATE POLICY "Saude Upsert" ON "public"."saude_operacional_snapshots" USING (("empresa_id" = "public"."get_user_empresa_id"())) WITH CHECK (("empresa_id" = "public"."get_user_empresa_id"()));



CREATE POLICY "Templates Full Admin/Op" ON "public"."templates_projeto" USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role", 'operacional'::"public"."user_role"]) AND ("deleted_at" IS NULL))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role", 'operacional'::"public"."user_role"]) AND ("deleted_at" IS NULL)));



CREATE POLICY "Templates Read All" ON "public"."templates_projeto" FOR SELECT USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND ("deleted_at" IS NULL)));



CREATE POLICY "Timesheets Full Admin/Op" ON "public"."timesheets" USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role", 'operacional'::"public"."user_role"]) AND ("deleted_at" IS NULL))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role", 'operacional'::"public"."user_role"]) AND ("deleted_at" IS NULL)));



CREATE POLICY "Timesheets Insert Own" ON "public"."timesheets" FOR INSERT WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND ("deleted_at" IS NULL) AND ("pessoa_id" IN ( SELECT "p"."id"
   FROM "public"."pessoas" "p"
  WHERE ("p"."profile_id" = "auth"."uid"())))));



CREATE POLICY "Timesheets Own User" ON "public"."timesheets" FOR SELECT USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND ("deleted_at" IS NULL) AND ("pessoa_id" IN ( SELECT "p"."id"
   FROM "public"."pessoas" "p"
  WHERE ("p"."profile_id" = "auth"."uid"())))));



CREATE POLICY "Timesheets Read Financeiro" ON "public"."timesheets" FOR SELECT USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['financeiro'::"public"."user_role"]) AND ("deleted_at" IS NULL)));



CREATE POLICY "Timesheets Update Own Pending" ON "public"."timesheets" FOR UPDATE USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND ("deleted_at" IS NULL) AND ("status" = 'pendente'::"text") AND ("pessoa_id" IN ( SELECT "p"."id"
   FROM "public"."pessoas" "p"
  WHERE ("p"."profile_id" = "auth"."uid"()))))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND ("deleted_at" IS NULL) AND ("pessoa_id" IN ( SELECT "p"."id"
   FROM "public"."pessoas" "p"
  WHERE ("p"."profile_id" = "auth"."uid"())))));



CREATE POLICY "Ultra admin full convites" ON "public"."convites" TO "authenticated" USING ("public"."is_ultra_admin"()) WITH CHECK ("public"."is_ultra_admin"());



CREATE POLICY "Ultra admin full empresas" ON "public"."empresas" TO "authenticated" USING ("public"."is_ultra_admin"()) WITH CHECK ("public"."is_ultra_admin"());



CREATE POLICY "Ultra admin full profiles" ON "public"."profiles" TO "authenticated" USING ("public"."is_ultra_admin"()) WITH CHECK ("public"."is_ultra_admin"());



CREATE POLICY "Usuario edita seu profile" ON "public"."profiles" FOR UPDATE USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "Ver profiles da empresa" ON "public"."profiles" FOR SELECT USING (("empresa_id" = "public"."get_user_empresa_id"()));



CREATE POLICY "Ver própria empresa" ON "public"."empresas" FOR SELECT USING (("id" = "public"."get_user_empresa_id"()));



CREATE POLICY "Versoes read all" ON "public"."orcamento_versoes" FOR SELECT USING (("empresa_id" = "public"."get_user_empresa_id"()));



CREATE POLICY "Versoes write admin/op" ON "public"."orcamento_versoes" FOR INSERT WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role", 'operacional'::"public"."user_role"])));



CREATE POLICY "WIP read all roles" ON "public"."wip_snapshots" FOR SELECT USING (("empresa_id" = "public"."get_user_empresa_id"()));



CREATE POLICY "WIP write admin/fin" ON "public"."wip_snapshots" USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role", 'financeiro'::"public"."user_role"]))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role", 'financeiro'::"public"."user_role"])));



ALTER TABLE "public"."ai_insights" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_usage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."alertas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."alocacoes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."aprovacoes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."asaas_config" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "asaas_config_empresa_insert" ON "public"."asaas_config" FOR INSERT WITH CHECK (("empresa_id" IN ( SELECT "profiles"."empresa_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "asaas_config_empresa_select" ON "public"."asaas_config" FOR SELECT USING (("empresa_id" IN ( SELECT "profiles"."empresa_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "asaas_config_empresa_update" ON "public"."asaas_config" FOR UPDATE USING (("empresa_id" IN ( SELECT "profiles"."empresa_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



ALTER TABLE "public"."asaas_webhook_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "asaas_webhook_logs_select" ON "public"."asaas_webhook_logs" FOR SELECT USING (("empresa_id" IN ( SELECT "profiles"."empresa_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "audit admin read empresa" ON "public"."audit_logs" FOR SELECT TO "authenticated" USING (("public"."is_company_admin"() AND ((("metadata" ->> 'empresa_id'::"text"))::"uuid" = "public"."get_user_empresa_id"())));



CREATE POLICY "audit ultra_admin full" ON "public"."audit_logs" FOR SELECT TO "authenticated" USING ("public"."is_ultra_admin"());



ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cartoes_credito" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."categorias_financeiras" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cliente_portal_accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clientes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."convites" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "convites_admin_full" ON "public"."convites" USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role"]))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role"])));



ALTER TABLE "public"."critical_alerts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "critical_alerts_admin_read" ON "public"."critical_alerts" FOR SELECT USING (("empresa_id" = "public"."get_user_empresa_id"()));



ALTER TABLE "public"."despesas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."disciplinas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."empresa_owners_pending" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."empresas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."escopo_historico" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."escopo_itens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."escopos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."faturas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "faturas_delete" ON "public"."faturas" FOR DELETE USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role", 'financeiro'::"public"."user_role"])));



CREATE POLICY "faturas_insert" ON "public"."faturas" FOR INSERT WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role", 'financeiro'::"public"."user_role"])));



CREATE POLICY "faturas_select" ON "public"."faturas" FOR SELECT USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND ("deleted_at" IS NULL)));



CREATE POLICY "faturas_update" ON "public"."faturas" FOR UPDATE USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND ("deleted_at" IS NULL) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role", 'financeiro'::"public"."user_role"]))) WITH CHECK ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role", 'financeiro'::"public"."user_role"])));



ALTER TABLE "public"."fluxos_disciplinas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."folha_pagamento" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fornecedores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marcos_faturamento" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."metas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mfa_backup_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."orcamento_versoes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pessoas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pilar_checkout_webhook_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pilar_pending_signups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pilar_subscription_plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pilar_subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pilar_subscriptions_empresa_read" ON "public"."pilar_subscriptions" FOR SELECT USING (("empresa_id" = "public"."get_user_empresa_id"()));



CREATE POLICY "plans_public_read" ON "public"."pilar_subscription_plans" FOR SELECT USING (("ativo" = true));



ALTER TABLE "public"."portal_download_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "portal_download_logs_admin" ON "public"."portal_download_logs" FOR SELECT USING ((("empresa_id" = "public"."get_user_empresa_id"()) AND "public"."has_role"(VARIADIC ARRAY['admin'::"public"."user_role"])));



ALTER TABLE "public"."portal_entregas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."portal_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."projeto_disciplina_responsaveis" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "projeto_disciplina_responsaveis_empresa" ON "public"."projeto_disciplina_responsaveis" USING ((EXISTS ( SELECT 1
   FROM ("public"."projeto_disciplinas" "pd"
     JOIN "public"."projetos" "p" ON (("p"."id" = "pd"."projeto_id")))
  WHERE (("pd"."id" = "projeto_disciplina_responsaveis"."projeto_disciplina_id") AND ("p"."empresa_id" = "public"."get_user_empresa_id"())))));



ALTER TABLE "public"."projeto_disciplinas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "projeto_disciplinas_empresa" ON "public"."projeto_disciplinas" USING ((EXISTS ( SELECT 1
   FROM "public"."projetos"
  WHERE (("projetos"."id" = "projeto_disciplinas"."projeto_id") AND ("projetos"."empresa_id" = "public"."get_user_empresa_id"())))));



ALTER TABLE "public"."projeto_orcamento_fases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."projetos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."proposta_disciplinas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."proposta_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."propostas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rate_limit_attempts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."receitas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."saude_operacional_snapshots" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "self_read_ultra_admin_modes" ON "public"."ultra_admin_modes" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."templates_projeto" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."timesheets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ultra_admin_modes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wip_snapshots" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


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



GRANT ALL ON FUNCTION "public"."auto_complete_disciplinas"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_complete_disciplinas"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_complete_disciplinas"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_gerar_receita_from_marco"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_gerar_receita_from_marco"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_gerar_receita_from_marco"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_status_data"() TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_status_data"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_status_data"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_convite"("p_email" "text", "p_cargo" "text", "p_nome" "text", "p_features" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_convite"("p_email" "text", "p_cargo" "text", "p_nome" "text", "p_features" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_convite"("p_email" "text", "p_cargo" "text", "p_nome" "text", "p_features" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_projeto_completo"("p_codigo" "text", "p_nome" "text", "p_cliente_id" "uuid", "p_data_inicio" "date", "p_data_previsao" "date", "p_data_final" "date", "p_valor_contrato" numeric, "p_observacao" "text", "p_localizacao" "text", "p_parcelas" "text", "p_responsaveis" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_projeto_completo"("p_codigo" "text", "p_nome" "text", "p_cliente_id" "uuid", "p_data_inicio" "date", "p_data_previsao" "date", "p_data_final" "date", "p_valor_contrato" numeric, "p_observacao" "text", "p_localizacao" "text", "p_parcelas" "text", "p_responsaveis" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_projeto_completo"("p_codigo" "text", "p_nome" "text", "p_cliente_id" "uuid", "p_data_inicio" "date", "p_data_previsao" "date", "p_data_final" "date", "p_valor_contrato" numeric, "p_observacao" "text", "p_localizacao" "text", "p_parcelas" "text", "p_responsaveis" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_projeto_completo"("p_codigo" "text", "p_nome" "text", "p_cliente_id" "uuid", "p_data_inicio" "date", "p_data_previsao" "date", "p_data_final" "date", "p_valor_contrato" numeric, "p_observacao" "text", "p_localizacao" "text", "p_parcelas" "text", "p_area_m2" numeric, "p_disciplinas" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_projeto_completo"("p_codigo" "text", "p_nome" "text", "p_cliente_id" "uuid", "p_data_inicio" "date", "p_data_previsao" "date", "p_data_final" "date", "p_valor_contrato" numeric, "p_observacao" "text", "p_localizacao" "text", "p_parcelas" "text", "p_area_m2" numeric, "p_disciplinas" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_projeto_completo"("p_codigo" "text", "p_nome" "text", "p_cliente_id" "uuid", "p_data_inicio" "date", "p_data_previsao" "date", "p_data_final" "date", "p_valor_contrato" numeric, "p_observacao" "text", "p_localizacao" "text", "p_parcelas" "text", "p_area_m2" numeric, "p_disciplinas" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_projeto_completo"("p_codigo" "text", "p_nome" "text", "p_cliente_id" "uuid", "p_data_inicio" "date", "p_data_previsao" "date", "p_data_final" "date", "p_valor_contrato" numeric, "p_observacao" "text", "p_localizacao" "text", "p_parcelas" "text", "p_area_m2" numeric, "p_disciplinas" "jsonb", "p_prioridade" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_projeto_completo"("p_codigo" "text", "p_nome" "text", "p_cliente_id" "uuid", "p_data_inicio" "date", "p_data_previsao" "date", "p_data_final" "date", "p_valor_contrato" numeric, "p_observacao" "text", "p_localizacao" "text", "p_parcelas" "text", "p_area_m2" numeric, "p_disciplinas" "jsonb", "p_prioridade" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_projeto_completo"("p_codigo" "text", "p_nome" "text", "p_cliente_id" "uuid", "p_data_inicio" "date", "p_data_previsao" "date", "p_data_final" "date", "p_valor_contrato" numeric, "p_observacao" "text", "p_localizacao" "text", "p_parcelas" "text", "p_area_m2" numeric, "p_disciplinas" "jsonb", "p_prioridade" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_despesa_data_pagamento"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_despesa_data_pagamento"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_despesa_data_pagamento"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_receita_data_recebimento"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_receita_data_recebimento"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_receita_data_recebimento"() TO "service_role";



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



GRANT ALL ON FUNCTION "public"."insert_audit_log"("p_action" "text", "p_target_table" "text", "p_target_id" "uuid", "p_diff" "jsonb", "p_actor_id" "uuid", "p_actor_email" "text", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."insert_audit_log"("p_action" "text", "p_target_table" "text", "p_target_id" "uuid", "p_diff" "jsonb", "p_actor_id" "uuid", "p_actor_email" "text", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_audit_log"("p_action" "text", "p_target_table" "text", "p_target_id" "uuid", "p_diff" "jsonb", "p_actor_id" "uuid", "p_actor_email" "text", "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_company_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_company_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_company_admin"() TO "service_role";



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



GRANT ALL ON FUNCTION "public"."pagar_fatura"("p_fatura_id" "uuid", "p_conta_id" "uuid", "p_valor_pago" numeric, "p_data_pagamento" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."pagar_fatura"("p_fatura_id" "uuid", "p_conta_id" "uuid", "p_valor_pago" numeric, "p_data_pagamento" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pagar_fatura"("p_fatura_id" "uuid", "p_conta_id" "uuid", "p_valor_pago" numeric, "p_data_pagamento" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."pilar_set_ultra_admin_scope"("p_scoped" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."pilar_set_ultra_admin_scope"("p_scoped" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."pilar_set_ultra_admin_scope"("p_scoped" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."portal_login"("p_email" "text", "p_senha" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."portal_login"("p_email" "text", "p_senha" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."portal_login"("p_email" "text", "p_senha" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."portal_verify_session"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."portal_verify_session"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."portal_verify_session"("p_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_company_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_company_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_company_change"() TO "service_role";



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



GRANT ALL ON FUNCTION "public"."rpc_daily_maintenance"() TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_daily_maintenance"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_daily_maintenance"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_dashboard_rentabilidade"() TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_dashboard_rentabilidade"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_dashboard_rentabilidade"() TO "service_role";



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



GRANT ALL ON FUNCTION "public"."rpc_gerar_parcelas_projeto"("p_projeto_id" "uuid", "p_num_parcelas" integer, "p_intervalo_dias" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_gerar_parcelas_projeto"("p_projeto_id" "uuid", "p_num_parcelas" integer, "p_intervalo_dias" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_gerar_parcelas_projeto"("p_projeto_id" "uuid", "p_num_parcelas" integer, "p_intervalo_dias" integer) TO "service_role";



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



GRANT ALL ON FUNCTION "public"."tg_validate_profile_features"() TO "anon";
GRANT ALL ON FUNCTION "public"."tg_validate_profile_features"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tg_validate_profile_features"() TO "service_role";



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



GRANT ALL ON FUNCTION "public"."verify_portal_token"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."verify_portal_token"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_portal_token"("p_token" "text") TO "service_role";



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


















GRANT ALL ON TABLE "public"."ai_insights" TO "anon";
GRANT ALL ON TABLE "public"."ai_insights" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_insights" TO "service_role";



GRANT ALL ON TABLE "public"."ai_usage" TO "anon";
GRANT ALL ON TABLE "public"."ai_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_usage" TO "service_role";



GRANT ALL ON TABLE "public"."alertas" TO "anon";
GRANT ALL ON TABLE "public"."alertas" TO "authenticated";
GRANT ALL ON TABLE "public"."alertas" TO "service_role";



GRANT ALL ON TABLE "public"."alocacoes" TO "anon";
GRANT ALL ON TABLE "public"."alocacoes" TO "authenticated";
GRANT ALL ON TABLE "public"."alocacoes" TO "service_role";



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



GRANT ALL ON TABLE "public"."cartoes_credito" TO "anon";
GRANT ALL ON TABLE "public"."cartoes_credito" TO "authenticated";
GRANT ALL ON TABLE "public"."cartoes_credito" TO "service_role";



GRANT ALL ON TABLE "public"."categorias_financeiras" TO "anon";
GRANT ALL ON TABLE "public"."categorias_financeiras" TO "authenticated";
GRANT ALL ON TABLE "public"."categorias_financeiras" TO "service_role";



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



GRANT ALL ON TABLE "public"."fluxos_disciplinas" TO "anon";
GRANT ALL ON TABLE "public"."fluxos_disciplinas" TO "authenticated";
GRANT ALL ON TABLE "public"."fluxos_disciplinas" TO "service_role";



GRANT ALL ON TABLE "public"."folha_pagamento" TO "anon";
GRANT ALL ON TABLE "public"."folha_pagamento" TO "authenticated";
GRANT ALL ON TABLE "public"."folha_pagamento" TO "service_role";



GRANT ALL ON TABLE "public"."fornecedores" TO "anon";
GRANT ALL ON TABLE "public"."fornecedores" TO "authenticated";
GRANT ALL ON TABLE "public"."fornecedores" TO "service_role";



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



GRANT ALL ON TABLE "public"."portal_tokens" TO "anon";
GRANT ALL ON TABLE "public"."portal_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."portal_tokens" TO "service_role";



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



GRANT ALL ON TABLE "public"."receitas" TO "anon";
GRANT ALL ON TABLE "public"."receitas" TO "authenticated";
GRANT ALL ON TABLE "public"."receitas" TO "service_role";



GRANT ALL ON TABLE "public"."saude_operacional_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."saude_operacional_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."saude_operacional_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."templates_projeto" TO "anon";
GRANT ALL ON TABLE "public"."templates_projeto" TO "authenticated";
GRANT ALL ON TABLE "public"."templates_projeto" TO "service_role";



GRANT ALL ON TABLE "public"."timesheets" TO "anon";
GRANT ALL ON TABLE "public"."timesheets" TO "authenticated";
GRANT ALL ON TABLE "public"."timesheets" TO "service_role";



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



GRANT ALL ON TABLE "public"."wip_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."wip_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."wip_snapshots" TO "service_role";









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































