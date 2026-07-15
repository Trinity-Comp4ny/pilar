-- Sync transacional dos responsáveis de uma disciplina.
-- Antes o front fazia DELETE all + INSERT em duas chamadas separadas fora de transação:
-- se o INSERT falhasse, a disciplina ficava sem nenhum responsável.
-- Esta função faz o diff (insere só os novos, remove só os que saíram) dentro de uma
-- única transação (o corpo da função é atômico), com checagem de empresa.

DROP FUNCTION IF EXISTS public.sync_disciplina_responsaveis(uuid, uuid[]);

CREATE FUNCTION public.sync_disciplina_responsaveis(
  p_disciplina_id uuid,
  p_pessoa_ids uuid[]
) RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_empresa_id uuid;
  v_projeto_empresa_id uuid;
  v_ids uuid[] := COALESCE(p_pessoa_ids, ARRAY[]::uuid[]);
BEGIN
  v_empresa_id := public.get_user_empresa_id();
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa';
  END IF;

  -- Garante que a disciplina pertence a um projeto da empresa do usuário
  SELECT p.empresa_id INTO v_projeto_empresa_id
  FROM public.projeto_disciplinas pd
  JOIN public.projetos p ON p.id = pd.projeto_id
  WHERE pd.id = p_disciplina_id;

  IF v_projeto_empresa_id IS NULL OR v_projeto_empresa_id <> v_empresa_id THEN
    RAISE EXCEPTION 'Disciplina não encontrada ou fora da empresa';
  END IF;

  -- Valida que toda pessoa informada pertence à mesma empresa e está ativa
  IF EXISTS (
    SELECT 1
    FROM unnest(v_ids) AS pid
    WHERE NOT EXISTS (
      SELECT 1 FROM public.pessoas pe
      WHERE pe.id = pid
        AND pe.empresa_id = v_empresa_id
        AND pe.deleted_at IS NULL
    )
  ) THEN
    RAISE EXCEPTION 'Responsável inválido para esta empresa';
  END IF;

  -- Remove apenas os responsáveis que saíram
  DELETE FROM public.projeto_disciplina_responsaveis r
  WHERE r.projeto_disciplina_id = p_disciplina_id
    AND NOT (r.pessoa_id = ANY(v_ids));

  -- Insere apenas os novos responsáveis (evita duplicar os que já existem)
  INSERT INTO public.projeto_disciplina_responsaveis (projeto_disciplina_id, pessoa_id)
  SELECT p_disciplina_id, pid
  FROM unnest(v_ids) AS pid
  WHERE NOT EXISTS (
    SELECT 1 FROM public.projeto_disciplina_responsaveis r
    WHERE r.projeto_disciplina_id = p_disciplina_id
      AND r.pessoa_id = pid
  );
END;
$$;

ALTER FUNCTION public.sync_disciplina_responsaveis(uuid, uuid[]) OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.sync_disciplina_responsaveis(uuid, uuid[]) TO authenticated;
