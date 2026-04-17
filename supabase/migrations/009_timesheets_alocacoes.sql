-- Migration 009: Timesheets e Alocações
-- Consolidação de: create_timesheets, fase3_vertical_features (alocações)

-- ==============================================================================
-- 1. ALTER pessoas: adicionar coluna horas_semanais
-- ==============================================================================

ALTER TABLE public.pessoas ADD COLUMN IF NOT EXISTS horas_semanais NUMERIC DEFAULT 40;

-- ==============================================================================
-- 2. TIMESHEETS: Registro de horas por pessoa/projeto/disciplina
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.timesheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  pessoa_id UUID NOT NULL REFERENCES public.pessoas(id) ON DELETE CASCADE,
  projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  disciplina TEXT NOT NULL,
  data DATE NOT NULL,
  horas DECIMAL(5,2) NOT NULL CHECK (horas > 0 AND horas <= 24),
  descricao TEXT,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
  aprovado_por UUID REFERENCES auth.users(id),
  aprovado_em TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT timesheets_unique_entry UNIQUE (pessoa_id, projeto_id, disciplina, data)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_timesheets_empresa ON public.timesheets(empresa_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_pessoa_data ON public.timesheets(pessoa_id, data);
CREATE INDEX IF NOT EXISTS idx_timesheets_projeto ON public.timesheets(projeto_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_empresa_data ON public.timesheets(empresa_id, data);
CREATE INDEX IF NOT EXISTS idx_timesheets_status ON public.timesheets(empresa_id, status);

-- RLS
ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;

-- Admin e Operacional: Full access
DROP POLICY IF EXISTS "Timesheets Full Admin/Op" ON public.timesheets;
CREATE POLICY "Timesheets Full Admin/Op" ON public.timesheets
  FOR ALL
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.has_role('admin', 'operacional')
    AND deleted_at IS NULL
  )
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.has_role('admin', 'operacional')
    AND deleted_at IS NULL
  );

-- Financeiro: Read only (para cálculos de custo)
DROP POLICY IF EXISTS "Timesheets Read Financeiro" ON public.timesheets;
CREATE POLICY "Timesheets Read Financeiro" ON public.timesheets
  FOR SELECT
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.has_role('financeiro')
    AND deleted_at IS NULL
  );

-- User: pode ver seus próprios timesheets
DROP POLICY IF EXISTS "Timesheets Own User" ON public.timesheets;
CREATE POLICY "Timesheets Own User" ON public.timesheets
  FOR SELECT
  USING (
    empresa_id = public.get_user_empresa_id()
    AND deleted_at IS NULL
    AND pessoa_id IN (
      SELECT p.id FROM public.pessoas p
      WHERE p.profile_id = auth.uid()
    )
  );

-- User: pode criar seus próprios timesheets
DROP POLICY IF EXISTS "Timesheets Insert Own" ON public.timesheets;
CREATE POLICY "Timesheets Insert Own" ON public.timesheets
  FOR INSERT
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND deleted_at IS NULL
    AND pessoa_id IN (
      SELECT p.id FROM public.pessoas p
      WHERE p.profile_id = auth.uid()
    )
  );

-- User: pode editar seus próprios timesheets pendentes
DROP POLICY IF EXISTS "Timesheets Update Own Pending" ON public.timesheets;
CREATE POLICY "Timesheets Update Own Pending" ON public.timesheets
  FOR UPDATE
  USING (
    empresa_id = public.get_user_empresa_id()
    AND deleted_at IS NULL
    AND status = 'pendente'
    AND pessoa_id IN (
      SELECT p.id FROM public.pessoas p
      WHERE p.profile_id = auth.uid()
    )
  )
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND deleted_at IS NULL
    AND pessoa_id IN (
      SELECT p.id FROM public.pessoas p
      WHERE p.profile_id = auth.uid()
    )
  );

-- Triggers
DROP TRIGGER IF EXISTS timesheets_audit ON public.timesheets;
CREATE TRIGGER timesheets_audit
  BEFORE INSERT OR UPDATE ON public.timesheets
  FOR EACH ROW EXECUTE FUNCTION public.handle_record_audit();

DROP TRIGGER IF EXISTS timesheets_prevent_company_change ON public.timesheets;
CREATE TRIGGER timesheets_prevent_company_change
  BEFORE UPDATE ON public.timesheets
  FOR EACH ROW EXECUTE FUNCTION public.prevent_company_change();

DROP TRIGGER IF EXISTS timesheets_soft_delete ON public.timesheets;
CREATE TRIGGER timesheets_soft_delete
  BEFORE DELETE ON public.timesheets
  FOR EACH ROW EXECUTE FUNCTION public.soft_delete_generic();

-- ==============================================================================
-- 3. ALOCAÇÕES: Capacity Planning
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.alocacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  pessoa_id UUID NOT NULL REFERENCES public.pessoas(id) ON DELETE CASCADE,
  projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  disciplina TEXT NOT NULL,
  semana_inicio DATE NOT NULL,
  horas_alocadas NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(pessoa_id, projeto_id, disciplina, semana_inicio)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_alocacoes_empresa ON public.alocacoes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_alocacoes_pessoa ON public.alocacoes(pessoa_id, semana_inicio);
CREATE INDEX IF NOT EXISTS idx_alocacoes_projeto ON public.alocacoes(projeto_id);

-- RLS
ALTER TABLE public.alocacoes ENABLE ROW LEVEL SECURITY;

-- Admin e Operacional: Full access
DROP POLICY IF EXISTS "Alocacoes Full Admin/Op" ON public.alocacoes;
CREATE POLICY "Alocacoes Full Admin/Op" ON public.alocacoes
  FOR ALL
  USING (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'operacional'))
  WITH CHECK (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'operacional'));

-- Todos da empresa: Read
DROP POLICY IF EXISTS "Alocacoes Read" ON public.alocacoes;
CREATE POLICY "Alocacoes Read" ON public.alocacoes
  FOR SELECT
  USING (empresa_id = public.get_user_empresa_id());

-- Triggers
DROP TRIGGER IF EXISTS alocacoes_audit ON public.alocacoes;
CREATE TRIGGER alocacoes_audit
  BEFORE INSERT OR UPDATE ON public.alocacoes
  FOR EACH ROW EXECUTE FUNCTION public.handle_record_audit();

DROP TRIGGER IF EXISTS alocacoes_prevent_company_change ON public.alocacoes;
CREATE TRIGGER alocacoes_prevent_company_change
  BEFORE UPDATE ON public.alocacoes
  FOR EACH ROW EXECUTE FUNCTION public.prevent_company_change();
