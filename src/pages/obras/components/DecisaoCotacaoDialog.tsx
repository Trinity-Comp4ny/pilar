import { useMemo } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BusyMark } from "@/components/motion/BusyMark";
import { useMoneyMask } from "@/hooks/useMoneyMask";
import { usePermissions } from "@/hooks/usePermissions";
import { nomeFornecedorProposta, realizadoPorEtapa } from "@/lib/obras";
import {
  useDecidirCotacao,
  type CotacaoComPropostas,
  type PropostaComFornecedor,
} from "@/pages/obras/hooks/useObraCotacoes";
import { useObraFrentes } from "@/pages/obras/hooks/useObraFrentes";
import { useObraOrcamento } from "@/pages/obras/hooks/useObraOrcamento";
import { useObraConta } from "@/pages/obras/hooks/useObraConta";
import { saldoDaCompra } from "@/pages/obras/lib/saldoOrcamento";

const hoje = () => new Date().toISOString().slice(0, 10);

/** Confirma a escolha da vencedora e oferece lançar direto como despesa na conta da obra. */
export function DecisaoCotacaoDialog({
  open,
  onOpenChange,
  obraId,
  cotacao,
  proposta,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  obraId: string;
  cotacao: CotacaoComPropostas;
  proposta: PropostaComFornecedor;
  onDone: () => void;
}) {
  const formatCurrency = useMoneyMask();
  const decidir = useDecidirCotacao(obraId);
  const { data: nos = [] } = useObraFrentes(obraId);
  const { data: orcamento = [] } = useObraOrcamento(obraId);
  const { data: lancamentos = [] } = useObraConta(obraId);
  const saldo = useMemo(
    () =>
      saldoDaCompra(
        cotacao.obra_frente_id,
        Number(proposta.valor),
        nos,
        new Map(orcamento.map((o) => [o.obra_frente_id, Number(o.valor_previsto)])),
        realizadoPorEtapa(lancamentos.filter((l) => !l.deleted_at))
      ),
    [cotacao.obra_frente_id, proposta.valor, nos, orcamento, lancamentos]
  );
  // Lançar na conta da obra é escrita financeira (ADR 0046): o banco recusa sem acesso.
  const podeLancarDespesa = usePermissions().can("financeiro");

  const decidirCom = async (lancarDespesa: boolean) => {
    try {
      await decidir.mutateAsync({
        cotacaoId: cotacao.id,
        proposta,
        cotacaoDescricao: cotacao.descricao,
        obraFrenteId: cotacao.obra_frente_id,
        lancarDespesa,
        data: hoje(),
      });
      toast.success(lancarDespesa ? "Vencedora escolhida e despesa lançada" : "Vencedora escolhida");
      onDone();
    } catch (e) {
      toast.error("Não foi possível decidir", { description: e instanceof Error ? e.message : "Tente novamente" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Escolher vencedora</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          {nomeFornecedorProposta(proposta)} por{" "}
          <span className="font-semibold text-ink">{formatCurrency(Number(proposta.valor))}</span> vence a cotação de{" "}
          {cotacao.descricao}.
        </p>
        <p className="text-sm text-muted-foreground">
          {podeLancarDespesa
            ? "Você pode só marcar a vencedora, ou já lançar o valor como despesa na conta da obra."
            : "A vencedora fica marcada. O lançamento na conta da obra é feito por quem tem acesso ao financeiro."}
        </p>

        {saldo && (
          <dl aria-label="Saldo do orçamento" className="space-y-1 rounded-md border border-border p-3 text-sm">
            <p className="text-xs text-muted-foreground">Orçamento de {saldo.caminho}</p>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Saldo antes da compra</dt>
              <dd>{formatCurrency(saldo.saldoAntes)}</dd>
            </div>
            <div className="flex justify-between font-medium">
              <dt>Saldo depois</dt>
              <dd data-testid="saldo-apos" className={saldo.estoura ? "text-danger-strong" : "text-positive-strong"}>
                {formatCurrency(saldo.saldoApos)}
              </dd>
            </div>
            {saldo.estoura && <p className="text-xs text-danger-strong">Esta compra estoura o orçamento.</p>}
          </dl>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={() => decidirCom(false)} disabled={decidir.isPending}>
            {decidir.isPending && <BusyMark className="mr-1.5 h-4 w-4" />}
            Só marcar vencedora
          </Button>
          {podeLancarDespesa && (
            <Button type="button" variant="brand" onClick={() => decidirCom(true)} disabled={decidir.isPending}>
              {decidir.isPending && <BusyMark className="mr-1.5 h-4 w-4" />}
              Marcar e lançar despesa
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
