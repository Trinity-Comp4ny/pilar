-- Hotfix: restaurar GRANT SELECT em pilar_subscription_plans para anon/authenticated.
-- Os grants foram perdidos durante o sync remoto; sem eles, PostgREST não enxerga
-- a tabela no schema cache e a landing page de planos quebra.

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='pilar_subscription_plans') THEN
    GRANT SELECT ON public.pilar_subscription_plans TO anon, authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='pilar_subscriptions') THEN
    GRANT SELECT ON public.pilar_subscriptions TO authenticated;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
