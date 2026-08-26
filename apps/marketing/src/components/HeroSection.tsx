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
    <section className="relative isolate overflow-hidden pt-20 md:pt-36 pb-10 md:pb-20">
      <HeroBackdrop />

      <div className="relative z-10 mx-auto max-w-6xl px-4 md:px-10">
        <div className="text-center">
          {/* Duas linhas, sempre. A largura não é limitada por `ch` e cada linha
              é `whitespace-nowrap`: com limite em ch, o verbo mais longo
              ("centralizam") empurrava o título para três linhas e a hero
              saltava a cada troca de palavra. O corpo cai um pouco para a linha
              mais larga caber. */}
          <h1 className="text-[62px] max-[1100px]:text-[50px] max-[850px]:text-[34px] max-[420px]:text-[27px] font-medium tracking-[-0.035em] leading-[1.1] text-ink mb-6 mx-auto">
            {/* Acima de 850px as duas linhas não quebram, então trocar o verbo
                nunca vira uma terceira linha. Abaixo disso o `nowrap` faria o
                título vazar a tela, então a pílula cai para uma linha só dela:
                são três linhas fixas no celular, igualmente estáveis. */}
            <span className="block max-[850px]:whitespace-normal min-[851px]:whitespace-nowrap">
              <Palavras texto={LINHA_1} atraso={0.1} />
              <span className="max-[850px]:block min-[851px]:inline">
                <span className="max-[850px]:hidden"> </span>
                <RotatingWord palavras={VERBOS} atraso={0.26} />
              </span>
            </span>
            <span className="block max-[850px]:whitespace-normal min-[851px]:whitespace-nowrap">
              <Palavras texto={LINHA_2} atraso={0.34} />
            </span>
          </h1>

          <m.p
            initial={reducedMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE.out, delay: 0.55 }}
            className="text-[14px] md:text-[17px] text-ink-soft max-w-xl mx-auto mb-8 md:mb-9 leading-relaxed px-2"
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
        className="relative z-10 mx-auto max-w-6xl px-4 md:px-10 mt-10 md:mt-20"
      >
        <div className="mx-auto">
          <HeroScene />
        </div>
      </m.div>
    </section>
  );
}
