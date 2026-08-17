import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { TIPO_CHAVE_PIX_LABEL } from "@/lib/pixUtils";
import type { ContaItem } from "../hooks/useContasCartoes";

interface ContaDetailPanelProps {
  conta: ContaItem;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export function ContaDetailPanel({ conta, canEdit, onEdit, onDelete }: ContaDetailPanelProps) {
  const variacao = (conta.saldo_atual || 0) - (conta.saldo_inicial || 0);
  const pct = conta.saldo_inicial ? (variacao / conta.saldo_inicial) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold"
            style={{ backgroundColor: conta.cor || "hsl(var(--chart-neutral))" }}
          >
            {conta.banco ? conta.banco.substring(0, 2).toUpperCase() : "??"}
          </div>
          <div>
            <h2 className="text-lg font-semibold">{conta.nome}</h2>
            <p className="text-sm text-muted-foreground">{conta.banco}</p>
          </div>
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
        <p className="text-xs text-muted-foreground mb-1">Saldo Atual</p>
        <p className="text-3xl font-bold">
          R$ {conta.saldo_atual?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
        </p>
        <p className={cn("text-sm mt-1 flex items-center gap-1", variacao >= 0 ? "text-positive-strong" : "text-negative-strong")}>
          {variacao >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
          {variacao >= 0 ? "+" : ""}
          {pct.toFixed(1)}% em relação ao saldo inicial
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 rounded-lg bg-muted/50 border">
          <p className="text-xs text-muted-foreground mb-1">Saldo Inicial</p>
          <p className="text-sm font-semibold">
            R$ {conta.saldo_inicial?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="p-4 rounded-lg bg-positive/5 border border-positive/20">
          <p className="text-xs text-positive-strong mb-1">Entradas</p>
          <p className="text-sm font-semibold text-positive-strong">
            + R$ {conta.total_entradas?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="p-4 rounded-lg bg-negative/5 border border-negative/20">
          <p className="text-xs text-negative-strong mb-1">Saídas</p>
          <p className="text-sm font-semibold text-negative-strong">
            - R$ {conta.total_saidas?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {conta.chave_pix && (
        <div className="p-4 rounded-lg bg-muted/50 border">
          <p className="text-xs text-muted-foreground mb-1">Chave PIX</p>
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">{conta.chave_pix}</p>
            {conta.tipo_chave_pix && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                {TIPO_CHAVE_PIX_LABEL[conta.tipo_chave_pix]}
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
