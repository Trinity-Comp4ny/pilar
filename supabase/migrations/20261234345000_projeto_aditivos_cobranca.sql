-- No projeto, criação manual e decisão financeira usam os mesmos escopos dos agentes.
ALTER TABLE public.escopos ADD COLUMN IF NOT EXISTS origem_manual boolean NOT NULL DEFAULT false;

CREATE TABLE public.projeto_registros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  disciplina_id uuid REFERENCES public.projeto_disciplinas(id) ON DELETE SET NULL,
  tipo text NOT NULL,
  origem_id uuid,
  ocorrido_em timestamptz NOT NULL DEFAULT now(),
  autor_nome text,
  detalhe text NOT NULL,
  dados jsonb NOT NULL DEFAULT '{}',
  financeiro boolean NOT NULL DEFAULT false
);

CREATE INDEX projeto_registros_timeline_idx ON public.projeto_registros(projeto_id, ocorrido_em DESC, id);
CREATE UNIQUE INDEX projeto_registros_cobranca_idx ON public.projeto_registros(origem_id)
  WHERE tipo = 'aditivo_cobranca';
ALTER TABLE public.projeto_registros ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.projeto_registros FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.projeto_registros TO authenticated;
CREATE POLICY projeto_registros_leitura ON public.projeto_registros FOR SELECT TO authenticated
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.user_has_feature('projetos', 'viewer')
    AND (NOT financeiro OR public.can_view_financeiro())
    AND (tipo NOT LIKE 'portal_%' OR public.user_has_feature('portal_cliente', 'editor'))
  );

CREATE FUNCTION public.projeto_nome_ator(p_id uuid)
RETURNS text LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT p.nome FROM public.pessoas p WHERE p.profile_id = p_id AND p.deleted_at IS NULL
    AND p.empresa_id = public.get_user_empresa_id()
  ORDER BY p.id LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.projeto_nome_ator(uuid) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.rpc_criar_aditivo_projeto(
  p_projeto_id uuid, p_descricao text, p_motivo text, p_valor numeric,
  p_disciplina_id uuid DEFAULT NULL, p_entrega_id uuid DEFAULT NULL, p_registro_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_empresa uuid := public.get_user_empresa_id();
  v_id uuid;
  v_entrega public.portal_entregas%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR v_empresa IS NULL OR NOT public.user_has_feature('projetos','editor')
     OR NOT public.can_view_financeiro() THEN
    RAISE EXCEPTION 'Sem acesso a aditivos' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.projetos WHERE id = p_projeto_id AND empresa_id = v_empresa AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Projeto inválido';
  END IF;
  IF nullif(btrim(p_descricao), '') IS NULL OR nullif(btrim(p_motivo), '') IS NULL
      OR length(p_descricao) > 250 OR length(p_motivo) > 4000
      OR p_valor IS NULL OR NOT (p_valor BETWEEN 0.01 AND 9999999999.99) OR p_valor <> round(p_valor, 2) THEN
    RAISE EXCEPTION 'Informe descrição, motivo e valor válido';
  END IF;
  IF p_entrega_id IS NOT NULL THEN
    SELECT * INTO v_entrega FROM public.portal_entregas
      WHERE id = p_entrega_id AND empresa_id = v_empresa AND projeto_id = p_projeto_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Revisão inválida'; END IF;
    p_disciplina_id := COALESCE(v_entrega.projeto_disciplina_id, p_disciplina_id);
  END IF;
  IF p_registro_id IS NOT NULL THEN
    SELECT COALESCE(disciplina_id, p_disciplina_id) INTO p_disciplina_id
      FROM public.projeto_registros
      WHERE id = p_registro_id AND projeto_id = p_projeto_id AND empresa_id = v_empresa AND tipo IN ('visita','suporte');
    IF NOT FOUND THEN RAISE EXCEPTION 'Atividade inválida'; END IF;
  END IF;
  IF p_disciplina_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.projeto_disciplinas WHERE id = p_disciplina_id AND projeto_id = p_projeto_id
  ) THEN RAISE EXCEPTION 'Disciplina inválida'; END IF;

  INSERT INTO public.escopos
    (empresa_id, projeto_id, descricao, justificativa, valor_aditivo, tipo, status, origem_manual, created_by, updated_by)
  VALUES
    (v_empresa, p_projeto_id, btrim(p_descricao), btrim(p_motivo), p_valor, 'aditivo', 'rascunho', true, auth.uid(), auth.uid())
  RETURNING id INTO v_id;

  INSERT INTO public.projeto_registros (empresa_id, projeto_id, disciplina_id, tipo, origem_id, autor_nome, detalhe, dados)
  VALUES (v_empresa, p_projeto_id, p_disciplina_id, 'aditivo_criado', v_id, public.projeto_nome_ator(auth.uid()),
    btrim(p_descricao), jsonb_strip_nulls(jsonb_build_object(
      'entrega_id', p_entrega_id, 'versao', v_entrega.numero_revisao, 'atividade_id', p_registro_id
    )));
  RETURN v_id;
END;
$$;

-- O grupo deve estar ligado ao projeto, a um cliente e a receitas parceladas.
-- Títulos avulsos e receitas de obra ficam fora. Grupos de aditivos também.
CREATE FUNCTION public.projeto_parcelas_elegiveis(p_projeto uuid, p_empresa uuid, p_cliente uuid)
RETURNS TABLE(id uuid, grupo_id uuid, grupo text, vencimento date, valor numeric, descricao text)
LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT r.id, g.id, g.descricao, r.data_vencimento, r.valor, r.descricao
  FROM public.receitas r JOIN public.grupos_parcela g ON g.id = r.grupo_parcela
  WHERE g.projeto_id = p_projeto AND g.empresa_id = p_empresa AND g.deleted_at IS NULL
    AND g.tipo_lancamento = 'receita' AND g.tipo_grupo = 'finito'
    AND r.projeto_id = p_projeto AND r.empresa_id = p_empresa AND r.cliente_id = p_cliente
    AND r.deleted_at IS NULL AND r.parcela_numero IS NOT NULL
    AND r.status = 'Pendente' AND r.data_vencimento >= (now() AT TIME ZONE 'America/Sao_Paulo')::date
    AND r.data_recebimento IS NULL AND r.obra_lancamento_origem_id IS NULL
    AND nullif(btrim(r.nota_fiscal), '') IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.cobrancas c WHERE c.receita_id = r.id AND c.status IN ('enviada','externa'))
    AND NOT EXISTS (
      SELECT 1 FROM public.projeto_registros e WHERE e.tipo = 'aditivo_cobranca' AND e.projeto_id = p_projeto
        AND e.dados->>'grupo_aditivo_id' = g.id::text
    )
  ORDER BY r.data_vencimento, r.parcela_numero, r.id;
$$;
REVOKE ALL ON FUNCTION public.projeto_parcelas_elegiveis(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.rpc_prever_cobranca_aditivo(
  p_aditivo uuid, p_grupo uuid DEFAULT NULL, p_vencimento date DEFAULT NULL, p_parcelas integer DEFAULT 1
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_aditivo public.escopos%ROWTYPE;
  v_projeto public.projetos%ROWTYPE;
  v_grupos jsonb;
  v_linhas jsonb := '[]';
  v_centavos bigint;
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_view_financeiro() OR NOT public.user_has_feature('projetos','editor') THEN
    RAISE EXCEPTION 'Sem acesso a aditivos' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_aditivo FROM public.escopos
    WHERE id = p_aditivo AND empresa_id = public.get_user_empresa_id() AND tipo = 'aditivo' AND deleted_at IS NULL
      AND status IN ('rascunho','pendente_aprovacao') AND valor_aditivo > 0;
  IF NOT FOUND THEN RAISE EXCEPTION 'Aditivo indisponível'; END IF;
  SELECT * INTO STRICT v_projeto FROM public.projetos
    WHERE id = v_aditivo.projeto_id AND empresa_id = v_aditivo.empresa_id AND deleted_at IS NULL;
  v_centavos := round(v_aditivo.valor_aditivo * 100)::bigint;

  SELECT COALESCE(jsonb_agg(to_jsonb(g) ORDER BY g.nome, g.id), '[]') INTO v_grupos
  FROM (
    SELECT grupo_id AS id, coalesce(grupo, 'Parcelamento do projeto') AS nome, count(*) AS quantidade
    FROM public.projeto_parcelas_elegiveis(v_projeto.id, v_projeto.empresa_id, v_projeto.cliente_id)
    GROUP BY grupo_id, grupo
  ) g;

  IF p_grupo IS NOT NULL THEN
    WITH parcelas AS (
      SELECT *, row_number() OVER (ORDER BY vencimento, id) AS ordem, count(*) OVER () AS total
      FROM public.projeto_parcelas_elegiveis(v_projeto.id, v_projeto.empresa_id, v_projeto.cliente_id)
      WHERE grupo_id = p_grupo
    )
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', id, 'vencimento', vencimento, 'descricao', descricao, 'anterior', valor,
      'novo', valor + (v_centavos / total + CASE WHEN ordem > total - v_centavos % total THEN 1 ELSE 0 END)::numeric / 100
    ) ORDER BY ordem), '[]') INTO v_linhas FROM parcelas;
  ELSIF p_vencimento IS NOT NULL THEN
    IF p_vencimento < v_hoje OR p_parcelas IS NULL OR p_parcelas NOT BETWEEN 1 AND 60 OR p_parcelas > v_centavos THEN
      RAISE EXCEPTION 'Confira o vencimento e o número de parcelas';
    END IF;
    SELECT jsonb_agg(jsonb_build_object(
      'vencimento', (p_vencimento + make_interval(months => n - 1))::date,
      'descricao', concat('Aditivo: ', v_aditivo.descricao, ' (', n, '/', p_parcelas, ')'),
      'anterior', 0,
      'novo', (v_centavos / p_parcelas + CASE WHEN n > p_parcelas - v_centavos % p_parcelas THEN 1 ELSE 0 END)::numeric / 100
    ) ORDER BY n) INTO v_linhas FROM generate_series(1, p_parcelas) AS n;
  END IF;

  RETURN jsonb_build_object('grupos', v_grupos, 'linhas', v_linhas,
    'projeto_id', v_projeto.id, 'cliente', v_projeto.cliente_id IS NOT NULL,
    'contrato', coalesce(v_projeto.valor_contrato, 0), 'aditivo', v_centavos::numeric / 100, 'saldo', (
      SELECT coalesce(sum(valor), 0) FROM public.receitas WHERE projeto_id = v_projeto.id
        AND empresa_id = v_projeto.empresa_id AND deleted_at IS NULL AND status IN ('Pendente','Atrasado')
    ));
END;
$$;

CREATE FUNCTION public.rpc_confirmar_cobranca_aditivo(
  p_aditivo uuid, p_previa jsonb, p_grupo uuid DEFAULT NULL, p_vencimento date DEFAULT NULL,
  p_parcelas integer DEFAULT 1, p_aceite text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_aditivo public.escopos%ROWTYPE;
  v_projeto public.projetos%ROWTYPE;
  v_previa jsonb;
  v_resultado jsonb;
  v_grupo_aditivo uuid;
  v_receitas uuid[];
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_view_financeiro() OR NOT public.user_has_feature('projetos','editor') THEN
    RAISE EXCEPTION 'Sem acesso a aditivos' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO STRICT v_aditivo FROM public.escopos
    WHERE id = p_aditivo AND empresa_id = public.get_user_empresa_id() AND tipo = 'aditivo' AND deleted_at IS NULL
    FOR UPDATE;
  IF v_aditivo.status = 'aprovado' THEN
    SELECT dados INTO v_resultado FROM public.projeto_registros
      WHERE projeto_id = v_aditivo.projeto_id AND origem_id = p_aditivo AND tipo = 'aditivo_cobranca';
    IF FOUND THEN RETURN v_resultado; END IF;
    RAISE EXCEPTION 'Este aditivo já foi aprovado';
  END IF;
  SELECT * INTO STRICT v_projeto FROM public.projetos
    WHERE id = v_aditivo.projeto_id AND empresa_id = v_aditivo.empresa_id AND deleted_at IS NULL FOR UPDATE;
  IF v_projeto.cliente_id IS NULL THEN RAISE EXCEPTION 'Vincule um cliente para aprovar a cobrança'; END IF;
  IF length(coalesce(p_aceite, '')) > 4000 THEN RAISE EXCEPTION 'Comprovante de aceite muito longo'; END IF;
  IF p_grupo IS NOT NULL THEN
    -- Travar os títulos antes de recomputar a prévia protege contra baixas simultâneas.
    PERFORM id FROM public.receitas WHERE grupo_parcela = p_grupo AND projeto_id = v_projeto.id
      AND empresa_id = v_projeto.empresa_id ORDER BY id FOR UPDATE;
    PERFORM c.receita_id FROM public.cobrancas c JOIN public.receitas r ON r.id = c.receita_id
      WHERE r.grupo_parcela = p_grupo AND r.projeto_id = v_projeto.id AND r.empresa_id = v_projeto.empresa_id
      ORDER BY c.receita_id FOR UPDATE OF c;
  END IF;

  v_previa := public.rpc_prever_cobranca_aditivo(p_aditivo, p_grupo, p_vencimento, p_parcelas);
  IF p_previa IS DISTINCT FROM v_previa OR jsonb_array_length(v_previa->'linhas') = 0 THEN
    RAISE EXCEPTION 'As parcelas mudaram. Confira uma nova prévia antes de aprovar.';
  END IF;

  IF p_grupo IS NOT NULL THEN
    UPDATE public.receitas r SET valor = x.novo, updated_at = now(), updated_by = auth.uid()
    FROM jsonb_to_recordset(v_previa->'linhas') AS x(id uuid, novo numeric)
    WHERE r.id = x.id AND r.valor IS DISTINCT FROM x.novo;
    UPDATE public.grupos_parcela SET total_original = coalesce(total_original, (
      SELECT sum(valor) - v_aditivo.valor_aditivo FROM public.receitas WHERE grupo_parcela = p_grupo AND deleted_at IS NULL
    )) + v_aditivo.valor_aditivo, updated_at = now(), updated_by = auth.uid() WHERE id = p_grupo;
  ELSE
    IF p_parcelas > 1 THEN v_grupo_aditivo := gen_random_uuid(); END IF;
    WITH criadas AS (
      INSERT INTO public.receitas
        (empresa_id, projeto_id, cliente_id, descricao, valor, data_vencimento, status, grupo_parcela,
          parcela_numero, parcela_total, created_by, updated_by)
      SELECT v_projeto.empresa_id, v_projeto.id, v_projeto.cliente_id, x.linha->>'descricao',
        (x.linha->>'novo')::numeric, (x.linha->>'vencimento')::date, 'Pendente',
        v_grupo_aditivo, CASE WHEN p_parcelas > 1 THEN x.n::integer END,
        CASE WHEN p_parcelas > 1 THEN p_parcelas END, auth.uid(), auth.uid()
      FROM jsonb_array_elements(v_previa->'linhas') WITH ORDINALITY AS x(linha,n)
      RETURNING id
    ) SELECT array_agg(id) INTO v_receitas FROM criadas;
  END IF;
  v_resultado := v_previa - 'grupos' || jsonb_strip_nulls(jsonb_build_object(
    'grupo_id', p_grupo, 'grupo_aditivo_id', v_grupo_aditivo, 'receitas', v_receitas, 'ator_id', auth.uid()
  ));
  IF v_projeto.valor_contrato IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.escopos WHERE projeto_id = v_projeto.id AND tipo = 'aditivo' AND status = 'aprovado'
  ) THEN
    v_resultado := v_resultado || jsonb_build_object('valor_original', v_projeto.valor_contrato);
  END IF;
  INSERT INTO public.projeto_registros (empresa_id, projeto_id, tipo, origem_id, autor_nome, detalhe, dados, financeiro)
  VALUES (v_projeto.empresa_id, v_projeto.id, 'aditivo_cobranca', p_aditivo, public.projeto_nome_ator(auth.uid()),
    v_aditivo.descricao, v_resultado, true);

  IF nullif(btrim(p_aceite), '') IS NOT NULL THEN
    INSERT INTO public.projeto_registros (empresa_id, projeto_id, tipo, origem_id, autor_nome, detalhe, dados, financeiro)
    VALUES (v_projeto.empresa_id, v_projeto.id, 'aditivo_aceite', p_aditivo, public.projeto_nome_ator(auth.uid()),
      v_aditivo.descricao, jsonb_build_object('comprovante', btrim(p_aceite), 'ator_id', auth.uid()), true);
  END IF;
  UPDATE public.escopos SET status = 'aprovado', aprovado_por = auth.uid(), aprovado_em = now(), updated_by = auth.uid()
    WHERE id = p_aditivo;
  RETURN v_resultado;
END;
$$;

CREATE FUNCTION public.tg_projeto_aditivo_decisao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF OLD.tipo <> 'aditivo' OR NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  IF auth.uid() IS NOT NULL AND OLD.status IN ('aprovado', 'rejeitado') THEN
    RAISE EXCEPTION 'Este aditivo já foi decidido';
  END IF;
  IF (NEW.origem_manual OR (auth.uid() IS NOT NULL AND NEW.valor_aditivo > 0))
    AND NEW.status = 'aprovado' AND NOT EXISTS (
    SELECT 1 FROM public.projeto_registros WHERE origem_id = NEW.id AND tipo = 'aditivo_cobranca'
  ) THEN RAISE EXCEPTION 'Confirme a cobrança pela aba Escopo e aditivos do projeto'; END IF;
  IF NEW.status = 'rejeitado' THEN
    INSERT INTO public.projeto_registros (empresa_id, projeto_id, tipo, origem_id, autor_nome, detalhe)
    VALUES (NEW.empresa_id, NEW.projeto_id, 'aditivo_rejeitado', NEW.id, public.projeto_nome_ator(auth.uid()), NEW.descricao);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.tg_projeto_aditivo_decisao() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER projeto_aditivo_decisao BEFORE UPDATE OF status ON public.escopos
  FOR EACH ROW EXECUTE FUNCTION public.tg_projeto_aditivo_decisao();

REVOKE ALL ON FUNCTION public.rpc_criar_aditivo_projeto(uuid,text,text,numeric,uuid,uuid,uuid),
  public.rpc_prever_cobranca_aditivo(uuid,uuid,date,integer),
  public.rpc_confirmar_cobranca_aditivo(uuid,jsonb,uuid,date,integer,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_criar_aditivo_projeto(uuid,text,text,numeric,uuid,uuid,uuid),
  public.rpc_prever_cobranca_aditivo(uuid,uuid,date,integer),
  public.rpc_confirmar_cobranca_aditivo(uuid,jsonb,uuid,date,integer,text) TO authenticated;

-- Os dois geradores do projeto passam a identificar o grupo das novas parcelas.
CREATE OR REPLACE FUNCTION public.rpc_gerar_parcelas_dia_fixo(p_projeto_id uuid, p_num_parcelas integer, p_dia_fixo integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_projeto RECORD;
  v_grupo uuid := gen_random_uuid();
  v_valor_parcela NUMERIC;
  v_caller_empresa_id UUID;
  v_data_venc DATE;
  v_ano INTEGER;
  v_mes INTEGER;
  v_dia_efetivo INTEGER;
  v_ultimo_dia INTEGER;
  v_start_mes INTEGER;
  v_start_ano INTEGER;
  i INTEGER;
  parcelas_criadas INTEGER := 0;
BEGIN
  -- ADR 0046: dinheiro exige can_view_financeiro() (admin ou financeiro_delegado).
  -- O filtro por empresa abaixo isola tenants, mas não papéis dentro da empresa.
  IF NOT public.can_view_financeiro() THEN
    RAISE EXCEPTION 'Sem acesso ao financeiro' USING ERRCODE = '42501';
  END IF;
  v_caller_empresa_id := public.get_user_empresa_id();

  SELECT id, valor_contrato, cliente_id, empresa_id, nome, codigo_projeto
  INTO v_projeto
  FROM projetos
  WHERE id = p_projeto_id AND deleted_at IS NULL;

  IF v_projeto IS NULL THEN
    RAISE EXCEPTION 'Projeto não encontrado';
  END IF;

  IF v_projeto.empresa_id != v_caller_empresa_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF v_projeto.valor_contrato IS NULL OR v_projeto.valor_contrato <= 0 THEN
    RAISE EXCEPTION 'Projeto sem valor de contrato';
  END IF;

  IF p_num_parcelas < 1 OR p_num_parcelas > 60 THEN
    RAISE EXCEPTION 'Número de parcelas deve ser entre 1 e 60';
  END IF;

  IF p_dia_fixo < 1 OR p_dia_fixo > 31 THEN
    RAISE EXCEPTION 'Dia fixo deve estar entre 1 e 31';
  END IF;

  v_valor_parcela := trunc(v_projeto.valor_contrato / p_num_parcelas, 2);

  IF EXTRACT(DAY FROM CURRENT_DATE)::INTEGER >= p_dia_fixo THEN
    v_start_mes := EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER + 1;
    v_start_ano := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
    IF v_start_mes > 12 THEN
      v_start_mes := 1;
      v_start_ano := v_start_ano + 1;
    END IF;
  ELSE
    v_start_mes := EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER;
    v_start_ano := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  END IF;

  FOR i IN 0..(p_num_parcelas - 1) LOOP
    v_mes := ((v_start_mes - 1 + i) % 12) + 1;
    v_ano := v_start_ano + ((v_start_mes - 1 + i) / 12);

    v_ultimo_dia := EXTRACT(DAY FROM (DATE_TRUNC('MONTH', MAKE_DATE(v_ano, v_mes, 1)) + INTERVAL '1 month - 1 day'))::INTEGER;
    v_dia_efetivo := LEAST(p_dia_fixo, v_ultimo_dia);
    v_data_venc := MAKE_DATE(v_ano, v_mes, v_dia_efetivo);

    -- Pula fim de semana (domingo=0, sábado=6 no PG)
    WHILE EXTRACT(DOW FROM v_data_venc) IN (0, 6) LOOP
      v_data_venc := v_data_venc + 1;
    END LOOP;

    INSERT INTO receitas (empresa_id, descricao, valor, data_vencimento, status, projeto_id, cliente_id, grupo_parcela, parcela_numero, parcela_total)
    VALUES (
      v_projeto.empresa_id,
      COALESCE(NULLIF(btrim(v_projeto.nome), ''), v_projeto.codigo_projeto) || ' - Parcela ' || (i + 1) || '/' || p_num_parcelas,
      CASE WHEN (i + 1) = p_num_parcelas THEN v_projeto.valor_contrato - v_valor_parcela * (p_num_parcelas - 1) ELSE v_valor_parcela END,
      v_data_venc,
      'Pendente',
      p_projeto_id,
      v_projeto.cliente_id, v_grupo, (i + 1), p_num_parcelas
    );
    parcelas_criadas := parcelas_criadas + 1;
  END LOOP;

  UPDATE public.grupos_parcela SET total_original = v_projeto.valor_contrato WHERE id = v_grupo;
  RETURN parcelas_criadas;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_gerar_parcelas_projeto(p_projeto_id uuid, p_num_parcelas integer DEFAULT 1, p_intervalo_dias integer DEFAULT 30)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_projeto RECORD;
  v_grupo uuid := gen_random_uuid();
  v_valor_parcela NUMERIC;
  v_data_base DATE;
  i INTEGER;
  parcelas_criadas INTEGER := 0;
  v_caller_empresa_id UUID;
BEGIN
  IF NOT public.can_view_financeiro() THEN
    RAISE EXCEPTION 'Sem permissão para gerar parcelas';
  END IF;

  v_caller_empresa_id := public.get_user_empresa_id();

  IF v_caller_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT id, valor_contrato, cliente_id, empresa_id, data_inicio, nome, codigo_projeto
  INTO v_projeto
  FROM projetos
  WHERE id = p_projeto_id AND deleted_at IS NULL;

  IF v_projeto IS NULL THEN
    RAISE EXCEPTION 'Projeto não encontrado';
  END IF;

  IF v_projeto.empresa_id != v_caller_empresa_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF v_projeto.valor_contrato IS NULL OR v_projeto.valor_contrato <= 0 THEN
    RAISE EXCEPTION 'Projeto sem valor de contrato';
  END IF;

  IF p_num_parcelas < 1 OR p_num_parcelas > 60 THEN
    RAISE EXCEPTION 'Número de parcelas deve ser entre 1 e 60';
  END IF;

  v_valor_parcela := trunc(v_projeto.valor_contrato / p_num_parcelas, 2);
  v_data_base := COALESCE(v_projeto.data_inicio, CURRENT_DATE);

  FOR i IN 1..p_num_parcelas LOOP
    INSERT INTO receitas (empresa_id, descricao, valor, data_vencimento, status, projeto_id, cliente_id, grupo_parcela, parcela_numero, parcela_total)
    VALUES (
      v_projeto.empresa_id,
      COALESCE(NULLIF(btrim(v_projeto.nome), ''), v_projeto.codigo_projeto) || ' - Parcela ' || i || '/' || p_num_parcelas,
      CASE WHEN i = p_num_parcelas THEN v_projeto.valor_contrato - v_valor_parcela * (p_num_parcelas - 1) ELSE v_valor_parcela END,
      v_data_base + ((i - 1) * p_intervalo_dias),
      'Pendente',
      p_projeto_id,
      v_projeto.cliente_id, v_grupo, i, p_num_parcelas
    );
    parcelas_criadas := parcelas_criadas + 1;
  END LOOP;

  UPDATE public.grupos_parcela SET total_original = v_projeto.valor_contrato WHERE id = v_grupo;
  RETURN parcelas_criadas;
END;
$function$;


CREATE FUNCTION public.rpc_resumo_aditivos_projeto(p_projeto uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_empresa uuid := public.get_user_empresa_id();
  v_total numeric;
  v_original numeric;
BEGIN
  IF auth.uid() IS NULL OR v_empresa IS NULL OR NOT public.can_view_financeiro()
     OR NOT public.user_has_feature('projetos','viewer') THEN
    RAISE EXCEPTION 'Sem acesso ao financeiro' USING ERRCODE = '42501';
  END IF;
  SELECT valor_contrato INTO STRICT v_total FROM public.projetos
    WHERE id = p_projeto AND empresa_id = v_empresa AND deleted_at IS NULL;
  SELECT (dados->>'valor_original')::numeric INTO v_original FROM public.projeto_registros
    WHERE projeto_id = p_projeto AND tipo = 'aditivo_cobranca' AND dados ? 'valor_original'
    ORDER BY ocorrido_em, id LIMIT 1;
  RETURN jsonb_build_object('original', v_original, 'total', v_total, 'aprovados', (
    SELECT coalesce(sum(valor_aditivo), 0) FROM public.escopos
    WHERE projeto_id = p_projeto AND tipo = 'aditivo' AND status = 'aprovado' AND deleted_at IS NULL
  ));
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_resumo_aditivos_projeto(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_resumo_aditivos_projeto(uuid) TO authenticated;

-- Pelos geradores legados, todos os títulos de um plano nasciam na mesma
-- transação com a descrição do projeto e sequência completa. Só agrupa esse
-- caso inequívoco; títulos avulsos e planos incompletos seguem como estão.
WITH candidatas AS MATERIALIZED (
  SELECT r.id, r.empresa_id, r.projeto_id, r.cliente_id, r.created_at,
    p.nome, r.valor, (n.partes[1])::int AS numero, (n.partes[2])::int AS quantidade
  FROM public.receitas r
  JOIN public.projetos p ON p.id = r.projeto_id AND p.empresa_id = r.empresa_id AND p.cliente_id = r.cliente_id
  CROSS JOIN LATERAL (SELECT regexp_match(r.descricao, ' - Parcela ([1-9][0-9]?)/([1-9][0-9]?)$') AS partes) n
  WHERE r.deleted_at IS NULL AND p.deleted_at IS NULL AND r.created_at IS NOT NULL
    AND r.grupo_parcela IS NULL AND r.parcela_numero IS NULL AND r.parcela_total IS NULL
    AND r.import_batch_id IS NULL AND r.obra_lancamento_origem_id IS NULL
    AND n.partes IS NOT NULL
    AND r.descricao = CONCAT(COALESCE(NULLIF(btrim(p.nome), ''), p.codigo_projeto),
      ' - Parcela ', n.partes[1], '/', n.partes[2])
), planos AS MATERIALIZED (
  SELECT gen_random_uuid() AS id, empresa_id, projeto_id, cliente_id, created_at, nome,
    quantidade, sum(valor) AS valor, array_agg(id) AS titulos
  FROM candidatas
  WHERE quantidade BETWEEN 2 AND 60
  GROUP BY empresa_id, projeto_id, cliente_id, created_at, nome, quantidade
  HAVING count(*) = quantidade AND count(DISTINCT numero) = quantidade
    AND min(numero) = 1 AND max(numero) = quantidade
), grupos AS (
  INSERT INTO public.grupos_parcela
    (id, empresa_id, tipo_lancamento, tipo_grupo, descricao, total_original,
     num_parcelas, contraparte_id, contraparte_tipo, projeto_id, created_at)
  SELECT id, empresa_id, 'receita', 'finito', nome, valor, quantidade, cliente_id, 'cliente', projeto_id, created_at
  FROM planos
  RETURNING id
)
UPDATE public.receitas r
SET grupo_parcela = grupos.id, parcela_numero = candidatas.numero, parcela_total = planos.quantidade
FROM grupos JOIN planos ON planos.id = grupos.id
JOIN candidatas ON candidatas.id = ANY(planos.titulos)
WHERE r.id = candidatas.id;
