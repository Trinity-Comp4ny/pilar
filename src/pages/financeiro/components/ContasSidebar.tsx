import type { ReactNode } from "react";
import { CreditCard, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ContaItem, CartaoItem } from "../hooks/useContasCartoes";

const fmtCompactBRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

interface ContasSidebarProps {
  contas: ContaItem[];
  cartoes: CartaoItem[];
  panelConta: ContaItem | null;
  panelCartao: CartaoItem | null;
  onSelectConta: (conta: ContaItem) => void;
  onSelectCartao: (cartao: CartaoItem) => void;
  contaDialog: ReactNode;
  cartaoDialog: ReactNode;
}

export function ContasSidebar({
  contas,
  cartoes,
  panelConta,
  panelCartao,
  onSelectConta,
  onSelectCartao,
  contaDialog,
  cartaoDialog,
}: ContasSidebarProps) {
  return (
    <div className="w-64 shrink-0 border-r flex flex-col">
      {/* Contas */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Wallet className="h-3.5 w-3.5" /> Contas
          </span>
          {contaDialog}
        </div>
        <div className="space-y-0.5">
          {contas.map((conta) => (
            <button
              key={conta.id}
              onClick={() => onSelectConta(conta)}
              className={cn(
                "w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-2.5",
                panelConta?.id === conta.id && !panelCartao
                  ? "bg-brand text-white font-medium"
                  : "hover:bg-muted text-foreground"
              )}
            >
              <div
                className="w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                style={{ backgroundColor: conta.cor || "hsl(var(--chart-neutral))" }}
              >
                {conta.banco ? conta.banco.substring(0, 2).toUpperCase() : "??"}
              </div>
              <span className="text-sm font-medium truncate flex-1">{conta.nome}</span>
              <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                {fmtCompactBRL.format(conta.saldo_atual)}
              </span>
            </button>
          ))}
          {contas.length === 0 && <p className="text-xs text-muted-foreground px-3 py-2">Nenhuma conta cadastrada</p>}
        </div>
      </div>

      {/* Cartões */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <CreditCard className="h-3.5 w-3.5" /> Cartões
          </span>
          {cartaoDialog}
        </div>
        <div className="space-y-0.5">
          {cartoes.map((cartao) => {
            const pct = cartao.limite ? (cartao.usado / cartao.limite) * 100 : 0;
            return (
              <button
                key={cartao.id}
                onClick={() => onSelectCartao(cartao)}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-lg transition-colors",
                  panelCartao?.id === cartao.id && !panelConta
                    ? "bg-brand text-white font-medium"
                    : "hover:bg-muted text-foreground"
                )}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium truncate">{cartao.nome}</span>
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0 ml-2">{pct.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-1">
                  <div
                    className={cn(
                      "h-1 rounded-full transition-all",
                      pct > 80 ? "bg-red-500" : pct > 50 ? "bg-yellow-500" : "bg-positive"
                    )}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </button>
            );
          })}
          {cartoes.length === 0 && <p className="text-xs text-muted-foreground px-3 py-2">Nenhum cartão cadastrado</p>}
        </div>
      </div>
    </div>
  );
}
