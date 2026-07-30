-- Spec 013 · Código curto e legível da disciplina (padrão ClickUp ENG-518).
-- DISC-001, DISC-002... sequencial POR PROJETO. Vai na tag do modal e na URL.

ALTER TABLE public.projeto_disciplinas ADD COLUMN IF NOT EXISTS codigo text;

-- Backfill das existentes: numera por projeto na ordem de criação.
WITH numeradas AS (
  SELECT
    id,
    'DISC-' || LPAD(
      ROW_NUMBER() OVER (PARTITION BY projeto_id ORDER BY created_at, id)::text, 3, '0'
    ) AS novo_codigo
  FROM public.projeto_disciplinas
  WHERE codigo IS NULL
)
UPDATE public.projeto_disciplinas d
   SET codigo = n.novo_codigo
  FROM numeradas n
 WHERE d.id = n.id;

-- Geração automática no insert (por projeto), quando o código não vem preenchido.
CREATE OR REPLACE FUNCTION public.tg_disciplina_codigo()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.codigo IS NULL OR NEW.codigo = '' THEN
    SELECT 'DISC-' || LPAD((COALESCE(MAX(SUBSTRING(codigo FROM 6)::int), 0) + 1)::text, 3, '0')
      INTO NEW.codigo
      FROM public.projeto_disciplinas
     WHERE projeto_id = NEW.projeto_id AND codigo ~ '^DISC-\d+$';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_disciplina_codigo ON public.projeto_disciplinas;
CREATE TRIGGER trg_disciplina_codigo
  BEFORE INSERT ON public.projeto_disciplinas
  FOR EACH ROW EXECUTE FUNCTION public.tg_disciplina_codigo();

COMMENT ON COLUMN public.projeto_disciplinas.codigo IS 'Código curto sequencial por projeto (DISC-001), spec 013.';
