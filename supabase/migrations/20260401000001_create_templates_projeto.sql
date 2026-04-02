-- ==============================================================================
-- TEMPLATES DE PROJETO: Modelos reutilizáveis por tipo de serviço
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.templates_projeto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo_servico TEXT NOT NULL,
  descricao TEXT,
  fases JSONB NOT NULL DEFAULT '[]',
  checklist JSONB DEFAULT '[]',
  ativo BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX idx_templates_projeto_empresa ON public.templates_projeto(empresa_id);
CREATE INDEX idx_templates_projeto_tipo ON public.templates_projeto(empresa_id, tipo_servico);

-- RLS
ALTER TABLE public.templates_projeto ENABLE ROW LEVEL SECURITY;

-- Admin e Operacional: Full access
CREATE POLICY "Templates Full Admin/Op" ON public.templates_projeto
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

-- Demais roles: Read only
CREATE POLICY "Templates Read All" ON public.templates_projeto
  FOR SELECT
  USING (
    empresa_id = public.get_user_empresa_id()
    AND deleted_at IS NULL
  );

-- Triggers
CREATE TRIGGER templates_projeto_audit
  BEFORE INSERT OR UPDATE ON public.templates_projeto
  FOR EACH ROW EXECUTE FUNCTION public.handle_record_audit();

CREATE TRIGGER templates_projeto_prevent_company_change
  BEFORE UPDATE ON public.templates_projeto
  FOR EACH ROW EXECUTE FUNCTION public.prevent_company_change();

CREATE TRIGGER templates_projeto_soft_delete
  BEFORE DELETE ON public.templates_projeto
  FOR EACH ROW EXECUTE FUNCTION public.soft_delete_generic();
