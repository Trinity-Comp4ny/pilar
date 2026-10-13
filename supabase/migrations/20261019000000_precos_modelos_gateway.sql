-- Preço dos modelos do AI Gateway que o Pilar pode usar por configuração (SPEC 108, ADR 0051).
-- O débito grava o nome do modelo como vem de AI_MODELO_<TIPO> (ex.: "anthropic/claude-haiku-5.5");
-- sem linha aqui, custo_estimado fica NULL e o Sentry avisa.
--
-- Preços do catálogo do gateway (GET /v1/models, 2026-10-13), em US$ por milhão de tokens.
-- Haiku: faixa até 100 mil tokens de entrada por chamada; acima disso o gateway cobra 5x,
-- e nenhuma chamada do Pilar chega perto. Jev (modelo de decisão) cobra só a entrada.
INSERT INTO public.ai_model_precos (modelo, preco_input_por_milhao, preco_output_por_milhao, moeda, vigente_desde)
VALUES
  ('anthropic/claude-haiku-5.5', 0.10, 0.50, 'USD', TIMESTAMPTZ '2026-10-01 00:00:00+00'),
  ('google/gemini-2.5-flash', 0.30, 2.50, 'USD', TIMESTAMPTZ '2026-10-01 00:00:00+00'),
  ('typesafe-ai/jev', 0.042, 0, 'USD', TIMESTAMPTZ '2026-10-01 00:00:00+00')
ON CONFLICT (modelo, vigente_desde) DO NOTHING;
