-- SPEC 172 fase 1: mapeador Google Places + cascata geográfica + pausa automática da fila.
--
-- O mapeador (edge function prospeccao-mapeador) roda por cron semanal e só escreve por
-- prospec_registrar_busca (service role). Nasce DESLIGADO (prospec_config.ativo = false): o
-- fundador liga depois de gravar a chave do Places e de conferir os termos do Google.

ALTER TABLE public.prospec_leads
  ADD COLUMN IF NOT EXISTS place_id text,
  ADD COLUMN IF NOT EXISTS regiao text;
CREATE UNIQUE INDEX IF NOT EXISTS prospec_leads_place_id_uidx ON public.prospec_leads (place_id)
  WHERE place_id IS NOT NULL;

-- Células da cascata: cidade × segmento. Prioridade menor roda primeiro.
CREATE TABLE public.prospec_celulas (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uf               text NOT NULL,
  cidade           text NOT NULL,
  segmento         text NOT NULL,
  regiao           text NOT NULL,
  prioridade       integer NOT NULL,
  ultima_busca_em  timestamptz,
  leads_novos      integer NOT NULL DEFAULT 0,
  UNIQUE (uf, cidade, segmento)
);
CREATE INDEX prospec_celulas_fila_idx ON public.prospec_celulas (prioridade, ultima_busca_em NULLS FIRST);

-- Uma linha por busca feita: é o que conta o teto da semana.
CREATE TABLE public.prospec_buscas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  celula_id   uuid REFERENCES public.prospec_celulas (id) ON DELETE SET NULL,
  encontrados integer NOT NULL DEFAULT 0,
  novos       integer NOT NULL DEFAULT 0,
  erro        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX prospec_buscas_data_idx ON public.prospec_buscas (created_at DESC);
CREATE INDEX prospec_buscas_celula_idx ON public.prospec_buscas (celula_id);

-- Linha única de configuração.
CREATE TABLE public.prospec_config (
  id                    boolean PRIMARY KEY DEFAULT true CHECK (id),
  ativo                 boolean NOT NULL DEFAULT false,
  teto_semanal_buscas   integer NOT NULL DEFAULT 100 CHECK (teto_semanal_buscas BETWEEN 0 AND 5000),
  repetir_apos_dias     integer NOT NULL DEFAULT 90 CHECK (repetir_apos_dias >= 7)
);
INSERT INTO public.prospec_config DEFAULT VALUES;

ALTER TABLE public.prospec_celulas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospec_buscas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospec_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY prospec_celulas_ultra_select ON public.prospec_celulas
  FOR SELECT TO authenticated USING ((SELECT public.is_ultra_admin()));
CREATE POLICY prospec_buscas_ultra_select ON public.prospec_buscas
  FOR SELECT TO authenticated USING ((SELECT public.is_ultra_admin()));
CREATE POLICY prospec_config_ultra_select ON public.prospec_config
  FOR SELECT TO authenticated USING ((SELECT public.is_ultra_admin()));

REVOKE ALL ON public.prospec_celulas, public.prospec_buscas, public.prospec_config FROM anon, authenticated;
GRANT SELECT ON public.prospec_celulas, public.prospec_buscas, public.prospec_config TO authenticated;

-- Liga/desliga e ajusta o teto (só ultra admin).
CREATE OR REPLACE FUNCTION public.prospec_config_salvar(p_ativo boolean, p_teto integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_ultra_admin() THEN
    RAISE EXCEPTION 'Acesso restrito ao Ultra Admin' USING ERRCODE = '42501';
  END IF;
  IF p_teto IS NULL OR p_teto < 0 OR p_teto > 5000 THEN
    RAISE EXCEPTION 'Teto inválido' USING ERRCODE = '22023';
  END IF;
  UPDATE public.prospec_config SET ativo = coalesce(p_ativo, ativo), teto_semanal_buscas = p_teto;
END;
$$;
REVOKE ALL ON FUNCTION public.prospec_config_salvar(boolean, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prospec_config_salvar(boolean, integer) TO authenticated;

-- Próximas células a buscar, já descontando o que a semana gastou. Só o service role chama.
CREATE OR REPLACE FUNCTION public.prospec_proximas_celulas()
RETURNS TABLE (id uuid, uf text, cidade text, segmento text, regiao text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg public.prospec_config;
  v_gastas integer;
  v_resta integer;
BEGIN
  SELECT * INTO v_cfg FROM public.prospec_config;
  IF NOT v_cfg.ativo THEN
    RETURN;
  END IF;
  SELECT count(*) INTO v_gastas FROM public.prospec_buscas
   WHERE created_at >= date_trunc('week', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo';
  v_resta := greatest(0, v_cfg.teto_semanal_buscas - v_gastas);
  RETURN QUERY
    SELECT c.id, c.uf, c.cidade, c.segmento, c.regiao
      FROM public.prospec_celulas c
     WHERE c.ultima_busca_em IS NULL
        OR c.ultima_busca_em < now() - make_interval(days => v_cfg.repetir_apos_dias)
     ORDER BY c.prioridade, c.ultima_busca_em NULLS FIRST, c.cidade
     LIMIT v_resta;
END;
$$;
REVOKE ALL ON FUNCTION public.prospec_proximas_celulas() FROM PUBLIC, anon, authenticated;

-- Grava o resultado de uma busca: leads novos (dedupe por place_id, telefone e bloqueio) e o log.
-- p_leads: [{place_id, nome, telefone, telefone_e164, tipo_telefone, site, endereco}].
CREATE OR REPLACE FUNCTION public.prospec_registrar_busca(p_celula uuid, p_leads jsonb, p_erro text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cel public.prospec_celulas;
  v_novos integer := 0;
  v_lead jsonb;
  v_icp boolean;
  v_e164 text;
  v_tipo text;
  v_ok integer;
BEGIN
  SELECT * INTO v_cel FROM public.prospec_celulas WHERE id = p_celula FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Célula não encontrada' USING ERRCODE = 'P0002';
  END IF;
  v_icp := v_cel.segmento IN ('arquitetura', 'engenharia');

  IF p_erro IS NULL THEN
    FOR v_lead IN SELECT * FROM jsonb_array_elements(coalesce(p_leads, '[]'::jsonb)) LOOP
      v_e164 := nullif(v_lead ->> 'telefone_e164', '');
      v_tipo := CASE WHEN v_e164 IS NULL THEN 'sem' ELSE coalesce(v_lead ->> 'tipo_telefone', 'fixo') END;
      CONTINUE WHEN nullif(btrim(v_lead ->> 'nome'), '') IS NULL;
      CONTINUE WHEN v_e164 IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.prospec_bloqueios b WHERE b.telefone_e164 = v_e164);

      INSERT INTO public.prospec_leads (
        origem, place_id, nome, segmento, segmento_teste, uf, cidade, regiao, telefone, telefone_e164,
        tipo_telefone, site, endereco, canal, confianca_contato, nota_encaixe)
      VALUES (
        'places', v_lead ->> 'place_id', btrim(v_lead ->> 'nome'), v_cel.segmento, NOT v_icp,
        v_cel.uf, v_cel.cidade, v_cel.regiao, v_lead ->> 'telefone', v_e164, v_tipo,
        v_lead ->> 'site', v_lead ->> 'endereco',
        CASE WHEN v_tipo = 'celular' THEN 'whatsapp' WHEN v_tipo = 'fixo' THEN 'ligacao' ELSE 'nenhum' END,
        'empresa', CASE WHEN v_icp THEN 60 ELSE 45 END)
      ON CONFLICT DO NOTHING;
      GET DIAGNOSTICS v_ok = ROW_COUNT;
      v_novos := v_novos + v_ok;
    END LOOP;

    UPDATE public.prospec_celulas SET ultima_busca_em = now(), leads_novos = v_novos WHERE id = p_celula;
  END IF;

  INSERT INTO public.prospec_buscas (celula_id, encontrados, novos, erro)
  VALUES (p_celula, jsonb_array_length(coalesce(p_leads, '[]'::jsonb)), v_novos, p_erro);
  RETURN v_novos;
END;
$$;
REVOKE ALL ON FUNCTION public.prospec_registrar_busca(uuid, jsonb, text) FROM PUBLIC, anon, authenticated;

-- ─── Pausa automática da fila ────────────────────────────────────────────────
-- 2 ou mais "parar" ou "número errado" em 7 dias: a fila não completa (devolve só o que já está nela).
CREATE OR REPLACE FUNCTION public.prospec_fila_pausada()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*) >= 2 FROM public.prospec_envios
   WHERE resultado IN ('parar', 'numero_errado') AND created_at >= now() - interval '7 days';
$$;
REVOKE ALL ON FUNCTION public.prospec_fila_pausada() FROM PUBLIC, anon, authenticated;

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
  v_falta := CASE WHEN public.prospec_fila_pausada() THEN 0 ELSE greatest(0, p_limite - v_enviados - v_na_fila) END;

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

-- ─── Semente da cascata ──────────────────────────────────────────────────────
-- 1: Marília e raio de ~100 km; 2: polos do interior de SP; 3: capitais. ICP antes de segmento de teste.
WITH cidades (uf, cidade, regiao, nivel) AS (
  VALUES
  ('SP','Marília','Marília e região',1),('SP','Garça','Marília e região',1),('SP','Pompeia','Marília e região',1),
  ('SP','Tupã','Marília e região',1),('SP','Assis','Marília e região',1),('SP','Ourinhos','Marília e região',1),
  ('SP','Bauru','Marília e região',1),('SP','Lins','Marília e região',1),('SP','Vera Cruz','Marília e região',1),
  ('SP','Álvaro de Carvalho','Marília e região',1),('SP','Gália','Marília e região',1),('SP','Oriente','Marília e região',1),
  ('SP','Campinas','Interior de SP',2),('SP','Ribeirão Preto','Interior de SP',2),('SP','São José do Rio Preto','Interior de SP',2),
  ('SP','Sorocaba','Interior de SP',2),('SP','Presidente Prudente','Interior de SP',2),('SP','Araçatuba','Interior de SP',2),
  ('SP','Piracicaba','Interior de SP',2),('SP','Jundiaí','Interior de SP',2),('SP','São Carlos','Interior de SP',2),
  ('SP','Franca','Interior de SP',2),('SP','Araraquara','Interior de SP',2),('SP','São José dos Campos','Interior de SP',2),
  ('SP','São Paulo','Capitais',3),('RJ','Rio de Janeiro','Capitais',3),('MG','Belo Horizonte','Capitais',3),
  ('PR','Curitiba','Capitais',3),('RS','Porto Alegre','Capitais',3),('SC','Florianópolis','Capitais',3),
  ('DF','Brasília','Capitais',3),('GO','Goiânia','Capitais',3),('MT','Cuiabá','Capitais',3),
  ('MS','Campo Grande','Capitais',3),('ES','Vitória','Capitais',3),('BA','Salvador','Capitais',3),
  ('PE','Recife','Capitais',3),('CE','Fortaleza','Capitais',3),('PA','Belém','Capitais',3),
  ('AM','Manaus','Capitais',3)
),
segs (slug, icp) AS (
  VALUES ('arquitetura',true),('engenharia',true),('construtoras',false),('moveis_planejados',false),
         ('marmorarias',false),('vidracarias',false),('esquadrias',false),('serralherias',false)
)
INSERT INTO public.prospec_celulas (uf, cidade, segmento, regiao, prioridade)
SELECT c.uf, c.cidade, s.slug, c.regiao, c.nivel * 10 + CASE WHEN s.icp THEN 0 ELSE 5 END
  FROM cidades c CROSS JOIN segs s;

-- ─── Cron semanal: domingo 22h BRT (segunda 01:00 UTC) ───────────────────────
CREATE OR REPLACE FUNCTION public.prospec_mapeador_disparar()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_url text := public._cron_secret('app_supabase_url');
  v_key text := public._cron_secret('app_cron_secret');
BEGIN
  IF v_url IS NULL OR v_url = '' OR v_key IS NULL OR v_key = '' THEN
    RAISE NOTICE 'prospec_mapeador_disparar: vault secrets ausentes, disparo pulado';
    RETURN;
  END IF;
  PERFORM net.http_post(
    url     := v_url || '/functions/v1/prospeccao-mapeador',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body    := '{}'::jsonb
  );
END;
$$;
REVOKE ALL ON FUNCTION public.prospec_mapeador_disparar() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'prospeccao-mapeador-semanal') THEN
      PERFORM cron.unschedule('prospeccao-mapeador-semanal');
    END IF;
    PERFORM cron.schedule('prospeccao-mapeador-semanal', '0 1 * * 1', 'SELECT public.prospec_mapeador_disparar()');
  END IF;
END;
$$;
