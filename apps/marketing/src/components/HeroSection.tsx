import { ArrowRight } from "lucide-react";
import { m, useReducedMotion } from "framer-motion";
import { APP_URL } from "../config";
import { trackCta } from "../analytics";
import { HeroScene } from "./hero/HeroScene";
import { RotatingPill, type PillWord } from "./RotatingPill";
import { GridBackdrop, ScrollSettle } from "./motion";
import { EASE, staggerContainer } from "../lib/motion";

/** Verbos originais da hero, agora cada um com o matiz de um módulo. */
const ROTATING_WORDS: PillWord[] = [
  { palavra: "conectam", fill: "bg-modulo-gestao", dot: "bg-modulo-gestao-strong" },
  { palavra: "organizam", fill: "bg-modulo-projetos", dot: "bg-modulo-projetos-strong" },
  { palavra: "centralizam", fill: "bg-modulo-obra", dot: "bg-modulo-obra-strong" },
  { palavra: "executam", fill: "bg-brand", dot: "bg-modulo-gestao-strong" },
];

const sobe = {
  hidden: { opacity: 0, y: 22, filter: "blur(8px)" },
  visible: { opacity: 1, y: 0, filter: "blur(0px)" },
};

export function HeroSection() {
  const reducedMotion = useReducedMotion();

  return (
    <section className="relative pt-24 pb-14 md:pt-28 md:pb-18 overflow-hidden bg-paper-white">
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/3 w-[900px] h-[600px] bg-brand/7 rounded-full blur-[130px] animate-aurora" />
        <div className="absolute top-1/4 right-0 w-[500px] h-[400px] bg-modulo-projetos/20 rounded-full blur-[100px] animate-aurora-alt" />
        <GridBackdrop mascara="top" />
      </div>

      <div className="container mx-auto px-6 md:px-10">
        {/* A entrada da hero é uma cascata só: badge, título, subtítulo, botões.
            Antes tudo nascia junto e a página abria estática. */}
        <m.div
          className="text-center"
          initial={reducedMotion ? false : "hidden"}
          animate="visible"
          variants={staggerContainer(0.09, 0.05)}
        >
          <m.div variants={sobe} transition={{ duration: 0.7, ease: EASE.out }}>
            <span className="inline-flex items-center gap-2 mb-5 px-3 py-1.5 rounded-full border border-paper-border bg-white/70 backdrop-blur text-[11.5px] text-ink-soft">
              <span className="relative flex w-1.5 h-1.5">
                <span className="absolute inline-flex w-full h-full rounded-full bg-modulo-gestao-strong opacity-70 motion-safe:animate-ping" />
                <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-modulo-gestao-strong" />
              </span>
              Para escritórios de engenharia multidisciplinar
            </span>
          </m.div>

          {/* Tipografia calibrada pela hero do Notion: peso 600 (teto da variable
              font Inter hospedada, que só cobre de 300 a 600), tracking -0.046em. A
              escala caiu em relação à versão anterior para a cena do produto
              começar acima da dobra em telas de 900px de altura. */}
          <m.h1
            variants={sobe}
            transition={{ duration: 0.8, ease: EASE.out }}
            className="text-balance text-[clamp(32px,4.7vw,57px)] font-semibold tracking-[-0.04em] text-ink mb-4 leading-[1.08] max-w-4xl mx-auto"
          >
            Onde times e agentes <RotatingPill words={ROTATING_WORDS} /> gestão, projetos e obras.
          </m.h1>

          <m.p
            variants={sobe}
            transition={{ duration: 0.7, ease: EASE.out }}
            className="text-base md:text-[17px] text-ink-soft max-w-xl mx-auto mb-6 leading-relaxed font-light"
          >
            Feche propostas, controle cronogramas e acompanhe obras, com agentes de IA feitos pro seu escritório de
            engenharia.
          </m.p>

          <m.div
            variants={sobe}
            transition={{ duration: 0.7, ease: EASE.out }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-3"
          >
            <a
              href={`${APP_URL}/cadastro`}
              onClick={() => trackCta("testar_gratis", "hero")}
              className="relative w-full sm:w-auto sm:min-w-[196px] px-7 py-3.5 bg-brand text-ink rounded-full font-medium text-[15px] hover:bg-brand/80 transition-colors flex items-center justify-center gap-2 group overflow-hidden"
            >
              <span className="absolute inset-0 -skew-x-12 translate-x-[-160%] group-hover:translate-x-[200%] transition-transform duration-700 bg-white/10 pointer-events-none" />
              Testar grátis por 14 dias
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </a>
            <a
              href="#produto"
              onClick={(e) => {
                e.preventDefault();
                trackCta("ver_como_funciona", "hero");
                document.getElementById("produto")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="w-full sm:w-auto sm:min-w-[176px] px-6 py-3.5 text-ink-soft font-medium text-[15px] border border-paper-border bg-white/60 hover:bg-white hover:text-ink rounded-full transition-colors flex items-center justify-center"
            >
              Ver como funciona
            </a>
          </m.div>

          <m.p variants={sobe} transition={{ duration: 0.6, ease: EASE.out }} className="text-xs text-ink-muted font-light mb-9 md:mb-11">
            Sem cartão · Cancele quando quiser
          </m.p>
        </m.div>

        {/* A cena assenta conforme o visitante desce: começa levemente afastada
            e chega ao 1:1 quando está inteira na tela. */}
        <ScrollSettle className="max-w-5xl mx-auto">
          <m.div
            initial={reducedMotion ? false : { opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: EASE.out, delay: 0.45 }}
          >
            <HeroScene />
          </m.div>
        </ScrollSettle>
      </div>
    </section>
  );
}
