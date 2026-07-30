-- Gestão · "Meu trabalho" (spec 008-gestao-meu-trabalho)
-- Cria a tabela de tarefas avulsas, funções de mapeamento de status e a RPC
-- que alimenta a aba Projetos (disciplinas do responsável logado).
-- Decisões D1-D4 resolvidas em 2026-07-30 (ver a spec).

-- ---------------------------------------------------------------------------
-- 1. Tabela de tarefas avulsas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tarefas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id     uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  titulo         text NOT NULL,
  descricao      text,
  status         text NOT NULL DEFAULT 'a_fazer'
                   CHECK (status IN ('a_fazer', 'fazendo', 'concluida')),
  responsavel_id uuid REFERENCES public.pessoas(id) ON DELETE SET NULL,
  projeto_id     uuid REFERENCES public.projetos(id) ON DELETE SET NULL,
  prazo          date,
  created_by     uuid NOT NULL DEFAULT auth.uid(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tarefas_empresa_responsavel
  ON public.tarefas (empresa_id, responsavel_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_empresa_status
  ON public.tarefas (empresa_id, status);

CREATE TRIGGER trg_tarefas_updated_at
  BEFORE UPDATE ON public.tarefas
  FOR EACH ROW EXECUTE FUNCTION public.tg_pilar_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 2. RLS — isolamento por empresa + validação cross-tenant no insert/update
-- ---------------------------------------------------------------------------
ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;

-- Leitura: membros da empresa veem as tarefas da própria empresa.
CREATE POLICY tarefas_select ON public.tarefas
  FOR SELECT USING (empresa_id = public.get_user_empresa_id());

-- Criação: só na própria empresa; responsável e projeto (quando informados)
-- precisam ser da mesma empresa (evita FK cross-tenant).
CREATE POLICY tarefas_insert ON public.tarefas
  FOR INSERT WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND (
      responsavel_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.pessoas p
        WHERE p.id = responsavel_id AND p.empresa_id = public.get_user_empresa_id()
      )
    )
    AND (
      projeto_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.projetos pr
        WHERE pr.id = projeto_id AND pr.empresa_id = public.get_user_empresa_id()
      )
    )
  );

-- Edição: mesma empresa dos dois lados; revalida responsável/projeto.
CREATE POLICY tarefas_update ON public.tarefas
  FOR UPDATE USING (empresa_id = public.get_user_empresa_id())
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND (
      responsavel_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.pessoas p
        WHERE p.id = responsavel_id AND p.empresa_id = public.get_user_empresa_id()
      )
    )
    AND (
      projeto_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.projetos pr
        WHERE pr.id = projeto_id AND pr.empresa_id = public.get_user_empresa_id()
      )
    )
  );

-- Exclusão: só na própria empresa.
CREATE POLICY tarefas_delete ON public.tarefas
  FOR DELETE USING (empresa_id = public.get_user_empresa_id());

-- ---------------------------------------------------------------------------
-- 3. Status de disciplina: mapa texto-livre -> balde de UI, e o inverso canônico
-- ---------------------------------------------------------------------------
-- projeto_disciplinas.status é texto livre e inconsistente ('Não Iniciado',
-- 'Nao Iniciado', 'Concluído', 'Concluida', 'Em Andamento', 'Atrasado'...).
-- Estas funções dão à UI 3 baldes estáveis e um valor canônico de escrita (D2).
CREATE OR REPLACE FUNCTION public.pilar_status_bucket(p_status text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_status IS NULL THEN 'a_fazer'
    WHEN lower(p_status) LIKE '%conclu%' THEN 'concluida'
    WHEN lower(p_status) LIKE '%andamento%'
      OR lower(p_status) LIKE '%revis%'
      OR lower(p_status) LIKE '%fazendo%'
      OR lower(p_status) LIKE '%progress%'
      OR lower(p_status) LIKE '%atras%' THEN 'fazendo'
    ELSE 'a_fazer'
  END;
$$;

CREATE OR REPLACE FUNCTION public.pilar_disciplina_status_canonico(p_bucket text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE p_bucket
    WHEN 'concluida' THEN 'Concluído'
    WHEN 'fazendo'   THEN 'Em Andamento'
    ELSE 'Não Iniciado'
  END;
$$;

-- ---------------------------------------------------------------------------
-- 4. RPC da aba Projetos: disciplinas sob responsabilidade da pessoa
-- ---------------------------------------------------------------------------
-- SECURITY INVOKER: o RLS de projeto_disciplinas/projetos já escopa por empresa.
-- p_pessoa_id nulo = pessoa do usuário logado (profile_id = auth.uid()).
CREATE OR REPLACE FUNCTION public.get_minhas_disciplinas(p_pessoa_id uuid DEFAULT NULL)
RETURNS TABLE (
  id           uuid,
  titulo       text,
  status_bucket text,
  status_raw   text,
  prazo        date,
  projeto_id   uuid,
  projeto_nome text
)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    pd.id,
    pd.nome AS titulo,
    public.pilar_status_bucket(pd.status) AS status_bucket,
    pd.status AS status_raw,
    pd.data_fim AS prazo,
    p.id AS projeto_id,
    p.nome AS projeto_nome
  FROM public.projeto_disciplinas pd
  JOIN public.projeto_disciplina_responsaveis r ON r.projeto_disciplina_id = pd.id
  JOIN public.projetos p ON p.id = pd.projeto_id
  WHERE r.pessoa_id = COALESCE(
    p_pessoa_id,
    (SELECT ps.id FROM public.pessoas ps
      WHERE ps.profile_id = auth.uid() AND ps.deleted_at IS NULL
      LIMIT 1)
  );
$$;

-- ---------------------------------------------------------------------------
-- 5. RPC de escrita do status da disciplina a partir do balde de UI (D2)
-- ---------------------------------------------------------------------------
-- SECURITY INVOKER: a policy projeto_disciplinas_empresa (FOR ALL) autoriza o
-- UPDATE só na própria empresa. Grava o valor canônico dos 3 status.
CREATE OR REPLACE FUNCTION public.set_disciplina_status(
  p_disciplina_id uuid,
  p_bucket text
)
RETURNS void
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF p_bucket NOT IN ('a_fazer', 'fazendo', 'concluida') THEN
    RAISE EXCEPTION 'balde de status inválido: %', p_bucket;
  END IF;

  UPDATE public.projeto_disciplinas
     SET status = public.pilar_disciplina_status_canonico(p_bucket)
   WHERE id = p_disciplina_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. Grants
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarefas TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_minhas_disciplinas(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_disciplina_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pilar_status_bucket(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pilar_disciplina_status_canonico(text) TO authenticated;
