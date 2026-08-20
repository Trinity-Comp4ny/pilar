import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { Reveal } from "./Reveal";
import { SpotlightCard } from "./SpotlightCard";
import { ModuleMiniature } from "./modules/ModuleMiniatures";
import { ModuleRelay } from "./modules/ModuleRelay";
import { TextReveal } from "./motion";
import { MODULOS } from "../lib/modules";

/** Substitui o antigo fluxo de 5 etapas, que refletia o sistema de um módulo só. */
export function ModulesSection() {
  return (
    <section id="produto" className="py-24 md:py-32 bg-paper-alt border-t border-paper-border scroll-mt-20">
      <div className="container mx-auto px-6 md:px-10">
        <div className="max-w-6xl mx-auto">
          {/* O cabeçalho ocupa duas colunas: título à esquerda, contexto à
              direita. Antes era uma coluna só, e o lado direito ficava vazio. */}
          <div className="grid md:grid-cols-[1.15fr_1fr] gap-8 md:gap-16 items-end mb-12">
            <div>
              <Reveal variant="down" className="mb-5">
                <span className="inline-block px-3 py-1 bg-brand text-ink-on-brand text-xs font-medium uppercase tracking-[0.2em] rounded-sm">
                  Três módulos, um sistema
                </span>
              </Reveal>
              <TextReveal
                as="h2"
                text="Cada módulo resolve uma fase. Juntos, fecham o ciclo."
                highlight="Juntos, fecham o ciclo."
                highlightClassName="italic text-ink/45"
                className="text-3xl md:text-[44px] font-medium text-ink leading-[1.1] tracking-tight"
              />
            </div>

            <Reveal variant="right" delay={0.15} className="md:pb-2">
              <p className="text-[15px] text-ink-soft font-light leading-relaxed border-l-2 border-brand pl-4">
                O dado entra uma vez, no lead, e segue até o diário de obra. Nada de exportar planilha entre etapas,
                nem redigitar cliente, valor e prazo a cada passo.
              </p>
            </Reveal>
          </div>

          <ModuleRelay />

          <div className="grid md:grid-cols-3 gap-4">
            {MODULOS.map((mo, i) => (
              <Reveal
                key={mo.slug}
                variant="scale"
                delay={i * 0.1}
                className="h-full"
              >
                <SpotlightCard
                  glow={mo.cor.glow}
                  className="group h-full flex flex-col rounded-2xl border border-paper-border/70 bg-white p-5 md:p-6 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_50px_-24px_rgba(0,0,0,0.3)] hover:border-paper-border"
                >
                  <span className={`absolute top-0 left-6 right-6 h-0.5 ${mo.cor.strong} rounded-b`} />

                  <ModuleMiniature slug={mo.slug} />

                  <p className={`text-[10px] uppercase tracking-[0.14em] font-medium mb-2.5 ${mo.cor.text}`}>
                    {mo.numero} · {mo.nome}
                  </p>
                  {/* Só a headline: em Obra ela e o `resumo` são a mesma frase,
                      e em Gestão dizem a mesma coisa com outras palavras. O
                      `resumo` continua servindo ao mega-menu, onde a headline
                      não aparece. */}
                  <h3 className="text-lg md:text-xl font-medium text-ink tracking-tight leading-snug mb-4">
                    {mo.headline}
                  </h3>

                  <ul className="flex flex-col gap-2.5 mb-6">
                    {mo.features.slice(0, 4).map((f) => (
                      <li key={f.titulo} className="flex gap-2.5 items-start">
                        <Check className={`w-3.5 h-3.5 mt-[3px] shrink-0 ${mo.cor.text}`} strokeWidth={2.4} />
                        <span className="text-[13px] text-ink-soft font-light leading-snug">{f.titulo}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    to={`/${mo.slug}`}
                    className={`mt-auto inline-flex items-center gap-1.5 text-[13px] font-medium group/link ${mo.cor.text}`}
                  >
                    Ver {mo.nome}
                    <ArrowRight className="w-3.5 h-3.5 group-hover/link:translate-x-1 transition-transform" />
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
