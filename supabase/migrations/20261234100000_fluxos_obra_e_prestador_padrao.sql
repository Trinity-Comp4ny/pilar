-- Fluxo de obra: modelo de cronograma (fase > etapa > serviço > tarefa) com duração e prestador padrão
-- por serviço, que a empresa monta uma vez e aplica em toda obra nova (pedido do Naka e do Bruno, 13/11).
-- Mesma ideia do fluxo de disciplinas do projeto (fluxos_disciplinas), em tabela própria porque a árvore
-- da obra tem quatro níveis e o prestador (fornecedor) em vez de pessoa.

CREATE TABLE IF NOT EXISTS public.fluxos_obra (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome        text NOT NULL CHECK (btrim(nome) <> ''),
  descricao   text,
  -- Árvore: [{ nome, etapas: [{ nome, servicos: [{ nome, duracao_dias, fornecedor_id, paralelo, tarefas: [text] }] }] }]
  estrutura   jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by  uuid DEFAULT auth.uid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_fluxos_obra_empresa ON public.fluxos_obra (empresa_id) WHERE deleted_at IS NULL;

ALTER TABLE public.fluxos_obra ENABLE ROW LEVEL SECURITY;

-- Escopo por empresa, como as demais tabelas de obra (obras_mvp). O SELECT não filtra deleted_at: o soft delete
-- é um UPDATE e a linha marcada precisa continuar visível para ele (a tela filtra).
DROP POLICY IF EXISTS fluxos_obra_select ON public.fluxos_obra;
CREATE POLICY fluxos_obra_select ON public.fluxos_obra
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id());

DROP POLICY IF EXISTS fluxos_obra_insert ON public.fluxos_obra;
CREATE POLICY fluxos_obra_insert ON public.fluxos_obra
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id());

DROP POLICY IF EXISTS fluxos_obra_update ON public.fluxos_obra;
CREATE POLICY fluxos_obra_update ON public.fluxos_obra
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id())
  WITH CHECK (empresa_id = public.get_user_empresa_id());

DROP POLICY IF EXISTS fluxos_obra_delete ON public.fluxos_obra;
CREATE POLICY fluxos_obra_delete ON public.fluxos_obra
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id());

REVOKE ALL ON public.fluxos_obra FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fluxos_obra TO authenticated;

-- empresa_id vem do usuário (trigger padrão do projeto, se existir) ou do front; updated_at acompanha o UPDATE.
CREATE OR REPLACE FUNCTION public.fluxos_obra_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fluxos_obra_touch ON public.fluxos_obra;
CREATE TRIGGER trg_fluxos_obra_touch
  BEFORE UPDATE ON public.fluxos_obra
  FOR EACH ROW EXECUTE FUNCTION public.fluxos_obra_touch();

-- Prestador padrão do serviço do cronograma (o eletricista, o encanador de sempre).
ALTER TABLE public.obra_frente
  ADD COLUMN IF NOT EXISTS fornecedor_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_obra_frente_fornecedor ON public.obra_frente (fornecedor_id) WHERE fornecedor_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
