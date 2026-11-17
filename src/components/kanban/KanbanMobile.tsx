import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface KanbanMobileColuna {
  id: string;
  titulo: string;
  /** Cor do ponto (hex da etapa ou classe `bg-*`). */
  cor: string;
  quantidade: number;
  /** Cards da coluna, já com o menu "Mover para" (no celular não há arraste). */
  children: ReactNode;
}

interface KanbanMobileProps {
  colunas: KanbanMobileColuna[];
  /** Nome do quadro para leitor de tela (ex.: "Quadro de projetos"). */
  ariaLabel: string;
}

const ehClasse = (cor: string) => cor.startsWith("bg-");

/**
 * Quadro Kanban no celular (< md): colunas lado a lado que passam com o dedo, uma por
 * tela com a ponta da próxima aparecendo, como o quadro do ClickUp no app. Sem faixa de
 * filtro por coluna: o título de cada coluna já diz onde a pessoa está (feedback do dono,
 * 14/11). Substitui as colunas empilhadas em acordeão (12/11). Sem arrastar:
 * mover de coluna é pelo menu do card, como antes.
 */
export function KanbanMobile({ colunas, ariaLabel }: KanbanMobileProps) {
  return (
    <section aria-label={ariaLabel} className="md:hidden">
      <div className="-mx-4 flex snap-x snap-mandatory items-start gap-3 overflow-x-auto scroll-px-4 px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {colunas.map((c) => (
          <div
            key={c.id}
            role="group"
            aria-label={`${c.titulo}, ${c.quantidade}`}
            className="flex w-[86vw] max-w-[380px] shrink-0 snap-start flex-col rounded-2xl bg-muted/50 p-2"
          >
            <header className="flex items-center gap-2 px-1.5 pb-2 pt-1">
              <span
                className={cn("h-2.5 w-2.5 shrink-0 rounded-full", ehClasse(c.cor) && c.cor)}
                style={ehClasse(c.cor) ? undefined : { backgroundColor: c.cor }}
              />
              <h3 className="truncate text-sm font-semibold uppercase tracking-wide text-ink">{c.titulo}</h3>
              <span className="ml-auto rounded-full bg-surface-card px-2 text-xs tabular-nums text-muted-foreground">
                {c.quantidade}
              </span>
            </header>
            {c.quantidade === 0 ? (
              <p className="px-1 py-8 text-center text-sm text-muted-foreground">Nada aqui</p>
            ) : (
              <div className="flex flex-col gap-2">{c.children}</div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
