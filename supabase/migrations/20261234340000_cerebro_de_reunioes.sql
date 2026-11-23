-- SPEC 169 fase 1, PR 1: cérebro de reuniões no Ultra (só banco, sem IA e sem tela).
--
-- Dado da operação da Pilar, não de tenant. Leitura só para ultra admin com MFA
-- (is_ultra_admin). Escrita pela API só nas duas colunas de curadoria (tipo_corrigido e
-- removido); todo o resto entra pelo service role na Edge Function do PR 2.
-- Nunca guarda a transcrição crua: só `transcript_redigido`, depois da redação.

CREATE TABLE public.reuniao (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo            text NOT NULL,
  ocorreu_em        timestamptz NOT NULL,
  origem_nome       text,
  tipo              text NOT NULL DEFAULT 'outro'
                    CHECK (tipo IN ('discovery', 'demo', 'venda', 'onboarding', 'suporte',
                                    'alinhamento_interno', 'parceiro', 'outro')),
  tipo_confianca    numeric(3, 2) CHECK (tipo_confianca BETWEEN 0 AND 1),
  tipo_corrigido    text CHECK (tipo_corrigido IN ('discovery', 'demo', 'venda', 'onboarding', 'suporte',
                                                   'alinhamento_interno', 'parceiro', 'outro')),
  origem_contato    text CHECK (origem_contato IN ('parente', 'indicacao', 'frio', 'inbound')),
  proximo_passo     text,
  proximo_passo_em  date,
  transcript_redigido text,
  redacoes          jsonb NOT NULL DEFAULT '{}'::jsonb,
  granola_note_id   text UNIQUE,
  status            text NOT NULL DEFAULT 'pendente'
                    CHECK (status IN ('pendente', 'analisada', 'falhou')),
  criado_por        uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.reuniao IS
  'SPEC 169: reuniões coladas no Ultra. Só transcript_redigido; redacoes guarda contagem por tipo, nunca o valor.';

CREATE INDEX reuniao_ocorreu_em_idx ON public.reuniao (ocorreu_em DESC);
CREATE INDEX reuniao_criado_por_idx ON public.reuniao (criado_por);

CREATE TABLE public.reuniao_insight (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reuniao_id      uuid NOT NULL REFERENCES public.reuniao (id) ON DELETE CASCADE,
  categoria       text NOT NULL
                  CHECK (categoria IN ('dor', 'ideia', 'objecao', 'decisao', 'pedido_feature', 'elogio',
                                       'risco', 'pratica_negocio', 'concorrencia')),
  texto           text NOT NULL,
  citacao         text NOT NULL,
  modulo_pilar    text,
  falante         text NOT NULL DEFAULT 'incerto'
                  CHECK (falante IN ('provavel_cliente', 'provavel_fundador', 'incerto')),
  texto_duvidoso  boolean NOT NULL DEFAULT false,
  removido        boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX reuniao_insight_reuniao_idx ON public.reuniao_insight (reuniao_id);
CREATE INDEX reuniao_insight_categoria_idx ON public.reuniao_insight (categoria) WHERE NOT removido;

CREATE TABLE public.reuniao_segmento (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reuniao_id      uuid NOT NULL REFERENCES public.reuniao (id) ON DELETE CASCADE,
  tipo            text NOT NULL
                  CHECK (tipo IN ('discovery', 'demo', 'venda', 'onboarding', 'suporte',
                                  'alinhamento_interno', 'parceiro', 'outro')),
  inicio          integer NOT NULL CHECK (inicio >= 0),
  fim             integer NOT NULL CHECK (fim >= inicio),
  proporcao_ruido numeric(3, 2) CHECK (proporcao_ruido BETWEEN 0 AND 1)
);

CREATE INDEX reuniao_segmento_reuniao_idx ON public.reuniao_segmento (reuniao_id);

CREATE TABLE public.compromisso (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reuniao_id    uuid NOT NULL REFERENCES public.reuniao (id) ON DELETE CASCADE,
  prometido_por text NOT NULL CHECK (prometido_por IN ('pilar', 'cliente')),
  para          text,
  descricao     text NOT NULL,
  prazo         date,
  status        text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'cumprido', 'cancelado')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX compromisso_reuniao_idx ON public.compromisso (reuniao_id);
CREATE INDEX compromisso_abertos_idx ON public.compromisso (prazo) WHERE status = 'aberto';

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.reuniao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reuniao_insight ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reuniao_segmento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compromisso ENABLE ROW LEVEL SECURITY;

CREATE POLICY reuniao_ultra_select ON public.reuniao
  FOR SELECT TO authenticated USING ((SELECT public.is_ultra_admin()));
CREATE POLICY reuniao_ultra_update ON public.reuniao
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_ultra_admin())) WITH CHECK ((SELECT public.is_ultra_admin()));
CREATE POLICY reuniao_insight_ultra_select ON public.reuniao_insight
  FOR SELECT TO authenticated USING ((SELECT public.is_ultra_admin()));
CREATE POLICY reuniao_insight_ultra_update ON public.reuniao_insight
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_ultra_admin())) WITH CHECK ((SELECT public.is_ultra_admin()));
CREATE POLICY reuniao_segmento_ultra_select ON public.reuniao_segmento
  FOR SELECT TO authenticated USING ((SELECT public.is_ultra_admin()));
CREATE POLICY compromisso_ultra_select ON public.compromisso
  FOR SELECT TO authenticated USING ((SELECT public.is_ultra_admin()));

REVOKE ALL ON public.reuniao, public.reuniao_insight, public.reuniao_segmento, public.compromisso
  FROM anon, authenticated;
GRANT SELECT ON public.reuniao, public.reuniao_insight, public.reuniao_segmento, public.compromisso
  TO authenticated;
-- Curadoria: só estas colunas mudam pela API.
GRANT UPDATE (tipo_corrigido) ON public.reuniao TO authenticated;
GRANT UPDATE (removido) ON public.reuniao_insight TO authenticated;

-- ─── Agente de inteligência no time (SPEC 126) ───────────────────────────────

INSERT INTO public.ops_agentes (id, nome, missao, ordem, fase, autonomia) VALUES
  ('inteligencia', 'Inteligência de clientes',
   'Transformar cada reunião em dor, ideia e objeção com citação, e só recomendar o que se repete.',
   8, 1, '{}')
ON CONFLICT (id) DO NOTHING;

-- ─── Resumo para a tela (números saem do código, não do modelo) ──────────────

CREATE OR REPLACE FUNCTION public.cerebro_resumo()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_ultra_admin() THEN
    RAISE EXCEPTION 'Acesso restrito ao Ultra Admin' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'reunioes', (SELECT count(*) FROM public.reuniao),
    'insights', (SELECT count(*) FROM public.reuniao_insight WHERE NOT removido),
    'compromissos_abertos', (SELECT count(*) FROM public.compromisso WHERE status = 'aberto'),
    'por_categoria', COALESCE((
      SELECT jsonb_object_agg(categoria, n) FROM (
        SELECT categoria, count(*) AS n FROM public.reuniao_insight WHERE NOT removido GROUP BY categoria
      ) c), '{}'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cerebro_resumo() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cerebro_resumo() TO authenticated;
