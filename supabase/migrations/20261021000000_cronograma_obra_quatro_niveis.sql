-- Spec 111: cronograma da obra em quatro níveis (fase > etapa > serviço > tarefa).
--
-- D1: obra_frente vira árvore (nivel + parent_id) em vez de tabelas novas. Toda FK
-- que já aponta para a etapa (conta, cotação, estoque, orçamento) continua válida.
-- D2: obra existente ganha uma fase "Geral" com as etapas de hoje.
-- D3: tarefa fica só em serviço; a que hoje está direto na etapa vai para um
-- serviço "Geral" daquela etapa.
--
-- Os triggers normalizam em vez de recusar os dois casos que o código antigo
-- ainda produz até o front novo chegar (etapa sem fase, tarefa na etapa): assim
-- aplicar a migration antes do deploy do front não quebra escrita (ver memória
-- "migration que barra escrita precisa do front no mesmo release"). Nível errado
-- de verdade (serviço sob fase, tarefa na fase) é recusado com mensagem clara.

-- ---------------------------------------------------------------------------
-- 1. Árvore
-- ---------------------------------------------------------------------------
ALTER TABLE public.obra_frente
  ADD COLUMN IF NOT EXISTS nivel text NOT NULL DEFAULT 'etapa',
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.obra_frente(id) ON DELETE CASCADE;

ALTER TABLE public.obra_frente DROP CONSTRAINT IF EXISTS obra_frente_nivel_valido;
ALTER TABLE public.obra_frente
  ADD CONSTRAINT obra_frente_nivel_valido CHECK (nivel IN ('fase', 'etapa', 'servico'));

CREATE INDEX IF NOT EXISTS idx_obra_frente_parent
  ON public.obra_frente (obra_id, parent_id, ordem);

COMMENT ON COLUMN public.obra_frente.nivel IS
  'Nível no cronograma da obra: fase > etapa > serviço (spec 111). Tarefas (tabela tarefas) penduram no serviço.';
COMMENT ON COLUMN public.obra_frente.parent_id IS
  'Pai na árvore: etapa aponta para fase, serviço para etapa; fase não tem pai.';

-- ---------------------------------------------------------------------------
-- 2. Backfill (antes dos triggers)
-- ---------------------------------------------------------------------------
-- D2: uma fase "Geral" por obra que já tem etapa.
INSERT INTO public.obra_frente (empresa_id, obra_id, nome, ordem, nivel)
SELECT DISTINCT f.empresa_id, f.obra_id, 'Geral', 0, 'fase'
  FROM public.obra_frente f
 WHERE f.nivel = 'etapa' AND f.parent_id IS NULL;

UPDATE public.obra_frente e
   SET parent_id = fa.id
  FROM public.obra_frente fa
 WHERE e.nivel = 'etapa'
   AND e.parent_id IS NULL
   AND fa.nivel = 'fase'
   AND fa.obra_id = e.obra_id
   AND fa.nome = 'Geral';

-- D3: serviço "Geral" para cada etapa que tem tarefa pendurada direto nela.
INSERT INTO public.obra_frente (empresa_id, obra_id, nome, ordem, nivel, parent_id)
SELECT DISTINCT e.empresa_id, e.obra_id, 'Geral', 0, 'servico', e.id
  FROM public.obra_frente e
  JOIN public.tarefas t ON t.obra_frente_id = e.id
 WHERE e.nivel = 'etapa';

UPDATE public.tarefas t
   SET obra_frente_id = s.id
  FROM public.obra_frente s
 WHERE s.nivel = 'servico'
   AND s.parent_id = t.obra_frente_id
   AND s.nome = 'Geral';

-- Ponte de responsáveis: tarefa criada pela obra só gravava responsavel_id e
-- ficava fora do filtro "Minhas" da gestão de tarefas.
INSERT INTO public.tarefa_responsaveis (tarefa_id, pessoa_id, empresa_id)
SELECT t.id, t.responsavel_id, t.empresa_id
  FROM public.tarefas t
 WHERE t.responsavel_id IS NOT NULL
ON CONFLICT (tarefa_id, pessoa_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Hierarquia válida em obra_frente
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_obra_frente_hierarquia()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_pai public.obra_frente;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.nivel IS DISTINCT FROM OLD.nivel THEN
    RAISE EXCEPTION 'O nível de um item do cronograma não pode mudar'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.nivel = 'fase' THEN
    IF NEW.parent_id IS NOT NULL THEN
      RAISE EXCEPTION 'Fase é o primeiro nível do cronograma e não fica dentro de outro item'
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  -- Etapa sem fase (código anterior à spec 111): vai para a fase "Geral" da obra.
  IF NEW.nivel = 'etapa' AND NEW.parent_id IS NULL THEN
    SELECT * INTO v_pai FROM public.obra_frente
     WHERE obra_id = NEW.obra_id AND nivel = 'fase' AND nome = 'Geral'
     ORDER BY created_at LIMIT 1;
    IF v_pai.id IS NULL THEN
      INSERT INTO public.obra_frente (empresa_id, obra_id, nome, ordem, nivel)
      VALUES (NEW.empresa_id, NEW.obra_id, 'Geral', 0, 'fase')
      RETURNING * INTO v_pai;
    END IF;
    NEW.parent_id := v_pai.id;
    RETURN NEW;
  END IF;

  IF NEW.parent_id IS NULL THEN
    RAISE EXCEPTION 'Serviço precisa estar dentro de uma etapa'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_pai FROM public.obra_frente WHERE id = NEW.parent_id;
  IF v_pai.id IS NULL OR v_pai.obra_id <> NEW.obra_id OR v_pai.empresa_id <> NEW.empresa_id THEN
    RAISE EXCEPTION 'O item pai precisa ser da mesma obra'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.nivel = 'etapa' AND v_pai.nivel <> 'fase' THEN
    RAISE EXCEPTION 'Etapa precisa estar dentro de uma fase'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.nivel = 'servico' AND v_pai.nivel <> 'etapa' THEN
    RAISE EXCEPTION 'Serviço precisa estar dentro de uma etapa'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_obra_frente_hierarquia ON public.obra_frente;
CREATE TRIGGER trg_obra_frente_hierarquia
  BEFORE INSERT OR UPDATE OF nivel, parent_id, obra_id ON public.obra_frente
  FOR EACH ROW EXECUTE FUNCTION public.tg_obra_frente_hierarquia();

-- ---------------------------------------------------------------------------
-- 4. Tarefa da obra só em serviço
-- ---------------------------------------------------------------------------
-- BEFORE valida; o redirecionamento etapa -> serviço "Geral" fica no AFTER porque
-- a RLS de tarefas (WITH CHECK em obra_frente) usa o snapshot do comando e não
-- enxergaria um serviço criado dentro do próprio INSERT.
CREATE OR REPLACE FUNCTION public.tg_tarefa_obra_no_servico()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_no      public.obra_frente;
  v_servico uuid;
BEGIN
  IF NEW.obra_frente_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_no FROM public.obra_frente WHERE id = NEW.obra_frente_id;
  IF v_no.id IS NULL THEN
    RETURN NEW; -- a FK reporta
  END IF;

  IF TG_WHEN = 'BEFORE' THEN
    IF NEW.obra_id IS DISTINCT FROM v_no.obra_id THEN
      RAISE EXCEPTION 'A tarefa e o serviço precisam ser da mesma obra'
        USING ERRCODE = 'check_violation';
    END IF;
    IF v_no.nivel = 'fase' THEN
      RAISE EXCEPTION 'Tarefa fica dentro de um serviço, não direto na fase'
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  -- AFTER: tarefa na etapa (código anterior à spec 111) vai para o serviço "Geral".
  IF v_no.nivel <> 'etapa' THEN
    RETURN NULL;
  END IF;
  SELECT id INTO v_servico FROM public.obra_frente
   WHERE parent_id = v_no.id AND nivel = 'servico' AND nome = 'Geral'
   ORDER BY created_at LIMIT 1;
  IF v_servico IS NULL THEN
    INSERT INTO public.obra_frente (empresa_id, obra_id, nome, ordem, nivel, parent_id)
    VALUES (v_no.empresa_id, v_no.obra_id, 'Geral', 0, 'servico', v_no.id)
    RETURNING id INTO v_servico;
  END IF;
  UPDATE public.tarefas SET obra_frente_id = v_servico WHERE id = NEW.id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_tarefa_obra_no_servico ON public.tarefas;
CREATE TRIGGER trg_tarefa_obra_no_servico
  BEFORE INSERT OR UPDATE OF obra_frente_id, obra_id ON public.tarefas
  FOR EACH ROW EXECUTE FUNCTION public.tg_tarefa_obra_no_servico();

DROP TRIGGER IF EXISTS trg_tarefa_obra_etapa_para_servico ON public.tarefas;
CREATE TRIGGER trg_tarefa_obra_etapa_para_servico
  AFTER INSERT OR UPDATE OF obra_frente_id ON public.tarefas
  FOR EACH ROW EXECUTE FUNCTION public.tg_tarefa_obra_no_servico();

-- ---------------------------------------------------------------------------
-- 5. responsavel_id sempre espelhado na ponte (filtro "Minhas")
-- ---------------------------------------------------------------------------
-- A gestão de tarefas apaga e regrava a ponte depois de salvar, então o espelho
-- aqui não conflita com ela; cobre quem só grava a coluna (obra, RDO).
CREATE OR REPLACE FUNCTION public.tg_tarefa_responsavel_na_ponte()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.responsavel_id IS NOT NULL
     AND OLD.responsavel_id IS DISTINCT FROM NEW.responsavel_id THEN
    DELETE FROM public.tarefa_responsaveis
     WHERE tarefa_id = NEW.id AND pessoa_id = OLD.responsavel_id;
  END IF;

  IF NEW.responsavel_id IS NOT NULL THEN
    INSERT INTO public.tarefa_responsaveis (tarefa_id, pessoa_id, empresa_id)
    VALUES (NEW.id, NEW.responsavel_id, NEW.empresa_id)
    ON CONFLICT (tarefa_id, pessoa_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tarefa_responsavel_na_ponte ON public.tarefas;
CREATE TRIGGER trg_tarefa_responsavel_na_ponte
  AFTER INSERT OR UPDATE OF responsavel_id ON public.tarefas
  FOR EACH ROW EXECUTE FUNCTION public.tg_tarefa_responsavel_na_ponte();

REVOKE ALL ON FUNCTION public.tg_obra_frente_hierarquia() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_tarefa_obra_no_servico() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_tarefa_responsavel_na_ponte() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Portal do cliente: continua mostrando etapas, agora com as tarefas dos
--    serviços abaixo delas (o avanço da etapa zeraria sem isso).
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_cliente_obra_detail(text, uuid);
CREATE FUNCTION public.get_cliente_obra_detail(p_token text, p_obra_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_session      json;
  v_cliente_id   uuid;
  v_empresa_id   uuid;
  v_obra         RECORD;
  v_frentes      json;
  v_aportes      json;
  v_despesas     json;
  v_total_aporte numeric(14,2);
  v_total_gasto  numeric(14,2);
  v_diario       json;
BEGIN
  v_session := public.portal_verify_session_readonly(p_token);
  IF v_session IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida';
  END IF;
  v_cliente_id := (v_session ->> 'cliente_id')::uuid;
  v_empresa_id := (v_session ->> 'empresa_id')::uuid;

  -- Gate fatal contra vazamento de margem: só administração, do cliente, visível.
  SELECT o.* INTO v_obra
  FROM public.obras o
  WHERE o.id = p_obra_id
    AND o.cliente_id = v_cliente_id
    AND o.empresa_id = v_empresa_id
    AND o.modelo_cobranca = 'administracao'
    AND o.visivel_portal = true
    AND o.deleted_at IS NULL;

  IF v_obra.id IS NULL THEN
    RAISE EXCEPTION 'Obra não encontrada';
  END IF;

  -- Etapas (na ordem das fases) com as tarefas dos seus serviços (dados crus;
  -- estado/span/avanço calculados no front por src/lib/obras.ts).
  SELECT COALESCE(json_agg(f ORDER BY f.fase_ordem, f.ordem, f.nome), '[]'::json)
  INTO v_frentes
  FROM (
    SELECT
      fr.id,
      fr.nome,
      fr.ordem,
      COALESCE(fa.ordem, 0) AS fase_ordem,
      fr.data_inicio,
      fr.data_fim,
      COALESCE((
        SELECT json_agg(json_build_object(
                 'status', tf.status,
                 'data_inicio', tf.data_inicio,
                 'prazo', tf.prazo
               ) ORDER BY tf.created_at)
        FROM public.tarefas tf
        WHERE tf.obra_frente_id = fr.id
           OR tf.obra_frente_id IN (
                SELECT s.id FROM public.obra_frente s WHERE s.parent_id = fr.id
              )
      ), '[]'::json) AS tarefas
    FROM public.obra_frente fr
    LEFT JOIN public.obra_frente fa ON fa.id = fr.parent_id
    WHERE fr.obra_id = v_obra.id
      AND fr.nivel = 'etapa'
  ) f;

  -- Aportes: sempre visíveis (é o dinheiro que o cliente colocou).
  SELECT COALESCE(json_agg(a ORDER BY a.data, a.descricao), '[]'::json), COALESCE(sum(a.valor), 0)
  INTO v_aportes, v_total_aporte
  FROM (
    SELECT l.data, l.descricao, l.valor
    FROM public.obra_conta_lancamento l
    WHERE l.obra_id = v_obra.id AND l.tipo = 'aporte' AND l.deleted_at IS NULL
  ) a;

  -- Despesas: SÓ confirmadas para o portal. Nunca pago_por nem status interno.
  SELECT COALESCE(json_agg(d ORDER BY d.data, d.descricao), '[]'::json), COALESCE(sum(d.valor), 0)
  INTO v_despesas, v_total_gasto
  FROM (
    SELECT l.data, l.descricao, l.valor, fr.nome AS frente_nome, l.comprovante_url
    FROM public.obra_conta_lancamento l
    LEFT JOIN public.obra_frente fr ON fr.id = l.obra_frente_id
    WHERE l.obra_id = v_obra.id
      AND l.tipo = 'despesa'
      AND l.confirmada_portal = true
      AND l.deleted_at IS NULL
  ) d;

  -- Diário (spec 087): últimos 30 dias, resumo curado. `id`/`path` da foto vão
  -- pro front resolver a URL assinada via edge function própria (o portal não
  -- tem sessão Supabase autenticada pra chamar storage.createSignedUrls direto).
  SELECT COALESCE(json_agg(d ORDER BY d.data DESC), '[]'::json)
  INTO v_diario
  FROM (
    SELECT
      r.id,
      r.data,
      r.clima,
      r.atividades,
      COALESCE((
        SELECT json_agg(json_build_object('id', f.id, 'path', f.path))
        FROM public.obra_rdo_foto f
        WHERE f.rdo_id = r.id
      ), '[]'::json) AS fotos
    FROM public.obra_rdo r
    WHERE r.obra_id = v_obra.id
    ORDER BY r.data DESC
    LIMIT 30
  ) d;

  RETURN json_build_object(
    'obra_id', v_obra.id,
    'nome', v_obra.nome,
    'status', v_obra.status,
    'data_inicio_prevista', v_obra.data_inicio_prevista,
    'data_fim_prevista', v_obra.data_fim_prevista,
    'taxa_administracao_pct', v_obra.taxa_administracao_pct,
    'frentes', v_frentes,
    'conta', json_build_object(
      'total_aportado', v_total_aporte,
      'total_gasto', v_total_gasto,
      'saldo', v_total_aporte - v_total_gasto,
      'taxa_administracao_valor', round(v_total_gasto * v_obra.taxa_administracao_pct / 100, 2),
      'aportes', v_aportes,
      'despesas', v_despesas
    ),
    'diario', v_diario
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_cliente_obra_detail(text, uuid) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7. Pilar Campo: a tarefa agora pendura no serviço; mostrar "Etapa › Serviço"
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.campo_listar_tarefas(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_acc  public.campo_accounts;
  v_rows json;
BEGIN
  SELECT * INTO v_acc
  FROM public.campo_accounts
  WHERE token_sessao = encode(extensions.digest(p_token, 'sha256'), 'hex')
    AND ativo = true AND token_expira_em > now()
  LIMIT 1;
  IF v_acc.id IS NULL THEN
    RETURN json_build_object('ok', false, 'erro', 'Sessão inválida');
  END IF;

  SELECT coalesce(json_agg(t ORDER BY t.created_at ASC), '[]'::json) INTO v_rows
  FROM (
    SELECT tr.id, tr.titulo, tr.status, tr.created_at,
           CASE
             WHEN f.id IS NULL THEN NULL
             WHEN f.nivel = 'servico' AND p.id IS NOT NULL THEN p.nome || ' › ' || f.nome
             ELSE f.nome
           END AS frente_nome
    FROM public.tarefas tr
    LEFT JOIN public.obra_frente f ON f.id = tr.obra_frente_id
    LEFT JOIN public.obra_frente p ON p.id = f.parent_id
    WHERE tr.obra_id = v_acc.obra_id
  ) t;

  RETURN json_build_object('ok', true, 'tarefas', v_rows);
END;
$$;

NOTIFY pgrst, 'reload schema';
