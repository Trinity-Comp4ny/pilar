-- Migration 002: Disciplinas e Metas
-- Consolidação de: add_finance_features (parte), security_hardening (parte), expand_metas, metas_auto_sync

-- ==============================================================================
-- 1. TABELA: disciplinas
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.disciplinas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Seed inicial de disciplinas
INSERT INTO public.disciplinas (nome) VALUES
('Arquitetônico'),
('Estrutural'),
('Estrutura Metálica'),
('Alvenaria Estrutural'),
('Elétrico'),
('Hidráulico'),
('Hidrossanitário'),
('Automação'),
('Climatização, Exaustão e Renovação de Ar'),
('Gases Medicinais'),
('Sistema Fotovoltaico'),
('Prevenção e Combate a Incêndio (PPCI)'),
('Auto de Vistoria do Corpo de Bombeiros (AVCB)'),
('Sistema de Proteção contra Descargas Atmosféricas (SPDA)')
ON CONFLICT DO NOTHING;

-- ==============================================================================
-- 2. RLS: disciplinas (admin only para escrita)
-- ==============================================================================

ALTER TABLE public.disciplinas ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Enable read access for all users" ON public.disciplinas
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Enable write access for admin users" ON public.disciplinas
    FOR INSERT WITH CHECK (public.has_role('admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Enable update access for admin users" ON public.disciplinas
    FOR UPDATE USING (public.has_role('admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Enable delete access for admin users" ON public.disciplinas
    FOR DELETE USING (public.has_role('admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ==============================================================================
-- 3. TABELA: metas (estado final com todas as colunas)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.metas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  alvo NUMERIC NOT NULL,
  atual NUMERIC NOT NULL DEFAULT 0,
  prazo DATE,
  categoria TEXT CHECK (categoria IN ('receita', 'lucro', 'economia', 'investimento')),
  tipo TEXT NOT NULL DEFAULT 'financeira',
  pessoa_id UUID REFERENCES public.pessoas(id) ON DELETE SET NULL,
  projeto_id UUID REFERENCES public.projetos(id) ON DELETE SET NULL,
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  descricao TEXT,
  unidade TEXT NOT NULL DEFAULT 'currency',
  auto_sync BOOLEAN DEFAULT FALSE,
  sync_fonte TEXT,
  sync_filtro JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para consultas comuns
CREATE INDEX IF NOT EXISTS idx_metas_tipo ON public.metas(tipo);
CREATE INDEX IF NOT EXISTS idx_metas_pessoa_id ON public.metas(pessoa_id);
CREATE INDEX IF NOT EXISTS idx_metas_projeto_id ON public.metas(projeto_id);
CREATE INDEX IF NOT EXISTS idx_metas_empresa_id ON public.metas(empresa_id);

-- ==============================================================================
-- 4. RLS: metas (admin only para escrita)
-- ==============================================================================

ALTER TABLE public.metas ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Enable read access for all users" ON public.metas
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Enable write access for admin users" ON public.metas
    FOR INSERT WITH CHECK (public.has_role('admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Enable update access for admin users" ON public.metas
    FOR UPDATE USING (public.has_role('admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Enable delete access for admin users" ON public.metas
    FOR DELETE USING (public.has_role('admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ==============================================================================
-- 5. FUNÇÃO: rpc_sync_metas (auto-sync de metas com dados reais)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.rpc_sync_metas()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meta RECORD;
  v_valor NUMERIC;
  v_count INTEGER := 0;
  v_empresa_id UUID;
BEGIN
  v_empresa_id := public.get_user_empresa_id();

  FOR v_meta IN
    SELECT * FROM metas
    WHERE empresa_id = v_empresa_id
      AND auto_sync = TRUE
      AND sync_fonte IS NOT NULL
  LOOP
    v_valor := NULL;

    CASE v_meta.sync_fonte
      WHEN 'receita_total' THEN
        SELECT COALESCE(SUM(valor), 0) INTO v_valor
        FROM receitas
        WHERE empresa_id = v_empresa_id
          AND status = 'Recebido'
          AND deleted_at IS NULL
          AND data_vencimento >= date_trunc('year', CURRENT_DATE);

      WHEN 'receita_mes' THEN
        SELECT COALESCE(SUM(valor), 0) INTO v_valor
        FROM receitas
        WHERE empresa_id = v_empresa_id
          AND status = 'Recebido'
          AND deleted_at IS NULL
          AND date_trunc('month', data_vencimento) = date_trunc('month', CURRENT_DATE);

      WHEN 'projetos_concluidos' THEN
        SELECT COUNT(*) INTO v_valor
        FROM projetos
        WHERE empresa_id = v_empresa_id
          AND status = 'Concluído'
          AND deleted_at IS NULL
          AND date_trunc('year', COALESCE(data_final, created_at)) = date_trunc('year', CURRENT_DATE);

      WHEN 'projetos_ativos' THEN
        SELECT COUNT(*) INTO v_valor
        FROM projetos
        WHERE empresa_id = v_empresa_id
          AND status IN ('Planejamento', 'Em andamento')
          AND deleted_at IS NULL;

      WHEN 'margem_media' THEN
        SELECT COALESCE(AVG(
          CASE WHEN r.total > 0 THEN ((r.total - d.total) / r.total) * 100 ELSE 0 END
        ), 0) INTO v_valor
        FROM (
          SELECT projeto_id, COALESCE(SUM(valor), 0) AS total
          FROM receitas WHERE empresa_id = v_empresa_id AND status = 'Recebido' AND deleted_at IS NULL
          GROUP BY projeto_id
        ) r
        JOIN (
          SELECT projeto_id, COALESCE(SUM(valor), 0) AS total
          FROM despesas WHERE empresa_id = v_empresa_id AND status = 'Pago' AND deleted_at IS NULL AND projeto_id IS NOT NULL
          GROUP BY projeto_id
        ) d ON r.projeto_id = d.projeto_id
        WHERE r.total > 0;

      WHEN 'leads_convertidos' THEN
        SELECT COUNT(*) INTO v_valor
        FROM leads
        WHERE empresa_id = v_empresa_id
          AND status = 'Ganho'
          AND deleted_at IS NULL
          AND date_trunc('year', COALESCE(convertido_em, created_at)) = date_trunc('year', CURRENT_DATE);

      WHEN 'horas_faturadas' THEN
        SELECT COALESCE(SUM(horas), 0) INTO v_valor
        FROM timesheets
        WHERE empresa_id = v_empresa_id
          AND status = 'aprovado'
          AND deleted_at IS NULL
          AND date_trunc('year', data) = date_trunc('year', CURRENT_DATE);

      ELSE
        CONTINUE;
    END CASE;

    IF v_valor IS NOT NULL THEN
      UPDATE metas SET atual = v_valor, updated_at = NOW() WHERE id = v_meta.id;
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_sync_metas() TO authenticated;
