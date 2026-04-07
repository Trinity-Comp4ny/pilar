-- ==============================================================================
-- FASE 3: FEATURES VERTICAIS
-- ==============================================================================

-- ==============================================================================
-- 3.1 MAPA DE OBRAS - Geocoding columns
-- ==============================================================================

ALTER TABLE public.projetos ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE public.projetos ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- ==============================================================================
-- 3.2 GESTÃO DE ESCOPO E ADITIVOS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.escopos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('original', 'aditivo')),
  status TEXT DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'pendente_aprovacao', 'aprovado', 'rejeitado')),
  horas_estimadas NUMERIC DEFAULT 0,
  custo_estimado NUMERIC DEFAULT 0,
  impacto_prazo_dias INTEGER DEFAULT 0,
  valor_aditivo NUMERIC DEFAULT 0,
  justificativa TEXT,
  aprovado_por UUID REFERENCES auth.users(id),
  aprovado_em TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.escopo_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escopo_id UUID NOT NULL REFERENCES public.escopos(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  disciplina TEXT,
  horas NUMERIC DEFAULT 0,
  custo NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.escopo_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escopo_id UUID NOT NULL REFERENCES public.escopos(id) ON DELETE CASCADE,
  acao TEXT NOT NULL,
  usuario_id UUID REFERENCES auth.users(id),
  usuario_nome TEXT,
  detalhes JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_escopos_empresa ON public.escopos(empresa_id);
CREATE INDEX idx_escopos_projeto ON public.escopos(projeto_id);
CREATE INDEX idx_escopo_itens_escopo ON public.escopo_itens(escopo_id);

ALTER TABLE public.escopos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escopo_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escopo_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Escopos Full Admin/Op" ON public.escopos
  FOR ALL USING (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'operacional') AND deleted_at IS NULL)
  WITH CHECK (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'operacional') AND deleted_at IS NULL);

CREATE POLICY "Escopos Read Fin" ON public.escopos
  FOR SELECT USING (empresa_id = public.get_user_empresa_id() AND public.has_role('financeiro') AND deleted_at IS NULL);

-- Escopo itens: via join com escopos
CREATE POLICY "EscopoItens Full" ON public.escopo_itens
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.escopos e WHERE e.id = escopo_id AND e.empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'operacional'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.escopos e WHERE e.id = escopo_id AND e.empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'operacional'))
  );

CREATE POLICY "EscopoItens Read" ON public.escopo_itens
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.escopos e WHERE e.id = escopo_id AND e.empresa_id = public.get_user_empresa_id())
  );

CREATE POLICY "EscopoHist Read" ON public.escopo_historico
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.escopos e WHERE e.id = escopo_id AND e.empresa_id = public.get_user_empresa_id())
  );

CREATE POLICY "EscopoHist Insert" ON public.escopo_historico
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.escopos e WHERE e.id = escopo_id AND e.empresa_id = public.get_user_empresa_id())
  );

CREATE TRIGGER escopos_audit BEFORE INSERT OR UPDATE ON public.escopos
  FOR EACH ROW EXECUTE FUNCTION public.handle_record_audit();
CREATE TRIGGER escopos_prevent_company_change BEFORE UPDATE ON public.escopos
  FOR EACH ROW EXECUTE FUNCTION public.prevent_company_change();
CREATE TRIGGER escopos_soft_delete BEFORE DELETE ON public.escopos
  FOR EACH ROW EXECUTE FUNCTION public.soft_delete_generic();

-- ==============================================================================
-- 3.3 PROPOSTAS COMERCIAIS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.propostas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  codigo TEXT,
  titulo TEXT NOT NULL,
  area_m2 DECIMAL(10,2),
  localizacao TEXT,
  valor_proposto DECIMAL(12,2),
  custo_estimado DECIMAL(12,2),
  margem_estimada_pct DECIMAL(5,2),
  prazo_estimado_dias INTEGER,
  status TEXT DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'enviada', 'aceita', 'recusada', 'expirada')),
  validade DATE,
  projeto_id UUID REFERENCES public.projetos(id) ON DELETE SET NULL,
  dados_simulacao JSONB DEFAULT '{}',
  observacao TEXT,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.proposta_disciplinas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  proposta_id UUID NOT NULL REFERENCES public.propostas(id) ON DELETE CASCADE,
  disciplina TEXT NOT NULL,
  horas_estimadas DECIMAL(8,2) DEFAULT 0,
  custo_hora DECIMAL(10,2) DEFAULT 0,
  valor_venda DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_propostas_empresa ON public.propostas(empresa_id);
CREATE INDEX idx_propostas_status ON public.propostas(empresa_id, status);
CREATE INDEX idx_proposta_disc ON public.proposta_disciplinas(proposta_id);

ALTER TABLE public.propostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposta_disciplinas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Propostas Full Admin/Op/Mkt" ON public.propostas
  FOR ALL USING (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'operacional', 'marketing') AND deleted_at IS NULL)
  WITH CHECK (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'operacional', 'marketing') AND deleted_at IS NULL);

CREATE POLICY "Propostas Read Fin" ON public.propostas
  FOR SELECT USING (empresa_id = public.get_user_empresa_id() AND public.has_role('financeiro') AND deleted_at IS NULL);

CREATE POLICY "PropostaDisc Full" ON public.proposta_disciplinas
  FOR ALL USING (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'operacional', 'marketing'))
  WITH CHECK (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'operacional', 'marketing'));

CREATE POLICY "PropostaDisc Read" ON public.proposta_disciplinas
  FOR SELECT USING (empresa_id = public.get_user_empresa_id());

CREATE TRIGGER propostas_audit BEFORE INSERT OR UPDATE ON public.propostas
  FOR EACH ROW EXECUTE FUNCTION public.handle_record_audit();
CREATE TRIGGER propostas_prevent_company_change BEFORE UPDATE ON public.propostas
  FOR EACH ROW EXECUTE FUNCTION public.prevent_company_change();
CREATE TRIGGER propostas_soft_delete BEFORE DELETE ON public.propostas
  FOR EACH ROW EXECUTE FUNCTION public.soft_delete_generic();

-- ==============================================================================
-- 3.4 PORTAL DO CLIENTE
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.portal_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  email_cliente TEXT,
  ativo BOOLEAN DEFAULT true,
  ultimo_acesso TIMESTAMP WITH TIME ZONE,
  expira_em TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.portal_entregas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT CHECK (tipo IN ('documento', 'aprovacao', 'informacao')),
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'revisao_solicitada')),
  resposta_cliente TEXT,
  respondido_em TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_portal_tokens_token ON public.portal_tokens(token);
CREATE INDEX idx_portal_tokens_projeto ON public.portal_tokens(projeto_id);
CREATE INDEX idx_portal_entregas_projeto ON public.portal_entregas(projeto_id);

ALTER TABLE public.portal_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_entregas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "PortalTokens Full Admin" ON public.portal_tokens
  FOR ALL USING (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'operacional'))
  WITH CHECK (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'operacional'));

CREATE POLICY "PortalEntregas Full Admin/Op" ON public.portal_entregas
  FOR ALL USING (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'operacional'))
  WITH CHECK (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'operacional'));

-- RPC para verificar token do portal (acessível via anon key)
CREATE OR REPLACE FUNCTION public.verify_portal_token(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'projeto_id', pt.projeto_id,
    'cliente_id', pt.cliente_id,
    'empresa_id', pt.empresa_id,
    'projeto_nome', p.nome,
    'projeto_status', p.status,
    'projeto_codigo', p.codigo_projeto,
    'cliente_nome', c.nome,
    'empresa_nome', e.nome
  ) INTO result
  FROM portal_tokens pt
  JOIN projetos p ON p.id = pt.projeto_id
  JOIN clientes c ON c.id = pt.cliente_id
  JOIN empresas e ON e.id = pt.empresa_id
  WHERE pt.token = p_token
    AND pt.ativo = true
    AND (pt.expira_em IS NULL OR pt.expira_em > NOW());

  IF result IS NULL THEN
    RAISE EXCEPTION 'Token inválido ou expirado';
  END IF;

  -- Atualiza último acesso
  UPDATE portal_tokens SET ultimo_acesso = NOW() WHERE token = p_token;

  RETURN result;
END;
$$;

-- ==============================================================================
-- 3.5 CAPACITY PLANNING
-- ==============================================================================

ALTER TABLE public.pessoas ADD COLUMN IF NOT EXISTS horas_semanais NUMERIC DEFAULT 40;

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

CREATE INDEX idx_alocacoes_empresa ON public.alocacoes(empresa_id);
CREATE INDEX idx_alocacoes_pessoa ON public.alocacoes(pessoa_id, semana_inicio);
CREATE INDEX idx_alocacoes_projeto ON public.alocacoes(projeto_id);

ALTER TABLE public.alocacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alocacoes Full Admin/Op" ON public.alocacoes
  FOR ALL USING (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'operacional'))
  WITH CHECK (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'operacional'));

CREATE POLICY "Alocacoes Read" ON public.alocacoes
  FOR SELECT USING (empresa_id = public.get_user_empresa_id());

CREATE TRIGGER alocacoes_audit BEFORE INSERT OR UPDATE ON public.alocacoes
  FOR EACH ROW EXECUTE FUNCTION public.handle_record_audit();
CREATE TRIGGER alocacoes_prevent_company_change BEFORE UPDATE ON public.alocacoes
  FOR EACH ROW EXECUTE FUNCTION public.prevent_company_change();
