import { ArrowRight } from "lucide-react";
import { Reveal } from "./Reveal";

const pains = [
  "Lead esfria no WhatsApp.",
  "Proposta no feeling.",
  "Projeto estoura prazo.",
  "Financeiro só aparece no fim.",
];

const flow = ["Lead", "Proposta", "Projeto", "Entrega", "Cobrança"];

export function ProofSection() {
  return (
    <section id="prova" className="py-28 md:py-36 bg-paper-alt border-t border-paper-border scroll-mt-20">
      <div className="container mx-auto px-6 md:px-10">
        <div className="max-w-6xl mx-auto">
          <Reveal className="mb-14">
            <span className="inline-block px-3 py-1 bg-brand text-ink text-xs font-medium uppercase tracking-[0.2em] rounded-sm">
              O que trava seu escritório
            </span>
          </Reveal>

          <Reveal className="mb-14">
            {pains.map((pain) => (
              <p
                key={pain}
                className="text-3xl md:text-5xl lg:text-6xl font-medium tracking-tight leading-[1.15] text-ink/20 line-through decoration-ink/15 decoration-1"
              >
                {pain}
              </p>
            ))}
          </Reveal>

          <Reveal className="w-full h-px bg-slate-200 mb-14" />

          <Reveal className="grid md:grid-cols-2 gap-12 md:gap-20 items-end mb-20">
            <h2 className="text-3xl md:text-5xl font-medium text-ink leading-[1.1] tracking-tight">
              <em className="landing-highlight">Controle total dos projetos.</em>{" "}
              <span className="italic text-ink/55">Mais margem no escritório.</span>
            </h2>

            <div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-3 text-xl md:text-3xl font-medium text-ink-soft tracking-tight mb-4">
                {flow.map((step, i) => (
                  <div key={step} className="flex items-center gap-3">
                    <span>{step}</span>
                    {i < flow.length - 1 && (
                      <ArrowRight className="w-5 h-5 md:w-6 md:h-6 text-slate-400 shrink-0" strokeWidth={1.5} />
                    )}
                  </div>
                ))}
              </div>
              <p className="text-sm text-slate-500 font-light max-w-sm">
                Cada etapa alimenta a próxima. Sem retrabalho. Sem conciliação manual.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
