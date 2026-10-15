-- Colunas do funil de leads personalizáveis por empresa (SPEC 120).
-- Mesma arquitetura de projeto_etapas (20260816000000): cada coluna declara um
-- `bucket` (um dos 6 status canônicos do lead) e o leads.status DERIVA dele por
-- trigger. Assim o funil vira colunas livres (criar/renomear/reordenar/excluir),
-- mas o CHECK de leads.status, os RPCs de conversão, o painel de gestão e os KPIs
-- que comparam status = 'Ganho'/'Perdido' seguem intactos.
--
-- Várias colunas podem compartilhar o mesmo bucket (ex.: "Visita técnica" e
-- "Reunião" contando como "Em contato"), por isso não há unique por (empresa, bucket).

-- 1. Tabela de colunas por empresa -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_etapas (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome       text NOT NULL CHECK (btrim(nome) <> ''),
  ordem      integer NOT NULL DEFAULT 0,
  cor        text,
  bucket     text NOT NULL DEFAULT 'Novo'
    CHECK (bucket IN ('Novo', 'Em contato', 'Proposta', 'Negociação', 'Ganho', 'Perdido')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_etapas_empresa_ordem
  ON public.lead_etapas (empresa_id, ordem);

ALTER TABLE public.lead_etapas ENABLE ROW LEVEL SECURITY;

-- Mesma matriz de leads: ler exige viewer do módulo, escrever exige editor.
DROP POLICY IF EXISTS lead_etapas_select ON public.lead_etapas;
CREATE POLICY lead_etapas_select ON public.lead_etapas
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id() AND public.user_has_feature('leads', 'viewer'));

DROP POLICY IF EXISTS lead_etapas_write ON public.lead_etapas;
CREATE POLICY lead_etapas_write ON public.lead_etapas
  FOR ALL TO authenticated
  USING (empresa_id = public.get_user_empresa_id() AND public.user_has_feature('leads', 'editor'))
  WITH CHECK (empresa_id = public.get_user_empresa_id() AND public.user_has_feature('leads', 'editor'));

REVOKE ALL ON public.lead_etapas FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_etapas TO authenticated;

-- 2. Lead aponta para a coluna ---------------------------------------------------------
-- SET NULL só alcança leads já excluídos (soft delete): lead ativo na coluna é
-- barrado pelo trigger de exclusão antes.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS etapa_id uuid REFERENCES public.lead_etapas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_etapa ON public.leads (etapa_id);

-- leads tem SELECT por coluna (valor_estimado só pela leads_safe): libera a nova.
GRANT SELECT (etapa_id) ON public.leads TO authenticated;

-- 3. Semente das 6 colunas-padrão (empresa nova + backfill) ---------------------------
-- Os nomes são os rótulos que o quadro já mostrava (registry de status do lead).
CREATE OR REPLACE FUNCTION public.seed_lead_etapas_padrao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.lead_etapas WHERE empresa_id = NEW.id) THEN
    INSERT INTO public.lead_etapas (empresa_id, nome, ordem, cor, bucket)
    VALUES
      (NEW.id, 'Novo',       0, '#3b82f6', 'Novo'),
      (NEW.id, 'Em Contato', 1, '#6366f1', 'Em contato'),
      (NEW.id, 'Proposta Enviada', 2, '#eab308', 'Proposta'),
      (NEW.id, 'Em Negociação', 3, '#a4ec86', 'Negociação'),
      (NEW.id, 'Ganho',      4, '#22c55e', 'Ganho'),
      (NEW.id, 'Perdido',    5, '#ef4444', 'Perdido');
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_lead_etapas_padrao() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_seed_lead_etapas ON public.empresas;
CREATE TRIGGER trg_seed_lead_etapas
  AFTER INSERT ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.seed_lead_etapas_padrao();

INSERT INTO public.lead_etapas (empresa_id, nome, ordem, cor, bucket)
SELECT e.id, v.nome, v.ordem, v.cor, v.bucket
FROM public.empresas e
CROSS JOIN (VALUES
  ('Novo',       0, '#3b82f6', 'Novo'),
  ('Em Contato', 1, '#6366f1', 'Em contato'),
  ('Proposta Enviada', 2, '#eab308', 'Proposta'),
  ('Em Negociação', 3, '#a4ec86', 'Negociação'),
  ('Ganho',      4, '#22c55e', 'Ganho'),
  ('Perdido',    5, '#ef4444', 'Perdido')
) AS v(nome, ordem, cor, bucket)
WHERE NOT EXISTS (SELECT 1 FROM public.lead_etapas le WHERE le.empresa_id = e.id);

-- Vincula cada lead (inclusive os excluídos) à coluna de bucket igual ao status.
-- Sem os triggers de usuário: o de auditoria carimbaria updated_at em todo lead e o
-- de "empresa em leitura" barraria empresas congeladas. O trigger de sync só é
-- criado depois, então nada deriva aqui (status já é igual ao bucket).
ALTER TABLE public.leads DISABLE TRIGGER USER;

UPDATE public.leads l
SET etapa_id = (
  SELECT le.id
  FROM public.lead_etapas le
  WHERE le.empresa_id = l.empresa_id AND le.bucket = l.status
  ORDER BY le.ordem, le.created_at
  LIMIT 1
)
WHERE l.etapa_id IS NULL;

ALTER TABLE public.leads ENABLE TRIGGER USER;

-- 4. Sync status <-> coluna (BEFORE em leads) ----------------------------------------
-- Prefixo "a_" roda antes dos demais triggers (ordem alfabética), para que NEW.status
-- já esteja derivado quando eles lerem.
CREATE OR REPLACE FUNCTION public.sync_lead_status_etapa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bucket text;
  v_etapa  uuid;
BEGIN
  -- Nada mudou nos dois lados e já há coluna: segue.
  IF TG_OP = 'UPDATE'
     AND NEW.etapa_id IS NOT NULL
     AND NEW.etapa_id IS NOT DISTINCT FROM OLD.etapa_id
     AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- Mudou de coluna (quadro, mobile) ou nasceu com coluna: o status deriva do bucket.
  -- A coluna precisa ser da mesma empresa do lead.
  IF NEW.etapa_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.etapa_id IS DISTINCT FROM OLD.etapa_id) THEN
    SELECT le.bucket INTO v_bucket
    FROM public.lead_etapas le
    WHERE le.id = NEW.etapa_id AND le.empresa_id = NEW.empresa_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'A coluna do funil não pertence à empresa do lead.' USING ERRCODE = '23503';
    END IF;
    NEW.status := v_bucket;
    RETURN NEW;
  END IF;

  -- Mudou só o status (RPC legada, ex.: conversão em cliente): se a coluna atual já
  -- conta como esse status, mantém.
  IF TG_OP = 'UPDATE' AND NEW.etapa_id IS NOT NULL THEN
    SELECT le.bucket INTO v_bucket FROM public.lead_etapas le WHERE le.id = NEW.etapa_id;
    IF v_bucket = NEW.status THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Sem coluna (insert legado, status trocado por RPC, dado antigo): usa a primeira
  -- coluna do bucket pedido. Um UPDATE que só zerou etapa_id (FK SET NULL de lead
  -- excluído) não é reatribuído.
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status OR OLD.etapa_id IS NULL THEN
    SELECT le.id INTO v_etapa
    FROM public.lead_etapas le
    WHERE le.empresa_id = NEW.empresa_id AND le.bucket = NEW.status
    ORDER BY le.ordem, le.created_at
    LIMIT 1;

    -- Empresa sem coluna desse bucket: lead novo cai na primeira coluna aberta e o
    -- status acompanha. Ganho/Perdido nunca caem em outro bucket (a última de cada
    -- uma não pode ser excluída).
    IF v_etapa IS NULL AND NEW.status NOT IN ('Ganho', 'Perdido') THEN
      SELECT le.id, le.bucket INTO v_etapa, v_bucket
      FROM public.lead_etapas le
      WHERE le.empresa_id = NEW.empresa_id AND le.bucket NOT IN ('Ganho', 'Perdido')
      ORDER BY le.ordem, le.created_at
      LIMIT 1;
      IF v_etapa IS NOT NULL THEN
        NEW.status := v_bucket;
      END IF;
    END IF;

    NEW.etapa_id := v_etapa;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_lead_status_etapa() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS a_sync_lead_status_etapa ON public.leads;
CREATE TRIGGER a_sync_lead_status_etapa
  BEFORE INSERT OR UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.sync_lead_status_etapa();

-- 5. Guarda das colunas ------------------------------------------------------------------
-- bucket e empresa não mudam (mudar o bucket de uma coluna com leads reclassificaria
-- tudo sem passar pelo fluxo de conversão/motivo de perda). Exclusão: barra coluna
-- com lead ativo e a última de Ganho/Perdido. service_role, migration e a exclusão de
-- empresa por retenção (excluir_empresa_retencao) passam direto.
CREATE OR REPLACE FUNCTION public.guard_lead_etapa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.bucket IS DISTINCT FROM OLD.bucket THEN
      RAISE EXCEPTION 'O tipo da coluna não muda depois de criada. Crie outra coluna e mova os leads.'
        USING ERRCODE = 'P0001';
    END IF;
    IF NEW.empresa_id IS DISTINCT FROM OLD.empresa_id THEN
      RAISE EXCEPTION 'A coluna não pode trocar de empresa.' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;

  -- Sem JWT (migration, psql) auth.role() é NULL: conta como service_role.
  IF COALESCE(auth.role(), 'service_role') <> 'authenticated'
     OR current_setting('pilar.retencao_em_curso', true) = 'on' THEN
    RETURN OLD;
  END IF;

  IF EXISTS (SELECT 1 FROM public.leads l WHERE l.etapa_id = OLD.id AND l.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Mova os leads desta coluna para outra antes de excluí-la.' USING ERRCODE = '23503';
  END IF;

  IF OLD.bucket IN ('Ganho', 'Perdido') AND NOT EXISTS (
    SELECT 1 FROM public.lead_etapas le
    WHERE le.empresa_id = OLD.empresa_id AND le.bucket = OLD.bucket AND le.id <> OLD.id
  ) THEN
    RAISE EXCEPTION 'O funil precisa de pelo menos uma coluna que conta como %.', OLD.bucket
      USING ERRCODE = 'P0001';
  END IF;

  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_lead_etapa() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_lead_etapa ON public.lead_etapas;
CREATE TRIGGER trg_guard_lead_etapa
  BEFORE UPDATE OR DELETE ON public.lead_etapas
  FOR EACH ROW EXECUTE FUNCTION public.guard_lead_etapa();

-- 6. leads_safe expõe a coluna (campo novo no fim: CREATE OR REPLACE só aceita assim) ---
CREATE OR REPLACE VIEW public.leads_safe WITH (security_barrier = true) AS
SELECT
  l.id,
  l.empresa_id,
  l.created_by,
  l.nome,
  l.sobrenome,
  l.email,
  l.contato,
  l.status,
  l.origem,
  l.cliente_id,
  l.motivo_perda,
  l.convertido_em,
  l.responsavel_id,
  l.previsao_fechamento,
  l.empresa_lead,
  l.cnpj,
  l.notas,
  l.deleted_at,
  l.created_at,
  l.updated_at,
  public.can_view_financeiro() AS pode_ver_valor,
  CASE WHEN public.can_view_financeiro() THEN l.valor_estimado END AS valor_estimado,
  l.etapa_id
FROM public.leads l
WHERE l.empresa_id = public.get_user_empresa_id()
  AND l.deleted_at IS NULL
  AND public.user_has_feature('leads', 'viewer');

COMMENT ON COLUMN public.lead_etapas.bucket IS
  'Âncora de status (um dos 6 valores de leads.status). O leads.status deriva daqui via trigger sync_lead_status_etapa, preservando conversão, motivo de perda e KPIs.';
