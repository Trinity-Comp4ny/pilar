-- Checklist por disciplina (spec 051, PR3): itens marcáveis dentro de uma
-- projeto_disciplina. Quando todos os itens de uma disciplina são concluídos,
-- o status da disciplina muda automaticamente para "Concluído"; desmarcar
-- reverte para "Em Andamento". Disciplina sem nenhum item de checklist não é
-- tocada por este mecanismo (status continua manual).

CREATE TABLE IF NOT EXISTS public.projeto_disciplina_checklist (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_disciplina_id uuid NOT NULL REFERENCES public.projeto_disciplinas(id) ON DELETE CASCADE,
  texto                 text NOT NULL,
  concluido             boolean NOT NULL DEFAULT false,
  ordem                 int NOT NULL DEFAULT 0,
  concluido_em          timestamptz,
  concluido_por         uuid REFERENCES public.pessoas(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projeto_disciplina_checklist_disciplina
  ON public.projeto_disciplina_checklist (projeto_disciplina_id);

ALTER TABLE public.projeto_disciplina_checklist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS projeto_disciplina_checklist_empresa ON public.projeto_disciplina_checklist;
CREATE POLICY projeto_disciplina_checklist_empresa
  ON public.projeto_disciplina_checklist
  USING (EXISTS (
    SELECT 1 FROM public.projeto_disciplinas pd
    JOIN public.projetos p ON p.id = pd.projeto_id
    WHERE pd.id = projeto_disciplina_checklist.projeto_disciplina_id
      AND p.empresa_id = public.get_user_empresa_id()
  ));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projeto_disciplina_checklist TO authenticated;

-- ---------------------------------------------------------------------------
-- 1. Metadado de conclusão (BEFORE): preenche concluido_em/concluido_por ao
--    marcar, limpa ao desmarcar. Resolve "quem marcou" a partir de auth.uid()
--    no banco (o client não precisa saber a pessoa do usuário logado).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tr_checklist_item_concluido_meta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.concluido AND (TG_OP = 'INSERT' OR NOT OLD.concluido) THEN
    NEW.concluido_em := now();
    NEW.concluido_por := (
      SELECT ps.id FROM public.pessoas ps
      WHERE ps.profile_id = auth.uid() AND ps.deleted_at IS NULL
      LIMIT 1
    );
  ELSIF NOT NEW.concluido THEN
    NEW.concluido_em := NULL;
    NEW.concluido_por := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_checklist_item_concluido_meta ON public.projeto_disciplina_checklist;
CREATE TRIGGER trg_checklist_item_concluido_meta
  BEFORE INSERT OR UPDATE ON public.projeto_disciplina_checklist
  FOR EACH ROW EXECUTE FUNCTION public.tr_checklist_item_concluido_meta();

-- ---------------------------------------------------------------------------
-- 2. Recálculo de status da disciplina (AFTER): conta itens/concluídos da
--    disciplina afetada e aplica a regra de negócio em projeto_disciplinas.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recalc_disciplina_status_por_checklist(p_disciplina_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total int;
  v_concluidos int;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE concluido)
    INTO v_total, v_concluidos
  FROM public.projeto_disciplina_checklist
  WHERE projeto_disciplina_id = p_disciplina_id;

  IF v_total = 0 THEN
    RETURN;
  END IF;

  IF v_concluidos = v_total THEN
    UPDATE public.projeto_disciplinas
       SET status = public.pilar_disciplina_status_canonico('concluida'),
           data_fim_real = COALESCE(data_fim_real, CURRENT_DATE)
     WHERE id = p_disciplina_id;
  ELSE
    UPDATE public.projeto_disciplinas
       SET status = public.pilar_disciplina_status_canonico('fazendo'),
           data_fim_real = NULL
     WHERE id = p_disciplina_id
       AND status = public.pilar_disciplina_status_canonico('concluida');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.tr_recalc_disciplina_status_checklist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_disciplina_status_por_checklist(OLD.projeto_disciplina_id);
    RETURN OLD;
  END IF;
  PERFORM public.recalc_disciplina_status_por_checklist(NEW.projeto_disciplina_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_disciplina_status_checklist ON public.projeto_disciplina_checklist;
CREATE TRIGGER trg_recalc_disciplina_status_checklist
  AFTER INSERT OR UPDATE OR DELETE ON public.projeto_disciplina_checklist
  FOR EACH ROW EXECUTE FUNCTION public.tr_recalc_disciplina_status_checklist();

REVOKE ALL ON FUNCTION public.recalc_disciplina_status_por_checklist(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recalc_disciplina_status_por_checklist(uuid) TO authenticated;
