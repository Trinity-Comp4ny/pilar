-- Spec 014 · Board unificado de "Meu trabalho"
-- A tarefa ganha prioridade e horas estimadas (a disciplina já tem prioridade).
-- A RPC get_minhas_disciplinas passa a devolver prioridade, responsável e o
-- acabamento (labels/links) para alimentar o mesmo board que as tarefas usam.
--
-- Nota de decisão: horas estimadas foi reaberta por decisão explícita do CEO
-- (2026-07-30), ciente de que o painel a havia travado até a captura de horas
-- (gate 2). É campo opcional, sem cálculo de margem — não toca rentabilidade.

-- Tarefa: prioridade (mesmo domínio da disciplina, em minúsculo) + horas -------
ALTER TABLE public.tarefas
  ADD COLUMN IF NOT EXISTS prioridade text NOT NULL DEFAULT 'media'
    CHECK (prioridade IN ('alta', 'media', 'baixa')),
  ADD COLUMN IF NOT EXISTS horas_estimadas numeric;

COMMENT ON COLUMN public.tarefas.prioridade IS 'Prioridade: alta/media/baixa (spec 014).';
COMMENT ON COLUMN public.tarefas.horas_estimadas IS 'Horas estimadas, opcional (spec 014). Sem cálculo de margem.';

-- RPC da aba Projetos: agora com prioridade, responsável e acabamento ---------
-- Mudança de assinatura de retorno exige DROP + CREATE (ADR / overloads).
DROP FUNCTION IF EXISTS public.get_minhas_disciplinas(uuid);

CREATE FUNCTION public.get_minhas_disciplinas(p_pessoa_id uuid DEFAULT NULL)
RETURNS TABLE (
  id               uuid,
  titulo           text,
  status_bucket    text,
  status_raw       text,
  prioridade       text,
  prazo            date,
  projeto_id       uuid,
  projeto_nome     text,
  responsavel_id   uuid,
  responsavel_nome text,
  labels           text[],
  links            jsonb
)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    pd.id,
    pd.nome AS titulo,
    public.pilar_status_bucket(pd.status) AS status_bucket,
    pd.status AS status_raw,
    CASE
      WHEN lower(pd.prioridade) LIKE 'alta%'  THEN 'alta'
      WHEN lower(pd.prioridade) LIKE 'baixa%' THEN 'baixa'
      ELSE 'media'
    END AS prioridade,
    pd.data_fim AS prazo,
    p.id AS projeto_id,
    p.nome AS projeto_nome,
    r.pessoa_id AS responsavel_id,
    resp.nome AS responsavel_nome,
    COALESCE(pd.labels, '{}') AS labels,
    COALESCE(pd.links, '[]'::jsonb) AS links
  FROM public.projeto_disciplinas pd
  JOIN public.projeto_disciplina_responsaveis r ON r.projeto_disciplina_id = pd.id
  JOIN public.projetos p ON p.id = pd.projeto_id
  LEFT JOIN public.pessoas resp ON resp.id = r.pessoa_id
  WHERE r.pessoa_id = COALESCE(
    p_pessoa_id,
    (SELECT ps.id FROM public.pessoas ps
      WHERE ps.profile_id = auth.uid() AND ps.deleted_at IS NULL
      LIMIT 1)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_minhas_disciplinas(uuid) TO authenticated;
