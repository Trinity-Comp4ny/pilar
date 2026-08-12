-- Folha: persistir o detalhe por projeto que gera o variável (snapshot no
-- fechamento) e expor esse detalhe já no preview, para o comprovante conseguir
-- destrinchar "de qual projeto veio o variável de cada pessoa".
--
-- Antes: get_folha_preview só devolvia projetos_nomes (array de nomes) e a folha
-- fechada não guardava nada disso, então o closed/histórico perdia a origem do
-- variável. Ver docs/specs/032-folha-comprovante-e-revisao.md.

-- 1) Snapshot por pessoa gravado ao fechar a folha. Não muda se o projeto mudar
--    depois: é a foto do que foi pago naquele mês.
ALTER TABLE public.folha_pagamento
  ADD COLUMN IF NOT EXISTS detalhe_projetos jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2) Preview passa a devolver detalhe_projetos: [{ nome, area_m2 }] por pessoa.
--    Supabase falha silenciosamente ao recriar função com overload divergente,
--    então DROP explícito antes do CREATE (ver memória feedback_supabase_function_overload).
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
    COALESCE(c.lista_projetos, ARRAY[]::TEXT[]),
    COALESCE(c.detalhe, '[]'::jsonb)
  FROM calculo_por_pessoa c
  ORDER BY c.p_nome;
END;
$function$
;
