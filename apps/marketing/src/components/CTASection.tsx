import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { m, useReducedMotion } from "framer-motion";
import { APP_URL } from "../config";
import { trackCta } from "../analytics";
import { useLoginHint } from "../loginHint";
import { Reveal } from "./Reveal";
import { GridBackdrop, TextReveal } from "./motion";
import { EASE } from "../lib/motion";

/**
 * Fecho da página, em escuro. Antes era uma parede branca com um título no meio
 * e três links de peso visual quase igual, o que diluía o CTA principal
 * (SPEC 060). Agora o primário é o único botão sólido, e os secundários viram
 * links de apoio.
 */
export function CTASection() {
  const loggedIn = useLoginHint();
  const reducedMotion = useReducedMotion();

  const primario = loggedIn
    ? { href: `${APP_URL}/inicio`, label: "Abrir Pilar", evento: "abrir_pilar" }
    : { href: `${APP_URL}/cadastro`, label: "Testar grátis por 14 dias", evento: "testar_gratis" };

  return (
    <section className="relative py-28 md:py-36 bg-ink text-white overflow-hidden">
      <GridBackdrop tom="ink" mascara="center" />
      <div
        aria-hidden="true"
        className="absolute bottom-[-30%] left-1/2 -translate-x-1/2 w-[820px] h-[520px] rounded-full bg-brand/14 blur-[130px] pointer-events-none"
      />

      <div className="relative container mx-auto px-6 md:px-10">
        <div className="max-w-3xl mx-auto text-center">
          <TextReveal
            as="h2"
            text="Veja o Pilar rodando. Do lead ao resultado do projeto."
            highlight="Do lead ao resultado do projeto."
            highlightClassName="italic text-brand"
            className="text-4xl md:text-[56px] font-medium text-white leading-[1.06] tracking-tight mb-7"
          />

          <Reveal variant="fade" delay={0.3}>
            <p className="text-white/60 text-lg max-w-lg mx-auto mb-2 font-light leading-relaxed">
              14 dias grátis. Sem cartão. Sem contrato. O fluxo inteiro num lugar só.
            </p>
            <p className="text-xs text-white/35 font-light mb-10">
              Cancele quando quiser · Migração assistida disponível
            </p>
          </Reveal>

          <m.div
            initial={reducedMotion ? false : { opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.6, delay: 0.4, ease: EASE.out }}
            className="flex flex-col items-center gap-5"
          >
            <a
              href={primario.href}
              onClick={() => trackCta(primario.evento, "cta_final")}
              className="relative w-full sm:w-auto px-9 py-4 bg-brand text-ink rounded-full font-medium text-base hover:bg-brand/85 transition-colors flex items-center justify-center gap-2 group overflow-hidden"
            >
              <span className="absolute inset-0 -skew-x-12 translate-x-[-160%] group-hover:translate-x-[200%] transition-transform duration-700 bg-white/20 pointer-events-none" />
              {primario.label}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>

            <div className="flex items-center gap-5 text-[13.5px]">
              <Link
                to="/planos"
                onClick={() => trackCta("ver_planos", "cta_final")}
                className="text-white/55 hover:text-white transition-colors underline decoration-brand/60 underline-offset-4"
              >
                Ver planos
              </Link>
              <span aria-hidden="true" className="w-1 h-1 rounded-full bg-white/20" />
              <a
                href="https://wa.me/5514998721100"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackCta("agende_demo", "cta_final")}
                className="text-white/55 hover:text-white transition-colors"
              >
                Agende uma demo
              </a>
            </div>
          </m.div>
        </div>
      </div>
    </section>
  );
}
