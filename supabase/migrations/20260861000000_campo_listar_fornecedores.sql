-- Pilar Campo (spec 042) ganha uma lista de fornecedores pra alimentar os
-- combobox de efetivo/visita da spec 062. A conta de campo não tem acesso
-- direto à tabela (sem auth.uid), então é RPC no mesmo padrão de
-- campo_listar_tarefas.

CREATE OR REPLACE FUNCTION public.campo_listar_fornecedores(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_acc  public.campo_accounts;
  v_rows json;
BEGIN
  SELECT * INTO v_acc
  FROM public.campo_accounts
  WHERE token_sessao = encode(extensions.digest(p_token, 'sha256'), 'hex')
    AND ativo = true AND token_expira_em > now()
  LIMIT 1;
  IF v_acc.id IS NULL THEN
    RETURN json_build_object('ok', false, 'erro', 'Sessão inválida');
  END IF;

  SELECT coalesce(json_agg(f ORDER BY f.nome ASC), '[]'::json) INTO v_rows
  FROM (
    SELECT id, nome, cnpj
    FROM public.fornecedores
    WHERE empresa_id = v_acc.empresa_id AND deleted_at IS NULL
  ) f;

  RETURN json_build_object('ok', true, 'fornecedores', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.campo_listar_fornecedores(text) FROM public;
GRANT EXECUTE ON FUNCTION public.campo_listar_fornecedores(text) TO anon, authenticated;
