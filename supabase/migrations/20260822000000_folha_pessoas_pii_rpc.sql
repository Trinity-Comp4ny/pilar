-- CPF/PIX no comprovante da folha, sem furar a proteção de coluna.
--
-- As colunas pessoas.cpf e pessoas.chaves_pix têm GRANT só para service_role
-- (PII), então o front (role authenticated) não pode lê-las direto. Este RPC
-- SECURITY DEFINER as devolve de forma controlada: só para pessoas da própria
-- empresa e só se o chamador tiver a feature financeiro. Chamado sob demanda,
-- no momento de gerar o comprovante, não no carregamento da folha.
DROP FUNCTION IF EXISTS public.get_folha_pessoas_pii(uuid[]);

CREATE FUNCTION public.get_folha_pessoas_pii(p_ids uuid[])
 RETURNS TABLE(pessoa_id uuid, cpf text, chaves_pix jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_empresa_id uuid;
BEGIN
  v_empresa_id := public.get_user_empresa_id();

  -- Sem empresa ou sem acesso ao financeiro: não devolve PII nenhuma.
  IF v_empresa_id IS NULL OR NOT public.user_has_feature('financeiro', 'viewer') THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT pe.id, pe.cpf, pe.chaves_pix
  FROM public.pessoas pe
  WHERE pe.id = ANY(p_ids)
    AND pe.empresa_id = v_empresa_id;
END;
$function$
;

ALTER FUNCTION public.get_folha_pessoas_pii(uuid[]) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_folha_pessoas_pii(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_folha_pessoas_pii(uuid[]) TO authenticated;
