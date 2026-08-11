-- Fecha um buraco da spec 014: a seed das 3 colunas-âncora (A fazer / Fazendo /
-- Concluído) da migration 20260730000500 só rodou para as empresas que já
-- existiam naquele momento. Empresa criada DEPOIS não recebia âncora nenhuma, e
-- "Meu trabalho" abria em branco (sem coluna, tarefa órfã invisível).
-- Aqui: (1) um trigger que semeia as âncoras em toda empresa nova, com bucket e
-- cor já preenchidos; (2) backfill idempotente das empresas que ficaram sem.

CREATE OR REPLACE FUNCTION public.seed_tarefa_etapas_padrao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só semeia se a empresa ainda não tem nenhuma etapa (idempotente).
  IF NOT EXISTS (SELECT 1 FROM public.tarefa_etapas WHERE empresa_id = NEW.id) THEN
    INSERT INTO public.tarefa_etapas (empresa_id, nome, ordem, cor, bucket)
    VALUES
      (NEW.id, 'A fazer',   0, '#94a3b8', 'a_fazer'),
      (NEW.id, 'Fazendo',   1, '#f59e0b', 'fazendo'),
      (NEW.id, 'Concluído', 2, '#10b981', 'concluida');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_tarefa_etapas ON public.empresas;
CREATE TRIGGER trg_seed_tarefa_etapas
  AFTER INSERT ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.seed_tarefa_etapas_padrao();

-- Backfill: empresas sem nenhuma etapa recebem as 3 âncoras agora.
INSERT INTO public.tarefa_etapas (empresa_id, nome, ordem, cor, bucket)
SELECT e.id, v.nome, v.ordem, v.cor, v.bucket
FROM public.empresas e
CROSS JOIN (VALUES
  ('A fazer',   0, '#94a3b8', 'a_fazer'),
  ('Fazendo',   1, '#f59e0b', 'fazendo'),
  ('Concluído', 2, '#10b981', 'concluida')
) AS v(nome, ordem, cor, bucket)
WHERE NOT EXISTS (SELECT 1 FROM public.tarefa_etapas t WHERE t.empresa_id = e.id);

-- Preenche a cor das âncoras já existentes (empresas antigas) para o dot bater.
UPDATE public.tarefa_etapas SET cor = '#94a3b8' WHERE bucket = 'a_fazer'   AND cor IS NULL;
UPDATE public.tarefa_etapas SET cor = '#f59e0b' WHERE bucket = 'fazendo'   AND cor IS NULL;
UPDATE public.tarefa_etapas SET cor = '#10b981' WHERE bucket = 'concluida' AND cor IS NULL;
