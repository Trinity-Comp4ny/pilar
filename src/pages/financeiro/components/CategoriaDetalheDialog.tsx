import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useMoneyMask } from "@/hooks/useMoneyMask";
import { cn } from "@/lib/utils";

export interface CategoriaDetalhe {
  name: string;
  value: number;
  color: string;
  count: number;
}

interface CategoriaDetalheDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  titulo: string;
  descricao: string;
  tone: "positive" | "danger";
  data: CategoriaDetalhe[];
}

export function CategoriaDetalheDialog({
  open,
  onOpenChange,
  titulo,
  descricao,
  tone,
  data,
}: CategoriaDetalheDialogProps) {
  const formatCurrency = useMoneyMask();
  const ordered = [...data].sort((a, b) => b.value - a.value);
  const total = ordered.reduce((acc, c) => acc + c.value, 0);
  const totalCount = ordered.reduce((acc, c) => acc + c.count, 0);
  const valueColor = tone === "positive" ? "text-positive-strong" : "text-negative-strong";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>
        {ordered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Sem registros no período</p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/5 text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="py-2 text-left font-medium">Categoria</th>
                  <th className="py-2 text-right font-medium">Lanç.</th>
                  <th className="py-2 text-right font-medium">Valor</th>
                  <th className="py-2 text-right font-medium">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {ordered.map((c) => (
                  <tr key={c.name}>
                    <td className="py-2.5">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: c.color }} />
                        <span className="truncate">{c.name}</span>
                      </span>
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-muted-foreground">{c.count}</td>
                    <td className={cn("py-2.5 text-right font-semibold tabular-nums whitespace-nowrap", valueColor)}>
                      {formatCurrency(c.value)}
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-muted-foreground">
                      {total > 0 ? ((c.value / total) * 100).toFixed(1) : "0.0"}%
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-black/10 font-semibold">
                  <td className="py-2.5">Total</td>
                  <td className="py-2.5 text-right tabular-nums">{totalCount}</td>
                  <td className={cn("py-2.5 text-right tabular-nums whitespace-nowrap", valueColor)}>
                    {formatCurrency(total)}
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-muted-foreground">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
