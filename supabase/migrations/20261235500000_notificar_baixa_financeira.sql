-- Financeiro: avisa na central quando uma despesa é paga ou uma receita é recebida.
--
-- Até aqui a central só avisava vencimento próximo e atraso. Quem não vive dentro
-- do Financeiro não via a baixa acontecer (a própria, a de outra pessoa ou a
-- conciliação do extrato). Agora a mudança de status para Pago/Recebido gera uma
-- notificação para quem pode ver dinheiro (mesmo roteamento do gerador diário),
-- exceto a pessoa que deu a baixa: ela acabou de ver.
--
-- Só UPDATE de status: lançamento que já nasce pago (importação) não dispara, para
-- não inundar a central. A deduplicação é a do notificar() (não empilha não lida).

CREATE OR REPLACE FUNCTION public._notificar_baixa_financeira()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_receita boolean := (TG_TABLE_NAME = 'receitas');
  v_dest uuid[];
  v_ator uuid := auth.uid();
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(array_agg(d), '{}') INTO v_dest
  FROM unnest(public._notif_ve_financeiro(NEW.empresa_id)) AS d
  WHERE d IS DISTINCT FROM v_ator;

  PERFORM public.notificar(
    NEW.empresa_id, v_dest,
    CASE WHEN v_receita THEN 'receita_recebida' ELSE 'despesa_paga' END,
    'financeiro', 'low',
    CASE WHEN v_receita THEN 'Recebido: ' ELSE 'Pago: ' END || COALESCE(NEW.descricao, '(sem descrição)'),
    'R$ ' || to_char(NEW.valor, 'FM999999990.00')
      || CASE WHEN v_receita THEN ' entrou' ELSE ' saiu' END
      || COALESCE(' em ' || to_char((to_jsonb(NEW) ->> CASE WHEN v_receita THEN 'data_recebimento' ELSE 'data_pagamento' END)::date, 'DD/MM/YYYY'), ''),
    CASE WHEN v_receita THEN 'receita' ELSE 'despesa' END, NEW.id, '/gestao/financeiro');
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._notificar_baixa_financeira() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS tr_notificar_baixa_despesas ON public.despesas;
CREATE TRIGGER tr_notificar_baixa_despesas
  AFTER UPDATE OF status ON public.despesas
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'Pago')
  EXECUTE FUNCTION public._notificar_baixa_financeira();

DROP TRIGGER IF EXISTS tr_notificar_baixa_receitas ON public.receitas;
CREATE TRIGGER tr_notificar_baixa_receitas
  AFTER UPDATE OF status ON public.receitas
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'Recebido')
  EXECUTE FUNCTION public._notificar_baixa_financeira();
