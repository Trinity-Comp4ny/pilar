import { useEffect, useRef } from "react";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

interface PageLayoutProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  sidebar?: React.ReactNode;
  className?: string;
  containerClassName?: string;
}

// Cada página monta o próprio PageLayout, então "troca de rota" = novo mount.
// O flag vive no módulo para não roubar o foco no primeiro carregamento do app.
let jaHouveNavegacao = false;

export function PageLayout({ children, header, sidebar, className, containerClassName }: PageLayoutProps) {
  const { state, isMobile } = useSidebar();
  const mainRef = useRef<HTMLElement>(null);
  const anuncioRef = useRef<HTMLParagraphElement>(null);

  // Padrão do labrynth-platform (spec 002, req. 8): em troca de rota o shell não
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
    <div
      className="fixed top-0 right-0 bottom-0 bg-white z-40 overflow-hidden flex flex-col transition-[left] duration-300 ease-in-out"
      style={{ left: isMobile ? "0px" : state === "collapsed" ? "64px" : "240px" }}
    >
      {header && <div className="sticky top-0 z-20 w-full bg-white border-b">{header}</div>}

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        {sidebar}
        <main
          ref={mainRef}
          tabIndex={-1}
          className={cn(
            "flex-1 overflow-y-auto w-full bg-gray-50/50 p-6 md:p-8 xl:p-10 2xl:p-12 outline-none",
            className
          )}
        >
          <div className={cn("w-full mx-auto space-y-6", containerClassName)}>{children}</div>
        </main>
      </div>

      <p ref={anuncioRef} aria-live="polite" className="sr-only" />
    </div>
  );
}
