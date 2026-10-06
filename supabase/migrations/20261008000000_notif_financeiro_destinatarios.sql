-- Notificação financeira só para quem pode ver financeiro.
--
-- _notif_ve_financeiro (20260817000100) excluía 'coordenador'/'colaborador'
-- do modelo antigo de papéis. Desde o ADR 0034 (20260870000000) o papel comum
-- é 'user', que não estava na lista: todo membro passou a receber "A receber",
-- "A pagar", recebimento atrasado, orçamento excedido e aditivo pronto, com
-- valores, no sino e no e-mail. E o coordenador com financeiro delegado, que
-- pode ver, ficava de fora.
--
-- Agora espelha can_view_financeiro() (20260904000000): admin/owner/
-- ultra_admin ou financeiro_delegado. Mesma assinatura, então CREATE OR
-- REPLACE mantém os grants.

CREATE OR REPLACE FUNCTION public._notif_ve_financeiro(p_empresa uuid)
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(array_agg(id), '{}')
  FROM public.profiles
  WHERE empresa_id = p_empresa
    AND (role IN ('admin', 'owner', 'ultra_admin') OR financeiro_delegado);
$$;

COMMENT ON FUNCTION public._notif_ve_financeiro(uuid) IS
  'Destinatários de notificação financeira: espelha can_view_financeiro() (admin/owner/ultra_admin ou financeiro_delegado).';

-- Remove o que já foi entregue a quem não pode ver. Toda notificação de
-- categoria financeiro sai de _notif_ve_financeiro ou _notif_gestao, então
-- quem não passa no filtro acima nunca deveria ter recebido. Apagar (e não
-- arquivar) também tira da fila de e-mail o que ainda não foi enviado.
DELETE FROM public.notificacoes n
USING public.profiles p
WHERE p.id = n.destinatario_id
  AND n.categoria = 'financeiro'
  AND NOT (p.role IN ('admin', 'owner', 'ultra_admin') OR p.financeiro_delegado);
