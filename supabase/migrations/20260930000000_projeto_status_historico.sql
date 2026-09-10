-- Spec 093 (PR 2): histórico de mudança de status do projeto. Hoje `projetos.status`
-- guarda só o valor atual e `status_data` só a última mudança — sem esta tabela, o
-- evento "mudança de status" da timeline (v_projeto_timeline, próxima migration) é
-- impossível, agora e no futuro. Append-only via trigger: não há INSERT/UPDATE direto
-- liberado pra authenticated, mesmo padrão de projeto_disciplina_pausas/revisoes (que
-- controlam escrita via RPC; aqui o controle é o trigger).
--
-- Não é retroativo: projetos que já mudaram de status antes desta migration não têm
-- esse histórico e não podem tê-lo reconstruído (decisão registrada na spec 093).

CREATE TABLE public.projeto_status_historico (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  de         public.status_projeto,
  para       public.status_projeto NOT NULL,
  mudado_em  timestamptz NOT NULL DEFAULT now(),
  mudado_por uuid REFERENCES public.pessoas(id) ON DELETE SET NULL
);

CREATE INDEX idx_projeto_status_historico_projeto
  ON public.projeto_status_historico (projeto_id);

ALTER TABLE public.projeto_status_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY projeto_status_historico_empresa
  ON public.projeto_status_historico
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.projetos p
    WHERE p.id = projeto_status_historico.projeto_id
      AND p.empresa_id = public.get_user_empresa_id()
  ));

GRANT SELECT ON public.projeto_status_historico TO authenticated;
-- sem INSERT/UPDATE/DELETE liberado: só o trigger abaixo escreve (SECURITY DEFINER).

CREATE OR REPLACE FUNCTION public._trg_registrar_status_projeto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.projeto_status_historico (projeto_id, de, para, mudado_por)
    VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      (SELECT ps.id FROM public.pessoas ps WHERE ps.profile_id = auth.uid() AND ps.deleted_at IS NULL LIMIT 1)
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._trg_registrar_status_projeto() FROM PUBLIC;

CREATE TRIGGER trg_registrar_status_projeto
  AFTER UPDATE ON public.projetos
  FOR EACH ROW
  EXECUTE FUNCTION public._trg_registrar_status_projeto();
