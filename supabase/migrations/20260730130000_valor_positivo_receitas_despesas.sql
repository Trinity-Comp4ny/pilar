-- Garante valor > 0 em receitas e despesas, em paridade com transferencias
-- (que já tem CHECK (valor > 0)). Fecha o furo em que um insert fora do front
-- (RPC de agente, script, import) grava lançamento de valor 0 ou negativo, o que
-- envenena todo relatório financeiro.
--
-- Usa NOT VALID para não falhar caso existam linhas legadas com valor <= 0:
-- a constraint passa a valer para INSERT/UPDATE imediatamente. Depois de conferir
-- que não há dado legado ruim, rode o VALIDATE CONSTRAINT (comentado ao final)
-- para checar as linhas existentes também.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'receitas_valor_positivo'
  ) THEN
    ALTER TABLE public.receitas
      ADD CONSTRAINT receitas_valor_positivo CHECK (valor > 0) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'despesas_valor_positivo'
  ) THEN
    ALTER TABLE public.despesas
      ADD CONSTRAINT despesas_valor_positivo CHECK (valor > 0) NOT VALID;
  END IF;
END $$;

-- Depois de conferir os dados legados, valide as linhas existentes:
-- ALTER TABLE public.receitas VALIDATE CONSTRAINT receitas_valor_positivo;
-- ALTER TABLE public.despesas VALIDATE CONSTRAINT despesas_valor_positivo;
