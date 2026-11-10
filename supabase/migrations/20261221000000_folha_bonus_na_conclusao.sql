-- Folha: o bônus de produtividade entra quando a disciplina é concluída.
--
-- Até aqui get_folha_preview pegava os projetos que COMEÇARAM no mês da folha
-- (projetos.data_inicio). Na VRZ (10/11) o bônus de um projeto fechado na semana
-- anterior, que nem tinha começado, já aparecia na folha. Regra nova, pedida pelo
-- escritório: o bônus entra quando a disciplina da pessoa é concluída.
--
--   * O projeto conta para a pessoa no mês em que ela conclui uma disciplina dela
--     naquele projeto. A base do bônus é do projeto (área × valor/m² e valor do
--     contrato × percentual), então cada projeto paga UMA vez por pessoa: no mês da
--     primeira disciplina dela concluída ali. Uma segunda disciplina da mesma pessoa
--     no mesmo projeto não paga de novo.
--   * Projeto já pago à pessoa numa folha fechada de outro mês não volta (disciplina
--     reaberta e concluída de novo não paga duas vezes). Vale para folhas fechadas a
--     partir desta regra, que gravam projeto_id no detalhe.
--   * Vínculo pela tabela relacional projeto_disciplina_responsaveis (a fonte de
--     verdade). O JSON legado projetos.disciplinas fica para trás: só olhava o
--     primeiro responsável e não acompanhava status mudado fora do formulário.
--   * Projeto excluído ou cancelado não paga bônus.
--
-- "Concluída" segue pilar_status_bucket (texto livre: 'Concluído', 'Concluida').
-- A data é projeto_disciplinas.data_fim_real. A troca de status direta (Meu
-- Trabalho, tabela de disciplinas) não preenchia essa data; o trigger abaixo
-- passa a preencher, e o backfill cobre as concluídas sem data.
--
-- Meses já fechados não mudam: folha_pagamento é snapshot.

-- 1. Conclusão da disciplina sempre tem data ----------------------------------
CREATE OR REPLACE FUNCTION public.projeto_disciplina_data_conclusao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF public.pilar_status_bucket(NEW.status) = 'concluida' THEN
    NEW.data_fim_real := COALESCE(NEW.data_fim_real, CURRENT_DATE);
  ELSIF TG_OP = 'UPDATE' AND public.pilar_status_bucket(OLD.status) = 'concluida' THEN
    -- Reaberta: a conclusão antiga deixa de valer (mesma regra do checklist).
    NEW.data_fim_real := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

-- Trigger dispara sem EXECUTE; ninguém precisa chamar a função direto.
REVOKE ALL ON FUNCTION public.projeto_disciplina_data_conclusao() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_projeto_disciplina_data_conclusao ON public.projeto_disciplinas;
CREATE TRIGGER trg_projeto_disciplina_data_conclusao
  BEFORE INSERT OR UPDATE OF status ON public.projeto_disciplinas
  FOR EACH ROW EXECUTE FUNCTION public.projeto_disciplina_data_conclusao();

-- Concluídas sem data: a última alteração é a melhor aproximação da conclusão.
UPDATE public.projeto_disciplinas
SET data_fim_real = updated_at::date
WHERE data_fim_real IS NULL
  AND public.pilar_status_bucket(status) = 'concluida';

-- 2. Prévia da folha pela conclusão da disciplina -------------------------------------------
-- Mesmo tipo de retorno de 20261209000000 (CREATE OR REPLACE basta). O
-- detalhe_projetos ganha projeto_id e concluido_em, chaves a mais no jsonb.
CREATE OR REPLACE FUNCTION public.get_folha_preview(p_mes integer, p_ano integer)
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
   detalhe_projetos jsonb,
   percentual_producao numeric,
   total_valor_base numeric
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa_id UUID;
BEGIN
  IF NOT public.can_view_folha() THEN
    RAISE EXCEPTION 'Sem permissão para ver a folha';
  END IF;

  v_empresa_id := public.get_user_empresa_id();

  RETURN QUERY
  WITH parte_da_pessoa AS (
    -- Uma linha por pessoa e projeto: quando ela concluiu a primeira disciplina ali.
    SELECT
      r.pessoa_id AS pe_id,
      d.projeto_id,
      min(d.data_fim_real) AS concluido_em
    FROM public.projeto_disciplina_responsaveis r
    JOIN public.projeto_disciplinas d ON d.id = r.projeto_disciplina_id
    WHERE public.pilar_status_bucket(d.status) = 'concluida'
      AND d.data_fim_real IS NOT NULL
    GROUP BY r.pessoa_id, d.projeto_id
  ),
  projetos_periodo AS (
    SELECT
      pp.pe_id,
      pr.id,
      pr.nome AS projeto_nome,
      COALESCE(pr.area_m2, 0) AS area_m2,
      COALESCE(pr.valor_contrato, 0) AS valor_base,
      pp.concluido_em
    FROM parte_da_pessoa pp
    JOIN public.projetos pr ON pr.id = pp.projeto_id
    WHERE pr.empresa_id = v_empresa_id
      AND pr.deleted_at IS NULL
      AND pr.status IS DISTINCT FROM 'Cancelado'
      AND EXTRACT(MONTH FROM pp.concluido_em) = p_mes
      AND EXTRACT(YEAR FROM pp.concluido_em) = p_ano
      AND NOT EXISTS (
        SELECT 1
        FROM public.folha_pagamento f
        CROSS JOIN LATERAL jsonb_array_elements(
          CASE WHEN jsonb_typeof(f.detalhe_projetos) = 'array' THEN f.detalhe_projetos ELSE '[]'::jsonb END
        ) AS e
        WHERE f.empresa_id = v_empresa_id
          AND f.pessoa_id = pp.pe_id
          AND f.status IS DISTINCT FROM 'cancelado'
          AND (f.ano, f.mes) <> (p_ano, p_mes)
          AND e ->> 'projeto_id' = pr.id::text
      )
  ),
  calculo_por_pessoa AS (
    SELECT
      pe.id AS p_id,
      pe.nome AS p_nome,
      pe.cargo AS p_cargo,
      COALESCE(pe.salario_fixo, 0) AS p_salario_fixo,
      COALESCE(pe.valor_m2, 0) AS p_valor_m2,
      COALESCE(pe.percentual_producao, 0) AS p_percentual,
      COALESCE(SUM(pp.area_m2) FILTER (WHERE pp.id IS NOT NULL), 0) AS soma_area,
      COALESCE(SUM(pp.valor_base) FILTER (WHERE pp.id IS NOT NULL), 0) AS soma_valor_base,
      array_agg(pp.projeto_nome ORDER BY pp.concluido_em, pp.projeto_nome)
        FILTER (WHERE pp.id IS NOT NULL) AS lista_projetos,
      jsonb_agg(
        jsonb_build_object(
          'projeto_id', pp.id,
          'nome', pp.projeto_nome,
          'area_m2', pp.area_m2,
          'valor_base', pp.valor_base,
          'concluido_em', pp.concluido_em
        )
        ORDER BY pp.concluido_em, pp.projeto_nome
      ) FILTER (WHERE pp.id IS NOT NULL) AS detalhe
    FROM public.pessoas pe
    LEFT JOIN projetos_periodo pp ON pp.pe_id = pe.id
    WHERE pe.empresa_id = v_empresa_id
      AND pe.deleted_at IS NULL
      AND pe.status = 'ativo'
    GROUP BY pe.id
  ),
  com_variavel AS (
    SELECT
      c.*,
      round(c.soma_area * c.p_valor_m2 + c.soma_valor_base * c.p_percentual / 100, 2) AS v_variavel
    FROM calculo_por_pessoa c
  )
  SELECT
    v.p_id,
    v.p_nome,
    v.p_cargo,
    v.p_salario_fixo,
    v.p_valor_m2,
    v.soma_area,
    v.v_variavel,
    round(v.p_salario_fixo + v.v_variavel, 2),
    COALESCE(v.lista_projetos, ARRAY[]::TEXT[]),
    COALESCE(v.detalhe, '[]'::jsonb),
    v.p_percentual,
    v.soma_valor_base
  FROM com_variavel v
  ORDER BY v.p_nome;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_folha_preview(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_folha_preview(integer, integer) TO authenticated;
