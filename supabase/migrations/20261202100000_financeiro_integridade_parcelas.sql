-- Financeiro, fase 1 da SPEC 149 (integridade). Diagnóstico em
-- docs/qa/2026-11-07/financeiro-lancamentos-parcelas-duplicatas.md.
--
-- B1. Grupo de parcela garantido no banco.
--     O form de lançamento e a geração de faturas da proposta (SmartInvoiceDialog)
--     criam o uuid de `grupo_parcela` no front e gravam só as parcelas. Sem a linha
--     em `grupos_parcela`, renegociar / quitar antecipado / editar em aberto falham
--     com "Grupo não encontrado" e a view devolve grupo_status nulo. Em vez de
--     corrigir cada caminho, um trigger por comando cria a linha que faltar, a
--     partir das parcelas inseridas no mesmo comando. Caminhos que já criam o grupo
--     (rpc_grupo_parcela_criar) não são afetados: o trigger só age se o grupo não
--     existe.
-- B2. Criação atômica: `rpc_lancamentos_criar` grava as linhas e o rateio na mesma
--     transação (antes eram N chamadas soltas depois do insert).
-- B7. Quitação antecipada aceita a conta de onde saiu/entrou o dinheiro.

-- =====================================================================
-- 1. Trigger: garante grupos_parcela para parcelas inseridas sem grupo
-- =====================================================================
CREATE OR REPLACE FUNCTION public.tr_garantir_grupo_parcela()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_criados uuid[];
  v_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'receitas' THEN
    WITH novos AS (
      INSERT INTO grupos_parcela (
        id, empresa_id, tipo_lancamento, tipo_grupo, descricao, total_original,
        num_parcelas, contraparte_id, contraparte_tipo, projeto_id, categoria_id,
        centro_custo_id, created_by, updated_by
      )
      SELECT
        n.grupo_parcela,
        (array_agg(n.empresa_id))[1],
        'receita',
        'finito',
        regexp_replace((array_agg(n.descricao ORDER BY n.parcela_numero NULLS LAST))[1], '\s*\(\d+/\d+\)\s*$', ''),
        SUM(n.valor),
        GREATEST(COALESCE(MAX(n.parcela_total), 0), COUNT(*)::int),
        (array_agg(n.cliente_id))[1],
        'cliente',
        (array_agg(n.projeto_id))[1],
        (array_agg(n.categoria_id))[1],
        (array_agg(n.centro_custo_id))[1],
        (array_agg(n.created_by))[1],
        (array_agg(n.created_by))[1]
      FROM novas n
      WHERE n.grupo_parcela IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM grupos_parcela g WHERE g.id = n.grupo_parcela)
      GROUP BY n.grupo_parcela
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    )
    SELECT array_agg(id) INTO v_criados FROM novos;
  ELSE
    WITH novos AS (
      INSERT INTO grupos_parcela (
        id, empresa_id, tipo_lancamento, tipo_grupo, descricao, total_original,
        num_parcelas, periodicidade, contraparte_id, contraparte_tipo, projeto_id,
        categoria_id, centro_custo_id, created_by, updated_by
      )
      SELECT
        n.grupo_parcela,
        (array_agg(n.empresa_id))[1],
        'despesa',
        CASE WHEN BOOL_OR(COALESCE(n.recorrente, false)) THEN 'recorrente' ELSE 'finito' END,
        regexp_replace((array_agg(n.descricao ORDER BY n.parcela_numero NULLS LAST))[1], '\s*\(\d+/\d+\)\s*$', ''),
        SUM(n.valor),
        GREATEST(COALESCE(MAX(n.parcela_total), 0), COUNT(*)::int),
        CASE WHEN (array_agg(n.periodicidade))[1] IN ('mensal','bimestral','trimestral','semestral','anual')
             THEN (array_agg(n.periodicidade))[1] ELSE 'mensal' END,
        (array_agg(n.fornecedor_id))[1],
        'fornecedor',
        (array_agg(n.projeto_id))[1],
        (array_agg(n.categoria_id))[1],
        (array_agg(n.centro_custo_id))[1],
        (array_agg(n.created_by))[1],
        (array_agg(n.created_by))[1]
      FROM novas n
      WHERE n.grupo_parcela IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM grupos_parcela g WHERE g.id = n.grupo_parcela)
      GROUP BY n.grupo_parcela
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    )
    SELECT array_agg(id) INTO v_criados FROM novos;
  END IF;

  -- O recalc por linha (tr_recalc_grupo_parcela) rodou antes deste trigger, quando o
  -- grupo ainda não existia, e saiu sem fazer nada. Recalcula agora.
  IF v_criados IS NOT NULL THEN
    FOREACH v_id IN ARRAY v_criados LOOP
      PERFORM recalc_grupo_parcela_status(v_id);
    END LOOP;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.tr_garantir_grupo_parcela() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS tr_garantir_grupo_parcela_receitas ON public.receitas;
CREATE TRIGGER tr_garantir_grupo_parcela_receitas
  AFTER INSERT ON public.receitas
  REFERENCING NEW TABLE AS novas
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.tr_garantir_grupo_parcela();

DROP TRIGGER IF EXISTS tr_garantir_grupo_parcela_despesas ON public.despesas;
CREATE TRIGGER tr_garantir_grupo_parcela_despesas
  AFTER INSERT ON public.despesas
  REFERENCING NEW TABLE AS novas
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.tr_garantir_grupo_parcela();

-- =====================================================================
-- 2. Backfill: grupos órfãos já gravados (parcelas sem linha em grupos_parcela)
-- =====================================================================
INSERT INTO public.grupos_parcela (
  id, empresa_id, tipo_lancamento, tipo_grupo, descricao, total_original,
  num_parcelas, contraparte_id, contraparte_tipo, projeto_id, categoria_id,
  centro_custo_id, created_at, updated_at
)
SELECT
  r.grupo_parcela,
  (array_agg(r.empresa_id))[1],
  'receita',
  'finito',
  regexp_replace((array_agg(r.descricao ORDER BY r.parcela_numero NULLS LAST))[1], '\s*\(\d+/\d+\)\s*$', ''),
  SUM(r.valor),
  GREATEST(COALESCE(MAX(r.parcela_total), 0), COUNT(*)::int),
  (array_agg(r.cliente_id))[1],
  'cliente',
  (array_agg(r.projeto_id))[1],
  (array_agg(r.categoria_id))[1],
  (array_agg(r.centro_custo_id))[1],
  MIN(r.created_at),
  MAX(r.updated_at)
FROM public.receitas r
WHERE r.grupo_parcela IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.grupos_parcela g WHERE g.id = r.grupo_parcela)
GROUP BY r.grupo_parcela
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.grupos_parcela (
  id, empresa_id, tipo_lancamento, tipo_grupo, descricao, total_original,
  num_parcelas, contraparte_id, contraparte_tipo, projeto_id, categoria_id,
  centro_custo_id, created_at, updated_at
)
SELECT
  d.grupo_parcela,
  (array_agg(d.empresa_id))[1],
  'despesa',
  CASE WHEN BOOL_OR(COALESCE(d.recorrente, false)) THEN 'recorrente' ELSE 'finito' END,
  regexp_replace((array_agg(d.descricao ORDER BY d.parcela_numero NULLS LAST))[1], '\s*\(\d+/\d+\)\s*$', ''),
  SUM(d.valor),
  GREATEST(COALESCE(MAX(d.parcela_total), 0), COUNT(*)::int),
  (array_agg(d.fornecedor_id))[1],
  'fornecedor',
  (array_agg(d.projeto_id))[1],
  (array_agg(d.categoria_id))[1],
  (array_agg(d.centro_custo_id))[1],
  MIN(d.created_at),
  MAX(d.updated_at)
FROM public.despesas d
WHERE d.grupo_parcela IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.grupos_parcela g WHERE g.id = d.grupo_parcela)
GROUP BY d.grupo_parcela
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT g.id FROM public.grupos_parcela g
    WHERE g.status_agregado = 'aberto' AND g.deleted_at IS NULL
  LOOP
    PERFORM public.recalc_grupo_parcela_status(r.id);
  END LOOP;
END;
$$;

-- =====================================================================
-- 3. rpc_lancamentos_criar: linhas + rateio numa transação só
-- =====================================================================
-- SECURITY INVOKER de propósito: o INSERT passa pela RLS de receitas/despesas como
-- qualquer escrita do usuário; a função só garante o tudo-ou-nada. `empresa_id` vem
-- sempre do servidor, nunca do payload.
CREATE OR REPLACE FUNCTION public.rpc_lancamentos_criar(
  p_tipo text,
  p_linhas jsonb,
  p_rateios jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_ids uuid[];
  v_id uuid;
BEGIN
  IF NOT public.can_view_financeiro() THEN
    RAISE EXCEPTION 'Sem permissão para lançar no financeiro';
  END IF;

  v_empresa_id := public.get_user_empresa_id();
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa';
  END IF;

  IF p_tipo NOT IN ('receita', 'despesa') THEN
    RAISE EXCEPTION 'tipo inválido: %', p_tipo;
  END IF;

  IF jsonb_typeof(p_linhas) <> 'array' OR jsonb_array_length(p_linhas) = 0 THEN
    RAISE EXCEPTION 'Nenhuma linha para gravar';
  END IF;

  IF jsonb_array_length(p_linhas) > 360 THEN
    RAISE EXCEPTION 'Máximo de 360 parcelas por lançamento';
  END IF;

  IF p_tipo = 'receita' THEN
    WITH ins AS (
      INSERT INTO receitas (
        empresa_id, descricao, valor, data_vencimento, data_competencia,
        data_recebimento, status, forma_pagamento, categoria_id, projeto_id,
        conta_id, cliente_id, centro_custo_id, nota_fiscal, observacao, tags,
        grupo_parcela, parcela_numero, parcela_total
      )
      SELECT
        v_empresa_id, l.descricao, l.valor, l.data_vencimento, l.data_competencia,
        l.data_recebimento, COALESCE(l.status, 'Pendente'::status_financeiro), l.forma_pagamento,
        l.categoria_id, l.projeto_id, l.conta_id, l.cliente_id, l.centro_custo_id,
        l.nota_fiscal, l.observacao, l.tags, l.grupo_parcela, l.parcela_numero, l.parcela_total
      FROM jsonb_populate_recordset(NULL::public.receitas, p_linhas) l
      RETURNING id
    )
    SELECT array_agg(id) INTO v_ids FROM ins;
  ELSE
    WITH ins AS (
      INSERT INTO despesas (
        empresa_id, descricao, valor, data_vencimento, data_competencia,
        data_pagamento, status, forma_pagamento, categoria_id, projeto_id,
        conta_id, cartao_id, fornecedor_id, centro_custo_id, nota_fiscal,
        observacao, tags, grupo_parcela, parcela_numero, parcela_total,
        recorrente, periodicidade
      )
      SELECT
        v_empresa_id, l.descricao, l.valor, l.data_vencimento, l.data_competencia,
        l.data_pagamento, COALESCE(l.status, 'Pendente'::status_financeiro), l.forma_pagamento,
        l.categoria_id, l.projeto_id, l.conta_id, l.cartao_id, l.fornecedor_id,
        l.centro_custo_id, l.nota_fiscal, l.observacao, l.tags, l.grupo_parcela,
        l.parcela_numero, l.parcela_total, COALESCE(l.recorrente, false), l.periodicidade
      FROM jsonb_populate_recordset(NULL::public.despesas, p_linhas) l
      RETURNING id
    )
    SELECT array_agg(id) INTO v_ids FROM ins;
  END IF;

  IF p_rateios IS NOT NULL AND jsonb_typeof(p_rateios) = 'array' AND jsonb_array_length(p_rateios) > 0 THEN
    FOREACH v_id IN ARRAY v_ids LOOP
      PERFORM public.rpc_lancamento_set_rateio(v_id, p_tipo, p_rateios);
    END LOOP;
  END IF;

  RETURN v_ids;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_lancamentos_criar(text, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_lancamentos_criar(text, jsonb, jsonb) TO authenticated;

-- =====================================================================
-- 4. Quitação antecipada com a conta do pagamento (B7)
-- =====================================================================
-- Sem a conta, a quitação baixava as parcelas sem dizer de onde saiu o dinheiro e o
-- saldo da conta não batia com o extrato. Parâmetro novo no fim, com DEFAULT: as
-- chamadas posicionais de 4 argumentos dos agentes continuam resolvendo para cá.
-- Despesa no cartão mantém a conta como está (quem paga é a fatura).
DROP FUNCTION IF EXISTS public.rpc_grupo_parcela_quitar_antecipado(uuid, date, integer, numeric);

CREATE OR REPLACE FUNCTION public.rpc_grupo_parcela_quitar_antecipado(
  p_grupo_id uuid,
  p_data_pagamento date DEFAULT CURRENT_DATE,
  p_quantidade integer DEFAULT NULL,
  p_desconto_total numeric DEFAULT 0,
  p_conta_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_empresa_id uuid;
  v_tipo text;
  v_afetadas integer := 0;
  v_ids uuid[];
  v_soma numeric;
  v_ultimo uuid;
  v_alvo numeric;
  v_atual numeric;
BEGIN
  IF NOT public.can_view_financeiro() THEN
    RAISE EXCEPTION 'Sem permissão para quitar antecipado';
  END IF;

  v_empresa_id := public.get_user_empresa_id();

  SELECT tipo_lancamento INTO v_tipo
  FROM grupos_parcela WHERE id = p_grupo_id AND empresa_id = v_empresa_id;

  IF v_tipo IS NULL THEN RAISE EXCEPTION 'Grupo não encontrado'; END IF;
  IF p_desconto_total IS NULL THEN p_desconto_total := 0; END IF;
  IF p_desconto_total < 0 THEN RAISE EXCEPTION 'Desconto não pode ser negativo'; END IF;

  IF v_tipo = 'receita' THEN
    SELECT array_agg(id ORDER BY parcela_numero) INTO v_ids FROM (
      SELECT id, parcela_numero FROM receitas
      WHERE grupo_parcela = p_grupo_id AND status::text IN ('Pendente','Atrasado') AND deleted_at IS NULL
      ORDER BY parcela_numero NULLS LAST LIMIT COALESCE(p_quantidade, 9999)
    ) sub;
    IF v_ids IS NULL OR array_length(v_ids,1) = 0 THEN RETURN 0; END IF;

    SELECT COALESCE(SUM(valor),0) INTO v_soma FROM receitas WHERE id = ANY(v_ids);
    IF p_desconto_total >= v_soma THEN
      RAISE EXCEPTION 'Desconto (%) maior ou igual ao saldo em aberto (%)', p_desconto_total, v_soma;
    END IF;
    SELECT id INTO v_ultimo FROM receitas WHERE id = ANY(v_ids) ORDER BY parcela_numero DESC NULLS LAST, id LIMIT 1;

    UPDATE receitas SET
      status = 'Recebido'::status_financeiro,
      data_recebimento = p_data_pagamento,
      conta_id = COALESCE(p_conta_id, conta_id),
      valor = CASE WHEN p_desconto_total > 0 AND v_soma > 0
                   THEN ROUND(valor * (v_soma - p_desconto_total) / v_soma, 2) ELSE valor END,
      observacao = CASE WHEN p_desconto_total > 0
                   THEN COALESCE(observacao,'') || chr(10) || '[Quitação antecipada — desconto de R$ ' || ROUND(p_desconto_total,2)::text || ' rateado]'
                   ELSE observacao END,
      updated_by = auth.uid(), updated_at = now()
    WHERE id = ANY(v_ids);
    GET DIAGNOSTICS v_afetadas = ROW_COUNT;

    IF p_desconto_total > 0 AND v_soma > 0 THEN
      v_alvo := ROUND(v_soma - p_desconto_total, 2);
      SELECT COALESCE(SUM(valor),0) INTO v_atual FROM receitas WHERE id = ANY(v_ids);
      IF v_atual <> v_alvo THEN UPDATE receitas SET valor = valor + (v_alvo - v_atual) WHERE id = v_ultimo; END IF;
    END IF;
  ELSE
    SELECT array_agg(id ORDER BY parcela_numero) INTO v_ids FROM (
      SELECT id, parcela_numero FROM despesas
      WHERE grupo_parcela = p_grupo_id AND status::text IN ('Pendente','Atrasado') AND deleted_at IS NULL
      ORDER BY parcela_numero NULLS LAST LIMIT COALESCE(p_quantidade, 9999)
    ) sub;
    IF v_ids IS NULL OR array_length(v_ids,1) = 0 THEN RETURN 0; END IF;

    SELECT COALESCE(SUM(valor),0) INTO v_soma FROM despesas WHERE id = ANY(v_ids);
    IF p_desconto_total >= v_soma THEN
      RAISE EXCEPTION 'Desconto (%) maior ou igual ao saldo em aberto (%)', p_desconto_total, v_soma;
    END IF;
    SELECT id INTO v_ultimo FROM despesas WHERE id = ANY(v_ids) ORDER BY parcela_numero DESC NULLS LAST, id LIMIT 1;

    UPDATE despesas SET
      status = 'Pago'::status_financeiro,
      data_pagamento = p_data_pagamento,
      conta_id = CASE WHEN cartao_id IS NOT NULL THEN conta_id ELSE COALESCE(p_conta_id, conta_id) END,
      valor = CASE WHEN p_desconto_total > 0 AND v_soma > 0
                   THEN ROUND(valor * (v_soma - p_desconto_total) / v_soma, 2) ELSE valor END,
      observacao = CASE WHEN p_desconto_total > 0
                   THEN COALESCE(observacao,'') || chr(10) || '[Quitação antecipada — desconto de R$ ' || ROUND(p_desconto_total,2)::text || ' rateado]'
                   ELSE observacao END,
      updated_by = auth.uid(), updated_at = now()
    WHERE id = ANY(v_ids);
    GET DIAGNOSTICS v_afetadas = ROW_COUNT;

    IF p_desconto_total > 0 AND v_soma > 0 THEN
      v_alvo := ROUND(v_soma - p_desconto_total, 2);
      SELECT COALESCE(SUM(valor),0) INTO v_atual FROM despesas WHERE id = ANY(v_ids);
      IF v_atual <> v_alvo THEN UPDATE despesas SET valor = valor + (v_alvo - v_atual) WHERE id = v_ultimo; END IF;
    END IF;
  END IF;

  RETURN v_afetadas;
END;
$fn$;

REVOKE ALL ON FUNCTION public.rpc_grupo_parcela_quitar_antecipado(uuid, date, integer, numeric, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_grupo_parcela_quitar_antecipado(uuid, date, integer, numeric, uuid) TO authenticated, service_role;
