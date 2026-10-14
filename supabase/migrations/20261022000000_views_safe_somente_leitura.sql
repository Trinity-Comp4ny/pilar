-- Views *_safe são só de leitura.
--
-- leads_safe, projetos_safe, pessoas_safe e escopos_safe existem para mascarar
-- coluna (valor, custo, dado pessoal) conforme o papel de quem lê. O app só faz
-- SELECT nelas; toda escrita vai direto na tabela, onde valem as policies de
-- editor. Nenhuma edge function usa estas views.
--
-- Elas rodam como dona (sem security_invoker), então o grant de escrita herdado
-- do default do schema não tem papel nenhum aqui e sai. Leitura fica só para
-- authenticated: anon nunca teve uso (o filtro por empresa devolve zero linha).
--
-- Migration isolada de propósito: só grants, sem dependência de outra migration,
-- pode ser aplicada sozinha pelo workflow de hotfix.

REVOKE ALL ON public.leads_safe, public.projetos_safe, public.pessoas_safe, public.escopos_safe
  FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.leads_safe, public.projetos_safe, public.pessoas_safe, public.escopos_safe
  TO authenticated;
