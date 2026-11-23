-- SPEC 172 fase 3: medição (resposta e reunião por segmento, modelo e região), teste A/B de
-- mensagem e follow-up com aprovação. Tudo restrito ao Ultra Admin.

ALTER TABLE public.prospec_envios ADD COLUMN IF NOT EXISTS modelo text;

COMMENT ON COLUMN public.prospec_envios.modelo IS
  'SPEC 172 fase 3: modelo de mensagem usado (ex.: pessoa_a, empresa_b, followup). Base do teste A/B.';

-- prospec_registrar ganha p_modelo. Troca a assinatura (sem overload: o PostgREST não resolve).
DROP FUNCTION IF EXISTS public.prospec_registrar(uuid, text, text, text, text);

CREATE OR REPLACE FUNCTION public.prospec_registrar(
  p_lead uuid,
  p_resultado text,
  p_canal text DEFAULT NULL,
  p_texto text DEFAULT NULL,
  p_contato_nome text DEFAULT NULL,
  p_modelo text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead public.prospec_leads;
  v_nome text := nullif(btrim(p_contato_nome), '');
BEGIN
  IF NOT public.is_ultra_admin() THEN
    RAISE EXCEPTION 'Acesso restrito ao Ultra Admin' USING ERRCODE = '42501';
  END IF;
  IF p_resultado NOT IN ('enviei', 'pulei', 'numero_errado', 'parar', 'respondeu',
                         'reuniao_marcada', 'sem_interesse') THEN
    RAISE EXCEPTION 'Resultado inválido' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_lead FROM public.prospec_leads WHERE id = p_lead FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead não encontrado' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.prospec_envios (lead_id, canal, resultado, texto, modelo)
  VALUES (p_lead, coalesce(p_canal, v_lead.canal), p_resultado, p_texto,
          nullif(btrim(p_modelo), ''));

  UPDATE public.prospec_leads SET
    status = CASE p_resultado
               WHEN 'enviei' THEN 'enviado'
               WHEN 'pulei' THEN 'novo'
               ELSE p_resultado
             END,
    fila_em = CASE WHEN p_resultado = 'pulei' THEN NULL ELSE fila_em END,
    pulado_em = CASE WHEN p_resultado = 'pulei' THEN now() ELSE pulado_em END,
    ultimo_contato_em = CASE WHEN p_resultado = 'pulei' THEN ultimo_contato_em ELSE now() END,
    contato_nome = coalesce(v_nome, contato_nome),
    confianca_contato = CASE WHEN v_nome IS NOT NULL THEN 'pessoa' ELSE confianca_contato END
  WHERE id = p_lead;

  IF p_resultado = 'parar' AND (v_lead.telefone_e164 IS NOT NULL OR v_lead.email IS NOT NULL) THEN
    INSERT INTO public.prospec_bloqueios (telefone_e164, email, motivo)
    VALUES (v_lead.telefone_e164, v_lead.email, 'parar')
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.prospec_registrar(uuid, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prospec_registrar(uuid, text, text, text, text, text) TO authenticated;

-- ─── Medição ─────────────────────────────────────────────────────────────────
-- Uma linha por (dimensão, chave). "Enviados" = leads com ao menos um envio. "Respostas" = leads
-- que responderam de qualquer forma (inclui reunião e sem interesse). Modelo = o do primeiro envio.

CREATE OR REPLACE FUNCTION public.prospec_resultados()
RETURNS TABLE (dimensao text, chave text, enviados bigint, respostas bigint, reunioes bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_ultra_admin() THEN
    RAISE EXCEPTION 'Acesso restrito ao Ultra Admin' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH enviados AS (
    SELECT l.id, l.segmento, coalesce(l.regiao, 'sem região') AS regiao,
           coalesce((SELECT e.modelo FROM public.prospec_envios e
                      WHERE e.lead_id = l.id AND e.resultado = 'enviei'
                      ORDER BY e.created_at LIMIT 1), 'sem modelo') AS modelo,
           EXISTS (SELECT 1 FROM public.prospec_envios e
                    WHERE e.lead_id = l.id
                      AND e.resultado IN ('respondeu', 'reuniao_marcada', 'sem_interesse')) AS respondeu,
           EXISTS (SELECT 1 FROM public.prospec_envios e
                    WHERE e.lead_id = l.id AND e.resultado = 'reuniao_marcada') AS reuniao
      FROM public.prospec_leads l
     WHERE EXISTS (SELECT 1 FROM public.prospec_envios e WHERE e.lead_id = l.id AND e.resultado = 'enviei')
  ),
  longo AS (
    SELECT 'segmento'::text AS dimensao, segmento AS chave, respondeu, reuniao FROM enviados
    UNION ALL SELECT 'modelo', modelo, respondeu, reuniao FROM enviados
    UNION ALL SELECT 'regiao', regiao, respondeu, reuniao FROM enviados
  )
  SELECT g.dimensao, g.chave, count(*)::bigint,
         count(*) FILTER (WHERE g.respondeu)::bigint,
         count(*) FILTER (WHERE g.reuniao)::bigint
    FROM longo g
   GROUP BY g.dimensao, g.chave
   ORDER BY g.dimensao, count(*) DESC, g.chave;
END;
$$;

REVOKE ALL ON FUNCTION public.prospec_resultados() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prospec_resultados() TO authenticated;

-- ─── Follow-up com aprovação ─────────────────────────────────────────────────
-- Lead enviado há `p_dias` dias ou mais, sem resposta e com um único envio. O envio do follow-up
-- é feito pelo fundador (um clique por lead) e conta como segundo envio: nunca há terceiro.

CREATE OR REPLACE FUNCTION public.prospec_followups(p_dias integer DEFAULT 4, p_limite integer DEFAULT 10)
RETURNS TABLE (
  id uuid, nome text, segmento text, segmento_teste boolean, cidade text, telefone_e164 text,
  tipo_telefone text, email text, site text, contato_nome text, canal text, confianca_contato text,
  nota_encaixe smallint, status text, fila_em date, ultimo_contato_em timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_ultra_admin() THEN
    RAISE EXCEPTION 'Acesso restrito ao Ultra Admin' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT l.id, l.nome, l.segmento, l.segmento_teste, l.cidade, l.telefone_e164, l.tipo_telefone,
         l.email, l.site, l.contato_nome, l.canal, l.confianca_contato, l.nota_encaixe, l.status,
         l.fila_em, l.ultimo_contato_em
    FROM public.prospec_leads l
   WHERE l.status = 'enviado'
     AND l.canal = 'whatsapp'
     AND l.telefone_e164 IS NOT NULL
     AND l.ultimo_contato_em <= now() - make_interval(days => greatest(p_dias, 1))
     AND (SELECT count(*) FROM public.prospec_envios e
           WHERE e.lead_id = l.id AND e.resultado = 'enviei') = 1
     AND NOT EXISTS (SELECT 1 FROM public.prospec_bloqueios b WHERE b.telefone_e164 = l.telefone_e164)
   ORDER BY l.ultimo_contato_em
   LIMIT greatest(least(p_limite, 50), 1);
END;
$$;

REVOKE ALL ON FUNCTION public.prospec_followups(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prospec_followups(integer, integer) TO authenticated;
