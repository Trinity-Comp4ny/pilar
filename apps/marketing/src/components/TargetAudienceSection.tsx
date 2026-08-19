import { Check, X } from "lucide-react";
import { Reveal } from "./Reveal";

const isFor = [
  "Escritório de engenharia multidisciplinar: civil, estrutural, MEP/HVAC.",
  "Vende projeto técnico por proposta e emite nota fiscal.",
  "Pequeno a médio porte, de 3 a 30 profissionais.",
];

const isNotFor = [
  "Arquitetura pura (fluxo criativo, etapas diferentes).",
  "Construtora ou incorporadora que precisa de gestão de obra.",
  "Freelancer solo sem fluxo de proposta.",
];

export function TargetAudienceSection() {
  return (
    <section id="para-quem" className="py-28 md:py-36 bg-paper-alt border-t border-paper-border scroll-mt-20">
      <div className="container mx-auto px-6 md:px-10">
        <div className="max-w-6xl mx-auto">
          <Reveal className="max-w-2xl mb-16">
            <div className="mb-6">
              <span className="inline-block px-3 py-1 bg-brand text-ink text-xs font-medium uppercase tracking-[0.2em] rounded-sm">
                Para quem é
              </span>
            </div>
            <h2 className="text-3xl md:text-5xl font-medium text-ink leading-[1.1] tracking-tight">
              <em className="landing-highlight">Feito pra engenharia.</em>{" "}
              <span className="italic text-ink/55">Não é ERP nem ferramenta de arquitetura.</span>
            </h2>
          </Reveal>

          <div className="grid md:grid-cols-2 gap-12 md:gap-20">
            <Reveal>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-medium mb-6">Feito para</p>
              <ul className="space-y-4">
                {isFor.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-brand shrink-0 mt-0.5" strokeWidth={2} />
                    <span className="text-base text-ink-soft font-light leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal delay={0.08}>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-medium mb-6">Não é para</p>
              <ul className="space-y-4">
                {isNotFor.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <X className="w-5 h-5 text-ink/30 shrink-0 mt-0.5" strokeWidth={2} />
                    <span className="text-base text-ink/50 font-light leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
