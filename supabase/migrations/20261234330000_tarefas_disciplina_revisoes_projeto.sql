BEGIN;

ALTER TABLE public.tarefas
  ADD COLUMN projeto_disciplina_id uuid REFERENCES public.projeto_disciplinas(id) ON DELETE SET NULL,
  ADD COLUMN portal_entrega_id uuid REFERENCES public.portal_entregas(id) ON DELETE SET NULL,
  ADD COLUMN retrabalho boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT tarefas_retrabalho_projeto_check CHECK (NOT retrabalho OR projeto_id IS NOT NULL);

CREATE INDEX tarefas_projeto_disciplina_idx ON public.tarefas (projeto_disciplina_id);

CREATE INDEX tarefas_portal_entrega_idx ON public.tarefas (portal_entrega_id);

CREATE FUNCTION public.validar_tarefa_disciplina()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.projeto_id IS DISTINCT FROM OLD.projeto_id THEN
    NEW.portal_entrega_id := NULL;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.projeto_id IS NULL AND OLD.projeto_id IS NOT NULL THEN
    NEW.projeto_disciplina_id := NULL;
    NEW.retrabalho := false;
  END IF;
  IF NEW.projeto_disciplina_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.projeto_disciplinas d
    JOIN public.projetos p ON p.id = d.projeto_id
    WHERE d.id = NEW.projeto_disciplina_id
      AND p.id = NEW.projeto_id
      AND p.empresa_id = NEW.empresa_id
  ) THEN
    RAISE EXCEPTION 'A disciplina precisa pertencer ao projeto da tarefa' USING ERRCODE = '23514';
  END IF;
  IF NEW.portal_entrega_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.portal_entregas e
    WHERE e.id = NEW.portal_entrega_id AND e.projeto_id = NEW.projeto_id AND e.empresa_id = NEW.empresa_id
  ) THEN
    RAISE EXCEPTION 'A revisão precisa pertencer ao projeto da tarefa' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validar_tarefa_disciplina
BEFORE INSERT OR UPDATE OF projeto_disciplina_id, projeto_id, empresa_id, portal_entrega_id ON public.tarefas
FOR EACH ROW EXECUTE FUNCTION public.validar_tarefa_disciplina();

ALTER TABLE public.portal_entregas
  ADD COLUMN revisao_anterior_id uuid REFERENCES public.portal_entregas(id) ON DELETE NO ACTION,
  ADD COLUMN numero_revisao integer CHECK (numero_revisao >= 0);

CREATE UNIQUE INDEX portal_entregas_revisao_anterior_uidx
  ON public.portal_entregas (revisao_anterior_id) WHERE revisao_anterior_id IS NOT NULL;

CREATE FUNCTION public.validar_portal_entrega_revisao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  anterior public.portal_entregas%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.numero_revisao IS DISTINCT FROM NEW.numero_revisao
      OR OLD.revisao_anterior_id IS DISTINCT FROM NEW.revisao_anterior_id
      OR (OLD.numero_revisao IS NOT NULL AND (
        OLD.drive_url IS DISTINCT FROM NEW.drive_url
        OR OLD.projeto_id IS DISTINCT FROM NEW.projeto_id
        OR OLD.empresa_id IS DISTINCT FROM NEW.empresa_id
      )) THEN
      RAISE EXCEPTION 'Publique uma nova revisão para alterar a entrega' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.revisao_anterior_id IS NOT NULL THEN
    SELECT * INTO anterior FROM public.portal_entregas WHERE id = NEW.revisao_anterior_id;
    IF NOT FOUND OR anterior.projeto_id IS DISTINCT FROM NEW.projeto_id
      OR anterior.empresa_id IS DISTINCT FROM NEW.empresa_id OR anterior.status IS DISTINCT FROM 'revisao_solicitada'
      OR anterior.numero_revisao IS NULL OR anterior.drive_url IS NOT DISTINCT FROM NEW.drive_url
      OR anterior.projeto_disciplina_id IS DISTINCT FROM NEW.projeto_disciplina_id THEN
      RAISE EXCEPTION 'Selecione uma revisão com ajustes solicitados e use um novo link'
        USING ERRCODE = '23514';
    END IF;
    NEW.numero_revisao := anterior.numero_revisao + 1;
  END IF;

  IF NEW.numero_revisao IS NOT NULL AND (
    NEW.projeto_id IS NULL OR NEW.tipo IS DISTINCT FROM 'aprovacao' OR NEW.drive_url IS NULL
    OR NEW.status IS DISTINCT FROM 'pendente'
    OR (NEW.revisao_anterior_id IS NULL AND NEW.numero_revisao <> 0)
  ) THEN
    RAISE EXCEPTION 'A revisão precisa de um projeto, um arquivo e aguardar aprovação' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validar_portal_entrega_revisao
BEFORE INSERT OR UPDATE ON public.portal_entregas
FOR EACH ROW EXECUTE FUNCTION public.validar_portal_entrega_revisao();

DROP FUNCTION IF EXISTS public.portal_listar_solicitacoes(TEXT, UUID, UUID);
CREATE FUNCTION public.portal_listar_solicitacoes(
  p_token TEXT,
  p_projeto_id UUID DEFAULT NULL,
  p_obra_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  projeto_id uuid,
  projeto_nome text,
  obra_id uuid,
  obra_nome text,
  titulo text,
  descricao text,
  tipo text,
  status text,
  drive_url text,
  projeto_disciplina_id uuid,
  disciplina_nome text,
  resposta_cliente text,
  respondido_em timestamptz,
  aprovado_ip inet,
  aprovado_user_agent text,
  created_at timestamptz,
  numero_revisao integer,
  revisao_anterior_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_session JSON;
  v_cliente_id UUID;
BEGIN
  v_session := portal_verify_session_readonly(p_token);
  IF v_session IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida ou expirada';
  END IF;
  v_cliente_id := (v_session->>'cliente_id')::uuid;

  RETURN QUERY
  SELECT
    e.id, e.projeto_id, p.nome, e.obra_id, o.nome, e.titulo, e.descricao, e.tipo, e.status,
    e.drive_url, e.projeto_disciplina_id, pd.nome, e.resposta_cliente, e.respondido_em,
    e.aprovado_ip, e.aprovado_user_agent, e.created_at, e.numero_revisao, e.revisao_anterior_id
  FROM portal_entregas e
  LEFT JOIN projetos p ON p.id = e.projeto_id
  LEFT JOIN obras o ON o.id = e.obra_id
  LEFT JOIN projeto_disciplinas pd ON pd.id = e.projeto_disciplina_id
  WHERE (
      (e.projeto_id IS NOT NULL AND p.cliente_id = v_cliente_id)
      OR (
        e.obra_id IS NOT NULL
        AND o.cliente_id = v_cliente_id
        AND o.modelo_cobranca = 'administracao'
        AND o.visivel_portal = true
        AND o.deleted_at IS NULL
      )
    )
    AND (p_projeto_id IS NULL OR e.projeto_id = p_projeto_id)
    AND (p_obra_id IS NULL OR e.obra_id = p_obra_id)
  ORDER BY e.created_at DESC;
END;
$$;


REVOKE ALL ON FUNCTION public.portal_listar_solicitacoes(TEXT, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_listar_solicitacoes(TEXT, UUID, UUID) TO anon, authenticated, service_role;

COMMIT;
