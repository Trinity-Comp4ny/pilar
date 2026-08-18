import { Fragment } from "react";
import { Link } from "react-router-dom";
import { m, useReducedMotion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { Reveal } from "./Reveal";
import { SpotlightCard } from "./SpotlightCard";
import { MODULOS } from "../lib/modules";

/**
 * Conector animado entre os 3 módulos ("Animated Beam", do MagicUI, adaptado):
 * um pulso viaja de nó a nó em loop, dando forma visual ao "fecham o ciclo"
 * que já estava só na copy. Decorativo — some com prefers-reduced-motion.
 */
function ModuleConnector() {
  const reducedMotion = useReducedMotion();
  if (reducedMotion) return null;

  return (
    <div className="hidden md:flex items-center justify-center gap-3 mb-12" aria-hidden="true">
      {MODULOS.map((mo, i) => (
        <Fragment key={mo.slug}>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${mo.cor.strong}`} />
            <span className="text-[10px] uppercase tracking-[0.14em] text-ink-muted font-medium">{mo.nome}</span>
          </div>
          {i < MODULOS.length - 1 && (
            <span className="relative w-16 h-px bg-paper-border">
              <m.span
                className="absolute -top-[3px] w-1.5 h-1.5 rounded-full bg-ink/50"
                animate={{ left: ["0%", "94%"] }}
                transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 0.8, delay: i * 0.5, ease: "easeInOut" }}
              />
            </span>
          )}
        </Fragment>
      ))}
    </div>
  );
}

/** Substitui o antigo fluxo de 5 etapas, que refletia o sistema de um módulo só. */
export function ModulesSection() {
  return (
    <section id="produto" className="py-28 md:py-36 bg-paper-alt border-t border-paper-border scroll-mt-20">
      <div className="container mx-auto px-6 md:px-10">
        <div className="max-w-6xl mx-auto">
          <Reveal className="max-w-2xl mb-10">
            <div className="mb-6">
              <span className="inline-block px-3 py-1 bg-brand text-ink-on-brand text-xs font-medium uppercase tracking-[0.2em] rounded-sm">
                Três módulos, um sistema
              </span>
            </div>
            <h2 className="text-3xl md:text-5xl font-medium text-ink leading-[1.1] tracking-tight mb-5">
              Cada módulo resolve uma fase. <span className="italic text-ink/55">Juntos, fecham o ciclo.</span>
            </h2>
            <p className="text-base text-ink-soft font-light leading-relaxed">
              O dado entra uma vez, no lead, e segue até o diário de obra. Nada de exportar planilha entre etapas.
            </p>
          </Reveal>

          <ModuleConnector />

          <div className="grid md:grid-cols-3 border-t border-paper-border">
            {MODULOS.map((mo, i) => (
              <Reveal
                key={mo.slug}
                delay={i * 0.08}
                className={i > 0 ? "md:border-l border-paper-border/60 border-t md:border-t-0" : ""}
              >
                <SpotlightCard
                  glow={mo.cor.glow}
                  className="h-full px-0 md:px-6 py-8 md:py-9 transition-transform duration-300 hover:-translate-y-1"
                >
                  <span className={`absolute top-0 left-0 w-1/3 h-0.5 ${mo.cor.strong}`} />

                  <p className={`text-[10px] uppercase tracking-[0.14em] font-medium mb-3 ${mo.cor.text}`}>
                    {mo.numero} · {mo.nome}
                  </p>
                  <h3 className="text-lg md:text-xl font-medium text-ink tracking-tight leading-snug mb-2">
                    {mo.headline}
                  </h3>
                  <p className="text-sm text-ink-muted font-light leading-relaxed mb-5">{mo.resumo}</p>

                  <ul className="flex flex-col gap-2.5 mb-6">
                    {mo.features.slice(0, 4).map((f) => (
                      <li key={f.titulo} className="flex gap-2.5 items-start">
                        <Check className={`w-3.5 h-3.5 mt-1 shrink-0 ${mo.cor.text}`} strokeWidth={2.4} />
                        <span className="text-[13px] text-ink-soft font-light leading-snug">{f.titulo}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    to={`/${mo.slug}`}
                    className={`inline-flex items-center gap-1.5 text-[13px] font-medium group/link ${mo.cor.text}`}
                  >
                    Ver {mo.nome}
                    <ArrowRight className="w-3.5 h-3.5 group-hover/link:translate-x-0.5 transition-transform" />
                  </Link>
                </SpotlightCard>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
