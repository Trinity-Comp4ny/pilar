import { ArrowLeftRight, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type NovoLancamentoEscolha = "receita" | "despesa" | "transferencia";

interface NovoLancamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEscolher: (escolha: NovoLancamentoEscolha) => void;
}

const OPCOES: {
  value: NovoLancamentoEscolha;
  label: string;
  description: string;
  icon: LucideIcon;
  toneClass: string;
}[] = [
  {
    value: "receita",
    label: "Receita",
    description: "Dinheiro que entra",
    icon: TrendingUp,
    toneClass: "border-positive hover:bg-positive/5 text-positive-strong",
  },
  {
    value: "despesa",
    label: "Despesa",
    description: "Dinheiro que sai",
    icon: TrendingDown,
    toneClass: "border-danger-mid hover:bg-danger-soft text-danger-mid",
  },
  {
    value: "transferencia",
    label: "Transferência",
    description: "Entre contas próprias",
    icon: ArrowLeftRight,
    toneClass: "border-info-mid hover:bg-info-soft text-info-mid",
  },
];

/** Seletor visual do tipo de lançamento, aberto pelo botão "Novo lançamento". */
export function NovoLancamentoDialog({ open, onOpenChange, onEscolher }: NovoLancamentoDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo lançamento</DialogTitle>
          <DialogDescription>O que você quer registrar?</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-3">
          {OPCOES.map((opcao) => (
            <button
              key={opcao.value}
              type="button"
              onClick={() => {
                onOpenChange(false);
                onEscolher(opcao.value);
              }}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-colors",
                opcao.toneClass
              )}
            >
              <opcao.icon className="h-6 w-6" />
              <span className="text-sm font-medium">{opcao.label}</span>
              <span className="text-xs text-muted-foreground">{opcao.description}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
