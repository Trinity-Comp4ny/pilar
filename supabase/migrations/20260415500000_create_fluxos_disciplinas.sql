-- ==============================================================================
-- FLUXOS DE DISCIPLINAS: Sequência reutilizável de etapas com disciplinas
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.fluxos_disciplinas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  etapas JSONB NOT NULL DEFAULT '[]',
  ativo BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fluxos_disciplinas_empresa ON public.fluxos_disciplinas(empresa_id);

-- RLS
ALTER TABLE public.fluxos_disciplinas ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'fluxos_disciplinas' AND policyname = 'Fluxos Full Admin/Op') THEN
    CREATE POLICY "Fluxos Full Admin/Op" ON public.fluxos_disciplinas
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
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'fluxos_disciplinas' AND policyname = 'Fluxos Read All') THEN
    CREATE POLICY "Fluxos Read All" ON public.fluxos_disciplinas
      FOR SELECT
      USING (
        empresa_id = public.get_user_empresa_id()
        AND deleted_at IS NULL
      );
  END IF;
END $$;

-- Triggers
CREATE OR REPLACE TRIGGER fluxos_disciplinas_audit
  BEFORE INSERT OR UPDATE ON public.fluxos_disciplinas
  FOR EACH ROW EXECUTE FUNCTION public.handle_record_audit();

CREATE OR REPLACE TRIGGER fluxos_disciplinas_prevent_company_change
  BEFORE UPDATE ON public.fluxos_disciplinas
  FOR EACH ROW EXECUTE FUNCTION public.prevent_company_change();

CREATE OR REPLACE TRIGGER fluxos_disciplinas_soft_delete
  BEFORE DELETE ON public.fluxos_disciplinas
  FOR EACH ROW EXECUTE FUNCTION public.soft_delete_generic();
