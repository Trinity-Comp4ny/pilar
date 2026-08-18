import { Reveal } from "./Reveal";

/**
 * Portal do cliente. É um portal só, com duas visões: quem contratou projeto
 * vê disciplina e entrega, quem contratou obra vê frente e prestação de contas.
 */

const PROJETO = [
  { label: "Estrutural", valor: "Entregue", tom: "ok" as const },
  { label: "Elétrico", valor: "Entregue", tom: "ok" as const },
  { label: "Climatização", valor: "Em revisão", tom: "espera" as const },
  { label: "Parcela 2 de 3", valor: "R$ 42.800", tom: "numero" as const },
];

const OBRA = [
  { label: "Aportes do cliente", valor: "R$ 320.000", tom: "numero" as const },
  { label: "Despesas com comprovante", valor: "R$ 218.450", tom: "numero" as const },
  { label: "Saldo em conta", valor: "R$ 101.550", tom: "numero" as const },
  { label: "Taxa de administração", valor: "R$ 21.845", tom: "numero" as const },
];

function Linha({ label, valor, tom }: { label: string; valor: string; tom: "ok" | "espera" | "numero" }) {
  return (
    <div className="flex justify-between items-center text-[11.5px] py-2 border-b border-paper-border/50 last:border-0 text-ink-soft">
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
    </div>
  );
}

export function PortalSection() {
  return (
    <section id="portal" className="py-28 md:py-36 bg-paper scroll-mt-20">
      <div className="container mx-auto px-6 md:px-10">
        <div className="max-w-5xl mx-auto">
          <Reveal className="max-w-2xl mb-14">
            <div className="mb-6">
              <span className="inline-block px-3 py-1 bg-brand text-ink-on-brand text-xs font-medium uppercase tracking-[0.2em] rounded-sm">
                Portal do cliente
              </span>
            </div>
            <h2 className="text-3xl md:text-5xl font-medium text-ink leading-[1.1] tracking-tight mb-5">
              Seu cliente acompanha sozinho. <span className="italic text-ink/55">Seu WhatsApp descansa.</span>
            </h2>
            <p className="text-base text-ink-soft font-light leading-relaxed">
              Um portal, duas visões: quem contratou projeto vê disciplina e entrega, quem contratou obra vê frente e
              prestação de contas.
            </p>
          </Reveal>

          <div className="grid md:grid-cols-2 gap-4">
            <Reveal className="bg-white border border-paper-border/60 rounded-xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-paper-border">
              <div className="px-4 py-2.5 border-b border-paper-border/60 bg-paper-alt">
                <span className="text-[8.5px] uppercase tracking-[0.1em] text-ink-muted">Visão de projeto</span>
              </div>
              <div className="p-4">
                {PROJETO.map((l) => (
                  <Linha key={l.label} {...l} />
                ))}
              </div>
            </Reveal>

            <Reveal
              delay={0.08}
              className="bg-white border border-paper-border/60 rounded-xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-paper-border"
            >
              <div className="px-4 py-2.5 border-b border-paper-border/60 bg-paper-alt">
                <span className="text-[8.5px] uppercase tracking-[0.1em] text-ink-muted">Visão de obra</span>
              </div>
              <div className="p-4">
                {OBRA.map((l) => (
                  <Linha key={l.label} {...l} />
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
