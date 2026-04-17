-- Fix RLS: metas leitura restrita por empresa
-- A policy anterior usava USING (true), expondo dados entre empresas.

DROP POLICY IF EXISTS "Enable read access for all users" ON public.metas;

CREATE POLICY "Metas read by company" ON public.metas
  FOR SELECT USING (empresa_id = public.get_user_empresa_id());
