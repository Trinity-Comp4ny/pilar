-- MFA desligado por padrão para quem foi obrigado a ativar (ADR 0031).
--
-- O ADR 0031 tornou o MFA opcional em 20/08 (produção em 24/08, release #324),
-- mas só parou de empurrar contas NOVAS para /mfa/setup. Quem já tinha
-- cadastrado o TOTP no regime obrigatório continuou com o fator verificado e,
-- por isso, segue recebendo o desafio de código em todo login. Em produção eram
-- 8 contas, todas com fator criado antes de 24/08 e nenhuma por escolha própria.
--
-- Esta migration remove esses fatores (e os códigos de backup dessas contas),
-- deixando todo mundo no padrão: sem MFA, com a opção de ativar em
-- Configurações > Segurança. Fica de fora o ultra_admin, que continua exigindo
-- aal2 para o acesso cross-tenant (UltraAdminRoute). Fator criado depois do
-- corte foi ativado por escolha do usuário e também é preservado.
--
-- auth.mfa_challenges e auth.mfa_recovery_code_sets caem em cascata.

WITH alvo AS (
  SELECT f.id AS factor_id, f.user_id
  FROM auth.mfa_factors f
  WHERE f.created_at < '2026-08-25'
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = f.user_id AND p.role = 'ultra_admin'
    )
),
codigos AS (
  DELETE FROM public.mfa_backup_codes b
  USING (SELECT DISTINCT user_id FROM alvo) a
  WHERE b.user_id = a.user_id
)
DELETE FROM auth.mfa_factors f
USING alvo a
WHERE f.id = a.factor_id;
