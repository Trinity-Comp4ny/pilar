-- Sentry PILAR-M e PILAR-K: dois RPCs quebrando em produção.
--
-- rpc_sync_metas: referenciava "updated_at" em UPDATE metas, coluna que a
-- tabela metas nunca teve (só created_at). Todo clique em "sincronizar metas"
-- falhava com 42703.
--
-- get_folha_preview: cast (d->>'responsavel_id')::uuid quebra com 22P02
-- quando a disciplina do projeto tem responsavel_id = "" (string vazia, não
-- null). NULLIF trata a string vazia como ausência de responsável, igual ao
-- caso já coberto de d->>'responsavel_id' IS NULL.
--
-- Nenhuma das duas está na allowlist de supabase/tests/anon_function_grants.sql
-- (20260836000000 já revogou as duas do vetor anon). DROP FUNCTION apaga os
-- grants existentes e a função nasce de novo executável por PUBLIC (default
-- privilege do supabase_admin, não contornável por ALTER DEFAULT PRIVILEGES —
-- ver nota em 20260836000000): REVOKE FROM PUBLIC explícito depois do CREATE
-- evita reabrir a classe de bug daquela migration.

DROP FUNCTION IF EXISTS public.rpc_sync_metas();

CREATE FUNCTION public.rpc_sync_metas() RETURNS integer
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
      UPDATE metas SET atual = v_valor WHERE id = v_meta.id;
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION "public"."rpc_sync_metas"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_sync_metas"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_sync_metas"() TO "service_role";

DROP FUNCTION IF EXISTS public.get_folha_preview(integer, integer);

CREATE FUNCTION public.get_folha_preview(p_mes integer, p_ano integer)
 RETURNS TABLE(
   pessoa_id uuid,
   nome text,
   cargo text,
   salario_fixo numeric,
   valor_m2 numeric,
   total_area numeric,
   total_variavel numeric,
   total_receber numeric,
   projetos_nomes text[],
   detalhe_projetos jsonb
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      array_agg(pp.projeto_nome) FILTER (WHERE pp.id IS NOT NULL) as lista_projetos,
      jsonb_agg(
        jsonb_build_object('nome', pp.projeto_nome, 'area_m2', COALESCE(pp.area_m2, 0))
      ) FILTER (WHERE pp.id IS NOT NULL) as detalhe
    FROM public.pessoas pe
    LEFT JOIN projetos_periodo pp ON EXISTS (
      SELECT 1
      FROM jsonb_array_elements(pp.disciplinas) as d
      WHERE NULLIF(d->>'responsavel_id', '')::uuid = pe.id
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
    COALESCE(c.lista_projetos, ARRAY[]::TEXT[]),
    COALESCE(c.detalhe, '[]'::jsonb)
  FROM calculo_por_pessoa c
  ORDER BY c.p_nome;
END;
$function$;

REVOKE EXECUTE ON FUNCTION "public"."get_folha_preview"(integer, integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_folha_preview"(integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_folha_preview"(integer, integer) TO "service_role";
