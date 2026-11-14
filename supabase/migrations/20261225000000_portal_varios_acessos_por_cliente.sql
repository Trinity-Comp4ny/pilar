-- Portal do cliente: mais de um acesso por cliente (SPEC 164, fase 2).
--
-- O cliente quer dar acesso a outra pessoa (a esposa, o sócio da obra). Antes havia uma
-- conta de portal por cliente (UNIQUE cliente_id, empresa_id) e o convite recusava a
-- segunda. Agora cada e-mail é uma conta própria do mesmo cliente: cada pessoa recebe o
-- próprio convite, cria a própria senha e o escritório revoga uma sem derrubar as outras.
--
-- Continua valendo UNIQUE(empresa_id, email) (20260715000072): dentro do escritório um
-- e-mail é de um cliente só. O portal já resolve tudo pela sessão (conta -> cliente_id),
-- então nenhuma função do portal muda.

ALTER TABLE public.cliente_portal_accounts
  DROP CONSTRAINT IF EXISTS cliente_portal_accounts_cliente_id_empresa_id_key;

COMMENT ON TABLE public.cliente_portal_accounts IS
  'Acessos ao portal do cliente: um por e-mail, vários por cliente (SPEC 164). E-mail único por empresa.';
