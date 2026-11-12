import { useEffect, useMemo, useRef, useState } from "react";
import { useSidebar } from "@/components/ui/sidebar";
import { ModuleChipNav } from "@/components/ModuleChipNav";
import { PageSlotsContext } from "@/components/pageSlotsContext";
import { cn } from "@/lib/utils";
import { sidebarOffset } from "@/lib/shellLayout";
import { useDentroDoMain } from "@/components/mainLandmark";
import { useRecolherAoRolar } from "@/hooks/useRecolherAoRolar";

interface PageLayoutProps {
  children: React.ReactNode;
  standalone?: boolean;
  header?: React.ReactNode;
  sidebar?: React.ReactNode;
  /** Abas de seção (`SectionTabs`), logo abaixo do header. Só renderiza com `header`. */
  tabs?: React.ReactNode;
  /** Toolbar de visão e filtros (`FilterBar`), abaixo das abas. Só renderiza com `header`. */
  toolbar?: React.ReactNode;
  className?: string;
  containerClassName?: string;
  /**
   * `compact`: tela de dados (quadro, Gantt, tabela, mapa). Topo de 16 px em vez de 24,
   * blocos a 16 px e o conteúdo ocupando a altura da tela, para a área principal rolar por
   * dentro (auditoria de espaço, 2026-11).
   */
  density?: "default" | "compact";
}

// Cada página monta o próprio PageLayout, então "troca de rota" = novo mount.
// O flag vive no módulo para não roubar o foco no primeiro carregamento do app.
let jaHouveNavegacao = false;

export function PageLayout({
  children,
  header,
  sidebar,
  tabs,
  toolbar,
  className,
  containerClassName,
  standalone,
  density = "default",
}: PageLayoutProps) {
  const compacta = density === "compact";
  const { state, isMobile } = useSidebar();
  const mainRef = useRef<HTMLElement>(null);
  // Celular: a linha de atalhos do módulo recolhe ao rolar para baixo e volta ao subir.
  const atalhosRecolhidos = useRecolherAoRolar(mainRef, isMobile && !standalone);
  // Dentro do Layout já existe um <main id="main-content">; aqui vira div (mesmo foco e
  // estilo). Fora dele (tela standalone), continua sendo o <main> da página.
  const Conteudo = useDentroDoMain() ? "div" : "main";
  const anuncioRef = useRef<HTMLParagraphElement>(null);
  // Alvos dos portais PageTabs/PageToolbar (filhos que montam a própria toolbar).
  const [tabsEl, setTabsEl] = useState<HTMLDivElement | null>(null);
  const [toolbarEl, setToolbarEl] = useState<HTMLDivElement | null>(null);
  const slots = useMemo(() => ({ tabsEl, toolbarEl, dentroDoLayout: true }), [tabsEl, toolbarEl]);

  // Spec 002, req. 8: em troca de rota o shell não
  // remonta, então move o foco para o conteúdo novo e anuncia a página para
  // leitores de tela (senão a navegação passa em silêncio). Atualiza o DOM
  // diretamente (aria-live é sistema externo; evita setState em effect).
  useEffect(() => {
    if (!jaHouveNavegacao) {
      jaHouveNavegacao = true;
      return;
    }
    mainRef.current?.focus({ preventScroll: true });
    if (anuncioRef.current) anuncioRef.current.textContent = document.title;
  }, []);

  return (
    <PageSlotsContext.Provider value={slots}>
      <div
        className="fixed right-0 bottom-0 bg-background z-40 overflow-hidden flex flex-col transition-[left] duration-300 ease-in-out"
        // `--faixas-h`: altura das faixas de aviso fixas no topo (Layout). Sem elas, 0.
        style={{ left: standalone ? 0 : sidebarOffset(state, isMobile), top: standalone ? 0 : "var(--faixas-h, 0px)" }}
      >
        {header && (
          <div className="sticky top-0 z-20 w-full bg-background border-b">
            {header}
            {/* Chip-nav do módulo ativo (spec 097 / ADR 0040): só existe em mobile e
              dentro de um dos 3 pilares; ModuleChipNav se auto-oculta no resto. */}
            {!standalone && (
              <div
                data-atalhos-modulo
                className={cn(
                  "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
                  atalhosRecolhidos ? "grid-rows-[0fr]" : "grid-rows-[1fr]"
                )}
              >
                <div className="min-h-0 overflow-hidden">
                  <ModuleChipNav />
                </div>
              </div>
            )}
            {/* Ordem fixa (SPEC 124 / ADR 0059): header, chips mobile, abas de seção, toolbar. */}
            <div ref={setTabsEl}>{tabs}</div>
            <div ref={setToolbarEl}>{toolbar}</div>
          </div>
        )}

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {sidebar}
          <Conteudo
            ref={mainRef as React.Ref<HTMLDivElement>}
            tabIndex={-1}
            className={cn(
              "flex-1 overflow-y-auto w-full bg-background outline-hidden",
              // Recuo lateral = o do header (24 px), para o conteúdo alinhar com o título. Eram
              // 32 a 48 px, desalinhados do título e com um vão acima do 1º bloco (auditoria
              // de espaço, 2026-11).
              compacta ? "p-4 md:px-6 md:py-4" : "p-4 md:px-6 md:pt-6",
              // BottomNav (spec 097) é fixa por cima do conteúdo em mobile; sem este
              // espaço reservado, o fim do scroll ficava escondido atrás dela.
              "pb-[calc(6.5rem+env(safe-area-inset-bottom))]",
              compacta ? "md:pb-4" : "md:pb-8",
              className
            )}
          >
            <div className={cn("w-full mx-auto", compacta ? "space-y-4" : "space-y-6", containerClassName)}>
              {children}
            </div>
          </Conteudo>
        </div>

        <p ref={anuncioRef} aria-live="polite" className="sr-only" />
      </div>
    </PageSlotsContext.Provider>
  );
}
