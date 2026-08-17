-- Metas livres (spec: design partner 13/08): objetivo de qualquer área da
-- gestão (RH, logística, administrativo...), não atrelado a financeiro nem a um
-- colaborador. O "setor" mora na coluna `categoria`, então o CHECK precisa
-- aceitar os novos valores além dos financeiros e pessoais já existentes
-- (migration 20260815000000). `tipo='livre'` é texto livre, não tem constraint.
ALTER TABLE public.metas DROP CONSTRAINT IF EXISTS metas_categoria_check;

ALTER TABLE public.metas ADD CONSTRAINT metas_categoria_check
  CHECK (
    categoria IS NULL OR categoria IN (
      -- financeiras
      'receita', 'lucro', 'economia', 'investimento',
      -- pessoais
      'entregas', 'qualidade', 'produtividade', 'desenvolvimento',
      -- livres (setores/áreas)
      'geral', 'rh', 'financeiro', 'comercial', 'logistica', 'administrativo', 'operacoes', 'inovacao'
    )
  );
