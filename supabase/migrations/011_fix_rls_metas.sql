-- Fix RLS: metas leitura restrita por empresa
-- A policy anterior usava USING (true), expondo dados entre empresas.

DROP POLICY IF EXISTS "Enable read access for all users" ON public.metas;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'metas' AND policyname = 'Metas read by company') THEN
    CREATE POLICY "Metas read by company" ON public.metas
      FOR SELECT USING (empresa_id = public.get_user_empresa_id());
  END IF;
END $$;
