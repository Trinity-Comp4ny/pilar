import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useMoneyMask } from "@/hooks/useMoneyMask";
import { cn } from "@/lib/utils";
import { valorDaColuna, type ColunaGrade, type FisicoFinanceiro } from "@/pages/obras/lib/fisicoFinanceiro";

interface Props {
  ff: FisicoFinanceiro;
  colunas: ColunaGrade[];
}

/** Físico-financeiro no celular (spec 165): um cartão por mês com o total, o acumulado e as fases; abrir mostra as etapas. Só leitura. */
export function FisicoFinanceiroLista({ ff, colunas }: Props) {
  const formatCurrency = useMoneyMask();
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const alternar = (k: string) =>
    setAbertos((a) => {
      const n = new Set(a);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  return (
    <ul className="space-y-2" aria-label="Desembolso previsto por mês">
      {colunas.map((c) => {
        const ultimo = c.meses[c.meses.length - 1];
        const acumulado = ultimo ? (ff.acumuladoPorMes[ultimo] ?? 0) : 0;
        const aberto = abertos.has(c.chave);
        const linhas = ff.linhas
          .filter((l) => l.nivel !== "servico" && valorDaColuna(l.porMes, c) > 0)
          .filter((l) => aberto || l.nivel === "fase");
        return (
          <li key={c.chave} className="rounded-2xl border border-black/5 bg-white p-4" data-testid={`ffl-${c.chave}`}>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 text-left"
              aria-expanded={aberto}
              aria-label={`${aberto ? "Recolher" : "Expandir"} ${c.rotulo}`}
              onClick={() => alternar(c.chave)}
            >
              <span>
                <span className="block text-sm font-medium text-ink">{c.rotulo}</span>
                <span className="block text-xs text-muted-foreground">Acumulado {formatCurrency(acumulado)}</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="text-base font-semibold tabular-nums text-ink">
                  {formatCurrency(valorDaColuna(ff.totalPorMes, c))}
                </span>
                <ChevronDown className={cn("h-4 w-4 transition-transform", aberto && "rotate-180")} aria-hidden />
              </span>
            </button>
            {linhas.length > 0 && (
              <ul className="mt-3 space-y-1 border-t border-black/5 pt-2">
                {linhas.map((l) => (
                  <li
                    key={l.id}
                    className={cn(
                      "flex justify-between gap-2 text-sm",
                      l.nivel === "etapa" && "pl-3 text-muted-foreground"
                    )}
                  >
                    <span className="truncate">{l.nome}</span>
                    <span className="tabular-nums">{formatCurrency(valorDaColuna(l.porMes, c))}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
