-- Migration: atualiza coluna features dos planos com as FeatureKeys canônicas
-- As features originais (migration 027) eram strings descritivas para exibição.
-- Este seed substitui pelo array de FeatureKeys usado em src/lib/planFeatures.ts.

UPDATE public.pilar_subscription_plans
SET features = '["dashboard","projetos","clientes","propostas","leads","financeiro","relatorios","mapa"]'::jsonb
WHERE slug = 'starter';

UPDATE public.pilar_subscription_plans
SET features = '["dashboard","projetos","clientes","propostas","leads","financeiro","relatorios","mapa","pessoas","timesheet","capacidade"]'::jsonb
WHERE slug = 'pro';

UPDATE public.pilar_subscription_plans
SET features = '["dashboard","projetos","clientes","propostas","leads","financeiro","relatorios","mapa","pessoas","timesheet","capacidade","templates","ai_hub"]'::jsonb
WHERE slug = 'enterprise';
