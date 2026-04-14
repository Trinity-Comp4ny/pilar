-- Sprint 6.2: Fundações de compliance
-- Tabela de aprovações genérica + versionamento de orçamento

-- Aprovações
CREATE TABLE IF NOT EXISTS public.aprovacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('despesa_acima_limite', 'aditivo', 'contratacao', 'orcamento', 'proposta')),
  referencia_tipo TEXT NOT NULL,
  referencia_id UUID NOT NULL,
  solicitante_id UUID REFERENCES auth.users(id),
  aprovador_id UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
  justificativa TEXT,
  resposta TEXT,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_aprovacoes_empresa ON public.aprovacoes(empresa_id);
CREATE INDEX idx_aprovacoes_status ON public.aprovacoes(empresa_id, status);
CREATE INDEX idx_aprovacoes_ref ON public.aprovacoes(referencia_tipo, referencia_id);

ALTER TABLE public.aprovacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Aprovacoes read all" ON public.aprovacoes
  FOR SELECT USING (empresa_id = public.get_user_empresa_id() AND deleted_at IS NULL);

CREATE POLICY "Aprovacoes write admin" ON public.aprovacoes
  FOR ALL USING (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'financeiro') AND deleted_at IS NULL)
  WITH CHECK (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'financeiro') AND deleted_at IS NULL);

-- Versionamento de orçamento
CREATE TABLE IF NOT EXISTS public.orcamento_versoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  versao INTEGER NOT NULL DEFAULT 1,
  dados JSONB NOT NULL,
  motivo TEXT,
  criado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_orcamento_versoes_projeto ON public.orcamento_versoes(projeto_id);

ALTER TABLE public.orcamento_versoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Versoes read all" ON public.orcamento_versoes
  FOR SELECT USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Versoes write admin/op" ON public.orcamento_versoes
  FOR INSERT WITH CHECK (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'operacional'));

-- Trigger para criar versão automaticamente quando orçamento muda
CREATE OR REPLACE FUNCTION public.handle_orcamento_versao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dados JSONB;
  v_versao INTEGER;
  v_empresa_id UUID;
BEGIN
  -- Pegar empresa_id do projeto
  SELECT empresa_id INTO v_empresa_id FROM projetos WHERE id = NEW.projeto_id;

  -- Snapshot atual do orçamento
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'disciplina', disciplina,
    'horas_estimadas', horas_estimadas,
    'custo_hora', custo_hora,
    'valor_venda', valor_venda,
    'margem_alvo_pct', margem_alvo_pct
  )), '[]'::JSONB)
  INTO v_dados
  FROM projeto_orcamento_fases
  WHERE projeto_id = NEW.projeto_id AND deleted_at IS NULL;

  -- Próxima versão
  SELECT COALESCE(MAX(versao), 0) + 1 INTO v_versao
  FROM orcamento_versoes
  WHERE projeto_id = NEW.projeto_id;

  -- Salvar versão
  INSERT INTO orcamento_versoes (empresa_id, projeto_id, versao, dados, criado_por, motivo)
  VALUES (v_empresa_id, NEW.projeto_id, v_versao, v_dados, auth.uid(), 'Atualização automática');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_orcamento_versao ON public.projeto_orcamento_fases;

CREATE TRIGGER trigger_orcamento_versao
  AFTER INSERT OR UPDATE ON public.projeto_orcamento_fases
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_orcamento_versao();
