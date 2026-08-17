import type { ReactNode } from "react";
import { formatCurrency } from "@/lib/format";
import { CreditCard, Wallet } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/utils";
import type { ContaItem, CartaoItem } from "../hooks/useContasCartoes";
import type { Fatura } from "../hooks/useFaturas";
import { vencimentoRelativo } from "./faturaHelpers";

const fmtCompactBRL = { format: (v: number) => formatCurrency(v, { compact: true }) };

interface ContasSidebarProps {
  contas: ContaItem[];
  cartoes: CartaoItem[];
  faturasPendentes: Fatura[];
  panelConta: ContaItem | null;
  panelCartao: CartaoItem | null;
  onSelectConta: (conta: ContaItem) => void;
  onSelectCartao: (cartao: CartaoItem) => void;
  contaDialog: ReactNode;
}

// Próxima fatura em aberto por cartão. faturasPendentes já vem ordenada por
// vencimento asc, então o primeiro match de cada cartão é o mais próximo.
function proximaFaturaPorCartao(faturas: Fatura[]): Map<string, Fatura> {
  const map = new Map<string, Fatura>();
  for (const f of faturas) {
    if (!map.has(f.cartao_id)) map.set(f.cartao_id, f);
  }
  return map;
}

function CartaoRow({
  cartao,
  fatura,
  active,
  onSelect,
  nested,
}: {
  cartao: CartaoItem;
  fatura: Fatura | undefined;
  active: boolean;
  onSelect: () => void;
  nested?: boolean;
}) {
  const pct = cartao.limite ? (cartao.usado / cartao.limite) * 100 : 0;
  const venc = fatura ? vencimentoRelativo(fatura.status, fatura.data_vencimento) : null;

  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left px-3 py-2.5 rounded-lg transition-colors",
        nested && "pl-8",
        active ? "bg-brand text-black/80 font-medium" : "hover:bg-muted text-foreground"
      )}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <CreditCard className="h-3.5 w-3.5 shrink-0 opacity-60" />
        <span className="text-sm font-medium truncate flex-1">{cartao.nome}</span>
        {venc && (
          <span
            className={cn(
              "text-[10px] shrink-0 rounded-full px-1.5 py-0.5 leading-none",
              venc.vencida ? "bg-danger-soft text-danger-strong" : "bg-black/5 text-muted-foreground"
            )}
          >
            {venc.label}
          </span>
        )}
      </div>
      <div className="w-full bg-muted rounded-full h-1">
        <div
          className={cn(
            "h-1 rounded-full transition-all",
            pct > 80 ? "bg-danger-strong" : pct > 50 ? "bg-warning-mid" : "bg-positive"
          )}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </button>
  );
}

export function ContasSidebar({
  contas,
  cartoes,
  faturasPendentes,
  panelConta,
  panelCartao,
  onSelectConta,
  onSelectCartao,
  contaDialog,
}: ContasSidebarProps) {
  const faturaPorCartao = proximaFaturaPorCartao(faturasPendentes);
  const contaIds = new Set(contas.map((c) => c.id));

  const cartoesPorConta = new Map<string, CartaoItem[]>();
  const orfaos: CartaoItem[] = [];
  for (const cartao of cartoes) {
    const contaId = cartao.conta_pagamento_id;
    if (contaId && contaIds.has(contaId)) {
      const list = cartoesPorConta.get(contaId) ?? [];
      list.push(cartao);
      cartoesPorConta.set(contaId, list);
    } else {
      orfaos.push(cartao);
    }
  }

  return (
    <div className="w-72 shrink-0 border-r flex flex-col">
      {/* Contas + cartões aninhados */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Wallet className="h-3.5 w-3.5" /> Contas
          </span>
          {contaDialog}
        </div>
        <div className="space-y-1">
          {contas.map((conta) => {
            const cartoesDaConta = cartoesPorConta.get(conta.id) ?? [];
            const contaAtiva = panelConta?.id === conta.id && !panelCartao;
            return (
              <div key={conta.id}>
                <button
                  onClick={() => onSelectConta(conta)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-2.5",
                    contaAtiva ? "bg-brand text-black/80 font-medium" : "hover:bg-muted text-foreground"
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
                {cartoesDaConta.map((cartao) => (
                  <CartaoRow
                    key={cartao.id}
                    cartao={cartao}
                    fatura={faturaPorCartao.get(cartao.id)}
                    active={panelCartao?.id === cartao.id && !panelConta}
                    onSelect={() => onSelectCartao(cartao)}
                    nested
                  />
                ))}
              </div>
            );
          })}
          {contas.length === 0 && (
            <EmptyState
              icon={Wallet}
              title="Nenhuma conta cadastrada"
              description="Cadastre uma conta para começar a organizar saldos e cartões."
              className="py-8 px-3"
            />
          )}
        </div>
      </div>

      {/* Cartões sem conta de pagamento vinculada (só aparece se existirem) */}
      {orfaos.length > 0 && (
        <div className="p-4">
          <div className="mb-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5" /> Sem conta vinculada
            </span>
          </div>
          <div className="space-y-1">
            {orfaos.map((cartao) => (
              <CartaoRow
                key={cartao.id}
                cartao={cartao}
                fatura={faturaPorCartao.get(cartao.id)}
                active={panelCartao?.id === cartao.id && !panelConta}
                onSelect={() => onSelectCartao(cartao)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
