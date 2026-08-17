import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Target, TrendingUp, Wallet, User, Layers, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import type { MetaRow } from "./MetaFormDialog";

interface MetaCardProps {
  meta: MetaRow;
  /** Subtítulo (nome da pessoa nas metas pessoais). */
  subtitle?: string | null;
  onEdit: () => void;
  onDelete: () => void;
}

const formatValor = (value: number, unidade: string | null | undefined) => {
  if (unidade === "currency") return `R$ ${value.toLocaleString("pt-BR")}`;
  if (unidade === "percentage") return `${value}%`;
  return value.toLocaleString("pt-BR");
};

const getIcon = (meta: MetaRow, isCompleted: boolean) => {
  const cls = cn("h-5 w-5", isCompleted && "text-positive-strong");
  if (meta.tipo === "pessoal") return <User className={cn(cls, !isCompleted && "text-blue-500")} />;
  if (meta.tipo === "livre") return <Layers className={cn(cls, !isCompleted && "text-ink-muted")} />;
  switch (meta.categoria) {
    case "receita":
      return <TrendingUp className={cn(cls, !isCompleted && "text-positive-strong")} />;
    case "lucro":
      return <Wallet className={cn(cls, !isCompleted && "text-blue-500")} />;
    case "investimento":
      return <Target className={cn(cls, !isCompleted && "text-purple-500")} />;
    default:
      return <Target className={cn(cls, !isCompleted && "text-gray-500")} />;
  }
};

export function MetaCard({ meta, subtitle, onEdit, onDelete }: MetaCardProps) {
  const percent = Math.min(Math.round((meta.atual / meta.alvo) * 100), 100);
  const isCompleted = percent >= 100;

  return (
    <Card className={cn("border-2 transition-all", isCompleted && "border-status-done bg-positive/10")}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className={cn("p-2 rounded-lg", isCompleted ? "bg-positive/10" : "bg-muted")}>
            {getIcon(meta, isCompleted)}
          </div>
          <div className="flex gap-0.5">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit} aria-label="Editar meta">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-danger-mid hover:text-danger-strong"
              onClick={onDelete}
              aria-label="Excluir meta"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex items-end justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-snug truncate">{meta.nome}</p>
            {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
          </div>
          <span
            className={cn(
              "text-2xl font-bold tabular-nums leading-none shrink-0",
              isCompleted ? "text-positive-strong" : "text-foreground"
            )}
          >
            {percent}%
          </span>
        </div>

        <Progress value={percent} className="h-1.5 bg-muted" indicatorClassName="bg-positive/100" />

        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Atual</p>
            <p className="text-sm font-semibold whitespace-nowrap">{formatValor(meta.atual, meta.unidade)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground mb-0.5">Alvo</p>
            <p className="text-sm font-semibold whitespace-nowrap">{formatValor(meta.alvo, meta.unidade)}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Prazo: {meta.prazo ? formatDate(meta.prazo) : "—"}
        </p>
      </CardContent>
    </Card>
  );
}
