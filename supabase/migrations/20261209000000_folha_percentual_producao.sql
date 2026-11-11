-- Folha: remuneração por porcentagem sobre o valor do projeto.
--
-- Até aqui a folha só pagava salário fixo + valor por m² (área dos projetos em
-- que a pessoa é responsável de disciplina, iniciados no mês). Há escritórios
-- que pagam produtividade por porcentagem: o montador recebe 10% do armário
-- de R$ 10 mil, o projetista recebe X% do contrato. Esta migration acrescenta
-- esse terceiro componente, que soma com os outros dois:
--
--   variável = Σ área × valor/m²  +  Σ valor do projeto × percentual / 100
--   total    = salário fixo + variável
--
-- A base do percentual é projetos.valor_contrato, com a mesma regra de
-- vínculo do m²: a pessoa responde por alguma disciplina do projeto e o projeto
-- começou no mês da folha. Cada projeto conta uma vez por pessoa.
--
-- O percentual é dado de folha, tão sensível quanto salário e valor/m²:
--   * pessoas.percentual_producao fica FORA do GRANT SELECT por coluna de
--     authenticated (20260715000050). A coluna nova nasce sem SELECT; a leitura
--     é só pela pessoas_safe, que devolve o valor real com can_view_folha().
--   * o trigger de escrita sensível (20260875000000) passa a cobri-la.

-- 1. Percentual na pessoa ------------------------------------------------------
ALTER TABLE public.pessoas
  ADD COLUMN IF NOT EXISTS percentual_producao numeric(5,2);

ALTER TABLE public.pessoas
  DROP CONSTRAINT IF EXISTS pessoas_percentual_producao_faixa;
ALTER TABLE public.pessoas
  ADD CONSTRAINT pessoas_percentual_producao_faixa
  CHECK (percentual_producao IS NULL OR (percentual_producao >= 0 AND percentual_producao <= 100));

COMMENT ON COLUMN public.pessoas.percentual_producao IS
  'Percentual (0 a 100) sobre o valor do contrato dos projetos em que a pessoa responde por disciplina no mês. Dado de folha: leitura só via pessoas_safe.';

-- 2. Snapshot na folha fechada -------------------------------------------------
-- percentual_producao: o percentual vigente no fechamento.
-- total_valor_base: soma dos valores de contrato que serviram de base.
-- adicional_variavel continua sendo o variável inteiro (m² + percentual).
ALTER TABLE public.folha_pagamento
  ADD COLUMN IF NOT EXISTS percentual_producao numeric(5,2),
  ADD COLUMN IF NOT EXISTS total_valor_base numeric(14,2);

-- 3. Escrita sensível: inclui o percentual ------------------------------------
CREATE OR REPLACE FUNCTION public.tg_pessoas_protege_sensiveis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (
    NEW.salario_fixo IS DISTINCT FROM OLD.salario_fixo
    OR NEW.valor_m2 IS DISTINCT FROM OLD.valor_m2
    OR NEW.percentual_producao IS DISTINCT FROM OLD.percentual_producao
    OR NEW.cpf IS DISTINCT FROM OLD.cpf
    OR NEW.chaves_pix IS DISTINCT FROM OLD.chaves_pix
    OR NEW.contas_bancarias IS DISTINCT FROM OLD.contas_bancarias
  ) AND NOT public.can_view_folha() THEN
    RAISE EXCEPTION 'Sem permissão para alterar dados sensíveis da pessoa'
      USING ERRCODE = '42501';
  END IF;

  -- chaves_pix/contas_bancarias têm DEFAULT '[]'::jsonb: comparar com o
  -- default, não com NULL (ver 20260875000000).
  IF TG_OP = 'INSERT' AND (
    NEW.salario_fixo IS NOT NULL
    OR NEW.valor_m2 IS NOT NULL
    OR NEW.percentual_producao IS NOT NULL
    OR NEW.cpf IS NOT NULL
    OR NEW.chaves_pix IS DISTINCT FROM '[]'::jsonb
    OR NEW.contas_bancarias IS DISTINCT FROM '[]'::jsonb
  ) AND NOT public.can_view_folha() THEN
    RAISE EXCEPTION 'Sem permissão para definir dados sensíveis da pessoa'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

-- 4. pessoas_safe: expõe o percentual mascarado ------------------------------
-- CREATE OR REPLACE mantém os grants (20261022000000) e só acrescenta a coluna
-- no fim. Corpo idêntico ao de 20260715000050 + percentual_producao.
CREATE OR REPLACE VIEW public.pessoas_safe WITH (security_barrier = true) AS
SELECT
  p.id,
  p.empresa_id,
  p.profile_id,
  p.nome,
  p.primeiro_nome,
  p.sobrenome,
  p.cargo,
  p.email,
  p.telefone,
  p.tipo_contrato,
  p.status,
  p.endereco,
  p.rg,
  p.data_nascimento,
  p.data_admissao,
  p.data_demissao,
  p.cnpj,
  p.razao_social,
  p.pis_nit,
  p.horas_semanais,
  p.deleted_at,
  p.created_at,
  p.updated_at,
  public.can_view_folha() AS pode_ver_sensivel,
  CASE
    WHEN public.can_view_folha() THEN p.cpf
    WHEN p.cpf IS NULL OR p.cpf = '' THEN p.cpf
    ELSE '***.***.***-' || right(regexp_replace(p.cpf, '\D', '', 'g'), 2)
  END AS cpf,
  CASE WHEN public.can_view_folha() THEN p.salario_fixo END AS salario_fixo,
  CASE WHEN public.can_view_folha() THEN p.valor_m2 END AS valor_m2,
  CASE WHEN public.can_view_folha() THEN p.contas_bancarias ELSE '[]'::jsonb END AS contas_bancarias,
  CASE WHEN public.can_view_folha() THEN p.chaves_pix ELSE '[]'::jsonb END AS chaves_pix,
  CASE WHEN public.can_view_folha() THEN p.percentual_producao END AS percentual_producao
FROM public.pessoas p
WHERE p.empresa_id = public.get_user_empresa_id()
  AND public.user_has_feature('pessoas', 'viewer');

-- 5. Prévia da folha com o percentual -----------------------------------------
-- O tipo de retorno muda (colunas novas), então DROP + CREATE. Gate e
-- tenancy iguais a 20260878000000.
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
  WITH projetos_periodo AS (
    SELECT
      pr.id,
      pr.nome as projeto_nome,
      COALESCE(pr.area_m2, 0) as area_m2,
      COALESCE(pr.valor_contrato, 0) as valor_base,
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
      COALESCE(pe.percentual_producao, 0) as p_percentual,
      COALESCE(SUM(pp.area_m2) FILTER (WHERE pp.id IS NOT NULL), 0) as soma_area,
      COALESCE(SUM(pp.valor_base) FILTER (WHERE pp.id IS NOT NULL), 0) as soma_valor_base,
      array_agg(pp.projeto_nome) FILTER (WHERE pp.id IS NOT NULL) as lista_projetos,
      jsonb_agg(
        jsonb_build_object(
          'nome', pp.projeto_nome,
          'area_m2', pp.area_m2,
          'valor_base', pp.valor_base
        )
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
  ),
  com_variavel AS (
    SELECT
      c.*,
      round(c.soma_area * c.p_valor_m2 + c.soma_valor_base * c.p_percentual / 100, 2) as v_variavel
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
