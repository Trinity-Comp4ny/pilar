import { Check } from "lucide-react";
import { HeroBackdrop } from "../components/hero/HeroBackdrop";
import { Reveal } from "../components/Reveal";
import { DEMO_EMBED_URL, DEMO_URL } from "../lib/contato";
import { usePageMeta } from "../lib/seo";

const ROTEIRO = [
  "Seu fluxo de hoje: como chegam os clientes, como sai a proposta, como a obra é acompanhada.",
  "A Pilar no seu caso: proposta, projeto, obra e financeiro com dados de demonstração.",
  "Os agentes de IA preparando o trabalho e esperando a sua aprovação.",
  "Plano, implantação e o que fica pronto no primeiro dia.",
];

/**
 * Agendamento da demonstração dentro do site (decisão de 2026-11-24). Antes todo
 * botão abria o Google Agenda em outra aba; agora a agenda vem embutida aqui, com
 * o link externo de reserva para quem bloqueia iframe de terceiros.
 */
export function Demonstracao() {
  usePageMeta({
    titulo: "Agende uma demonstração da Pilar",
    descricao:
      "Escolha um horário e veja a Pilar aplicada ao seu negócio: proposta, projeto, obra, financeiro e agentes de IA.",
    caminho: "/demonstracao",
  });

  return (
    <section className="relative isolate overflow-hidden px-5 pb-16 pt-24 md:px-10 md:pb-24 md:pt-32">
      <HeroBackdrop />
      <div className="relative z-10 mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
        <Reveal variant="up" className="min-w-0">
          <h1 className="mb-5 text-[52px] font-medium leading-[1.06] tracking-[-0.035em] text-ink max-[1100px]:text-[40px] max-[850px]:text-[30px] max-[420px]:text-[26px]">
            Veja a Pilar <span className="italic text-ink/45">no seu negócio.</span>
          </h1>
          <p className="mb-8 max-w-md text-[15px] leading-relaxed text-ink-soft md:text-[16px]">
            Escolha um horário na agenda. A conversa é por vídeo, com alguém da equipe da Pilar, e segue o jeito que o
            seu escritório ou a sua obra já trabalha.
          </p>
          <h2 className="mb-3 text-[11px] font-medium uppercase tracking-[0.16em] text-ink-muted">
            O que a gente mostra
          </h2>
          <ul className="flex flex-col gap-3">
            {ROTEIRO.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-[14px] leading-snug text-ink">
                <span className="mt-[1px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-brand">
                  <Check className="h-3 w-3 text-ink" strokeWidth={2.6} />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal variant="up" delay={0.1} className="min-w-0">
          <div className="overflow-hidden rounded-[22px] border border-paper-border bg-white">
            <iframe
              title="Agenda da demonstração da Pilar"
              src={DEMO_EMBED_URL}
              loading="lazy"
              className="block h-[720px] w-full border-0 max-md:h-[820px]"
            />
          </div>
          <p className="mt-3 text-[12.5px] text-ink-muted">
            A agenda não carregou?{" "}
            <a
              href={DEMO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink underline underline-offset-2 hover:text-ink/70"
            >
              Abra no Google Agenda
            </a>
            .
          </p>
        </Reveal>
      </div>
    </section>
  );
}
