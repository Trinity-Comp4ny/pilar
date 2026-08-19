import { useEffect, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Reveal } from "../components/Reveal";

/**
 * FAQ e qualificação de público, que saíram da home (decisão do CEO, 18/08).
 * "Para quem é" virou a primeira pergunta daqui, e continua sendo o filtro que
 * afasta arquitetura pura e construtora de grande porte.
 */

const FEITO_PARA = [
  "Escritório multidisciplinar: civil, estrutural, elétrico, hidrossanitário, climatização.",
  "Quem vende projeto técnico por proposta e emite nota.",
  "De 3 a 30 profissionais, com sócio olhando margem.",
  "Quem também administra obra e presta contas ao cliente.",
];

const NAO_E_PARA = [
  "Arquitetura pura, que tem fluxo criativo e etapas diferentes.",
  "Construtora ou incorporadora de grande porte.",
  "Freelancer solo sem fluxo de proposta.",
];

const FAQS = [
  {
    pergunta: "São três sistemas ou um só?",
    resposta:
      "Um só. Os módulos existem para você não olhar tela de obra enquanto fecha proposta, mas o dado é o mesmo: o cliente do lead é o cliente do projeto, e é o cliente da obra.",
  },
  {
    pergunta: "Preciso usar os três módulos?",
    resposta: "Não. Escritório que só faz projeto usa Gestão e Projetos. Quem também administra obra liga o terceiro.",
  },
  {
    pergunta: "Posso confiar no que a IA monta?",
    resposta:
      "A IA monta o rascunho, você revisa e confirma. Nada é gravado sem o seu aval, e existe botão de desfazer que apaga exatamente o que aquela execução criou.",
  },
  {
    pergunta: "Meu pessoal de obra não tem e-mail. Funciona?",
    resposta:
      "Funciona. O gestor gera usuário e senha e entrega na mão, e o registro do dia fica guardado no aparelho até o sinal voltar.",
  },
  {
    pergunta: "Já uso planilha. Por que trocar?",
    resposta:
      "Planilha não gera a proposta no seu template, não avisa o responsável da etapa seguinte e não recebe o diário de obra do canteiro. O Pilar faz as três coisas.",
  },
  {
    pergunta: "É mais um sistema para alimentar?",
    resposta: "O dado entra na proposta e segue até a cobrança e o diário. Você alimenta menos, não mais.",
  },
];

export function Faq() {
  const [aberta, setAberta] = useState<number | null>(0);

  useEffect(() => {
    document.title = "Perguntas frequentes | Pilar";
  }, []);

  return (
    <>
      <section className="pt-32 pb-14 md:pt-40 md:pb-16">
        <div className="container mx-auto px-6 md:px-10">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-[clamp(30px,4.4vw,48px)] font-medium tracking-[-0.032em] text-ink leading-[1.06] mb-4">
              Perguntas frequentes
            </h1>
            <p className="text-base md:text-lg text-ink-soft font-light leading-relaxed">
              O que costuma aparecer antes da primeira conversa.
            </p>
          </div>
        </div>
      </section>

      <section className="pb-20 md:pb-24">
        <div className="container mx-auto px-6 md:px-10">
          <div className="max-w-3xl mx-auto">
            <Reveal className="mb-14 p-6 md:p-8 rounded-xl bg-paper-alt border border-paper-border">
              <h2 className="text-xl md:text-2xl font-medium text-ink tracking-tight mb-6">
                O Pilar serve pro meu escritório?
              </h2>
              <div className="grid sm:grid-cols-2 gap-8">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-ink-muted font-medium mb-4">Feito para</p>
                  <ul className="flex flex-col gap-3">
                    {FEITO_PARA.map((item) => (
                      <li key={item} className="flex gap-2.5 items-start">
                        <Check className="w-4 h-4 text-modulo-gestao-strong shrink-0 mt-0.5" strokeWidth={2.2} />
                        <span className="text-[13.5px] text-ink-soft font-light leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-ink-muted font-medium mb-4">Não é para</p>
                  <ul className="flex flex-col gap-3">
                    {NAO_E_PARA.map((item) => (
                      <li key={item} className="flex gap-2.5 items-start">
                        <X className="w-4 h-4 text-ink-disabled shrink-0 mt-0.5" strokeWidth={2.2} />
                        <span className="text-[13.5px] text-ink-muted font-light leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Reveal>

            <Reveal>
              {FAQS.map((faq, i) => {
                const isOpen = aberta === i;
                return (
                  <div key={faq.pergunta} className="border-b border-paper-border">
                    <button
                      type="button"
                      onClick={() => setAberta(isOpen ? null : i)}
                      aria-expanded={isOpen}
                      className="w-full flex items-center justify-between gap-4 py-6 text-left"
                    >
                      <span className="text-lg md:text-xl font-medium text-ink tracking-tight">{faq.pergunta}</span>
                      <ChevronDown
                        className={`w-5 h-5 text-ink-muted shrink-0 transition-transform duration-300 ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <p className="text-base text-ink-muted font-light leading-relaxed pb-6 max-w-2xl">
                        {faq.resposta}
                      </p>
                    )}
                  </div>
                );
              })}
            </Reveal>
          </div>
        </div>
      </section>
    </>
  );
}
