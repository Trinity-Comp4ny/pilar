-- admin_audit_logs.actor_id era NOT NULL, mas ações automáticas do sistema (cron,
-- webhook) não têm ator humano por trás. Achado testando o checkout de assinatura
-- ponta a ponta em sandbox (2026-09-01): `pilar-checkout-webhook` (invite_dispatch_failed)
-- e `trial-expiry-cron` (2 pontos) já tentavam inserir actor_id: null — o INSERT
-- falhava em silêncio (o código não checava o erro desse insert de auditoria),
-- então essas falhas nunca apareciam em admin_audit_logs, só no Sentry.
--
-- actor_id NULL passa a significar "ação do sistema", não "operador desconhecido".

ALTER TABLE public.admin_audit_logs ALTER COLUMN actor_id DROP NOT NULL;
