-- Create Disciplinas Table
CREATE TABLE IF NOT EXISTS public.disciplinas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Seed initial disciplines
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

-- Enable RLS on disciplinas
ALTER TABLE public.disciplinas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.disciplinas
  FOR SELECT USING (true);

CREATE POLICY "Enable write access for authenticated users" ON public.disciplinas
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update access for authenticated users" ON public.disciplinas
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete access for authenticated users" ON public.disciplinas
  FOR DELETE USING (auth.role() = 'authenticated');

-- Create Metas Table
CREATE TABLE IF NOT EXISTS public.metas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  alvo NUMERIC NOT NULL,
  atual NUMERIC NOT NULL DEFAULT 0,
  prazo DATE,
  categoria TEXT CHECK (categoria IN ('receita', 'lucro', 'economia', 'investimento')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on metas
ALTER TABLE public.metas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.metas
  FOR SELECT USING (true);

CREATE POLICY "Enable write access for authenticated users" ON public.metas
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update access for authenticated users" ON public.metas
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete access for authenticated users" ON public.metas
  FOR DELETE USING (auth.role() = 'authenticated');

-- Add area_m2 to projetos
ALTER TABLE public.projetos ADD COLUMN IF NOT EXISTS area_m2 NUMERIC DEFAULT 0;

-- Ensure valor_m2 exists in pessoas (it might have been added in previous migration, but just in case)
ALTER TABLE public.pessoas ADD COLUMN IF NOT EXISTS valor_m2 NUMERIC DEFAULT 0;

-- Create View for Pro-labore
CREATE OR REPLACE VIEW public.view_pro_labore AS
SELECT 
  p.id as pessoa_id,
  p.nome as pessoa_nome,
  p.cargo,
  COALESCE(p.salario_fixo, 0) as salario_fixo,
  COALESCE(p.valor_m2, 0) as valor_m2,
  COUNT(DISTINCT pr.projeto_id) as qtd_projetos,
  COALESCE(SUM(proj.area_m2), 0) as total_area_m2,
  COALESCE(SUM(proj.area_m2 * COALESCE(p.valor_m2, 0)), 0) as total_comissao,
  (COALESCE(p.salario_fixo, 0) + COALESCE(SUM(proj.area_m2 * COALESCE(p.valor_m2, 0)), 0)) as total_receber
FROM 
  public.pessoas p
LEFT JOIN 
  public.projetos_responsaveis pr ON p.id = pr.pessoa_id
LEFT JOIN 
  public.projetos proj ON pr.projeto_id = proj.id
WHERE
  proj.status = 'Execução' OR proj.status = 'Planejamento' -- Consider active projects
GROUP BY 
  p.id, p.nome, p.cargo, p.salario_fixo, p.valor_m2;

-- Grant access to view
GRANT SELECT ON public.view_pro_labore TO authenticated;
GRANT SELECT ON public.view_pro_labore TO anon;
