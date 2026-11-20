import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";
import { climaLabel, condicaoLabel } from "@/lib/obras";
import type { RdoRow } from "@/pages/obras/hooks/useObraRdo";
import type { PeriodoRelatorio } from "@/pages/obras/lib/relatorioDiario";

/** Imprime só o relatório (o resto da tela some no papel). */
const CSS_IMPRESSAO = `
@media print {
  body * { visibility: hidden !important; }
  #relatorio-diario, #relatorio-diario * { visibility: visible !important; }
  #relatorio-diario { position: absolute; left: 0; top: 0; width: 100%; padding: 16px; }
  .sem-impressao { display: none !important; }
}`;

const Campo = ({ titulo, texto }: { titulo: string; texto: string | null }) =>
  texto ? (
    <div>
      <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">{titulo}</p>
      <p className="whitespace-pre-wrap text-sm text-ink/90">{texto}</p>
    </div>
  ) : null;

/** Diário de obra de um período, pronto para imprimir ou salvar em PDF e mandar ao cliente. */
export function RelatorioDiarioDialog({
  open,
  onOpenChange,
  obraNome,
  periodo,
  rdos,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  obraNome: string;
  periodo: PeriodoRelatorio;
  rdos: RdoRow[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <style>{CSS_IMPRESSAO}</style>
        <DialogHeader className="sem-impressao">
          <DialogTitle>Diário por período</DialogTitle>
          <DialogDescription>
            Confira antes de mandar. Imprima ou salve em PDF para enviar ao cliente.
          </DialogDescription>
        </DialogHeader>

        <div id="relatorio-diario" className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">{obraNome}</h2>
            <p className="text-xs text-muted-foreground">
              Diário de obra · {formatDate(periodo.de)} a {formatDate(periodo.ate)}
            </p>
          </div>

          {rdos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem registros neste período.</p>
          ) : (
            <ul className="space-y-3">
              {rdos.map((r) => {
                const meta = [climaLabel(r.clima), condicaoLabel(r.condicao_trabalho)].filter(Boolean).join(" · ");
                return (
                  <li key={r.id} className="space-y-2 rounded-xl border border-border bg-white p-3">
                    <p className="text-sm font-semibold text-ink">
                      {formatDate(r.data)}
                      {meta && <span className="font-normal text-muted-foreground">{` · ${meta}`}</span>}
                    </p>
                    <Campo titulo="Atividades" texto={r.atividades} />
                    <Campo titulo="Ocorrências" texto={r.ocorrencias} />
                    <Campo titulo="Pendências" texto={r.pendencias} />
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="sem-impressao flex justify-end">
          <Button variant="brand" onClick={() => window.print()}>
            <Printer className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Imprimir ou salvar em PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
