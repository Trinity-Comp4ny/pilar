-- Obra no portal do cliente — Fase 1 (backend + segurança). Spec 030.
--
-- Leva a obra ao portal do cliente que já existe (auth por token, RPC
-- SECURITY DEFINER escopada por cliente_id+empresa_id). O dono acompanha
-- cronograma + prestação de contas da obra que o escritório ADMINISTRA por taxa.
--
-- Travas de segurança (todas no backend, dentro das RPCs — o portal usa a chave
-- anon, não há RLS por role de cliente):
--   1. só obra modelo_cobranca = 'administracao' (em preco_fechado o custo real é
--      a margem do escritório e não pode vazar);
--   2. só obra visivel_portal = true e do próprio cliente do token;
--   3. só despesa confirmada_portal = true (o sócio segura o que ainda confere);
--   4. NUNCA cotação/proposta/comparativo de fornecedor.

-- ============================================================================
-- 1. Vínculo e visibilidade em obras
-- ============================================================================

ALTER TABLE public.obras
  ADD COLUMN IF NOT EXISTS cliente_id     uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS visivel_portal boolean NOT NULL DEFAULT false;

-- Backfill: obra que já tem projeto herda o cliente do projeto (uma vez).
UPDATE public.obras o
SET cliente_id = p.cliente_id
FROM public.projetos p
WHERE o.projeto_id = p.id
  AND o.cliente_id IS NULL
  AND p.cliente_id IS NOT NULL;

-- Índice para o lookup do portal (cliente + empresa + visível).
CREATE INDEX IF NOT EXISTS obras_cliente_portal_idx
  ON public.obras (cliente_id, empresa_id)
  WHERE visivel_portal = true AND deleted_at IS NULL;

-- RLS lado equipe: revalidar o novo cliente_id como as outras FKs (DROP+CREATE
-- explícito). Mantém projeto_id/responsavel_id como estavam (20260730180000).
DROP POLICY IF EXISTS obras_insert ON public.obras;
CREATE POLICY obras_insert ON public.obras
  FOR INSERT WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND (
      projeto_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.projetos pr
        WHERE pr.id = projeto_id AND pr.empresa_id = public.get_user_empresa_id()
      )
    )
    AND (
      responsavel_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.pessoas p
        WHERE p.id = responsavel_id AND p.empresa_id = public.get_user_empresa_id()
      )
    )
    AND (
      cliente_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.clientes c
        WHERE c.id = cliente_id AND c.empresa_id = public.get_user_empresa_id()
      )
    )
  );

DROP POLICY IF EXISTS obras_update ON public.obras;
CREATE POLICY obras_update ON public.obras
  FOR UPDATE USING (empresa_id = public.get_user_empresa_id())
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND (
      projeto_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.projetos pr
        WHERE pr.id = projeto_id AND pr.empresa_id = public.get_user_empresa_id()
      )
    )
    AND (
      responsavel_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.pessoas p
        WHERE p.id = responsavel_id AND p.empresa_id = public.get_user_empresa_id()
      )
    )
    AND (
      cliente_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.clientes c
        WHERE c.id = cliente_id AND c.empresa_id = public.get_user_empresa_id()
      )
    )
  );

-- ============================================================================
-- 2. Confirmação de lançamento (o que o cliente vê)
-- ============================================================================

-- Default true: o lançamento nasce visível quando a obra é publicada; o sócio
-- SEGURA pontualmente o que ainda confere marcando false. A exposição acidental
-- já está contida pela obra (visivel_portal default false + gate de modalidade).
ALTER TABLE public.obra_conta_lancamento
  ADD COLUMN IF NOT EXISTS confirmada_portal boolean NOT NULL DEFAULT true;

-- ============================================================================
-- 3. RPCs do portal (SECURITY DEFINER; segurança dentro da função)
-- ============================================================================

-- Lista de obras que o cliente do token pode ver no portal.
DROP FUNCTION IF EXISTS public.get_cliente_obras(text);
CREATE FUNCTION public.get_cliente_obras(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_session    json;
  v_cliente_id uuid;
  v_empresa_id uuid;
  v_result     json;
BEGIN
  v_session := public.portal_verify_session_readonly(p_token);
  IF v_session IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida';
  END IF;
  v_cliente_id := (v_session ->> 'cliente_id')::uuid;
  v_empresa_id := (v_session ->> 'empresa_id')::uuid;

  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.nome), '[]'::json)
  INTO v_result
  FROM (
    SELECT
      o.id,
      o.nome,
      o.status,
      o.data_inicio_prevista,
      o.data_fim_prevista,
      -- avanço determinístico: tarefas concluídas / total (espelha calcularAvanco)
      COALESCE((
        SELECT round(100.0 * count(*) FILTER (WHERE tf.status = 'concluida') / NULLIF(count(*), 0))
        FROM public.tarefas tf
        WHERE tf.obra_id = o.id
      ), 0)::int AS avanco_pct
    FROM public.obras o
    WHERE o.cliente_id = v_cliente_id
      AND o.empresa_id = v_empresa_id
      AND o.modelo_cobranca = 'administracao'
      AND o.visivel_portal = true
      AND o.deleted_at IS NULL
  ) t;

  RETURN v_result;
END;
$$;

-- Detalhe de uma obra: cronograma (frentes + passos crus, o front deriva estado
-- com obras.ts) + prestação de contas agregada. Recusa obra que não é do cliente,
-- não é administração, ou não está visível.
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

  -- Frentes com seus passos (dados crus; estado/span/avanço calculados no front
  -- por src/lib/obras.ts).
  SELECT COALESCE(json_agg(f ORDER BY f.ordem, f.nome), '[]'::json)
  INTO v_frentes
  FROM (
    SELECT
      fr.id,
      fr.nome,
      fr.ordem,
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
      ), '[]'::json) AS tarefas
    FROM public.obra_frente fr
    WHERE fr.obra_id = v_obra.id
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
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_cliente_obras(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_cliente_obra_detail(text, uuid) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
