-- Colunas de projeto personalizáveis por empresa (Kanban customizável).
-- Espelha a arquitetura de tarefa_etapas (spec 014), com uma diferença: o
-- `bucket` é OBRIGATÓRIO e usa os 6 valores canônicos do enum status_projeto.
-- Assim o board vira colunas livres (criar/renomear/reordenar/excluir), mas o
-- projetos.status legado DERIVA do bucket da coluna, mantendo intactos os ~2
-- triggers, ~8 RPCs e KPIs que comparam status = 'Concluído'/'Cancelado'/etc.
--
-- Regra do bucket: cada coluna declara a qual dos 6 status canônicos pertence
-- (Planejamento/Em andamento/Revisão/Paralisado/Concluído/Cancelado). Vários
-- colunas podem compartilhar o mesmo bucket (ex.: duas colunas "Em andamento"),
-- por isso NÃO há unique index por (empresa, bucket) como em tarefa_etapas.

-- 1. Tabela de etapas (colunas) por empresa ------------------------------------
CREATE TABLE IF NOT EXISTS public.projeto_etapas (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome       text NOT NULL,
  ordem      integer NOT NULL DEFAULT 0,
  cor        text,
  -- Âncora de semântica: um dos valores do enum status_projeto. O status do
  -- projeto deriva daqui, então a regra de negócio (data_final, notificação,
  -- KPIs) segue funcionando sem reescrita.
  bucket     public.status_projeto NOT NULL DEFAULT 'Em andamento',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projeto_etapas_empresa_ordem
  ON public.projeto_etapas (empresa_id, ordem);

ALTER TABLE public.projeto_etapas ENABLE ROW LEVEL SECURITY;

-- Config da empresa: qualquer membro autenticado gerencia as colunas. Escopo
-- por empresa dos dois lados (mesma filosofia de tarefa_etapas).
DROP POLICY IF EXISTS projeto_etapas_all ON public.projeto_etapas;
CREATE POLICY projeto_etapas_all ON public.projeto_etapas
  FOR ALL
  USING (empresa_id = public.get_user_empresa_id())
  WITH CHECK (empresa_id = public.get_user_empresa_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projeto_etapas TO authenticated;

-- 2. Projeto aponta para a etapa (coluna). RESTRICT: não deixa apagar coluna
--    com projeto dentro (o front bloqueia antes com mensagem amigável).
ALTER TABLE public.projetos
  ADD COLUMN IF NOT EXISTS etapa_id uuid REFERENCES public.projeto_etapas(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_projetos_etapa ON public.projetos (etapa_id);

-- 3. Sync status <-> etapa (trigger BEFORE em projetos) ------------------------
-- Prefixo "a_" no nome garante que este trigger roda ANTES de
-- projeto_auto_complete e tr_calculate_status_data (ordem alfabética), para que
-- NEW.status já esteja derivado quando essas regras lerem o status.
CREATE OR REPLACE FUNCTION public.sync_projeto_status_etapa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Deriva pelo que MUDOU, para os dois caminhos coexistirem: o desktop move a
  -- coluna (etapa_id) e o status segue o bucket; o mobile move o status e a
  -- etapa segue o bucket. Sem isso, um caminho reverteria o outro.
  IF TG_OP = 'UPDATE' AND NEW.etapa_id IS DISTINCT FROM OLD.etapa_id AND NEW.etapa_id IS NOT NULL THEN
    -- Mudou de coluna (desktop): o status deriva do bucket da etapa nova.
    SELECT pe.bucket INTO NEW.status FROM public.projeto_etapas pe WHERE pe.id = NEW.etapa_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    -- Mudou o status (mobile / RPC): a etapa segue a primeira coluna do bucket.
    SELECT pe.id INTO NEW.etapa_id
    FROM public.projeto_etapas pe
    WHERE pe.empresa_id = NEW.empresa_id AND pe.bucket = NEW.status
    ORDER BY pe.ordem LIMIT 1;
  ELSIF NEW.etapa_id IS NOT NULL THEN
    -- INSERT com etapa, ou update que não mexeu em nenhum: mantém status = bucket.
    SELECT pe.bucket INTO NEW.status FROM public.projeto_etapas pe WHERE pe.id = NEW.etapa_id;
  ELSIF NEW.empresa_id IS NOT NULL AND NEW.status IS NOT NULL THEN
    -- INSERT sem etapa (RPC/form legado): deriva a etapa da primeira coluna do bucket.
    SELECT pe.id INTO NEW.etapa_id
    FROM public.projeto_etapas pe
    WHERE pe.empresa_id = NEW.empresa_id AND pe.bucket = NEW.status
    ORDER BY pe.ordem LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS a_sync_projeto_status_etapa ON public.projetos;
CREATE TRIGGER a_sync_projeto_status_etapa
  BEFORE INSERT OR UPDATE ON public.projetos
  FOR EACH ROW EXECUTE FUNCTION public.sync_projeto_status_etapa();

-- 4. Semente das 6 colunas-padrão por empresa nova -----------------------------
CREATE OR REPLACE FUNCTION public.seed_projeto_etapas_padrao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.projeto_etapas WHERE empresa_id = NEW.id) THEN
    INSERT INTO public.projeto_etapas (empresa_id, nome, ordem, cor, bucket)
    VALUES
      (NEW.id, 'Planejamento', 0, '#f59e0b', 'Planejamento'),
      (NEW.id, 'Em andamento', 1, '#3b82f6', 'Em andamento'),
      (NEW.id, 'Revisão',      2, '#8b5cf6', 'Revisão'),
      (NEW.id, 'Paralisado',   3, '#64748b', 'Paralisado'),
      (NEW.id, 'Concluído',    4, '#10b981', 'Concluído'),
      (NEW.id, 'Cancelado',    5, '#ef4444', 'Cancelado');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_projeto_etapas ON public.empresas;
CREATE TRIGGER trg_seed_projeto_etapas
  AFTER INSERT ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.seed_projeto_etapas_padrao();

-- 5. Backfill idempotente das empresas existentes ------------------------------
INSERT INTO public.projeto_etapas (empresa_id, nome, ordem, cor, bucket)
SELECT e.id, v.nome, v.ordem, v.cor, v.bucket::public.status_projeto
FROM public.empresas e
CROSS JOIN (VALUES
  ('Planejamento', 0, '#f59e0b', 'Planejamento'),
  ('Em andamento', 1, '#3b82f6', 'Em andamento'),
  ('Revisão',      2, '#8b5cf6', 'Revisão'),
  ('Paralisado',   3, '#64748b', 'Paralisado'),
  ('Concluído',    4, '#10b981', 'Concluído'),
  ('Cancelado',    5, '#ef4444', 'Cancelado')
) AS v(nome, ordem, cor, bucket)
WHERE NOT EXISTS (SELECT 1 FROM public.projeto_etapas pe WHERE pe.empresa_id = e.id);

-- Vincula cada projeto à coluna cujo bucket casa com o status atual. Direto no
-- UPDATE (o trigger de sync respeita etapa_id já preenchido em updates futuros).
UPDATE public.projetos p
SET etapa_id = pe.id
FROM public.projeto_etapas pe
WHERE pe.empresa_id = p.empresa_id
  AND p.etapa_id IS NULL
  AND pe.bucket = p.status;

COMMENT ON COLUMN public.projeto_etapas.bucket IS
  'Âncora de status (um dos 6 valores de status_projeto). O projetos.status deriva daqui via trigger sync_projeto_status_etapa, preservando as regras de negócio.';
