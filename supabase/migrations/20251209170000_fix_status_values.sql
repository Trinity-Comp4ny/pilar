-- Corrige possíveis valores incorretos de status em projetos existentes
-- e garante que o enum está correto

-- Atualiza qualquer valor que possa estar incorreto
UPDATE public.projetos
SET status = 'Em andamento'
WHERE status::text SIMILAR TO '%(em|Em)%(andamento|Andamento)%'
  AND status::text != 'Em andamento';

-- Verifica se há algum valor inválido e mostra
DO $$
DECLARE
  invalid_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO invalid_count
  FROM public.projetos
  WHERE status::text NOT IN ('Planejamento', 'Em andamento', 'Paralisado', 'Concluído', 'Cancelado');
  
  IF invalid_count > 0 THEN
    RAISE NOTICE 'Atenção: Existem % projetos com status inválido', invalid_count;
  ELSE
    RAISE NOTICE 'Todos os status estão corretos!';
  END IF;
END $$;
