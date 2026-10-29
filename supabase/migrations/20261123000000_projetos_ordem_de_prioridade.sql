-- SPEC 143 (BEZ-350): ordem de prioridade dos projetos, definida pelo coordenador.
--
-- 1. projetos.ordem_prioridade (menor número primeiro; nulo = sem ordem, vai para o fim).
-- 2. projetos_safe passa a expor a coluna (o front lê por ela).
-- 3. rpc_reordenar_projetos(uuid[]): grava 1..N na ordem recebida, numa só chamada. A ordem é uma
--    só por empresa, então só quem edita projetos grava (mesma permissão do arraste no quadro).

ALTER TABLE public.projetos
  ADD COLUMN IF NOT EXISTS ordem_prioridade integer;

COMMENT ON COLUMN public.projetos.ordem_prioridade IS
  'Ordem de prioridade definida pelo coordenador (1 = primeiro). Nulo = sem ordem. Gravada só por rpc_reordenar_projetos.';

CREATE INDEX IF NOT EXISTS idx_projetos_empresa_ordem_prioridade
  ON public.projetos (empresa_id, ordem_prioridade)
  WHERE ordem_prioridade IS NOT NULL AND deleted_at IS NULL;

-- O front lê projetos pela view projetos_safe, que lista as colunas uma a uma: sem isto a ordem não
-- chega à tela. Coluna nova no fim (CREATE OR REPLACE não deixa mudar a ordem das existentes). O WITH
-- é repetido de propósito: CREATE OR REPLACE sem ele zera o security_barrier.
CREATE OR REPLACE VIEW public.projetos_safe WITH (security_barrier = true) AS
SELECT
  p.id,
  p.empresa_id,
  p.cliente_id,
  p.codigo_projeto,
  p.nome,
  p.localizacao,
  p.latitude,
  p.longitude,
  p.status,
  p.status_data,
  p.data_inicio,
  p.data_previsao,
  p.data_final,
  p.observacao,
  p.parcelas,
  p.area_m2,
  p.prioridade,
  p.etapa_id,
  p.disciplinas,
  p.comentarios,
  p.links,
  p.deleted_at,
  p.created_at,
  p.created_by,
  p.updated_at,
  p.updated_by,
  public.can_view_financeiro() AS pode_ver_valor,
  CASE WHEN public.can_view_financeiro() THEN p.valor_contrato END AS valor_contrato,
  CASE WHEN public.can_view_financeiro() THEN p.custo_indireto_pct END AS custo_indireto_pct,
  p.ordem_prioridade
FROM public.projetos p
WHERE p.empresa_id = public.get_user_empresa_id()
  AND p.deleted_at IS NULL
  AND public.user_has_feature('projetos', 'viewer');

CREATE OR REPLACE FUNCTION public.rpc_reordenar_projetos(p_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa  uuid := public.get_user_empresa_id();
  v_distintos int;
  v_validos   int;
BEGIN
  IF v_empresa IS NULL OR NOT public.user_has_feature('projetos', 'editor') THEN
    RAISE EXCEPTION 'Sem permissão para reordenar projetos';
  END IF;

  IF p_ids IS NULL OR cardinality(p_ids) = 0 THEN
    RETURN;
  END IF;

  IF cardinality(p_ids) > 1000 THEN
    RAISE EXCEPTION 'Projetos demais para reordenar de uma vez';
  END IF;

  SELECT count(DISTINCT x) INTO v_distintos FROM unnest(p_ids) AS x;
  IF v_distintos <> cardinality(p_ids) THEN
    RAISE EXCEPTION 'A lista de projetos tem repetidos';
  END IF;

  -- Um id de outra empresa (ou apagado) derruba a chamada inteira: nada é gravado.
  SELECT count(*) INTO v_validos
  FROM public.projetos
  WHERE id = ANY (p_ids) AND empresa_id = v_empresa AND deleted_at IS NULL;
  IF v_validos <> cardinality(p_ids) THEN
    RAISE EXCEPTION 'Projeto não encontrado ou sem permissão';
  END IF;

  -- Só toca a linha cuja posição mudou, para não mexer em updated_at à toa.
  UPDATE public.projetos p
  SET ordem_prioridade = o.pos
  FROM unnest(p_ids) WITH ORDINALITY AS o(id, pos)
  WHERE p.id = o.id
    AND p.empresa_id = v_empresa
    AND p.ordem_prioridade IS DISTINCT FROM o.pos::integer;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_reordenar_projetos(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_reordenar_projetos(uuid[]) TO authenticated;
