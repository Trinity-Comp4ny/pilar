-- Spec 087: Diário da obra no portal do cliente, resumo curado (data, clima,
-- atividades, fotos). NUNCA ocorrências/pendências/efetivo por fornecedor/
-- impedimento/visita — decisão registrada em DECISOES.md (01/09): mantém a
-- fronteira já fechada pela spec 030 ("cliente vê avanço e conta, não o
-- diário operacional inteiro"). O filtro de campo é feito aqui no SQL, não
-- escondido no front: os campos proibidos nem entram no JSON devolvido.

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

NOTIFY pgrst, 'reload schema';
