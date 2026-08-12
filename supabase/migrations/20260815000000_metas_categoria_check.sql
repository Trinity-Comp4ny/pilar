-- Metas passaram a ter categorias pessoais (entregas, qualidade, produtividade,
-- desenvolvimento) além das financeiras. O CHECK antigo só permitia as 4
-- financeiras e barrava a criação de QUALQUER meta pessoal.
-- Amplia o conjunto permitido e mantém NULL válido.
ALTER TABLE public.metas DROP CONSTRAINT IF EXISTS metas_categoria_check;

ALTER TABLE public.metas ADD CONSTRAINT metas_categoria_check
  CHECK (
    categoria IS NULL OR categoria IN (
      -- financeiras
      'receita', 'lucro', 'economia', 'investimento',
      -- pessoais
      'entregas', 'qualidade', 'produtividade', 'desenvolvimento'
    )
  );
