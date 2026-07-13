-- Onda 1 — Portal: aprovar proposta de forma ATÔMICA.
-- Antes: a edge function portal-aprovar-proposta fazia dois UPDATEs sequenciais
-- (propostas→'aceita' e depois projetos→'Planejamento'). Se o 2º falhasse, a proposta
-- ficava 'aceita' e o projeto 'enviada'/anterior; o retry batia no filtro status='enviada'
-- e retornava 422 → cliente travado, sem forma de reaprovar.
-- Fix: uma RPC plpgsql (transação única) que muda os dois estados de uma vez. Guarda o
-- status da proposta ('enviada') dentro da transação para evitar dupla-aprovação em corrida.
-- Se qualquer passo falhar, TUDO faz rollback → proposta volta a 'enviada' → retry funciona.

CREATE OR REPLACE FUNCTION public.portal_aprovar_proposta_atomica(
  p_proposta_id uuid,
  p_projeto_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_afetadas integer;
BEGIN
  UPDATE propostas
  SET status = 'aceita', updated_at = now()
  WHERE id = p_proposta_id AND status = 'enviada' AND deleted_at IS NULL;
  GET DIAGNOSTICS v_afetadas = ROW_COUNT;

  IF v_afetadas = 0 THEN
    RAISE EXCEPTION 'Proposta % não está no status enviada (pode já ter sido processada)', p_proposta_id
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE projetos
  SET status = 'Planejamento', updated_at = now()
  WHERE id = p_projeto_id AND deleted_at IS NULL;
  GET DIAGNOSTICS v_afetadas = ROW_COUNT;

  IF v_afetadas = 0 THEN
    RAISE EXCEPTION 'Projeto % não encontrado para avançar status', p_projeto_id
      USING ERRCODE = 'P0002';
  END IF;
END;
$fn$;

-- A edge function chama com service_role (bypassa RLS); mantém SECURITY DEFINER por segurança.
GRANT EXECUTE ON FUNCTION public.portal_aprovar_proposta_atomica(uuid, uuid) TO service_role;
