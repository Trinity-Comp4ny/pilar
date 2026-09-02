import { useRef } from "react";
import { m, useReducedMotion, useScroll, useTransform } from "framer-motion";

/**
 * Tese do produto em texto grande, revelada palavra a palavra conforme o
 * visitante rola.
 *
 * Cada palavra acende quando o scroll passa por ela: o texto começa apagado e
 * vai ganhando tinta da esquerda para a direita. É a peça que dá ritmo entre a
 * hero e o corpo da página, e força a leitura da frase que sustenta o resto.
 */

const FRASE =
  "O dado entra uma vez, no lead, e segue até o diário de obra. A proposta aprovada vira projeto, o projeto vira cronograma, e o que acontece no canteiro volta como margem no fim do mês.";

function Palavra({ palavra, inicio, fim, progresso }: { palavra: string; inicio: number; fim: number; progresso: ReturnType<typeof useScroll>["scrollYProgress"] }) {
  const opacidade = useTransform(progresso, [inicio, fim], [0.16, 1]);
  return (
    <m.span style={{ opacity: opacidade }} className="inline-block">
      {palavra}&nbsp;
    </m.span>
  );
}

export function StatementSection() {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.45"] });

  const palavras = FRASE.split(" ");

  return (
    <section className="w-full bg-paper px-5 md:px-10 py-16 md:py-36">
      <div ref={ref} className="max-w-5xl mx-auto">
        <p className="text-[48px] max-[1100px]:text-[38px] max-[850px]:text-[26px] max-[420px]:text-[22px] font-medium tracking-[-0.03em] leading-[1.24] text-ink">
          {reducedMotion
            ? FRASE
            : palavras.map((p, i) => (
                <Palavra
                  key={`${p}-${i}`}
                  palavra={p}
                  // Cada palavra ocupa uma fatia do progresso, com sobreposição
                  // de meia fatia: sem isso a revelação vira degrau, não onda.
                  inicio={i / palavras.length}
                  fim={(i + 1.6) / palavras.length}
                  progresso={scrollYProgress}
                />
              ))}
        </p>
      </div>
    </section>
  );
}
