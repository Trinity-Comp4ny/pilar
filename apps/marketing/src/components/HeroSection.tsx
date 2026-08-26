import { m, useReducedMotion } from "framer-motion";
import { APP_URL } from "../config";
import { trackCta } from "../analytics";
import { HeroScene } from "./hero/HeroScene";
import { HeroBackdrop } from "./hero/HeroBackdrop";
import { SplitButton } from "./ui/SplitButton";
import { RotatingWord } from "./RotatingWord";
import { EASE } from "../lib/motion";

/**
 * Hero.
 *
 * A tipografia segue a proporção da referência: display em peso 500 com
 * tracking bem fechado, duas linhas, e a palavra que carrega a promessa em
 * itálico sobre o verde da marca. O verbo que girava numa pílula saiu: com a
 * palavra em itálico o destaque já está no lugar certo, e a hero deixa de ter
 * duas coisas competindo pela mesma atenção.
 */

const LINHA_1 = "Onde times e agentes";
const LINHA_2 = "gestão, projetos e obras.";

/** Os verbos que giram no lugar do destaque, um por matiz de módulo. */
const VERBOS = ["organizam", "conectam", "centralizam", "executam"];

/** Cada palavra sobe de dentro da própria linha, escalonada. */
function Palavras({ texto, atraso = 0, className }: { texto: string; atraso?: number; className?: string }) {
  const reducedMotion = useReducedMotion();
  const palavras = texto.split(" ");

  return (
    <>
      {palavras.map((palavra, i) => (
        <span key={`${palavra}-${i}`} className="inline-block overflow-hidden align-bottom pb-[0.1em] -mb-[0.1em]">
          <m.span
            className={`inline-block ${className ?? ""}`}
            initial={reducedMotion ? false : { y: "110%" }}
            animate={{ y: "0%" }}
            transition={{ duration: 0.85, ease: EASE.out, delay: atraso + i * 0.055 }}
          >
            {palavra}
          </m.span>
          {i < palavras.length - 1 && <span>&nbsp;</span>}
        </span>
      ))}
    </>
  );
}

export function HeroSection() {
  const reducedMotion = useReducedMotion();

  return (
    <section className="relative isolate overflow-hidden pt-28 md:pt-36 pb-14 md:pb-20">
      <HeroBackdrop />

      <div className="relative z-10 mx-auto max-w-6xl px-6 md:px-10">
        <div className="text-center">
          <h1 className="text-[clamp(36px,5.6vw,74px)] font-medium tracking-[-0.035em] leading-[1.05] text-ink mb-6 max-w-[18ch] md:max-w-[22ch] mx-auto">
            <span className="block">
              <Palavras texto={LINHA_1} atraso={0.1} />{" "}
              <RotatingWord palavras={VERBOS} atraso={0.26} />
            </span>
            <span className="block">
              <Palavras texto={LINHA_2} atraso={0.34} />
            </span>
          </h1>

          <m.p
            initial={reducedMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE.out, delay: 0.55 }}
            className="text-[15px] md:text-[17px] text-ink-soft max-w-xl mx-auto mb-9 leading-relaxed"
          >
            Feche propostas, controle cronogramas e acompanhe obras, com agentes de IA feitos pro seu escritório de
            engenharia.
          </m.p>

          <m.div
            initial={reducedMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE.out, delay: 0.65 }}
            className="flex flex-col items-center gap-3"
          >
            <SplitButton
              href={`${APP_URL}/cadastro`}
              onClick={() => trackCta("testar_gratis", "hero")}
            >
              Testar grátis por 14 dias
            </SplitButton>
            <p className="text-[12.5px] text-ink-muted">Sem cartão · Cancele quando quiser</p>
          </m.div>
        </div>
      </div>

      {/* A cena do produto sobe por cima da paisagem, como na referência. */}
      <m.div
        initial={reducedMotion ? false : { opacity: 0, y: 48 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: EASE.out, delay: 0.8 }}
        className="relative z-10 mx-auto max-w-6xl px-6 md:px-10 mt-16 md:mt-20"
      >
        <div className="mx-auto">
          <HeroScene />
        </div>
      </m.div>
    </section>
  );
}
