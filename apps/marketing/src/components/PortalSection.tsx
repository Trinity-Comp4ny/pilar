import { m, useReducedMotion } from "framer-motion";
import { MessageSquareOff } from "lucide-react";
import { Reveal } from "./Reveal";
import { NumberTicker, RevealGroup, TextReveal } from "./motion";
import { EASE } from "../lib/motion";

/**
 * Portal do cliente. É um portal só, com duas visões: quem contratou projeto
 * vê disciplina e entrega, quem contratou obra vê frente e prestação de contas.
 *
 * A versão anterior eram dois cards pequenos num bloco de 825px de altura, com
 * o resto vazio. Agora os cards têm cabeçalho de verdade, barra de progresso e
 * um fecho que amarra a promessa do título (SPEC 060).
 */

const PROJETO = {
  titulo: "Visão de projeto",
  subtitulo: "Quem contratou projeto",
  progresso: 0.72,
  rotuloProgresso: "72% das disciplinas entregues",
  linhas: [
    { label: "Estrutural", valor: "Entregue", tom: "ok" as const },
    { label: "Elétrico", valor: "Entregue", tom: "ok" as const },
    { label: "Climatização", valor: "Em revisão", tom: "espera" as const },
    { label: "Parcela 2 de 3", valor: "R$ 42.800", tom: "numero" as const },
  ],
};

const OBRA = {
  titulo: "Visão de obra",
  subtitulo: "Quem contratou administração",
  progresso: 0.68,
  rotuloProgresso: "68% do aporte já prestado em conta",
  linhas: [
    { label: "Aportes do cliente", valor: "R$ 320.000", tom: "numero" as const },
    { label: "Despesas com comprovante", valor: "R$ 218.450", tom: "numero" as const },
    { label: "Saldo em conta", valor: "R$ 101.550", tom: "numero" as const },
    { label: "Taxa de administração", valor: "R$ 21.845", tom: "numero" as const },
  ],
};

type Tom = "ok" | "espera" | "numero";

function Linha({ label, valor, tom, atraso }: { label: string; valor: string; tom: Tom; atraso: number }) {
  const reducedMotion = useReducedMotion();

  return (
    <m.div
      className="flex justify-between items-center text-[12px] py-2.5 border-b border-paper-border/50 last:border-0 text-ink-soft"
      initial={reducedMotion ? false : { opacity: 0, x: 12 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, amount: 0.5 }}
      transition={{ duration: 0.45, delay: atraso, ease: EASE.out }}
    >
      <span>{label}</span>
      {tom === "numero" ? (
        <span className="text-ink font-medium tabular-nums">{valor}</span>
      ) : (
        <span
          className={`text-[8px] uppercase tracking-[0.08em] px-2 py-0.5 rounded-full ${
            tom === "ok" ? "bg-brand/40 text-modulo-gestao-strong" : "bg-paper-alt text-ink-muted"
          }`}
        >
          {valor}
        </span>
      )}
    </m.div>
  );
}

function CardVisao({ dados, atraso }: { dados: typeof PROJETO; atraso: number }) {
  const reducedMotion = useReducedMotion();

  return (
    <div className="h-full rounded-2xl border border-paper-border/70 bg-white overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_50px_-24px_rgba(0,0,0,0.3)] hover:border-paper-border">
      <div className="px-4 py-3 border-b border-paper-border/60 bg-paper-alt">
        <p className="text-[8.5px] uppercase tracking-[0.11em] text-ink-muted mb-0.5">{dados.subtitulo}</p>
        <p className="text-[14px] font-medium text-ink">{dados.titulo}</p>
      </div>

      <div className="px-4 pt-4">
        <div className="h-1.5 rounded-full bg-paper-alt overflow-hidden mb-1.5">
          <m.span
            className="block h-full w-full rounded-full bg-modulo-gestao-strong origin-left"
            initial={reducedMotion ? false : { scaleX: 0 }}
            whileInView={{ scaleX: dados.progresso }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 1, delay: atraso + 0.1, ease: EASE.out }}
          />
        </div>
        <p className="text-[9.5px] text-ink-muted mb-1">{dados.rotuloProgresso}</p>
      </div>

      <div className="p-4 pt-2">
        {dados.linhas.map((l, i) => (
          <Linha key={l.label} {...l} atraso={atraso + 0.2 + i * 0.09} />
        ))}
      </div>
    </div>
  );
}

export function PortalSection() {
  return (
    <section id="portal" className="py-24 md:py-32 bg-paper scroll-mt-20">
      <div className="container mx-auto px-6 md:px-10">
        <div className="max-w-5xl mx-auto">
          <div className="max-w-2xl mb-12">
            <Reveal variant="down" className="mb-5">
              <span className="inline-block px-3 py-1 bg-brand text-ink-on-brand text-xs font-medium uppercase tracking-[0.2em] rounded-sm">
                Portal do cliente
              </span>
            </Reveal>
            <TextReveal
              as="h2"
              text="Seu cliente acompanha sozinho. Seu WhatsApp descansa."
              highlight="Seu WhatsApp descansa."
              highlightClassName="italic text-ink/45"
              className="text-3xl md:text-[44px] font-medium text-ink leading-[1.1] tracking-tight mb-5"
            />
            <Reveal variant="fade" delay={0.25}>
              <p className="text-[15px] text-ink-soft font-light leading-relaxed">
                Um portal, duas visões: quem contratou projeto vê disciplina e entrega, quem contratou obra vê frente e
                prestação de contas.
              </p>
            </Reveal>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <Reveal variant="left" loose>
              <CardVisao dados={PROJETO} atraso={0} />
            </Reveal>
            <Reveal variant="right" delay={0.1} loose>
              <CardVisao dados={OBRA} atraso={0.12} />
            </Reveal>
          </div>

          {/* Fecho: transforma o benefício abstrato do título em números. */}
          <RevealGroup className="grid sm:grid-cols-3 gap-4" stagger={0.09}>
            {[
              { valor: 1, sufixo: " link", texto: "por cliente, sem ele criar conta nem instalar nada" },
              { valor: 24, sufixo: "h por dia", texto: "para o cliente conferir sozinho, no horário dele" },
              { valor: 0, sufixo: " planilhas", texto: "enviadas por e-mail para prestar contas do mês" },
            ].map((k) => (
              <RevealGroup.Item key={k.texto} variant="up">
                <div className="rounded-xl border border-paper-border/60 bg-paper-alt/50 px-4 py-4 h-full">
                  <p className="text-[26px] font-medium text-ink tracking-tight leading-none mb-2">
                    <NumberTicker value={k.valor} suffix={k.sufixo} duration={1.2} />
                  </p>
                  <p className="text-[12px] text-ink-muted font-light leading-relaxed">{k.texto}</p>
                </div>
              </RevealGroup.Item>
            ))}
          </RevealGroup>

          <Reveal variant="fade" delay={0.2} className="flex items-center justify-center gap-2 mt-8">
            <MessageSquareOff className="w-3.5 h-3.5 text-ink-muted shrink-0" strokeWidth={1.8} />
            <p className="text-[12.5px] text-ink-muted font-light">
              Menos "e aí, como está o projeto?" no fim da tarde de sexta.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
