import { useEffect, useRef } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type SectionTab = {
  id: string;
  label: string;
  icon?: LucideIcon;
  disabled?: boolean;
  badge?: string | number;
  /** Âncora do coach mark de onboarding (vira [data-tour=...] na aba). */
  dataTour?: string;
};

type Props = {
  tabs: SectionTab[];
  value: string;
  onValueChange: (id: string) => void;
  /** Nome da região para leitor de tela. */
  ariaLabel?: string;
  className?: string;
};

/**
 * Barra horizontal de seções da página (SPEC 121 / ADR 0058). Vai no slot `tabs`
 * de `PilarPage`/`PageLayout`, logo abaixo do header, e substitui a sidebar de
 * página (`SecondSidebar`) e as pílulas cinza de `TabsList` para seção.
 *
 * Só troca de seção: o conteúdo de cada aba é renderizado pela página. Para trocar
 * a visão da mesma coleção (Lista/Quadro), use `ViewSwitcher`.
 */
export function SectionTabs({ tabs, value, onValueChange, ariaLabel = "Seções", className }: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Aba ativa pode nascer fora da área visível (muitas abas em 390px). Aplica o
  // scrollLeft direto no container: `scrollIntoView` rolaria também os ancestrais
  // e deslocaria a página inteira (achado da auditoria mobile, ver ui/tabs.tsx).
  useEffect(() => {
    const container = listRef.current;
    const active = itemRefs.current[value];
    if (!container || !active) return;
    const containerRect = container.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    const activeCenter = activeRect.left - containerRect.left + container.scrollLeft + activeRect.width / 2;
    container.scrollLeft = activeCenter - container.clientWidth / 2;
  }, [value]);

  const habilitadas = tabs.filter((t) => !t.disabled);

  const mover = (atual: string, destino: "anterior" | "proxima" | "primeira" | "ultima") => {
    const i = habilitadas.findIndex((t) => t.id === atual);
    if (i < 0 || habilitadas.length === 0) return;
    const alvo =
      destino === "primeira"
        ? habilitadas[0]
        : destino === "ultima"
          ? habilitadas[habilitadas.length - 1]
          : habilitadas[(i + (destino === "proxima" ? 1 : -1) + habilitadas.length) % habilitadas.length];
    onValueChange(alvo.id);
    itemRefs.current[alvo.id]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent, id: string) => {
    const mapa: Record<string, "anterior" | "proxima" | "primeira" | "ultima"> = {
      ArrowLeft: "anterior",
      ArrowRight: "proxima",
      Home: "primeira",
      End: "ultima",
    };
    const destino = mapa[e.key];
    if (!destino) return;
    e.preventDefault();
    mover(id, destino);
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "flex gap-1 overflow-x-auto px-1 md:px-3 scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const ativa = tab.id === value;
        return (
          <button
            key={tab.id}
            ref={(node) => {
              itemRefs.current[tab.id] = node;
            }}
            type="button"
            role="tab"
            aria-selected={ativa}
            aria-disabled={tab.disabled || undefined}
            tabIndex={ativa ? 0 : -1}
            data-tour={tab.dataTour}
            onClick={() => !tab.disabled && onValueChange(tab.id)}
            onKeyDown={(e) => onKeyDown(e, tab.id)}
            className={cn(
              "relative inline-flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors",
              "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
              ativa ? "text-ink" : "text-muted-foreground hover:text-ink",
              tab.disabled && "cursor-not-allowed opacity-40 hover:text-muted-foreground"
            )}
          >
            {Icon && <Icon size={15} strokeWidth={1.75} aria-hidden className="shrink-0" />}
            {tab.label}
            {tab.badge !== undefined && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] leading-none tabular-nums text-muted-foreground">
                {tab.badge}
              </span>
            )}
            {ativa && <span aria-hidden className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-ink" />}
          </button>
        );
      })}
    </div>
  );
}
