-- ============================================================================
-- SPEC 092 / ADR 0038: o layout ganha ZONA.
--
-- O painel passa a ter duas zonas: uma faixa fixa de KPIs no topo, que
-- acompanha a rolagem (a dock do painel), e a grade de widgets abaixo. Cada
-- item do layout declara em qual zona vive; sem `z`, é grade, o que mantém
-- compatível o layout de quem já salvou.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_painel_layout(p_layout jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_item jsonb;
  v_fixos int := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'sem sessão';
  END IF;

  IF p_layout IS NULL OR jsonb_typeof(p_layout) <> 'array' THEN
    RAISE EXCEPTION 'painel_layout: deve ser uma lista';
  END IF;

  IF jsonb_array_length(p_layout) > 40 THEN
    RAISE EXCEPTION 'painel_layout: no máximo 40 widgets';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_layout) LOOP
    IF COALESCE(jsonb_typeof(v_item -> 'w'), 'ausente') <> 'string'
       OR btrim(v_item ->> 'w') = '' THEN
      RAISE EXCEPTION 'painel_layout: cada item precisa de "w" (id do widget) como texto';
    END IF;
    IF COALESCE(v_item ->> 's', '') NOT IN ('kpi', 'terco', 'meia', 'inteira') THEN
      RAISE EXCEPTION 'painel_layout: tamanho inválido (%)', COALESCE(v_item ->> 's', 'ausente');
    END IF;
    -- Zona é opcional: ausente significa grade.
    IF v_item ? 'z' AND COALESCE(v_item ->> 'z', '') NOT IN ('topo', 'grade') THEN
      RAISE EXCEPTION 'painel_layout: zona inválida (%)', v_item ->> 'z';
    END IF;
    IF COALESCE(v_item ->> 'z', 'grade') = 'topo' THEN
      v_fixos := v_fixos + 1;
    END IF;
  END LOOP;

  -- A faixa fixa cabe numa linha; mais que isso deixa de ser dock e passa a
  -- roubar a tela inteira do conteúdo.
  IF v_fixos > 6 THEN
    RAISE EXCEPTION 'painel_layout: a faixa fixa aceita no máximo 6 indicadores';
  END IF;

  UPDATE public.profiles SET painel_layout = p_layout WHERE id = auth.uid();
END;
$fn$;

REVOKE ALL ON FUNCTION public.set_painel_layout(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_painel_layout(jsonb) TO authenticated;

COMMENT ON COLUMN public.profiles.painel_layout IS
  'SPEC 092: widgets escolhidos no /inicio. [{"w":"<id>","s":"kpi|terco|meia|inteira","z":"topo|grade"}]. z ausente = grade. Vazio = layout padrão do front.';


-- ── Dois blocos novos que o catálogo passou a oferecer ──────────────────────
-- Efetivo em obra (quanta gente esteve no campo na semana, pelo RDO) e projetos
-- por cliente (concentração de carteira em CONTAGEM, sem tocar em valor).
CREATE OR REPLACE FUNCTION public.get_painel_extra()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
SET search_path = public
AS $fn$
DECLARE
  v_hoje date := current_date;
  v_result jsonb;
BEGIN
  WITH
  efetivo AS (
    SELECT jsonb_agg(jsonb_build_object(
             'obraId', obra_id, 'obra', obra, 'media', media, 'dias', dias
           ) ORDER BY media DESC) AS items
    FROM (
      SELECT o.id AS obra_id, o.nome AS obra,
             ROUND(AVG(r.efetivo))::int AS media,
             COUNT(*)::int AS dias
      FROM public.obras o
      JOIN public.obra_rdo r ON r.obra_id = o.id
      WHERE o.deleted_at IS NULL AND o.status = 'em_andamento'
        AND r.data >= v_hoje - 7 AND r.efetivo IS NOT NULL
      GROUP BY o.id, o.nome
      ORDER BY 3 DESC
      LIMIT 8
    ) x
  ),
  por_cliente AS (
    SELECT jsonb_agg(jsonb_build_object(
             'clienteId', cliente_id, 'cliente', cliente, 'ativos', ativos, 'atrasados', atrasados
           ) ORDER BY ativos DESC) AS items
    FROM (
      SELECT c.id AS cliente_id,
             COALESCE(NULLIF(btrim(c.nome), ''), 'Sem cliente') AS cliente,
             COUNT(*)::int AS ativos,
             COUNT(*) FILTER (WHERE p.data_previsao IS NOT NULL AND p.data_previsao < v_hoje)::int AS atrasados
      FROM public.projetos p
      JOIN public.clientes c ON c.id = p.cliente_id
      WHERE p.deleted_at IS NULL AND p.status::text NOT IN ('Concluído', 'Cancelado')
      GROUP BY c.id, c.nome
      ORDER BY 3 DESC
      LIMIT 8
    ) x
  )
  SELECT jsonb_build_object(
    'efetivoObra', COALESCE((SELECT items FROM efetivo), '[]'::jsonb),
    'projetosPorCliente', COALESCE((SELECT items FROM por_cliente), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$fn$;

COMMENT ON FUNCTION public.get_painel_extra() IS
  'SPEC 092: blocos do painel que não cabiam na primeira leva (efetivo em obra pelo RDO, projetos por cliente em contagem). Separada para a chamada principal não crescer sem limite.';

REVOKE ALL ON FUNCTION public.get_painel_extra() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_painel_extra() TO authenticated;
