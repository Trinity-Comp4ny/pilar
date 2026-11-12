import { useRef, useState, type ReactNode, type UIEvent } from "react";
import { cn } from "@/lib/utils";

export interface KanbanMobileColuna {
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
 * tela com a ponta da próxima aparecendo, como o quadro do ClickUp no app. Em cima, uma
 * faixa com o nome de cada coluna leva direto a ela e marca onde a pessoa está.
 * Substitui as colunas empilhadas em acordeão (feedback do dono, 12/11). Sem arrastar:
 * mover de coluna é pelo menu do card, como antes.
 */
export function KanbanMobile({ colunas, ariaLabel }: KanbanMobileProps) {
  const trilho = useRef<HTMLDivElement>(null);
  const faixa = useRef<HTMLDivElement>(null);
  const [ativa, setAtiva] = useState(0);

  const irPara = (i: number) => {
    const alvo = trilho.current?.children[i] as HTMLElement | undefined;
    trilho.current?.scrollTo({ left: alvo ? alvo.offsetLeft - 16 : 0, behavior: "smooth" });
  };

  const aoRolar = (e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const primeira = el.children[0] as HTMLElement | undefined;
    if (!primeira) return;
    const passo = primeira.offsetWidth + 12; // largura da coluna + gap-3
    const i = Math.min(colunas.length - 1, Math.max(0, Math.round(el.scrollLeft / passo)));
    if (i === ativa) return;
    setAtiva(i);
    const chip = faixa.current?.children[i] as HTMLElement | undefined;
    chip?.scrollIntoView?.({ block: "nearest", inline: "center", behavior: "smooth" });
  };

  return (
    <section aria-label={ariaLabel} className="md:hidden">
      <div
        ref={faixa}
        role="tablist"
        aria-label="Colunas"
        className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {colunas.map((c, i) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={i === ativa}
            onClick={() => irPara(i)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
              i === ativa ? "border-brand bg-brand text-ink" : "border-border bg-surface-card text-ink-soft"
            )}
          >
            <span
              className={cn("h-2 w-2 shrink-0 rounded-full", ehClasse(c.cor) && c.cor)}
              style={ehClasse(c.cor) ? undefined : { backgroundColor: c.cor }}
            />
            {c.titulo}
            <span className="tabular-nums opacity-70">{c.quantidade}</span>
          </button>
        ))}
      </div>

      <div
        ref={trilho}
        onScroll={aoRolar}
        className="-mx-4 flex snap-x snap-mandatory items-start gap-3 overflow-x-auto scroll-px-4 px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
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
