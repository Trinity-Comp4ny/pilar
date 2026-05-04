-- Sprint 2 — Integridade de dados
-- D1: UNIQUE(empresa_id, codigo_projeto) — evita race condition gerando código duplicado
-- D2: UNIQUE(projeto_id, disciplina_id) em projeto_orcamento_fases — ON CONFLICT precisa disso
-- D3: soft-delete em metas e categorias_financeiras
-- D5: RLS cross-tenant em projeto_disciplina_responsaveis — valida pessoa.empresa_id

-- ───────────────────────────────────────────────
-- D1: codigo_projeto único por empresa
-- ───────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.projetos'::regclass
      AND conname = 'projetos_empresa_codigo_uq'
  ) THEN
    ALTER TABLE public.projetos
      ADD CONSTRAINT projetos_empresa_codigo_uq UNIQUE (empresa_id, codigo_projeto);
  END IF;
END $$;

-- ───────────────────────────────────────────────
-- D2: disciplina única por projeto em projeto_orcamento_fases
-- ───────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.projeto_orcamento_fases'::regclass
      AND conname = 'projeto_orcamento_fases_projeto_disciplina_uq'
  ) THEN
    ALTER TABLE public.projeto_orcamento_fases
      ADD CONSTRAINT projeto_orcamento_fases_projeto_disciplina_uq
      UNIQUE (projeto_id, disciplina);
  END IF;
END $$;

-- ───────────────────────────────────────────────
-- D3: soft-delete em metas
-- ───────────────────────────────────────────────
ALTER TABLE public.metas
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Atualiza policy existente de metas para filtrar deletados
DROP POLICY IF EXISTS "metas_empresa" ON public.metas;
CREATE POLICY "metas_empresa" ON public.metas
  FOR ALL USING (
    empresa_id = get_user_empresa_id()
    AND deleted_at IS NULL
  );

-- ───────────────────────────────────────────────
-- D3: soft-delete em categorias_financeiras
-- ───────────────────────────────────────────────
ALTER TABLE public.categorias_financeiras
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Recriar policy de categorias para filtrar deletadas
DROP POLICY IF EXISTS "categorias_financeiras_empresa" ON public.categorias_financeiras;
CREATE POLICY "categorias_financeiras_empresa" ON public.categorias_financeiras
  FOR ALL USING (
    empresa_id = get_user_empresa_id()
    AND deleted_at IS NULL
  );

-- ───────────────────────────────────────────────
-- D5: RLS cross-tenant em projeto_disciplina_responsaveis
-- Valida que a pessoa pertence à mesma empresa do projeto
-- ───────────────────────────────────────────────
DROP POLICY IF EXISTS "projeto_disciplina_responsaveis_empresa" ON public.projeto_disciplina_responsaveis;

CREATE POLICY "projeto_disciplina_responsaveis_empresa" ON public.projeto_disciplina_responsaveis
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.projeto_disciplinas pd
      JOIN public.projetos p ON p.id = pd.projeto_id
      WHERE pd.id = projeto_disciplina_id
        AND p.empresa_id = get_user_empresa_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.projeto_disciplinas pd
      JOIN public.projetos p ON p.id = pd.projeto_id
      WHERE pd.id = projeto_disciplina_id
        AND p.empresa_id = get_user_empresa_id()
    )
    AND EXISTS (
      SELECT 1
      FROM public.pessoas pe
      WHERE pe.id = pessoa_id
        AND pe.empresa_id = get_user_empresa_id()
    )
  );
