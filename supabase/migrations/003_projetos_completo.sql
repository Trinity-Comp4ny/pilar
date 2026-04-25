-- Migration 003: Projetos Completo
-- Consolidacao de: disciplinas_to_projetos, update_create_projeto_rpc, complete_update, fix_status_values, templates_projeto, prioridade, revisao_status, fix_create_projeto_rpc, fluxos_disciplinas, disciplinas_jsonb_to_relational

-- ==============================================================================
-- 1. ALTERACOES NA TABELA PROJETOS: novas colunas
-- ==============================================================================

-- Coluna disciplinas (JSONB legado - sera migrada para tabela relacional)
ALTER TABLE public.projetos
ADD COLUMN IF NOT EXISTS disciplinas JSONB DEFAULT '[]'::jsonb;

-- Coluna status_data para armazenar o status de prazo calculado
ALTER TABLE public.projetos
ADD COLUMN IF NOT EXISTS status_data TEXT;

-- Coluna prioridade
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'projetos' AND column_name = 'prioridade'
  ) THEN
    ALTER TABLE public.projetos
      ADD COLUMN prioridade TEXT NOT NULL DEFAULT 'Media'
      CHECK (prioridade IN ('Alta', 'Media', 'Baixa'));
  END IF;
END $$;

-- ==============================================================================
-- 2. ENUM: Adiciona valor 'Revisao' ao status_projeto
-- ==============================================================================

ALTER TYPE status_projeto ADD VALUE IF NOT EXISTS 'Revisao' AFTER 'Em andamento';

-- ==============================================================================
-- 3. CORRECAO DE STATUS EXISTENTES
-- ==============================================================================

UPDATE public.projetos
SET status = 'Em andamento'
WHERE status::text SIMILAR TO '%(em|Em)%(andamento|Andamento)%'
  AND status::text != 'Em andamento';

-- ==============================================================================
-- 4. MIGRACAO LEGADO: projetos_responsaveis -> coluna JSONB disciplinas
-- ==============================================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'projetos_responsaveis') THEN
    UPDATE public.projetos p
    SET disciplinas = (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'disciplina', pr.disciplina,
          'responsavel_id', pr.pessoa_id,
          'responsavel_nome', pes.nome
        )
      ), '[]'::jsonb)
      FROM public.projetos_responsaveis pr
      LEFT JOIN public.pessoas pes ON pes.id = pr.pessoa_id
      WHERE pr.projeto_id = p.id
    )
    WHERE EXISTS (
      SELECT 1 FROM public.projetos_responsaveis pr WHERE pr.projeto_id = p.id
    );
    DROP TABLE public.projetos_responsaveis;
  END IF;
END $$;

-- ==============================================================================
-- 5. TABELA: templates_projeto
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

CREATE INDEX IF NOT EXISTS idx_templates_projeto_empresa ON public.templates_projeto(empresa_id);
CREATE INDEX IF NOT EXISTS idx_templates_projeto_tipo ON public.templates_projeto(empresa_id, tipo_servico);

ALTER TABLE public.templates_projeto ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'templates_projeto' AND policyname = 'Templates Full Admin/Op') THEN
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
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'templates_projeto' AND policyname = 'Templates Read All') THEN
    CREATE POLICY "Templates Read All" ON public.templates_projeto
      FOR SELECT
      USING (
        empresa_id = public.get_user_empresa_id()
        AND deleted_at IS NULL
      );
  END IF;
END $$;

CREATE OR REPLACE TRIGGER templates_projeto_audit
  BEFORE INSERT OR UPDATE ON public.templates_projeto
  FOR EACH ROW EXECUTE FUNCTION public.handle_record_audit();

CREATE OR REPLACE TRIGGER templates_projeto_prevent_company_change
  BEFORE UPDATE ON public.templates_projeto
  FOR EACH ROW EXECUTE FUNCTION public.prevent_company_change();

CREATE OR REPLACE TRIGGER templates_projeto_soft_delete
  BEFORE DELETE ON public.templates_projeto
  FOR EACH ROW EXECUTE FUNCTION public.soft_delete_generic();

-- ==============================================================================
-- 6. TABELA: fluxos_disciplinas
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

CREATE INDEX IF NOT EXISTS idx_fluxos_disciplinas_empresa ON public.fluxos_disciplinas(empresa_id);

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

CREATE OR REPLACE TRIGGER fluxos_disciplinas_audit
  BEFORE INSERT OR UPDATE ON public.fluxos_disciplinas
  FOR EACH ROW EXECUTE FUNCTION public.handle_record_audit();

CREATE OR REPLACE TRIGGER fluxos_disciplinas_prevent_company_change
  BEFORE UPDATE ON public.fluxos_disciplinas
  FOR EACH ROW EXECUTE FUNCTION public.prevent_company_change();

CREATE OR REPLACE TRIGGER fluxos_disciplinas_soft_delete
  BEFORE DELETE ON public.fluxos_disciplinas
  FOR EACH ROW EXECUTE FUNCTION public.soft_delete_generic();

-- ==============================================================================
-- 7. TABELAS RELACIONAIS: projeto_disciplinas e projeto_disciplina_responsaveis
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.projeto_disciplinas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  status TEXT DEFAULT 'Nao Iniciado',
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

CREATE TABLE IF NOT EXISTS public.projeto_disciplina_responsaveis (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  projeto_disciplina_id UUID NOT NULL REFERENCES public.projeto_disciplinas(id) ON DELETE CASCADE,
  pessoa_id UUID NOT NULL REFERENCES public.pessoas(id) ON DELETE CASCADE,
  UNIQUE(projeto_disciplina_id, pessoa_id)
);

CREATE INDEX IF NOT EXISTS idx_projeto_disciplinas_projeto_id ON public.projeto_disciplinas(projeto_id);
CREATE INDEX IF NOT EXISTS idx_projeto_disciplina_responsaveis_disciplina_id ON public.projeto_disciplina_responsaveis(projeto_disciplina_id);
CREATE INDEX IF NOT EXISTS idx_projeto_disciplina_responsaveis_pessoa_id ON public.projeto_disciplina_responsaveis(pessoa_id);

-- RLS
ALTER TABLE public.projeto_disciplinas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projeto_disciplina_responsaveis ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'projeto_disciplinas' AND policyname = 'projeto_disciplinas_empresa') THEN
    CREATE POLICY "projeto_disciplinas_empresa" ON public.projeto_disciplinas
      FOR ALL USING (
        EXISTS (SELECT 1 FROM public.projetos WHERE id = projeto_id AND empresa_id = get_user_empresa_id())
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'projeto_disciplina_responsaveis' AND policyname = 'projeto_disciplina_responsaveis_empresa') THEN
    CREATE POLICY "projeto_disciplina_responsaveis_empresa" ON public.projeto_disciplina_responsaveis
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.projeto_disciplinas pd
          JOIN public.projetos p ON p.id = pd.projeto_id
          WHERE pd.id = projeto_disciplina_id AND p.empresa_id = get_user_empresa_id()
        )
      );
  END IF;
END $$;

-- ==============================================================================
-- 8. MIGRACAO JSONB -> RELACIONAL: dados existentes
-- ==============================================================================

-- Migra disciplinas do JSONB para a tabela relacional
INSERT INTO public.projeto_disciplinas (projeto_id, nome, status, data_inicio, data_fim, data_fim_real, observacoes, prioridade, justificativa_atraso, horas_estimadas, custo_hora)
SELECT
  p.id,
  (d->>'disciplina')::TEXT,
  COALESCE(d->>'status', 'Nao Iniciado'),
  NULLIF(d->>'data_inicio', '')::DATE,
  NULLIF(d->>'data_previsao', '')::DATE,
  NULLIF(d->>'data_final', '')::DATE,
  NULL,
  d->>'prioridade',
  d->>'justificativa_atraso',
  COALESCE((d->>'horas_estimadas')::NUMERIC, 0),
  COALESCE((d->>'custo_hora')::NUMERIC, 0)
FROM public.projetos p, jsonb_array_elements(p.disciplinas) AS d
WHERE p.disciplinas IS NOT NULL AND jsonb_array_length(p.disciplinas) > 0
ON CONFLICT DO NOTHING;

-- Migra responsaveis do array JSONB responsaveis
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

-- Migra responsavel_id de nivel superior (disciplinas sem array responsaveis)
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

-- Marca coluna JSONB como deprecated
COMMENT ON COLUMN public.projetos.disciplinas IS 'DEPRECATED: migrated to projeto_disciplinas table. Will be removed in future migration.';

-- ==============================================================================
-- 9. RPC: create_projeto_completo (versao final - 20260402510000)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.create_projeto_completo(
  p_codigo TEXT,
  p_nome TEXT,
  p_cliente_id UUID,
  p_data_inicio DATE DEFAULT NULL,
  p_data_previsao DATE DEFAULT NULL,
  p_data_final DATE DEFAULT NULL,
  p_valor_contrato DECIMAL DEFAULT 0,
  p_observacao TEXT DEFAULT '',
  p_localizacao TEXT DEFAULT '',
  p_parcelas TEXT DEFAULT NULL,
  p_area_m2 NUMERIC DEFAULT 0,
  p_disciplinas JSONB DEFAULT '[]',
  p_prioridade TEXT DEFAULT 'Media'
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_empresa_id UUID;
  v_user_id UUID;
  v_projeto_id UUID;
BEGIN
  v_user_id := auth.uid();
  SELECT empresa_id INTO v_empresa_id FROM public.profiles WHERE id = v_user_id;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao vinculado a uma empresa';
  END IF;

  INSERT INTO public.projetos (
    empresa_id, codigo_projeto, nome, cliente_id,
    data_inicio, data_previsao, data_final,
    valor_contrato, observacao, localizacao,
    parcelas, area_m2, disciplinas, prioridade,
    created_by, updated_by
  ) VALUES (
    v_empresa_id, p_codigo, p_nome, p_cliente_id,
    p_data_inicio, p_data_previsao, p_data_final,
    p_valor_contrato, p_observacao, p_localizacao,
    p_parcelas, p_area_m2, p_disciplinas, p_prioridade,
    v_user_id, v_user_id
  ) RETURNING id INTO v_projeto_id;

  RETURN v_projeto_id;
END;
$$;

-- ==============================================================================
-- 10. RPC: update_projeto_completo (versao final - 20260401300000)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.update_projeto_completo(
  p_projeto_id UUID,
  p_codigo TEXT,
  p_nome TEXT,
  p_cliente_id UUID,
  p_data_inicio DATE DEFAULT NULL,
  p_data_previsao DATE DEFAULT NULL,
  p_data_final DATE DEFAULT NULL,
  p_valor_contrato DECIMAL DEFAULT 0,
  p_observacao TEXT DEFAULT '',
  p_localizacao TEXT DEFAULT '',
  p_parcelas TEXT DEFAULT NULL,
  p_area_m2 NUMERIC DEFAULT 0,
  p_disciplinas JSONB DEFAULT '[]',
  p_status TEXT DEFAULT 'Planejamento',
  p_prioridade TEXT DEFAULT 'Media'
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  UPDATE public.projetos SET
    codigo_projeto = p_codigo,
    nome = p_nome,
    cliente_id = p_cliente_id,
    data_inicio = p_data_inicio,
    data_previsao = p_data_previsao,
    data_final = p_data_final,
    valor_contrato = p_valor_contrato,
    observacao = p_observacao,
    localizacao = p_localizacao,
    parcelas = p_parcelas,
    area_m2 = p_area_m2,
    disciplinas = p_disciplinas,
    status = p_status::status_projeto,
    prioridade = p_prioridade,
    updated_by = v_user_id,
    updated_at = now()
  WHERE id = p_projeto_id;
END;
$$;

-- ==============================================================================
-- 11. TRIGGER: calculate_status_data (calculo automatico de prazo)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.calculate_status_data()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Se projeto esta concluido, verifica se foi no prazo ou com atraso
  IF NEW.status = 'Concluido' AND NEW.data_final IS NOT NULL AND NEW.data_previsao IS NOT NULL THEN
    IF NEW.data_final <= NEW.data_previsao THEN
      NEW.status_data := 'concluido_no_prazo';
    ELSE
      NEW.status_data := 'concluido_com_atraso';
    END IF;
  -- Se projeto esta cancelado
  ELSIF NEW.status = 'Cancelado' THEN
    NEW.status_data := 'cancelado';
  -- Se projeto tem data de previsao
  ELSIF NEW.data_previsao IS NOT NULL THEN
    DECLARE
      dias_diferenca INTEGER;
    BEGIN
      dias_diferenca := NEW.data_previsao - CURRENT_DATE;

      IF dias_diferenca < 0 THEN
        NEW.status_data := 'em_atraso';
      ELSIF dias_diferenca <= 7 THEN
        NEW.status_data := 'atencao';
      ELSE
        NEW.status_data := 'no_prazo';
      END IF;
    END;
  ELSE
    NEW.status_data := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_calculate_status_data ON public.projetos;
CREATE TRIGGER tr_calculate_status_data
  BEFORE INSERT OR UPDATE ON public.projetos
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_status_data();
