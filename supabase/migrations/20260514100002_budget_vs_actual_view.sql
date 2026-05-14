-- Migration: View Budget vs Actual por disciplina em cada projeto
--
-- Tabelas utilizadas:
--   public.projeto_orcamento_fases  — orçado por disciplina (horas_estimadas, custo_estimado GENERATED)
--   public.projetos                 — para obter empresa_id e filtrar soft-delete
--
-- Nota: horas_reais e custo_real estão zerados enquanto timesheet estiver dormente.
-- Quando timesheet for reativado, substituir os literais 0::DECIMAL pelas
-- subqueries em public.timesheets (projeto_id, horas, status = 'aprovado').

DROP VIEW IF EXISTS public.v_budget_vs_actual;

CREATE OR REPLACE VIEW public.v_budget_vs_actual AS
SELECT
  pof.id,
  pof.projeto_id,
  p.empresa_id,
  pof.disciplina,
  COALESCE(pof.horas_estimadas, 0)  AS horas_orcadas,
  COALESCE(pof.custo_estimado, 0)   AS custo_orcado,
  -- Horas e custo reais virão de timesheets quando reativado; por ora usa 0
  0::DECIMAL                         AS horas_reais,
  0::DECIMAL                         AS custo_real,
  -- Percentual de horas consumidas sobre o orçado
  CASE
    WHEN COALESCE(pof.horas_estimadas, 0) > 0
      THEN ROUND((0::DECIMAL / pof.horas_estimadas) * 100, 1)
    ELSE 0
  END                                AS pct_consumido,
  -- Semáforo de orçamento
  CASE
    WHEN COALESCE(pof.horas_estimadas, 0) = 0 THEN 'sem_orcamento'
    WHEN 0::DECIMAL >= pof.horas_estimadas       THEN 'estourado'
    WHEN 0::DECIMAL >= pof.horas_estimadas * 0.8 THEN 'atencao'
    ELSE 'ok'
  END                                AS status_orcamento
FROM public.projeto_orcamento_fases pof
JOIN public.projetos p
  ON p.id = pof.projeto_id
  AND p.deleted_at IS NULL
WHERE pof.deleted_at IS NULL;

COMMENT ON VIEW public.v_budget_vs_actual IS
  'Orçado vs realizado por disciplina (projeto_orcamento_fases). '
  'horas_reais/custo_real serão preenchidos quando o módulo de timesheet for reativado.';

GRANT SELECT ON public.v_budget_vs_actual TO authenticated;
