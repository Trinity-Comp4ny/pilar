import { Marquee } from "./motion";
import { Reveal } from "./Reveal";

/**
 * Faixa de capacidades entre a hero e os módulos.
 *
 * Ocupa o lugar que numa LP costuma ser "logos de clientes". Como ainda não há
 * logo que possa ser exibido, a prova aqui é a amplitude do que o sistema faz
 * de fato, na linguagem de quem contrata. Nada nesta lista é promessa: tudo
 * existe em produção hoje.
 */

const CAPACIDADES = [
  "Funil de leads",
  "Proposta no seu template",
  "Contrato e parcelas",
  "Extrato lido por IA",
  "Cronograma por disciplina",
  "Diário de obra offline",
  "Portal do cliente",
  "Prestação de contas de obra",
  "Folha e pró-labore",
  "Margem por projeto",
  "Nota fiscal e PIX",
  "Aditivo de escopo",
];

const DISCIPLINAS = ["Civil", "Estrutural", "Elétrica", "Hidráulica", "Climatização", "Incêndio"];

export function CapabilityStrip() {
  return (
    <section className="relative py-12 md:py-14 bg-paper-white border-y border-paper-border">
      <div className="container mx-auto px-6 md:px-10">
        <Reveal variant="fade" className="text-center mb-7">
          <p className="text-[11px] uppercase tracking-[0.18em] text-ink-muted">
            Um sistema só, do primeiro contato à última medição
          </p>
        </Reveal>
      </div>

      <Marquee duration={44}>
        {CAPACIDADES.map((c) => (
          <span key={c} className="flex items-center gap-3 text-[15px] text-ink-soft font-light whitespace-nowrap">
            <span className="w-1 h-1 rounded-full bg-modulo-gestao-strong/60" />
            {c}
          </span>
        ))}
      </Marquee>

      <div className="container mx-auto px-6 md:px-10">
        <Reveal variant="fade" delay={0.1} className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-2 mt-8">
          <span className="text-[11.5px] text-ink-muted mr-1">Disciplinas atendidas:</span>
          {DISCIPLINAS.map((d) => (
            <span
              key={d}
              className="text-[11.5px] px-2.5 py-1 rounded-full border border-paper-border bg-white text-ink-soft"
            >
              {d}
            </span>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
