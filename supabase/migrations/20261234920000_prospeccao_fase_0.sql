-- SPEC 172 fase 0: prospecção outbound no Ultra (base importada, fila do dia, registro de envio).
--
-- Dado da operação da Pilar, não de tenant. Leitura só para ultra admin com MFA
-- (is_ultra_admin). Importação insere leads direto (RLS de INSERT); toda mudança de estado
-- passa pelas duas RPCs abaixo, que gravam o envio e o lead juntos. Quem envia a mensagem é o
-- fundador, pelo wa.me: nenhuma coluna aqui dispara nada. Telefone de diretório não é opt-in, por
-- isso `parar` é definitivo (vai para prospec_bloqueios e nunca volta para a fila).

CREATE TABLE public.prospec_leads (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origem             text NOT NULL DEFAULT 'import'
                     CHECK (origem IN ('import', 'places', 'cnpj')),
  nome               text NOT NULL,
  segmento           text NOT NULL,
  segmento_teste     boolean NOT NULL DEFAULT false,
  uf                 text,
  cidade             text,
  telefone           text,
  telefone_adicional text,
  telefone_e164      text,
  tipo_telefone      text NOT NULL DEFAULT 'sem'
                     CHECK (tipo_telefone IN ('celular', 'fixo', 'sem')),
  email              text,
  site               text,
  endereco           text,
  contato_nome       text,
  whatsapp_na_fonte  boolean NOT NULL DEFAULT false,
  qualidade          text,
  canal              text NOT NULL DEFAULT 'nenhum'
                     CHECK (canal IN ('whatsapp', 'email', 'ligacao', 'nenhum')),
  confianca_contato  text NOT NULL DEFAULT 'empresa'
                     CHECK (confianca_contato IN ('pessoa', 'empresa')),
  nota_encaixe       smallint NOT NULL DEFAULT 50 CHECK (nota_encaixe BETWEEN 0 AND 100),
  status             text NOT NULL DEFAULT 'novo'
                     CHECK (status IN ('novo', 'fila', 'enviado', 'respondeu', 'reuniao_marcada',
                                       'sem_interesse', 'numero_errado', 'parar')),
  fila_em            date,
  pulado_em          timestamptz,
  ultimo_contato_em  timestamptz,
  criado_por         uuid DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.prospec_leads IS
  'SPEC 172: leads de prospecção da Pilar (importados, Places ou CNPJ). Não é dado de tenant.';

CREATE UNIQUE INDEX prospec_leads_telefone_uidx ON public.prospec_leads (telefone_e164)
  WHERE telefone_e164 IS NOT NULL;
CREATE UNIQUE INDEX prospec_leads_email_uidx ON public.prospec_leads (lower(email))
  WHERE telefone_e164 IS NULL AND email IS NOT NULL;
CREATE INDEX prospec_leads_fila_idx ON public.prospec_leads (nota_encaixe DESC, created_at)
  WHERE status = 'novo';
CREATE INDEX prospec_leads_status_idx ON public.prospec_leads (status);
CREATE INDEX prospec_leads_criado_por_idx ON public.prospec_leads (criado_por);

CREATE TABLE public.prospec_envios (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     uuid NOT NULL REFERENCES public.prospec_leads (id) ON DELETE CASCADE,
  canal       text,
  resultado   text NOT NULL
              CHECK (resultado IN ('enviei', 'pulei', 'numero_errado', 'parar', 'respondeu',
                                   'reuniao_marcada', 'sem_interesse')),
  texto       text,
  criado_por  uuid DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX prospec_envios_lead_idx ON public.prospec_envios (lead_id, created_at DESC);
CREATE INDEX prospec_envios_dia_idx ON public.prospec_envios (created_at DESC) WHERE resultado = 'enviei';
CREATE INDEX prospec_envios_criado_por_idx ON public.prospec_envios (criado_por);

CREATE TABLE public.prospec_bloqueios (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone_e164  text,
  email          text,
  motivo         text NOT NULL DEFAULT 'parar',
  created_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (telefone_e164 IS NOT NULL OR email IS NOT NULL)
);

CREATE UNIQUE INDEX prospec_bloqueios_telefone_uidx ON public.prospec_bloqueios (telefone_e164)
  WHERE telefone_e164 IS NOT NULL;
CREATE UNIQUE INDEX prospec_bloqueios_email_uidx ON public.prospec_bloqueios (lower(email))
  WHERE email IS NOT NULL;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.prospec_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospec_envios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospec_bloqueios ENABLE ROW LEVEL SECURITY;

CREATE POLICY prospec_leads_ultra_select ON public.prospec_leads
  FOR SELECT TO authenticated USING ((SELECT public.is_ultra_admin()));
CREATE POLICY prospec_leads_ultra_insert ON public.prospec_leads
  FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_ultra_admin()));
CREATE POLICY prospec_envios_ultra_select ON public.prospec_envios
  FOR SELECT TO authenticated USING ((SELECT public.is_ultra_admin()));
CREATE POLICY prospec_bloqueios_ultra_select ON public.prospec_bloqueios
  FOR SELECT TO authenticated USING ((SELECT public.is_ultra_admin()));

REVOKE ALL ON public.prospec_leads, public.prospec_envios, public.prospec_bloqueios
  FROM anon, authenticated;
GRANT SELECT ON public.prospec_leads, public.prospec_envios, public.prospec_bloqueios TO authenticated;
GRANT INSERT ON public.prospec_leads TO authenticated;

-- ─── Fila do dia ─────────────────────────────────────────────────────────────
-- Completa a fila até o limite diário: o que já foi enviado hoje e o que já está na fila contam.
-- Ordem: maior nota de encaixe, ICP antes de segmento de teste. Fora da fila: bloqueado, pulado
-- há menos de 7 dias e lead que não é do canal pedido. Devolve o total na fila.

CREATE OR REPLACE FUNCTION public.prospec_montar_fila(p_limite integer DEFAULT 10, p_canal text DEFAULT 'whatsapp')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_inicio timestamptz := (v_hoje::timestamp AT TIME ZONE 'America/Sao_Paulo');
  v_enviados integer;
  v_na_fila integer;
  v_falta integer;
BEGIN
  IF NOT public.is_ultra_admin() THEN
    RAISE EXCEPTION 'Acesso restrito ao Ultra Admin' USING ERRCODE = '42501';
  END IF;
  IF p_limite IS NULL OR p_limite < 1 OR p_limite > 50 THEN
    RAISE EXCEPTION 'Limite diário inválido' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO v_enviados FROM public.prospec_envios
   WHERE resultado = 'enviei' AND created_at >= v_inicio;
  SELECT count(*) INTO v_na_fila FROM public.prospec_leads WHERE status = 'fila';
  v_falta := greatest(0, p_limite - v_enviados - v_na_fila);

  IF v_falta > 0 THEN
    UPDATE public.prospec_leads l
       SET status = 'fila', fila_em = v_hoje
     WHERE l.id IN (
       SELECT c.id FROM public.prospec_leads c
        WHERE c.status = 'novo'
          AND c.canal = p_canal
          AND (c.pulado_em IS NULL OR c.pulado_em < now() - interval '7 days')
          AND NOT EXISTS (
            SELECT 1 FROM public.prospec_bloqueios b
             WHERE (b.telefone_e164 IS NOT NULL AND b.telefone_e164 = c.telefone_e164)
                OR (b.email IS NOT NULL AND lower(b.email) = lower(c.email)))
        ORDER BY c.segmento_teste, c.nota_encaixe DESC, c.created_at
        LIMIT v_falta
        FOR UPDATE SKIP LOCKED);
  END IF;

  RETURN (SELECT count(*) FROM public.prospec_leads WHERE status = 'fila');
END;
$$;

REVOKE ALL ON FUNCTION public.prospec_montar_fila(integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prospec_montar_fila(integer, text) TO authenticated;

-- ─── Registro de envio e de resultado ────────────────────────────────────────
-- Uma chamada grava o evento e move o lead. `parar` bloqueia o telefone e o e-mail para sempre.
-- Nome informado pelo fundador (ele soube quem atende) promove o lead a `pessoa`.

CREATE OR REPLACE FUNCTION public.prospec_registrar(
  p_lead uuid,
  p_resultado text,
  p_canal text DEFAULT NULL,
  p_texto text DEFAULT NULL,
  p_contato_nome text DEFAULT NULL
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

  INSERT INTO public.prospec_envios (lead_id, canal, resultado, texto)
  VALUES (p_lead, coalesce(p_canal, v_lead.canal), p_resultado, p_texto);

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

REVOKE ALL ON FUNCTION public.prospec_registrar(uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prospec_registrar(uuid, text, text, text, text) TO authenticated;
