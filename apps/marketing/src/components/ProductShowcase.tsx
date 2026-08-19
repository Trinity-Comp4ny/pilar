import { useEffect, useState } from "react";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { BrowserFrame } from "./BrowserFrame";
import dashboardImg from "../assets/showcase/dashboard.webp";
import projetoImg from "../assets/showcase/projeto.webp";
import cronogramaImg from "../assets/showcase/cronograma.webp";

const SLIDES = [
  {
    src: dashboardImg,
    alt: "Início do Pilar: saldo do mês, recebido, a receber e a pagar em tempo real",
    url: "app.pilarsoft.com.br/inicio",
  },
  {
    src: projetoImg,
    alt: "Projeto no Pilar: contrato, prazo e progresso das disciplinas",
    url: "app.pilarsoft.com.br/projetos",
  },
  {
    src: cronogramaImg,
    alt: "Cronograma de projetos com status e prazos",
    url: "app.pilarsoft.com.br/projetos/cronograma",
  },
];

const INTERVAL_MS = 4000;

/** Cicla screenshots reais do produto em crossfade (ver ADR 0023). Pausa com a aba em segundo plano. */
export function ProductShowcase() {
  const [index, setIndex] = useState(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;
    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setIndex((i) => (i + 1) % SLIDES.length);
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, [reducedMotion]);

  const current = SLIDES[index];

  return (
    <BrowserFrame url={current.url}>
      <div className="relative aspect-[16/10] bg-paper-alt">
        <AnimatePresence mode="wait">
          <m.img
            key={current.src}
            src={current.src}
            alt={current.alt}
            className="absolute inset-0 w-full h-full object-cover object-top"
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reducedMotion ? undefined : { opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
          />
        </AnimatePresence>
      </div>

      {!reducedMotion && (
        <div className="flex items-center justify-center gap-1.5 py-3 border-t border-slate-100">
          {SLIDES.map((slide, i) => (
            <span
              key={slide.src}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === index ? "w-6 bg-brand" : "w-1.5 bg-slate-200"
              }`}
            />
          ))}
        </div>
      )}
    </BrowserFrame>
  );
}
