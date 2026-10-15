import { ChevronRight } from "lucide-react";

type Props = {
  nome: string;
  cor: string;
  total: number;
  onExpandir: () => void;
};

/** Coluna do funil minimizada: faixa vertical com o nome e a contagem. */
export function EtapaColapsada({ nome, cor, total, onExpandir }: Props) {
  return (
    <div
      className="flex flex-col w-10 shrink-0 min-h-0 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
      onClick={onExpandir}
    >
      <div className="flex flex-col items-center gap-2 py-3">
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cor }} />
      </div>
      <div className="flex-1 flex items-center justify-center">
        <span
          className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          {nome} · {total}
        </span>
      </div>
    </div>
  );
}
