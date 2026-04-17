-- Migration: Move disciplinas from JSONB column in projetos to relational tables
-- This enables referential integrity, proper indexing, and eliminates race conditions.

-- 1. Create projeto_disciplinas table
CREATE TABLE IF NOT EXISTS public.projeto_disciplinas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  status TEXT DEFAULT 'Não Iniciado',
  data_inicio DATE,
  data_fim DATE,
  data_fim_real DATE,
  observacoes TEXT,
  prioridade TEXT,
  justificativa_atraso TEXT,
  horas_estimadas NUMERIC DEFAULT 0,
  custo_hora NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create projeto_disciplina_responsaveis (many-to-many)
CREATE TABLE IF NOT EXISTS public.projeto_disciplina_responsaveis (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  projeto_disciplina_id UUID NOT NULL REFERENCES public.projeto_disciplinas(id) ON DELETE CASCADE,
  pessoa_id UUID NOT NULL REFERENCES public.pessoas(id) ON DELETE CASCADE,
  UNIQUE(projeto_disciplina_id, pessoa_id)
);

-- 3. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_projeto_disciplinas_projeto_id ON public.projeto_disciplinas(projeto_id);
CREATE INDEX IF NOT EXISTS idx_projeto_disciplina_responsaveis_disciplina_id ON public.projeto_disciplina_responsaveis(projeto_disciplina_id);
CREATE INDEX IF NOT EXISTS idx_projeto_disciplina_responsaveis_pessoa_id ON public.projeto_disciplina_responsaveis(pessoa_id);

-- 4. Migrate existing data from JSONB to the new tables
INSERT INTO public.projeto_disciplinas (projeto_id, nome, status, data_inicio, data_fim, data_fim_real, observacoes, prioridade, justificativa_atraso, horas_estimadas, custo_hora)
SELECT
  p.id,
  (d->>'disciplina')::TEXT,
  COALESCE(d->>'status', 'Não Iniciado'),
  NULLIF(d->>'data_inicio', '')::DATE,
  NULLIF(d->>'data_previsao', '')::DATE,
  NULLIF(d->>'data_final', '')::DATE,
  NULL,
  d->>'prioridade',
  d->>'justificativa_atraso',
  COALESCE((d->>'horas_estimadas')::NUMERIC, 0),
  COALESCE((d->>'custo_hora')::NUMERIC, 0)
FROM public.projetos p, jsonb_array_elements(p.disciplinas) AS d
WHERE p.disciplinas IS NOT NULL AND jsonb_array_length(p.disciplinas) > 0;

-- 5. Migrate responsaveis from the JSONB responsaveis array
INSERT INTO public.projeto_disciplina_responsaveis (projeto_disciplina_id, pessoa_id)
SELECT DISTINCT pd.id, (r->>'responsavel_id')::UUID
FROM public.projetos p,
     jsonb_array_elements(p.disciplinas) WITH ORDINALITY AS d(val, ord),
     jsonb_array_elements(d.val->'responsaveis') AS r,
     public.projeto_disciplinas pd
WHERE p.disciplinas IS NOT NULL
  AND jsonb_array_length(p.disciplinas) > 0
  AND pd.projeto_id = p.id
  AND pd.nome = (d.val->>'disciplina')
  AND (r->>'responsavel_id') IS NOT NULL
  AND (r->>'responsavel_id') != ''
  AND EXISTS (SELECT 1 FROM public.pessoas WHERE id = (r->>'responsavel_id')::UUID)
ON CONFLICT DO NOTHING;

-- 5b. Also migrate top-level responsavel_id (for disciplinas that don't use the responsaveis array)
INSERT INTO public.projeto_disciplina_responsaveis (projeto_disciplina_id, pessoa_id)
SELECT DISTINCT pd.id, (d->>'responsavel_id')::UUID
FROM public.projetos p,
     jsonb_array_elements(p.disciplinas) AS d,
     public.projeto_disciplinas pd
WHERE p.disciplinas IS NOT NULL
  AND jsonb_array_length(p.disciplinas) > 0
  AND pd.projeto_id = p.id
  AND pd.nome = (d->>'disciplina')
  AND (d->>'responsavel_id') IS NOT NULL
  AND (d->>'responsavel_id') != ''
  AND EXISTS (SELECT 1 FROM public.pessoas WHERE id = (d->>'responsavel_id')::UUID)
ON CONFLICT DO NOTHING;

-- 6. RLS policies
ALTER TABLE public.projeto_disciplinas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projeto_disciplina_responsaveis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projeto_disciplinas_empresa" ON public.projeto_disciplinas
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.projetos WHERE id = projeto_id AND empresa_id = get_user_empresa_id())
  );

CREATE POLICY "projeto_disciplina_responsaveis_empresa" ON public.projeto_disciplina_responsaveis
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.projeto_disciplinas pd
      JOIN public.projetos p ON p.id = pd.projeto_id
      WHERE pd.id = projeto_disciplina_id AND p.empresa_id = get_user_empresa_id()
    )
  );

-- 7. Mark old column as deprecated (do NOT drop it)
COMMENT ON COLUMN public.projetos.disciplinas IS 'DEPRECATED: migrated to projeto_disciplinas table. Will be removed in future migration.';
