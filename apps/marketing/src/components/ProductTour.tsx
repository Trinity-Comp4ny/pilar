import { useCallback, useEffect, useRef, useState } from "react";
import { m, useReducedMotion } from "framer-motion";
import { BrowserFrame } from "./BrowserFrame";
import { ModuleScreen } from "./mock/ModuleScreens";
import { MODULOS, type ModuloSlug } from "../lib/modules";

const CICLO_MS = 7000;

/**
 * Tour guiado da hero: as abas trocam a tela do produto, e o ciclo anda
 * sozinho até o visitante escolher uma aba. Substitui o carrossel de prints
 * (ProductShowcase): as telas são vetoriais, então nunca cortam nem pixelam.
 */
export function ProductTour() {
  const [ativo, setAtivo] = useState<ModuloSlug>("gestao");
  const [autoplay, setAutoplay] = useState(true);
  const reducedMotion = useReducedMotion();
  const timer = useRef<number | null>(null);

  const modulo = MODULOS.find((mo) => mo.slug === ativo) ?? MODULOS[0];

  const limpar = useCallback(() => {
    if (timer.current) {
      window.clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => {
    if (reducedMotion || !autoplay) return;
    timer.current = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setAtivo((slug) => {
        const i = MODULOS.findIndex((mo) => mo.slug === slug);
        return MODULOS[(i + 1) % MODULOS.length].slug;
      });
    }, CICLO_MS);
    return limpar;
  }, [reducedMotion, autoplay, limpar]);

  const escolher = (slug: ModuloSlug) => {
    setAutoplay(false);
    limpar();
    setAtivo(slug);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <BrowserFrame url={modulo.url}>
        <div className="px-5 py-4 md:px-6 md:py-5 text-left min-h-[260px]">
          {/* key força o remount, então cada troca reanima a tela por dentro */}
          <m.div
            key={ativo}
            initial={reducedMotion ? false : { opacity: 0, y: 7 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <ModuleScreen slug={ativo} />
          </m.div>
        </div>
      </BrowserFrame>

      <div className="flex flex-wrap justify-center gap-2 mt-8" role="tablist" aria-label="Módulos do Pilar">
        {MODULOS.map((mo) => {
          const selecionado = mo.slug === ativo;
          return (
            <button
              key={mo.slug}
              type="button"
              role="tab"
              aria-selected={selecionado}
              onClick={() => escolher(mo.slug)}
              className={`relative overflow-hidden text-left min-w-[158px] px-4 py-3 rounded-xl bg-white border transition-shadow ${
                selecionado ? "border-paper-border shadow-md" : "border-paper-border/60 hover:border-paper-border"
              }`}
            >
              <span className="block text-[8.5px] uppercase tracking-[0.1em] text-ink-muted mb-0.5">{mo.numero}</span>
              <span className="block text-[13.5px] font-medium text-ink">{mo.nome}</span>
              <span className="block text-[10.5px] text-ink-muted mt-0.5">{mo.resumo}</span>

              {selecionado && autoplay && !reducedMotion && (
                <m.span
                  className={`absolute left-0 bottom-0 h-0.5 ${mo.cor.strong}`}
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ duration: CICLO_MS / 1000, ease: "linear" }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
