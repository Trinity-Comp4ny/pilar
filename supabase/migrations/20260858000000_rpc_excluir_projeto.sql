-- Excluir/restaurar projeto via RPC (fix do 42501 reportado pela VRZ em 22/08).
--
-- O soft delete era um UPDATE client-side (`deleted_at = now()`) direto em
-- projetos. Só que a policy projetos_select tem `deleted_at IS NULL`, e o
-- Postgres re-checa a linha NOVA de um UPDATE contra o USING das policies de
-- SELECT quando o comando também lê a tabela (WHERE): a linha recém-deletada
-- fica invisível no mesmo instante e o banco responde
-- "new row violates row-level security policy for table projetos" (42501)
-- para QUALQUER usuário, admin incluso. O "Desfazer" tinha o problema
-- espelhado: a linha soft-deletada não passa no SELECT, então o restore
-- nunca encontrava o que restaurar.
--
-- Mesmo remédio já usado em transferencias (rpc_excluir_transferencia):
-- SECURITY DEFINER com tenant check explícito, fora do alcance do re-check
-- de RLS. O acesso segue a mesma régua da policy de escrita
-- (user_has_feature('projetos','editor') — pós ADR 0029, role + módulo da
-- empresa), então a RPC não abre nada que o UPDATE direto não deveria
-- permitir.
--
-- Follow-up registrado na memória do projeto: mais 16 tabelas têm SELECT
-- policy com `deleted_at IS NULL`; auditar quais ainda soft-deletam por
-- UPDATE client-side.

CREATE OR REPLACE FUNCTION public.rpc_excluir_projeto(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa UUID := public.get_user_empresa_id();
BEGIN
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa';
  END IF;

  IF NOT public.user_has_feature('projetos', 'editor') THEN
    RAISE EXCEPTION 'Sem acesso ao módulo Projetos';
  END IF;

  -- updated_at/updated_by ficam por conta do trigger tr_audit_projetos.
  UPDATE public.projetos
  SET deleted_at = NOW()
  WHERE id = p_id AND empresa_id = v_empresa AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Projeto não encontrado';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_excluir_projeto(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_excluir_projeto(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.rpc_restaurar_projeto(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa UUID := public.get_user_empresa_id();
BEGIN
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa';
  END IF;

  IF NOT public.user_has_feature('projetos', 'editor') THEN
    RAISE EXCEPTION 'Sem acesso ao módulo Projetos';
  END IF;

  UPDATE public.projetos
  SET deleted_at = NULL
  WHERE id = p_id AND empresa_id = v_empresa AND deleted_at IS NOT NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Projeto não encontrado';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_restaurar_projeto(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_restaurar_projeto(UUID) TO authenticated;
