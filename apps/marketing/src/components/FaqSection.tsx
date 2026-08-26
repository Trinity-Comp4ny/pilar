import { useState } from "react";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { APP_URL } from "../config";
import { trackCta } from "../analytics";
import { Reveal } from "./Reveal";
import { RevealGroup } from "./motion";
import { EASE } from "../lib/motion";

/**
 * Dúvidas em acordeão, no formato da referência: cartões brancos empilhados,
 * um aberto por vez, com a resposta abrindo em altura animada.
 *
 * É um recorte das perguntas que mais aparecem antes da assinatura. A /faq
 * continua existindo com a lista inteira.
 */

const PERGUNTAS = [
  {
    q: "Como funcionam os 14 dias grátis?",
    a: "Você cria a conta e usa o sistema inteiro, sem cartão. No fim do período, escolhe um plano para continuar. Nada é cobrado automaticamente.",
  },
  {
    q: "Preciso migrar meus projetos na mão?",
    a: "Não. Importamos clientes, projetos em andamento e o histórico financeiro a partir da sua planilha, e conferimos junto com você antes de liberar.",
  },
  {
    q: "Os agentes de IA gravam algo sem eu ver?",
    a: "Nunca. O agente monta um rascunho e espera a sua confirmação. Toda execução fica registrada, e o botão de desfazer apaga exatamente o que aquela execução criou.",
  },
  {
    q: "Serve para escritório de uma disciplina só?",
    a: "Serve, mas o Pilar foi desenhado para quem toca várias disciplinas no mesmo projeto: é aí que o controle de prazo e margem por disciplina paga o investimento.",
  },
  {
    q: "Meus dados ficam isolados dos outros clientes?",
    a: "Ficam. O isolamento é por empresa, aplicado no banco e não só na tela, e os agentes leem com a sua permissão, nunca com chave de administrador.",
  },
];

function Item({ q, a, aberto, aoAbrir }: { q: string; a: string; aberto: boolean; aoAbrir: () => void }) {
  const reducedMotion = useReducedMotion();

  return (
    <div className="rounded-2xl border border-paper-border bg-frame overflow-hidden">
      <button
        type="button"
        onClick={aoAbrir}
        aria-expanded={aberto}
        className="w-full flex items-center gap-4 px-5 md:px-6 py-4 md:py-5 text-left"
      >
        <span className="flex-1 text-[15px] md:text-[16px] font-medium text-ink">{q}</span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 text-ink-muted transition-transform duration-300 ${aberto ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {aberto && (
          <m.div
            initial={reducedMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.34, ease: EASE.out }}
            className="overflow-hidden"
          >
            <p className="px-5 md:px-6 pb-5 md:pb-6 text-[14px] text-ink-soft leading-relaxed max-w-[70ch]">{a}</p>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FaqSection() {
  const [aberto, setAberto] = useState(0);

  return (
    <section id="faq" className="w-full bg-paper px-6 md:px-10 pb-24 md:pb-32 scroll-mt-28">
      <div className="max-w-3xl mx-auto">
        <Reveal variant="up" className="text-center mb-10">
          <h2 className="text-[clamp(30px,4.2vw,52px)] font-medium tracking-[-0.035em] leading-[1.08] text-ink mb-4">
            O que costumam perguntar
          </h2>
          <p className="text-[15px] text-ink-soft leading-relaxed mb-6">
            Não achou o que procurava? Fale com a gente, respondemos no mesmo dia.
          </p>
          <a
            href="https://wa.me/5514998721100"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackCta("agende_demo", "faq")}
            className="inline-flex items-center justify-center h-11 px-6 rounded-full bg-ink text-white text-[14px] font-medium hover:bg-ink/90 transition-colors"
          >
            Falar com a gente
          </a>
        </Reveal>

        <RevealGroup className="flex flex-col gap-3" stagger={0.07}>
          {PERGUNTAS.map((p, i) => (
            <RevealGroup.Item key={p.q} variant="up">
              <Item {...p} aberto={aberto === i} aoAbrir={() => setAberto(aberto === i ? -1 : i)} />
            </RevealGroup.Item>
          ))}
        </RevealGroup>

        <Reveal variant="fade" delay={0.15} className="text-center mt-8">
          <a
            href={`${APP_URL}/cadastro`}
            onClick={() => trackCta("testar_gratis", "faq")}
            className="text-[13.5px] text-ink-soft underline decoration-brand underline-offset-4 hover:text-ink transition-colors"
          >
            Ou comece o teste grátis agora
          </a>
        </Reveal>
      </div>
    </section>
  );
}
