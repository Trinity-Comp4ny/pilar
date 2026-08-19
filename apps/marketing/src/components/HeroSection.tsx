import { ArrowRight } from "lucide-react";
import { APP_URL } from "../config";
import { trackCta } from "../analytics";
import { ProductTour } from "./ProductTour";
import { RotatingPill, type PillWord } from "./RotatingPill";

/** Verbos originais da hero, agora cada um com o matiz de um módulo. */
const ROTATING_WORDS: PillWord[] = [
  { palavra: "conectam", fill: "bg-modulo-gestao", dot: "bg-modulo-gestao-strong" },
  { palavra: "organizam", fill: "bg-modulo-projetos", dot: "bg-modulo-projetos-strong" },
  { palavra: "centralizam", fill: "bg-modulo-obra", dot: "bg-modulo-obra-strong" },
  { palavra: "executam", fill: "bg-brand", dot: "bg-modulo-gestao-strong" },
];

export function HeroSection() {
  return (
    <section className="relative pt-32 pb-24 md:pt-40 md:pb-28 overflow-hidden">
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/3 w-[900px] h-[600px] bg-brand/7 rounded-full blur-[130px] animate-aurora" />
        <div className="absolute top-1/4 right-0 w-[500px] h-[400px] bg-modulo-projetos/20 rounded-full blur-[100px] animate-aurora-alt" />
        <div className="absolute inset-0 hero-dot-grid" />
      </div>

      <div className="container mx-auto px-6 md:px-10">
        <div className="text-center">
          {/* Tipografia calibrada pela hero do Notion: peso 500, tracking
              -0.046em. Sem quebra de linha forçada: a pílula é uma unidade
              que não quebra sozinha, então se o container for estreito
              demais pro tamanho da fonte, ela "sobra" pra própria linha.
              `text-balance` deixa o navegador escolher a quebra (mesmo
              mecanismo do Notion), e o max-width/tamanho de fonte foram
              recalibrados pra sempre caber ao lado de uma palavra vizinha,
              inclusive no verbo mais longo ("centralizam"). */}
          <h1 className="text-balance text-[clamp(36px,6.2vw,72px)] font-medium tracking-[-0.046em] text-ink mb-6 leading-[1.1] max-w-6xl mx-auto">
            Onde times e agentes <RotatingPill words={ROTATING_WORDS} /> gestão, projetos e obras.
          </h1>

          <p className="text-lg md:text-xl text-ink-soft max-w-2xl mx-auto mb-5 leading-relaxed font-light">
            Feche propostas, controle cronogramas e acompanhe obras, com agentes de IA feitos pro seu escritório de
            engenharia.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-3">
            <a
              href="#produto"
              onClick={(e) => {
                e.preventDefault();
                trackCta("ver_como_funciona", "hero");
                document.getElementById("produto")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="w-full sm:w-auto sm:min-w-[186px] px-6 py-3.5 bg-paper-alt text-ink-soft font-medium text-[15px] hover:bg-paper-border/60 hover:text-ink rounded-full transition-colors flex items-center justify-center"
            >
              Ver como funciona
            </a>
            <a
              href={`${APP_URL}/cadastro`}
              onClick={() => trackCta("testar_gratis", "hero")}
              className="relative w-full sm:w-auto sm:min-w-[186px] px-7 py-3.5 bg-brand text-ink rounded-full font-medium text-[15px] hover:bg-brand/80 transition-colors flex items-center justify-center gap-2 group overflow-hidden"
            >
              <span className="absolute inset-0 -skew-x-12 translate-x-[-160%] group-hover:translate-x-[200%] transition-transform duration-700 bg-white/10 pointer-events-none" />
              Testar grátis por 14 dias
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </a>
          </div>

          <p className="text-xs text-ink-muted font-light mb-20">Sem cartão · Cancele quando quiser</p>

          <ProductTour />
        </div>
      </div>
    </section>
  );
}
