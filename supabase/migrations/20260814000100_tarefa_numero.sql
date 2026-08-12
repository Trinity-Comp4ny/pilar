-- Meu trabalho · número curto por tarefa (estilo ClickUp "#42")
-- Sequencial por empresa, atribuído no insert por um contador dedicado (à prova
-- de corrida: o ON CONFLICT DO UPDATE ... RETURNING trava a linha do contador).
-- Serve para identificar/buscar/citar a tarefa; não muda ao renomear.

-- 1. Contador por empresa (fonte do próximo número).
CREATE TABLE IF NOT EXISTS public.tarefa_contadores (
  empresa_id uuid PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,
  ultimo     int NOT NULL DEFAULT 0
);
-- Só o trigger (SECURITY DEFINER) escreve aqui; cliente não acessa direto.
ALTER TABLE public.tarefa_contadores ENABLE ROW LEVEL SECURITY;

-- 2. Coluna do número (nullable até o backfill).
ALTER TABLE public.tarefas ADD COLUMN IF NOT EXISTS numero int;

-- 3. Backfill: numera as tarefas existentes por empresa, na ordem de criação.
WITH numbered AS (
  SELECT id, row_number() OVER (PARTITION BY empresa_id ORDER BY created_at, id) AS rn
    FROM public.tarefas
)
UPDATE public.tarefas t
   SET numero = n.rn
  FROM numbered n
 WHERE t.id = n.id;

-- 4. Semeia o contador com o maior número já usado por empresa.
INSERT INTO public.tarefa_contadores (empresa_id, ultimo)
SELECT empresa_id, MAX(numero) FROM public.tarefas GROUP BY empresa_id
ON CONFLICT (empresa_id) DO UPDATE SET ultimo = EXCLUDED.ultimo;

-- 5. Atribuição no insert. Sempre sobrescreve (o número não vem do cliente).
-- O DEFAULT existe só para o número ser opcional no tipo gerado do insert;
-- o trigger troca pelo valor real antes de gravar. SECURITY DEFINER para
-- escrever no contador sem depender de policy (o dono ignora o RLS do contador).
ALTER TABLE public.tarefas ALTER COLUMN numero SET DEFAULT 0;

CREATE OR REPLACE FUNCTION public.tg_tarefa_numero()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v int;
BEGIN
  INSERT INTO public.tarefa_contadores (empresa_id, ultimo)
       VALUES (NEW.empresa_id, 1)
  ON CONFLICT (empresa_id)
       DO UPDATE SET ultimo = public.tarefa_contadores.ultimo + 1
    RETURNING ultimo INTO v;
  NEW.numero := v;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tarefa_numero
  BEFORE INSERT ON public.tarefas
  FOR EACH ROW EXECUTE FUNCTION public.tg_tarefa_numero();

-- 6. Trava o invariante: todo mundo numerado e único por empresa.
ALTER TABLE public.tarefas ALTER COLUMN numero SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tarefas_empresa_numero
  ON public.tarefas (empresa_id, numero);
