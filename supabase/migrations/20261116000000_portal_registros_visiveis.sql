-- SPEC 135, fase C: o portal do cliente mostra os registros da equipe que o gestor liberou.
-- Mesma função do portal (get_cliente_obra_detail), com a chave `registros` a mais. O gate de
-- obra (do cliente, em administração, visível no portal) não muda.

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
  v_registros    json;
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

  -- Registros da equipe (SPEC 135, fase C): só os que o gestor liberou ("Mostrar ao cliente") e que a
  -- IA já organizou, dos últimos 30 dias. Texto e quantas fotos. Nunca áudio, autor, extraído
  -- (efetivo, pendência, problema) nem o caminho das fotos: quem assina a foto é a edge
  -- portal-obra-fotos, que revalida o registro contra a sessão.
  SELECT COALESCE(json_agg(g ORDER BY g.data DESC, g.criado_em DESC), '[]'::json)
  INTO v_registros
  FROM (
    SELECT
      r.id,
      r.data_registro AS data,
      COALESCE(NULLIF(btrim(r.texto_organizado), ''), NULLIF(btrim(r.texto_bruto), '')) AS texto,
      cardinality(r.fotos) AS num_fotos,
      r.criado_em
    FROM public.obra_registro r
    WHERE r.obra_id = v_obra.id
      AND r.empresa_id = v_empresa_id
      AND r.visivel_cliente = true
      AND r.status = 'pronto'
      AND r.data_registro >= current_date - 30
    ORDER BY r.data_registro DESC, r.criado_em DESC
    LIMIT 60
  ) g;

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
    'diario', v_diario,
    'registros', v_registros
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_cliente_obra_detail(text, uuid) TO anon, authenticated, service_role;
