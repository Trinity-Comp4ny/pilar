import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Reveal } from "./Reveal";

const faqs = [
  {
    question: "Já uso planilha. Por que trocar?",
    answer: "Planilha não avisa quando o projeto vira prejuízo. O Pilar avisa, e ainda emite a cobrança.",
  },
  {
    question: "Não é só mais um sistema pra alimentar?",
    answer: "Um fluxo só: o dado entra na proposta e segue até o financeiro. Você alimenta menos, não mais.",
  },
  {
    question: "Posso confiar no orçamento que a IA monta?",
    answer: "A IA monta o rascunho, você revisa e aprova. Nada vai pro cliente sem o seu OK.",
  },
  {
    question: "É caro? É mais um SaaS pra pagar?",
    answer: "Custa menos que um projeto no vermelho que você descobriu tarde demais.",
  },
  {
    question: "Serve pro meu escritório?",
    answer:
      "Feito pra engenharia multidisciplinar: civil, estrutural, MEP/HVAC. Não é ERP de obra nem ferramenta de arquitetura.",
  },
];

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="py-28 md:py-36 bg-paper scroll-mt-20">
      <div className="container mx-auto px-6 md:px-10">
        <div className="max-w-3xl mx-auto">
          <Reveal className="mb-16">
            <div className="mb-6">
              <span className="inline-block px-3 py-1 bg-brand text-ink text-xs font-medium uppercase tracking-[0.2em] rounded-sm">
                Perguntas frequentes
              </span>
            </div>
            <h2 className="text-3xl md:text-5xl font-medium text-ink leading-[1.1] tracking-tight">
              <em className="landing-highlight">Antes de perguntar,</em>{" "}
              <span className="italic text-ink/55">responda.</span>
            </h2>
          </Reveal>

          <Reveal>
            {faqs.map((faq, i) => {
              const isOpen = openIndex === i;
              return (
                <div key={faq.question} className="border-b border-paper-border">
                  <button
                    type="button"
                    onClick={() => setOpenIndex(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center justify-between gap-4 py-6 text-left"
                  >
                    <span className="text-lg md:text-xl font-medium text-ink tracking-tight">{faq.question}</span>
                    <ChevronDown
                      className={`w-5 h-5 text-slate-500 shrink-0 transition-transform duration-300 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <p className="text-base text-slate-500 font-light leading-relaxed pb-6 max-w-2xl">{faq.answer}</p>
                  )}
                </div>
              );
            })}
          </Reveal>
        </div>
      </div>
    </section>
  );
}
