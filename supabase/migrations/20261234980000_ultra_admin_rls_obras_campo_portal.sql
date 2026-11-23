-- O ultra_admin (com MFA, via is_ultra_admin()) lê e gerencia obras, contas do Pilar Campo
-- e contas do portal do cliente de qualquer empresa. Direção do dono (23/11/2026):
-- o ultra_admin enxerga e controla tudo.
--
-- Policy PERMISSIVA e aditiva: soma-se (OR) às policies de tenant existentes, que ficam
-- intactas. Quem não é ultra_admin continua preso à própria empresa. O select envolve a
-- função em subselect para o Postgres avaliá-la uma vez por query (initplan).

DROP POLICY IF EXISTS obras_ultra_admin ON public.obras;
CREATE POLICY obras_ultra_admin ON public.obras
  FOR ALL TO authenticated
  USING ((SELECT public.is_ultra_admin()))
  WITH CHECK ((SELECT public.is_ultra_admin()));

DROP POLICY IF EXISTS campo_accounts_ultra_admin ON public.campo_accounts;
CREATE POLICY campo_accounts_ultra_admin ON public.campo_accounts
  FOR ALL TO authenticated
  USING ((SELECT public.is_ultra_admin()))
  WITH CHECK ((SELECT public.is_ultra_admin()));

DROP POLICY IF EXISTS cliente_portal_accounts_ultra_admin ON public.cliente_portal_accounts;
CREATE POLICY cliente_portal_accounts_ultra_admin ON public.cliente_portal_accounts
  FOR ALL TO authenticated
  USING ((SELECT public.is_ultra_admin()))
  WITH CHECK ((SELECT public.is_ultra_admin()));
