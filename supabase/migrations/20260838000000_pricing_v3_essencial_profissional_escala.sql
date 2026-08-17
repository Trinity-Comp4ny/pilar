-- Atualiza nome, preço e limites dos 3 planos existentes para a hipótese v3
-- de docs/strategy/PRICING.md (resposta à auditoria externa de posicionamento).
-- Mantém os slugs internos (starter/pro/enterprise) intocados: são identificador
-- estável referenciado por vários arquivos de front e por pilar-checkout-create;
-- só o que o cliente vê muda. Usuários ilimitados em todos os planos (adotado
-- desde a v2, reforçado na v3). Limite de projetos ativos sobe junto com o
-- reposicionamento; "obras ativas" não entra aqui porque não existe enforcement
-- nenhum no banco ainda (sem coluna, sem contador), ver PRICING.md item 7.

UPDATE public.pilar_subscription_plans
SET
  nome = 'Essencial',
  descricao = 'Pra escritório pequeno',
  preco_mensal = 490.00,
  preco_anual = 4900.00,
  max_usuarios = NULL,
  max_projetos = 15
WHERE slug = 'starter';

UPDATE public.pilar_subscription_plans
SET
  nome = 'Profissional',
  descricao = 'Centro do ICP, o mais escolhido',
  preco_mensal = 690.00,
  preco_anual = 6900.00,
  max_usuarios = NULL,
  max_projetos = 40,
  destaque = TRUE
WHERE slug = 'pro';

UPDATE public.pilar_subscription_plans
SET
  nome = 'Escala',
  descricao = 'Pra operação maior ou multiequipe',
  preco_mensal = 1290.00,
  preco_anual = 12900.00,
  max_usuarios = NULL,
  max_projetos = NULL,
  destaque = FALSE
WHERE slug = 'enterprise';
