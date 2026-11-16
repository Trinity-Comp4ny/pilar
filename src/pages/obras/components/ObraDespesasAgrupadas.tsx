import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ViewSwitcher, type ViewOption } from "@/components/ViewSwitcher";
import { useMoneyMask } from "@/hooks/useMoneyMask";
import { agruparDespesas, type DespesaAgrupavel } from "@/pages/obras/lib/despesasAgrupadas";

type Por = "fornecedor" | "item";
const OPCOES: ViewOption<Por>[] = [
  { value: "fornecedor", label: "Por fornecedor" },
  { value: "item", label: "Por item" },
];

/** Onde o dinheiro da obra foi: despesas somadas por fornecedor ou por item comprado. */
export function ObraDespesasAgrupadas({
  lancamentos,
  nomeFornecedor,
}: {
  lancamentos: ReadonlyArray<DespesaAgrupavel>;
  nomeFornecedor: ReadonlyMap<string, string>;
}) {
  const formatCurrency = useMoneyMask();
  const [por, setPor] = useState<Por>("fornecedor");
  const grupos = useMemo(() => agruparDespesas(lancamentos, por, nomeFornecedor), [lancamentos, por, nomeFornecedor]);
  const total = grupos.reduce((a, g) => a + g.total, 0);
  if (grupos.length === 0) return null;

  return (
    <Card className="rounded-2xl border border-black/5 bg-white">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-medium text-ink">Onde o dinheiro foi</h3>
            <p className="text-xs text-muted-foreground">Despesas da obra somadas por {por}.</p>
          </div>
          <ViewSwitcher options={OPCOES} value={por} onChange={setPor} ariaLabel="Agrupar despesas" />
        </div>
        <ul className="divide-y divide-black/5">
          {grupos.map((g) => (
            <li key={g.chave} className="flex items-center gap-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate text-ink">{g.rotulo}</p>
                <p className="text-xs text-muted-foreground">
                  {g.lancamentos} {g.lancamentos === 1 ? "lançamento" : "lançamentos"}
                  {g.quantidade != null &&
                    ` · ${g.quantidade.toLocaleString("pt-BR")}${g.unidade ? ` ${g.unidade}` : ""}`}
                  {total > 0 && ` · ${Math.round((g.total / total) * 100)}%`}
                </p>
              </div>
              <span className="tabular-nums text-ink">{formatCurrency(g.total)}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
