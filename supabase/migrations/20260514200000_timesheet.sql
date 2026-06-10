CREATE TABLE public.timesheet_lancamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  fase_id uuid REFERENCES public.projeto_orcamento_fases(id) ON DELETE SET NULL,
  descricao text NOT NULL CHECK (char_length(descricao) >= 3),
  horas numeric(5,2) NOT NULL CHECK (horas > 0 AND horas <= 24),
  data date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
  aprovado_por uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.timesheet_lancamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "empresa_isolation" ON public.timesheet_lancamentos
  USING (empresa_id = get_user_empresa_id());

CREATE POLICY "insert_own" ON public.timesheet_lancamentos
  FOR INSERT WITH CHECK (
    empresa_id = get_user_empresa_id() AND user_id = auth.uid()
  );

CREATE POLICY "update_own_pending" ON public.timesheet_lancamentos
  FOR UPDATE USING (
    empresa_id = get_user_empresa_id() AND
    (user_id = auth.uid() OR user_has_feature('pessoas'))
  );

CREATE INDEX idx_timesheet_empresa_data ON public.timesheet_lancamentos(empresa_id, data DESC) WHERE status != 'rejeitado';
CREATE INDEX idx_timesheet_projeto ON public.timesheet_lancamentos(projeto_id) WHERE status = 'aprovado';

-- Trigger updated_at
CREATE TRIGGER set_timesheet_updated_at
  BEFORE UPDATE ON public.timesheet_lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.tg_pilar_touch_updated_at();
