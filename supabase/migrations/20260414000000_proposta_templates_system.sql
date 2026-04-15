-- Proposta Templates System
-- Upload DOCX templates with {{VARIABLES}}, auto-fill from lead/proposta data, generate final DOCX

-- 1. Templates table
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

-- RLS
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

-- 2. New columns on propostas
ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.proposta_templates(id) ON DELETE SET NULL;
ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS campos_extras JSONB DEFAULT '{}';
ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS documento_path TEXT;
ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS conteudo JSONB DEFAULT '{}';

-- 3. Storage buckets (run via Supabase dashboard or CLI if not auto-created)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('proposta-templates', 'proposta-templates', false) ON CONFLICT DO NOTHING;
-- INSERT INTO storage.buckets (id, name, public) VALUES ('propostas-docs', 'propostas-docs', false) ON CONFLICT DO NOTHING;

-- 4. Updated RPC: converter proposta em projeto + criar cliente automaticamente
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

  -- Gerar codigo do projeto
  v_codigo := COALESCE(v_proposta.codigo, 'PRJ-' || to_char(NOW(), 'YYYYMMDD-HH24MI'));

  -- Montar JSON de disciplinas
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

  -- Criar orcamento por disciplina
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

  -- Atualizar proposta
  UPDATE propostas
  SET projeto_id = v_projeto_id,
      status = 'aceita'
  WHERE id = p_proposta_id;

  RETURN v_projeto_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_converter_proposta_projeto(UUID) TO authenticated;
