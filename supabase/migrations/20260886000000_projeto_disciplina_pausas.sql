-- Pausa documentada por disciplina (spec 083): histórico auditável de "dias
-- parados", motivo obrigatório, quem pausou/retomou. Só entra/sai do status
-- "Pausada" via as duas RPCs abaixo, nunca por update direto de status, pra
-- motivo e timestamps nunca ficarem inconsistentes com o histórico.

CREATE TABLE public.projeto_disciplina_pausas (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_disciplina_id uuid NOT NULL REFERENCES public.projeto_disciplinas(id) ON DELETE CASCADE,
  motivo                text NOT NULL,
  pausado_em            timestamptz NOT NULL DEFAULT now(),
  pausado_por           uuid REFERENCES public.pessoas(id) ON DELETE SET NULL,
  retomado_em           timestamptz,
  retomado_por          uuid REFERENCES public.pessoas(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- só 1 pausa aberta por disciplina por vez
CREATE UNIQUE INDEX projeto_disciplina_pausas_aberta_uniq
  ON public.projeto_disciplina_pausas (projeto_disciplina_id)
  WHERE retomado_em IS NULL;

CREATE INDEX idx_projeto_disciplina_pausas_disciplina
  ON public.projeto_disciplina_pausas (projeto_disciplina_id);

ALTER TABLE public.projeto_disciplina_pausas ENABLE ROW LEVEL SECURITY;

CREATE POLICY projeto_disciplina_pausas_empresa
  ON public.projeto_disciplina_pausas
  USING (EXISTS (
    SELECT 1 FROM public.projeto_disciplinas pd
    JOIN public.projetos p ON p.id = pd.projeto_id
    WHERE pd.id = projeto_disciplina_pausas.projeto_disciplina_id
      AND p.empresa_id = public.get_user_empresa_id()
  ));

GRANT SELECT ON public.projeto_disciplina_pausas TO authenticated;
-- sem INSERT/UPDATE direto: só via as RPCs abaixo.

CREATE OR REPLACE FUNCTION public.rpc_pausar_disciplina(p_disciplina_id uuid, p_motivo text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_pausa_id uuid;
BEGIN
  SELECT p.empresa_id INTO v_empresa_id
  FROM public.projeto_disciplinas pd
  JOIN public.projetos p ON p.id = pd.projeto_id
  WHERE pd.id = p_disciplina_id;

  IF v_empresa_id IS NULL OR v_empresa_id <> public.get_user_empresa_id() THEN
    RAISE EXCEPTION 'Disciplina não encontrada ou sem permissão';
  END IF;

  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN
    RAISE EXCEPTION 'Motivo da pausa é obrigatório';
  END IF;

  INSERT INTO public.projeto_disciplina_pausas (projeto_disciplina_id, motivo, pausado_por)
  VALUES (
    p_disciplina_id,
    btrim(p_motivo),
    (SELECT ps.id FROM public.pessoas ps WHERE ps.profile_id = auth.uid() AND ps.deleted_at IS NULL LIMIT 1)
  )
  RETURNING id INTO v_pausa_id;

  UPDATE public.projeto_disciplinas SET status = 'Pausada' WHERE id = p_disciplina_id;

  RETURN v_pausa_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_retomar_disciplina(p_disciplina_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
BEGIN
  SELECT p.empresa_id INTO v_empresa_id
  FROM public.projeto_disciplinas pd
  JOIN public.projetos p ON p.id = pd.projeto_id
  WHERE pd.id = p_disciplina_id;

  IF v_empresa_id IS NULL OR v_empresa_id <> public.get_user_empresa_id() THEN
    RAISE EXCEPTION 'Disciplina não encontrada ou sem permissão';
  END IF;

  UPDATE public.projeto_disciplina_pausas
     SET retomado_em = now(),
         retomado_por = (SELECT ps.id FROM public.pessoas ps WHERE ps.profile_id = auth.uid() AND ps.deleted_at IS NULL LIMIT 1)
   WHERE projeto_disciplina_id = p_disciplina_id
     AND retomado_em IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Não há pausa em aberto pra essa disciplina';
  END IF;

  UPDATE public.projeto_disciplinas SET status = 'Em Andamento' WHERE id = p_disciplina_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_pausar_disciplina(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_pausar_disciplina(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.rpc_retomar_disciplina(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_retomar_disciplina(uuid) TO authenticated;
