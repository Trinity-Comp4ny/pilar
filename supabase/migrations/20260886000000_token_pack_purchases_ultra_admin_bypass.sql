-- Motor de tokens: bypass de RLS pra ultra_admin em pilar_token_pack_purchases
-- (mesmo padrão já aplicado a ai_token_ledger/ai_token_saldo na 20260881000000).
-- Sem isso, o painel de margem do ultra-admin (TokensPanel.tsx) não enxerga a
-- receita de pacote avulso de nenhuma empresa que não seja a própria.

DROP POLICY IF EXISTS "token_pack_purchases_select" ON public.pilar_token_pack_purchases;
CREATE POLICY "token_pack_purchases_select" ON public.pilar_token_pack_purchases
  FOR SELECT USING (empresa_id = public.get_user_empresa_id() OR public.is_ultra_admin());
