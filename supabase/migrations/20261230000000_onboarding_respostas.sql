-- SPEC 165 (fase 2): respostas do onboarding inteligente.
--
-- Cada pessoa que passa pelo onboarding guarda aqui o que respondeu: as dores que escolheu,
-- a principal, o texto livre e o contexto (aprofundamento, projetos ativos, ferramentas).
-- É o dado que mostra ao Pilar o que dói em cada escritório e orienta o plano de configuração.
-- A linha nasce na primeira resposta e é atualizada a cada tela (rascunho), então quem fecha
-- a aba volta de onde parou; `concluido_em` marca o fim.
--
-- Leitura: a própria pessoa e o ultra-admin (painel "Dores do mercado", fase 4). Escrita: só
-- a própria pessoa, sempre na empresa em que ela está.

BEGIN;

CREATE TABLE IF NOT EXISTS public.onboarding_respostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Versão do questionário: permite mudar as perguntas sem misturar respostas.
  versao integer NOT NULL DEFAULT 1,
  dores text[] NOT NULL DEFAULT '{}'::text[],
  dor_principal text,
  texto_livre text CHECK (texto_livre IS NULL OR char_length(texto_livre) <= 1000),
  contexto jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (pg_column_size(contexto) <= 8000),
  etapa_atual integer NOT NULL DEFAULT 1 CHECK (etapa_atual BETWEEN 1 AND 20),
  concluido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT onboarding_respostas_dores_validas CHECK (
    dores <@ ARRAY[
      'lucro_projeto', 'prazos', 'propostas', 'financeiro', 'equipe',
      'cliente_andamento', 'aditivos', 'obra', 'espalhado', 'outra'
    ]::text[]
    AND cardinality(dores) <= 3
  ),
  CONSTRAINT onboarding_respostas_dor_principal_valida CHECK (
    dor_principal IS NULL OR dor_principal = ANY (dores)
  )
);

COMMENT ON TABLE public.onboarding_respostas IS
  'Respostas do onboarding inteligente por pessoa (SPEC 165): dores, texto livre e contexto. Rascunho até concluido_em.';

CREATE INDEX IF NOT EXISTS onboarding_respostas_empresa_idx ON public.onboarding_respostas (empresa_id);
CREATE INDEX IF NOT EXISTS onboarding_respostas_concluido_idx ON public.onboarding_respostas (concluido_em DESC);

DROP TRIGGER IF EXISTS trg_onboarding_respostas_updated_at ON public.onboarding_respostas;
CREATE TRIGGER trg_onboarding_respostas_updated_at
  BEFORE UPDATE ON public.onboarding_respostas
  FOR EACH ROW EXECUTE FUNCTION public.tg_pilar_touch_updated_at();

ALTER TABLE public.onboarding_respostas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.onboarding_respostas FROM anon;

DROP POLICY IF EXISTS onboarding_respostas_select ON public.onboarding_respostas;
CREATE POLICY onboarding_respostas_select ON public.onboarding_respostas
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_ultra_admin()));

DROP POLICY IF EXISTS onboarding_respostas_insert ON public.onboarding_respostas;
CREATE POLICY onboarding_respostas_insert ON public.onboarding_respostas
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) AND empresa_id = public.get_user_empresa_id());

DROP POLICY IF EXISTS onboarding_respostas_update ON public.onboarding_respostas;
CREATE POLICY onboarding_respostas_update ON public.onboarding_respostas
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()) AND empresa_id = public.get_user_empresa_id());

COMMIT;
