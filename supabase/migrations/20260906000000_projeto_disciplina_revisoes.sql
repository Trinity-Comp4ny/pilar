-- Revisão por disciplina (spec 093): histórico auditável de retrabalho, motivo
-- obrigatório, quem registrou e quando. Mesmo modelo das pausas
-- (20260891000000): a tabela só é lida pelo client, a escrita passa pelas duas
-- RPCs abaixo, pra motivo e datas nunca ficarem inconsistentes.
--
-- Decisões do design partner (Victor/VRZ, 2026-09-04) refletidas aqui:
-- sem numeração formal (o contador é derivado por count, nunca persistido),
-- revisão genérica com o motivo em texto livre, e sem vínculo com contrato.
-- As colunas que ligariam revisão a dinheiro (horas_gastas, aditivo_id) ficam
-- de fora e entram depois de forma aditiva.
--
-- Registrar revisão NÃO altera projeto_disciplinas.status: diferente da pausa,
-- que tem status próprio, mexer no status aqui colidiria com a máquina de pausa
-- e com o guard de checklist incompleto, sem ganho.

CREATE TABLE public.projeto_disciplina_revisoes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_disciplina_id uuid NOT NULL REFERENCES public.projeto_disciplinas(id) ON DELETE CASCADE,
  motivo                text NOT NULL,
  solicitada_em         date NOT NULL DEFAULT current_date,
  registrada_por        uuid REFERENCES public.pessoas(id) ON DELETE SET NULL,
  concluida_em          date,
  concluida_por         uuid REFERENCES public.pessoas(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- só 1 revisão em aberto por disciplina por vez
CREATE UNIQUE INDEX projeto_disciplina_revisoes_aberta_uniq
  ON public.projeto_disciplina_revisoes (projeto_disciplina_id)
  WHERE concluida_em IS NULL;

CREATE INDEX idx_projeto_disciplina_revisoes_disciplina
  ON public.projeto_disciplina_revisoes (projeto_disciplina_id);

ALTER TABLE public.projeto_disciplina_revisoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY projeto_disciplina_revisoes_empresa
  ON public.projeto_disciplina_revisoes
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.projeto_disciplinas pd
    JOIN public.projetos p ON p.id = pd.projeto_id
    WHERE pd.id = projeto_disciplina_revisoes.projeto_disciplina_id
      AND p.empresa_id = public.get_user_empresa_id()
  ));

GRANT SELECT ON public.projeto_disciplina_revisoes TO authenticated;
-- sem INSERT/UPDATE direto: só via as RPCs abaixo.

CREATE OR REPLACE FUNCTION public.rpc_registrar_revisao(
  p_disciplina_id uuid,
  p_motivo text,
  p_solicitada_em date DEFAULT current_date
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_revisao_id uuid;
BEGIN
  SELECT p.empresa_id INTO v_empresa_id
  FROM public.projeto_disciplinas pd
  JOIN public.projetos p ON p.id = pd.projeto_id
  WHERE pd.id = p_disciplina_id;

  IF v_empresa_id IS NULL OR v_empresa_id <> public.get_user_empresa_id() THEN
    RAISE EXCEPTION 'Disciplina não encontrada ou sem permissão';
  END IF;

  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN
    RAISE EXCEPTION 'Motivo da revisão é obrigatório';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.projeto_disciplina_revisoes
    WHERE projeto_disciplina_id = p_disciplina_id AND concluida_em IS NULL
  ) THEN
    RAISE EXCEPTION 'Já existe uma revisão em aberto nessa disciplina';
  END IF;

  INSERT INTO public.projeto_disciplina_revisoes (
    projeto_disciplina_id, motivo, solicitada_em, registrada_por
  )
  VALUES (
    p_disciplina_id,
    btrim(p_motivo),
    COALESCE(p_solicitada_em, current_date),
    (SELECT ps.id FROM public.pessoas ps WHERE ps.profile_id = auth.uid() AND ps.deleted_at IS NULL LIMIT 1)
  )
  RETURNING id INTO v_revisao_id;

  RETURN v_revisao_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_concluir_revisao(
  p_revisao_id uuid,
  p_concluida_em date DEFAULT current_date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_solicitada_em date;
BEGIN
  SELECT p.empresa_id, r.solicitada_em INTO v_empresa_id, v_solicitada_em
  FROM public.projeto_disciplina_revisoes r
  JOIN public.projeto_disciplinas pd ON pd.id = r.projeto_disciplina_id
  JOIN public.projetos p ON p.id = pd.projeto_id
  WHERE r.id = p_revisao_id;

  IF v_empresa_id IS NULL OR v_empresa_id <> public.get_user_empresa_id() THEN
    RAISE EXCEPTION 'Revisão não encontrada ou sem permissão';
  END IF;

  IF COALESCE(p_concluida_em, current_date) < v_solicitada_em THEN
    RAISE EXCEPTION 'Conclusão não pode ser anterior à data da solicitação';
  END IF;

  UPDATE public.projeto_disciplina_revisoes
     SET concluida_em = COALESCE(p_concluida_em, current_date),
         concluida_por = (SELECT ps.id FROM public.pessoas ps WHERE ps.profile_id = auth.uid() AND ps.deleted_at IS NULL LIMIT 1)
   WHERE id = p_revisao_id
     AND concluida_em IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Essa revisão já foi concluída';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_registrar_revisao(uuid, text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_registrar_revisao(uuid, text, date) TO authenticated;

REVOKE ALL ON FUNCTION public.rpc_concluir_revisao(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_concluir_revisao(uuid, date) TO authenticated;
