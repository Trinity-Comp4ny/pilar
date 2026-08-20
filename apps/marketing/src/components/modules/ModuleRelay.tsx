import { useEffect, useRef, useState } from "react";
import { m, useInView, useReducedMotion } from "framer-motion";
import { EASE } from "../../lib/motion";
import { MODULOS } from "../../lib/modules";

/**
 * Bastão entre os três módulos: o dado entra no Gestão e é passado adiante até
 * a Obra, em loop.
 *
 * A versão anterior era um traço cinza que só preenchia conforme o scroll, sem
 * dizer nada sobre o que viaja entre os módulos. Aqui cada passagem tem um
 * feixe que corre pelo trecho, o nó de destino pulsa ao receber, e a legenda no
 * meio nomeia o que acabou de ser passado. É a frase "o dado entra uma vez, no
 * lead, e segue até o diário de obra" encenada.
 *
 * Só `transform` e `opacity` animam, e o loop para fora da viewport.
 */

/** O que viaja em cada trecho, na ordem em que a história acontece. */
const PASSAGENS = [
  { de: 0, para: 1, carga: "Proposta aprovada vira projeto" },
  { de: 1, para: 2, carga: "Cronograma vira frente de obra" },
] as const;

/** Duração de cada passo do ciclo, em ms. */
const CORRIDA = 1500;
const PAUSA = 1100;

export function ModuleRelay() {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const emVista = useInView(ref, { amount: 0.6 });
  // -1 = repouso (nada correndo). 0 e 1 = a passagem correspondente.
  const [passo, setPasso] = useState(-1);

  useEffect(() => {
    if (reducedMotion || !emVista) return;

    let i = -1;
    const avancar = () => {
      i = i + 1 > PASSAGENS.length - 1 ? -1 : i + 1;
      setPasso(i);
    };

    avancar();
    const id = window.setInterval(avancar, CORRIDA + PAUSA);
    return () => window.clearInterval(id);
  }, [reducedMotion, emVista]);

  return (
    <div ref={ref} className="hidden md:block relative mb-14" aria-hidden="true">
      <div className="relative grid grid-cols-3">
        {MODULOS.map((mo, i) => {
          // Um nó está "aceso" quando já recebeu o bastão neste ciclo.
          const recebeu = reducedMotion || passo === -1 ? i === 0 : i <= PASSAGENS[passo].para;
          const chegandoAgora = passo >= 0 && PASSAGENS[passo].para === i;

          return (
            <div key={mo.slug} className="relative flex flex-col items-center">
              {/* Trecho que liga este nó ao anterior. */}
              {i > 0 && (
                <span className="absolute right-1/2 top-[7px] w-full h-px bg-paper-border overflow-hidden">
                  <m.span
                    className={`absolute inset-y-0 left-0 w-full origin-left ${mo.cor.strong}`}
                    initial={false}
                    animate={{ scaleX: recebeu ? 1 : 0 }}
                    transition={
                      recebeu
                        ? { duration: CORRIDA / 1000, ease: EASE.inOut }
                        : { duration: 0.3, ease: EASE.out }
                    }
                  />
                  {/* Cabeça luminosa do feixe, que corre à frente do traço. */}
                  {chegandoAgora && !reducedMotion && (
                    <m.span
                      className="absolute top-1/2 -translate-y-1/2 w-10 h-[3px] rounded-full bg-white/70 blur-[2px]"
                      initial={{ left: "-12%" }}
                      animate={{ left: "104%" }}
                      transition={{ duration: CORRIDA / 1000, ease: EASE.inOut }}
                    />
                  )}
                </span>
              )}

              <span className="relative flex items-center justify-center w-[15px] h-[15px]">
                {/* Onda que sai do nó no instante em que ele recebe. */}
                {chegandoAgora && !reducedMotion && (
                  <m.span
                    className={`absolute inset-0 rounded-full ${mo.cor.strong}`}
                    initial={{ scale: 1, opacity: 0.5 }}
                    animate={{ scale: 2.9, opacity: 0 }}
                    transition={{ duration: 0.75, ease: EASE.out, delay: CORRIDA / 1000 - 0.1 }}
                  />
                )}
                <m.span
                  className={`w-2.5 h-2.5 rounded-full ${mo.cor.strong}`}
                  initial={false}
                  animate={{ scale: recebeu ? 1 : 0.62, opacity: recebeu ? 1 : 0.3 }}
                  transition={{ duration: 0.4, ease: EASE.out, delay: chegandoAgora ? CORRIDA / 1000 - 0.1 : 0 }}
                />
              </span>

              <span
                className={`mt-3 text-[10px] uppercase tracking-[0.14em] font-medium transition-colors duration-500 ${
                  recebeu ? mo.cor.text : "text-ink-muted/45"
                }`}
              >
                {mo.nome}
              </span>
            </div>
          );
        })}
      </div>

      {/* Legenda do que acabou de ser passado. Altura reservada, então a grade
          não pula quando o texto troca. */}
      <div className="relative h-5 mt-3">
        {PASSAGENS.map((p, i) => (
          <m.span
            key={p.carga}
            className="absolute inset-x-0 text-center text-[11.5px] text-ink-muted font-light"
            initial={false}
            animate={{ opacity: passo === i ? 1 : 0, y: passo === i ? 0 : 4 }}
            transition={
              passo === i
                ? { duration: 0.3, ease: EASE.out, delay: 0.22 }
                : { duration: 0.18, ease: EASE.out }
            }
          >
            {p.carga}
          </m.span>
        ))}
      </div>
    </div>
  );
}
