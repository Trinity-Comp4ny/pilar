-- Adiciona coluna disciplinas como JSONB na tabela projetos
ALTER TABLE public.projetos 
ADD COLUMN IF NOT EXISTS disciplinas JSONB DEFAULT '[]'::jsonb;

-- Migra dados existentes de projetos_responsaveis para a nova coluna disciplinas
UPDATE public.projetos p
SET disciplinas = (
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'disciplina', pr.disciplina,
      'responsavel_id', pr.pessoa_id,
      'responsavel_nome', pes.nome
    )
  ), '[]'::jsonb)
  FROM public.projetos_responsaveis pr
  LEFT JOIN public.pessoas pes ON pes.id = pr.pessoa_id
  WHERE pr.projeto_id = p.id
);

DROP TABLE IF EXISTS public.projetos_responsaveis;