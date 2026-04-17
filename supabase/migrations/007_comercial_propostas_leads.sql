-- Migration 007: Comercial - Propostas, Leads e Escopos
-- Consolidação de: fase3_vertical_features (parte), add_lead_motivo_perda_conversao, rpc_converter_proposta_projeto, proposta_templates_system, storage_proposta_templates, fix_storage_rls_multitenant, fix_converter_proposta (2x)

-- ==============================================================================
-- 1. GESTÃO DE ESCOPO E ADITIVOS
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

CREATE INDEX IF NOT EXISTS idx_escopos_empresa ON public.escopos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_escopos_projeto ON public.escopos(projeto_id);
CREATE INDEX IF NOT EXISTS idx_escopo_itens_escopo ON public.escopo_itens(escopo_id);

ALTER TABLE public.escopos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escopo_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escopo_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Escopos Full Admin/Op" ON public.escopos;
CREATE POLICY "Escopos Full Admin/Op" ON public.escopos
  FOR ALL USING (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'operacional') AND deleted_at IS NULL)
  WITH CHECK (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'operacional') AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Escopos Read Fin" ON public.escopos;
CREATE POLICY "Escopos Read Fin" ON public.escopos
  FOR SELECT USING (empresa_id = public.get_user_empresa_id() AND public.has_role('financeiro') AND deleted_at IS NULL);

DROP POLICY IF EXISTS "EscopoItens Full" ON public.escopo_itens;
CREATE POLICY "EscopoItens Full" ON public.escopo_itens
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.escopos e WHERE e.id = escopo_id AND e.empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'operacional'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.escopos e WHERE e.id = escopo_id AND e.empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'operacional'))
  );

DROP POLICY IF EXISTS "EscopoItens Read" ON public.escopo_itens;
CREATE POLICY "EscopoItens Read" ON public.escopo_itens
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.escopos e WHERE e.id = escopo_id AND e.empresa_id = public.get_user_empresa_id())
  );

DROP POLICY IF EXISTS "EscopoHist Read" ON public.escopo_historico;
CREATE POLICY "EscopoHist Read" ON public.escopo_historico
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.escopos e WHERE e.id = escopo_id AND e.empresa_id = public.get_user_empresa_id())
  );

DROP POLICY IF EXISTS "EscopoHist Insert" ON public.escopo_historico;
CREATE POLICY "EscopoHist Insert" ON public.escopo_historico
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.escopos e WHERE e.id = escopo_id AND e.empresa_id = public.get_user_empresa_id())
  );

DROP TRIGGER IF EXISTS escopos_audit ON public.escopos;
CREATE TRIGGER escopos_audit BEFORE INSERT OR UPDATE ON public.escopos
  FOR EACH ROW EXECUTE FUNCTION public.handle_record_audit();

DROP TRIGGER IF EXISTS escopos_prevent_company_change ON public.escopos;
CREATE TRIGGER escopos_prevent_company_change BEFORE UPDATE ON public.escopos
  FOR EACH ROW EXECUTE FUNCTION public.prevent_company_change();

DROP TRIGGER IF EXISTS escopos_soft_delete ON public.escopos;
CREATE TRIGGER escopos_soft_delete BEFORE DELETE ON public.escopos
  FOR EACH ROW EXECUTE FUNCTION public.soft_delete_generic();

-- ==============================================================================
-- 2. PROPOSTAS COMERCIAIS
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
  -- Colunas de template (proposta_templates_system)
  template_id UUID, -- FK adicionada após criar proposta_templates
  campos_extras JSONB DEFAULT '{}',
  documento_path TEXT,
  conteudo JSONB DEFAULT '{}',
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

CREATE INDEX IF NOT EXISTS idx_propostas_empresa ON public.propostas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_propostas_status ON public.propostas(empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_proposta_disc ON public.proposta_disciplinas(proposta_id);

ALTER TABLE public.propostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposta_disciplinas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Propostas Full Admin/Op/Mkt" ON public.propostas;
CREATE POLICY "Propostas Full Admin/Op/Mkt" ON public.propostas
  FOR ALL USING (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'operacional', 'marketing') AND deleted_at IS NULL)
  WITH CHECK (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'operacional', 'marketing') AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Propostas Read Fin" ON public.propostas;
CREATE POLICY "Propostas Read Fin" ON public.propostas
  FOR SELECT USING (empresa_id = public.get_user_empresa_id() AND public.has_role('financeiro') AND deleted_at IS NULL);

DROP POLICY IF EXISTS "PropostaDisc Full" ON public.proposta_disciplinas;
CREATE POLICY "PropostaDisc Full" ON public.proposta_disciplinas
  FOR ALL USING (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'operacional', 'marketing'))
  WITH CHECK (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'operacional', 'marketing'));

DROP POLICY IF EXISTS "PropostaDisc Read" ON public.proposta_disciplinas;
CREATE POLICY "PropostaDisc Read" ON public.proposta_disciplinas
  FOR SELECT USING (empresa_id = public.get_user_empresa_id());

DROP TRIGGER IF EXISTS propostas_audit ON public.propostas;
CREATE TRIGGER propostas_audit BEFORE INSERT OR UPDATE ON public.propostas
  FOR EACH ROW EXECUTE FUNCTION public.handle_record_audit();

DROP TRIGGER IF EXISTS propostas_prevent_company_change ON public.propostas;
CREATE TRIGGER propostas_prevent_company_change BEFORE UPDATE ON public.propostas
  FOR EACH ROW EXECUTE FUNCTION public.prevent_company_change();

DROP TRIGGER IF EXISTS propostas_soft_delete ON public.propostas;
CREATE TRIGGER propostas_soft_delete BEFORE DELETE ON public.propostas
  FOR EACH ROW EXECUTE FUNCTION public.soft_delete_generic();

-- ==============================================================================
-- 3. PROPOSTA TEMPLATES
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.proposta_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  arquivo_path TEXT NOT NULL,
  variaveis TEXT[] DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_proposta_templates_empresa ON public.proposta_templates(empresa_id);

ALTER TABLE public.proposta_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "PropostaTemplates Full" ON public.proposta_templates;
CREATE POLICY "PropostaTemplates Full" ON public.proposta_templates
  FOR ALL USING (
    empresa_id = public.get_user_empresa_id()
    AND public.has_role('admin', 'operacional', 'marketing')
    AND deleted_at IS NULL
  )
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.has_role('admin', 'operacional', 'marketing')
  );

DROP POLICY IF EXISTS "PropostaTemplates Read" ON public.proposta_templates;
CREATE POLICY "PropostaTemplates Read" ON public.proposta_templates
  FOR SELECT USING (
    empresa_id = public.get_user_empresa_id()
    AND deleted_at IS NULL
  );

-- Adicionar FK de template_id agora que proposta_templates existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'propostas_template_id_fkey'
      AND table_name = 'propostas'
  ) THEN
    ALTER TABLE public.propostas
      ADD CONSTRAINT propostas_template_id_fkey
      FOREIGN KEY (template_id) REFERENCES public.proposta_templates(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ==============================================================================
-- 4. ALOCAÇÕES (CAPACITY PLANNING)
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

CREATE INDEX IF NOT EXISTS idx_alocacoes_empresa ON public.alocacoes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_alocacoes_pessoa ON public.alocacoes(pessoa_id, semana_inicio);
CREATE INDEX IF NOT EXISTS idx_alocacoes_projeto ON public.alocacoes(projeto_id);

ALTER TABLE public.alocacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Alocacoes Full Admin/Op" ON public.alocacoes;
CREATE POLICY "Alocacoes Full Admin/Op" ON public.alocacoes
  FOR ALL USING (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'operacional'))
  WITH CHECK (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'operacional'));

DROP POLICY IF EXISTS "Alocacoes Read" ON public.alocacoes;
CREATE POLICY "Alocacoes Read" ON public.alocacoes
  FOR SELECT USING (empresa_id = public.get_user_empresa_id());

DROP TRIGGER IF EXISTS alocacoes_audit ON public.alocacoes;
CREATE TRIGGER alocacoes_audit BEFORE INSERT OR UPDATE ON public.alocacoes
  FOR EACH ROW EXECUTE FUNCTION public.handle_record_audit();

DROP TRIGGER IF EXISTS alocacoes_prevent_company_change ON public.alocacoes;
CREATE TRIGGER alocacoes_prevent_company_change BEFORE UPDATE ON public.alocacoes
  FOR EACH ROW EXECUTE FUNCTION public.prevent_company_change();

-- ==============================================================================
-- 5. ALTER LEADS — motivo_perda e convertido_em
-- ==============================================================================

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS motivo_perda TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS convertido_em TIMESTAMPTZ;

-- ==============================================================================
-- 6. HELPER FUNCTION — get_user_empresa_id_text()
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_user_empresa_id_text()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT empresa_id::text FROM profiles WHERE id = auth.uid();
$$;

-- ==============================================================================
-- 7. RPC — Converter lead em cliente
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.rpc_converter_lead_cliente(p_lead_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead RECORD;
  v_empresa_id UUID;
  v_cliente_id UUID;
BEGIN
  -- Buscar o lead
  SELECT * INTO v_lead FROM leads WHERE id = p_lead_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead não encontrado';
  END IF;

  -- Verificar se já foi convertido
  IF v_lead.cliente_id IS NOT NULL THEN
    RAISE EXCEPTION 'Lead já foi convertido em cliente';
  END IF;

  v_empresa_id := v_lead.empresa_id;

  -- Criar o cliente a partir dos dados do lead
  INSERT INTO clientes (empresa_id, nome, email, contato, origem)
  VALUES (v_empresa_id, v_lead.nome, v_lead.email, v_lead.contato, v_lead.origem)
  RETURNING id INTO v_cliente_id;

  -- Atualizar o lead
  UPDATE leads
  SET status = 'Ganho',
      cliente_id = v_cliente_id,
      convertido_em = NOW()
  WHERE id = p_lead_id;

  RETURN v_cliente_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_converter_lead_cliente(UUID) TO authenticated;

-- ==============================================================================
-- 8. RPC — Converter proposta em projeto (VERSÃO FINAL)
--    Inclui: criação automática de cliente a partir do lead + código sequencial único
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.rpc_converter_proposta_projeto(p_proposta_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proposta RECORD;
  v_lead RECORD;
  v_empresa_id UUID;
  v_projeto_id UUID;
  v_cliente_id UUID;
  v_disc RECORD;
  v_disciplinas_json JSONB := '[]'::JSONB;
  v_codigo TEXT;
  v_seq INT;
BEGIN
  -- Buscar proposta
  SELECT * INTO v_proposta FROM propostas WHERE id = p_proposta_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposta não encontrada';
  END IF;

  IF v_proposta.projeto_id IS NOT NULL THEN
    RAISE EXCEPTION 'Proposta já foi convertida em projeto';
  END IF;

  v_empresa_id := v_proposta.empresa_id;

  -- Se proposta tem lead_id e não tem cliente_id, criar cliente automaticamente
  IF v_proposta.lead_id IS NOT NULL AND v_proposta.cliente_id IS NULL THEN
    SELECT * INTO v_lead FROM leads WHERE id = v_proposta.lead_id AND deleted_at IS NULL;
    IF FOUND THEN
      -- Verificar se lead já tem cliente_id (já foi convertido antes)
      IF v_lead.cliente_id IS NOT NULL THEN
        v_cliente_id := v_lead.cliente_id;
      ELSE
        -- Criar cliente a partir do lead
        INSERT INTO clientes (empresa_id, nome, email, contato, origem)
        VALUES (v_empresa_id, v_lead.nome, v_lead.email, v_lead.contato, v_lead.origem)
        RETURNING id INTO v_cliente_id;

        -- Atualizar lead
        UPDATE leads
        SET status = 'Ganho',
            cliente_id = v_cliente_id,
            convertido_em = NOW()
        WHERE id = v_proposta.lead_id;
      END IF;

      -- Vincular cliente à proposta
      UPDATE propostas SET cliente_id = v_cliente_id WHERE id = p_proposta_id;
    END IF;
  ELSE
    v_cliente_id := v_proposta.cliente_id;
  END IF;

  -- Gerar codigo sequencial único por empresa
  SELECT COALESCE(MAX(
    CASE WHEN codigo_projeto ~ '^PRJ-\d+$'
      THEN CAST(SUBSTRING(codigo_projeto FROM 5) AS INT)
      ELSE 0
    END
  ), 0) + 1
  INTO v_seq
  FROM projetos
  WHERE empresa_id = v_empresa_id;

  v_codigo := 'PRJ-' || LPAD(v_seq::TEXT, 4, '0');

  -- Montar JSON de disciplinas a partir de proposta_disciplinas
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'nome', pd.disciplina,
    'horas_estimadas', pd.horas_estimadas,
    'custo_hora', pd.custo_hora,
    'valor_venda', pd.valor_venda
  )), '[]'::JSONB)
  INTO v_disciplinas_json
  FROM proposta_disciplinas pd
  WHERE pd.proposta_id = p_proposta_id;

  -- Criar projeto
  INSERT INTO projetos (
    empresa_id, codigo_projeto, nome, cliente_id, valor_contrato,
    area_m2, localizacao, status, prioridade, disciplinas,
    data_inicio, data_previsao, observacao
  ) VALUES (
    v_empresa_id,
    v_codigo,
    v_proposta.titulo,
    v_cliente_id,
    COALESCE(v_proposta.valor_proposto, 0),
    v_proposta.area_m2,
    v_proposta.localizacao,
    'Planejamento',
    'Media',
    v_disciplinas_json,
    CURRENT_DATE,
    CASE WHEN v_proposta.prazo_estimado_dias IS NOT NULL
      THEN CURRENT_DATE + (v_proposta.prazo_estimado_dias || ' days')::INTERVAL
      ELSE NULL
    END,
    v_proposta.observacao
  )
  RETURNING id INTO v_projeto_id;

  -- Criar orcamento por fase/disciplina a partir de proposta_disciplinas
  FOR v_disc IN
    SELECT disciplina, horas_estimadas, custo_hora, valor_venda
    FROM proposta_disciplinas
    WHERE proposta_id = p_proposta_id
  LOOP
    INSERT INTO projeto_orcamento_fases (
      empresa_id, projeto_id, disciplina, horas_estimadas, custo_hora, valor_venda, margem_alvo_pct
    ) VALUES (
      v_empresa_id, v_projeto_id, v_disc.disciplina,
      v_disc.horas_estimadas, v_disc.custo_hora, v_disc.valor_venda,
      CASE WHEN v_disc.custo_hora > 0 AND v_disc.horas_estimadas > 0 AND v_disc.valor_venda > 0
        THEN ROUND(((v_disc.valor_venda - (v_disc.horas_estimadas * v_disc.custo_hora)) / v_disc.valor_venda) * 100, 2)
        ELSE 20.0
      END
    );
  END LOOP;

  -- Atualizar proposta: vincular ao projeto e marcar como aceita
  UPDATE propostas
  SET projeto_id = v_projeto_id,
      status = 'aceita'
  WHERE id = p_proposta_id;

  RETURN v_projeto_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_converter_proposta_projeto(UUID) TO authenticated;

-- ==============================================================================
-- 9. STORAGE BUCKETS E POLICIES (multi-tenant isolado)
-- ==============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('proposta-templates', 'proposta-templates', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('propostas-docs', 'propostas-docs', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- proposta-templates: policies com filtro multi-tenant
-- ============================================================

DROP POLICY IF EXISTS "proposta_templates_insert" ON storage.objects;
CREATE POLICY "proposta_templates_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'proposta-templates'
  AND (storage.foldername(name))[1] = public.get_user_empresa_id_text()
);

DROP POLICY IF EXISTS "proposta_templates_select" ON storage.objects;
CREATE POLICY "proposta_templates_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'proposta-templates'
  AND (storage.foldername(name))[1] = public.get_user_empresa_id_text()
);

DROP POLICY IF EXISTS "proposta_templates_update" ON storage.objects;
CREATE POLICY "proposta_templates_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'proposta-templates'
  AND (storage.foldername(name))[1] = public.get_user_empresa_id_text()
);

DROP POLICY IF EXISTS "proposta_templates_delete" ON storage.objects;
CREATE POLICY "proposta_templates_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'proposta-templates'
  AND (storage.foldername(name))[1] = public.get_user_empresa_id_text()
);

-- ============================================================
-- propostas-docs: policies com filtro multi-tenant
-- ============================================================

DROP POLICY IF EXISTS "propostas_docs_insert" ON storage.objects;
CREATE POLICY "propostas_docs_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'propostas-docs'
  AND (storage.foldername(name))[1] = public.get_user_empresa_id_text()
);

DROP POLICY IF EXISTS "propostas_docs_select" ON storage.objects;
CREATE POLICY "propostas_docs_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'propostas-docs'
  AND (storage.foldername(name))[1] = public.get_user_empresa_id_text()
);

DROP POLICY IF EXISTS "propostas_docs_update" ON storage.objects;
CREATE POLICY "propostas_docs_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'propostas-docs'
  AND (storage.foldername(name))[1] = public.get_user_empresa_id_text()
);

DROP POLICY IF EXISTS "propostas_docs_delete" ON storage.objects;
CREATE POLICY "propostas_docs_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'propostas-docs'
  AND (storage.foldername(name))[1] = public.get_user_empresa_id_text()
);
