-- SPEC 136, requisito 11 (BEZ-19): criar a obra a partir da estimativa, num clique.
--
-- Uma transação só: cria a obra (sem projeto, ADR 0012), a árvore fase › etapa › serviço em obra_frente com as
-- datas do cronograma da estimativa, o previsto por etapa em obra_orcamento_etapa e marca a estimativa como
-- "virou_obra", com o vínculo. Se qualquer parte falha (capacidade do plano, empresa só leitura, árvore inválida),
-- nada fica gravado.
--
-- A árvore e o previsto são montados no cliente a partir do resultado da estimativa (obraDaEstimativa.ts) e
-- validados aqui na fronteira: formato, tamanho, datas e valores. SECURITY INVOKER: a RLS e os triggers de obras,
-- obra_frente, obra_orcamento_etapa e estimativas_obra valem como em qualquer escrita do app. empresa_id nunca vem
-- do cliente: sai da estimativa, que a RLS só deixa ler na empresa do usuário.

CREATE OR REPLACE FUNCTION public.criar_obra_da_estimativa(
  p_estimativa_id uuid,
  p_obra jsonb,
  p_fases jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_est public.estimativas_obra;
  v_obra_id uuid;
  v_nome text := btrim(coalesce(p_obra ->> 'nome', ''));
  v_fase jsonb;
  v_etapa jsonb;
  v_servico jsonb;
  v_fase_id uuid;
  v_etapa_id uuid;
  v_previsto numeric(14, 2);
  i int := 0;
  j int;
  k int;
BEGIN
  IF v_nome = '' OR length(v_nome) > 200 THEN
    RAISE EXCEPTION 'Dê um nome à obra (até 200 caracteres)' USING ERRCODE = 'check_violation';
  END IF;
  IF jsonb_typeof(p_fases) IS DISTINCT FROM 'array' OR jsonb_array_length(p_fases) = 0
     OR jsonb_array_length(p_fases) > 50 THEN
    RAISE EXCEPTION 'O cronograma da estimativa precisa ter de 1 a 50 fases' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_est FROM public.estimativas_obra WHERE id = p_estimativa_id FOR UPDATE;
  IF v_est.id IS NULL THEN
    RAISE EXCEPTION 'Estimativa não encontrada' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_est.obra_id IS NOT NULL OR v_est.status = 'virou_obra' THEN
    RAISE EXCEPTION 'Esta estimativa já virou obra' USING ERRCODE = 'unique_violation';
  END IF;

  INSERT INTO public.obras (
    empresa_id, nome, cliente_id, status, modelo_cobranca, taxa_administracao_pct,
    cep, cidade, localizacao, latitude, longitude, data_inicio_prevista, data_fim_prevista
  ) VALUES (
    v_est.empresa_id,
    v_nome,
    v_est.cliente_id,
    'planejada',
    'administracao',
    coalesce((p_obra ->> 'taxa_administracao_pct')::numeric, 0),
    nullif(btrim(left(p_obra ->> 'cep', 9)), ''),
    nullif(btrim(left(p_obra ->> 'cidade', 120)), ''),
    nullif(btrim(left(p_obra ->> 'localizacao', 300)), ''),
    (p_obra ->> 'latitude')::double precision,
    (p_obra ->> 'longitude')::double precision,
    (p_obra ->> 'data_inicio_prevista')::date,
    (p_obra ->> 'data_fim_prevista')::date
  )
  RETURNING id INTO v_obra_id;

  FOR v_fase IN SELECT value FROM jsonb_array_elements(p_fases) LOOP
    i := i + 1;
    IF btrim(coalesce(v_fase ->> 'nome', '')) = '' OR jsonb_typeof(v_fase -> 'etapas') IS DISTINCT FROM 'array'
       OR jsonb_array_length(v_fase -> 'etapas') > 100 THEN
      RAISE EXCEPTION 'Fase % do cronograma inválida', i USING ERRCODE = 'check_violation';
    END IF;
    INSERT INTO public.obra_frente (empresa_id, obra_id, nome, ordem, nivel, data_inicio, data_fim)
    VALUES (v_est.empresa_id, v_obra_id, left(btrim(v_fase ->> 'nome'), 200), i, 'fase',
            (v_fase ->> 'inicio')::date, (v_fase ->> 'fim')::date)
    RETURNING id INTO v_fase_id;

    j := 0;
    FOR v_etapa IN SELECT value FROM jsonb_array_elements(v_fase -> 'etapas') LOOP
      j := j + 1;
      v_previsto := coalesce((v_etapa ->> 'previsto')::numeric, 0);
      IF btrim(coalesce(v_etapa ->> 'nome', '')) = '' OR v_previsto < 0 OR v_previsto >= 1e12
         OR jsonb_typeof(coalesce(v_etapa -> 'servicos', '[]'::jsonb)) <> 'array'
         OR jsonb_array_length(coalesce(v_etapa -> 'servicos', '[]'::jsonb)) > 100 THEN
        RAISE EXCEPTION 'Etapa % da fase % inválida', j, i USING ERRCODE = 'check_violation';
      END IF;
      INSERT INTO public.obra_frente (empresa_id, obra_id, nome, ordem, nivel, parent_id, data_inicio, data_fim)
      VALUES (v_est.empresa_id, v_obra_id, left(btrim(v_etapa ->> 'nome'), 200), j, 'etapa', v_fase_id,
              (v_etapa ->> 'inicio')::date, (v_etapa ->> 'fim')::date)
      RETURNING id INTO v_etapa_id;

      IF v_previsto > 0 THEN
        INSERT INTO public.obra_orcamento_etapa (empresa_id, obra_id, obra_frente_id, valor_previsto)
        VALUES (v_est.empresa_id, v_obra_id, v_etapa_id, round(v_previsto, 2));
      END IF;

      k := 0;
      FOR v_servico IN SELECT value FROM jsonb_array_elements(coalesce(v_etapa -> 'servicos', '[]'::jsonb)) LOOP
        k := k + 1;
        IF btrim(coalesce(v_servico ->> 'nome', '')) = '' THEN
          RAISE EXCEPTION 'Serviço % da etapa % da fase % sem nome', k, j, i USING ERRCODE = 'check_violation';
        END IF;
        INSERT INTO public.obra_frente (empresa_id, obra_id, nome, ordem, nivel, parent_id, data_inicio, data_fim)
        VALUES (v_est.empresa_id, v_obra_id, left(btrim(v_servico ->> 'nome'), 200), k, 'servico', v_etapa_id,
                (v_servico ->> 'inicio')::date, (v_servico ->> 'fim')::date);
      END LOOP;
    END LOOP;
  END LOOP;

  UPDATE public.estimativas_obra
     SET obra_id = v_obra_id, status = 'virou_obra'
   WHERE id = v_est.id;

  RETURN v_obra_id;
END;
$$;

COMMENT ON FUNCTION public.criar_obra_da_estimativa(uuid, jsonb, jsonb) IS
  'SPEC 136 (BEZ-19): cria a obra, o cronograma (fase > etapa > serviço) e o previsto por etapa a partir da estimativa, e marca a estimativa como virou_obra. Tudo ou nada; SECURITY INVOKER, a RLS vale.';

REVOKE ALL ON FUNCTION public.criar_obra_da_estimativa(uuid, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_obra_da_estimativa(uuid, jsonb, jsonb) TO authenticated;
