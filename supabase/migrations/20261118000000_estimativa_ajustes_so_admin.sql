-- SPEC 137 (BEZ-14): a tabela de preços da empresa (estimativa_ajustes_empresa) só é escrita por quem administra.
--
-- Antes, qualquer usuário da empresa gravava. O valor da empresa vale antes do SINAPI e da referência do Pilar
-- em toda estimativa da empresa, então mudá-lo é decisão do admin (ou do ultra admin, que opera a empresa).
-- A leitura continua para toda a empresa: quem monta a estimativa precisa ver o valor que está valendo.

DROP POLICY estimativa_ajustes_insert ON public.estimativa_ajustes_empresa;
DROP POLICY estimativa_ajustes_update ON public.estimativa_ajustes_empresa;
DROP POLICY estimativa_ajustes_delete ON public.estimativa_ajustes_empresa;

CREATE POLICY estimativa_ajustes_insert ON public.estimativa_ajustes_empresa
  FOR INSERT TO authenticated WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND (public.is_company_admin() OR public.is_ultra_admin())
  );

CREATE POLICY estimativa_ajustes_update ON public.estimativa_ajustes_empresa
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id() AND (public.is_company_admin() OR public.is_ultra_admin()))
  WITH CHECK (empresa_id = public.get_user_empresa_id() AND (public.is_company_admin() OR public.is_ultra_admin()));

CREATE POLICY estimativa_ajustes_delete ON public.estimativa_ajustes_empresa
  FOR DELETE TO authenticated USING (
    empresa_id = public.get_user_empresa_id()
    AND (public.is_company_admin() OR public.is_ultra_admin())
  );
