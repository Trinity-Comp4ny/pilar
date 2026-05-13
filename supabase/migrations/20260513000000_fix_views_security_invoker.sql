-- Corrige views que rodam como owner (postgres) e bypassam RLS das tabelas base.
-- Sem security_invoker=true, Postgres 15 usa as permissões do dono da view,
-- permitindo que usuários autenticados vejam dados de outras empresas.

ALTER VIEW public.view_fatura_resumo   SET (security_invoker = true);
ALTER VIEW public.view_cartao_resumo   SET (security_invoker = true);
ALTER VIEW public.view_financas_resumo SET (security_invoker = true);
ALTER VIEW public.view_folha_pagamento SET (security_invoker = true);

DO $$
DECLARE v RECORD;
BEGIN
  FOR v IN
    SELECT c.relname, c.reloptions
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='public' AND c.relkind='v'
      AND c.relname IN ('view_fatura_resumo','view_cartao_resumo',
                        'view_financas_resumo','view_folha_pagamento')
  LOOP
    IF v.reloptions IS NULL
       OR NOT ('security_invoker=true' = ANY(v.reloptions)) THEN
      RAISE EXCEPTION 'View %.security_invoker NOT set', v.relname;
    END IF;
  END LOOP;
END$$;
