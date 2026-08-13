import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ContaItem, CartaoItem } from "../hooks/useContasCartoes";

interface CartaoDetailPanelProps {
  cartao: CartaoItem;
  contas: ContaItem[];
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export function CartaoDetailPanel({ cartao, contas, canEdit, onEdit, onDelete }: CartaoDetailPanelProps) {
  const pct = cartao.limite ? (cartao.usado / cartao.limite) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{cartao.nome}</h2>
            <Badge variant="outline" className="text-xs">
              {cartao.tipo === "debito" ? "Débito" : "Crédito"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Fecha dia {cartao.dia_fechamento} · Vence dia {cartao.dia_vencimento}
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="outline" className="h-9 rounded-full text-sm" onClick={onEdit}>
              <Pencil className="h-4 w-4 mr-1.5" /> Editar
            </Button>
            <Button
              variant="outline"
              className="h-9 rounded-full text-sm text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4 mr-1.5" /> Excluir
            </Button>
          </div>
        )}
      </div>

      <div className="border-t pt-5">
        <p className="text-xs text-muted-foreground mb-1">Disponível</p>
        <p className="text-3xl font-bold text-positive-strong">
          R$ {cartao.disponivel?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            Utilizado:{" "}
            <span className="font-medium text-foreground">
              R$ {cartao.usado?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
          </span>
          <span className="text-muted-foreground">
            Limite:{" "}
            <span className="font-medium text-foreground">
              R$ {cartao.limite?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
          </span>
        </div>
        <div className="w-full bg-muted rounded-full h-2.5">
          <div
            className={cn(
              "h-2.5 rounded-full transition-all",
              pct > 80 ? "bg-danger-strong" : pct > 50 ? "bg-warning-mid" : "bg-positive"
            )}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">{pct.toFixed(1)}% utilizado</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 rounded-lg bg-muted/50 border">
          <p className="text-xs text-muted-foreground mb-1">Fechamento</p>
          <p className="text-sm font-semibold">Dia {cartao.dia_fechamento}</p>
        </div>
        <div className="p-4 rounded-lg bg-muted/50 border">
          <p className="text-xs text-muted-foreground mb-1">Vencimento</p>
          <p className="text-sm font-semibold">Dia {cartao.dia_vencimento}</p>
        </div>
      </div>

      {cartao.conta_pagamento_id && (
        <div className="p-4 rounded-lg bg-muted/50 border">
          <p className="text-xs text-muted-foreground mb-1">Conta para pagamento de faturas</p>
          <p className="text-sm font-medium">
            {contas.find((c) => c.id === cartao.conta_pagamento_id)?.nome ?? "—"}
          </p>
        </div>
      )}
    </div>
  );
}
