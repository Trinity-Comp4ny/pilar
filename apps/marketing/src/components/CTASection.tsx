import { m, useReducedMotion } from "framer-motion";
import { APP_URL } from "../config";
import { trackCta } from "../analytics";
import { useLoginHint } from "../loginHint";
import { Reveal } from "./Reveal";
import { SplitButton } from "./ui/SplitButton";
import { HeroBackdrop } from "./hero/HeroBackdrop";
import { EASE } from "../lib/motion";

/**
 * Fecho da página: um cartão largo com a paisagem desfocada por dentro, no
 * formato da referência. O verde sai das bordas do cartão e continua no rodapé,
 * então o fim da página é um bloco de cor só, e não mais uma parede branca com
 * três links de peso igual.
 */
export function CTASection() {
  const loggedIn = useLoginHint();
  const reducedMotion = useReducedMotion();

  const primario = loggedIn
    ? { href: `${APP_URL}/inicio`, label: "Abrir Pilar", evento: "abrir_pilar" }
    : { href: `${APP_URL}/cadastro`, label: "Testar grátis por 14 dias", evento: "testar_gratis" };

  return (
    <section className="w-full bg-paper px-4 md:px-10 pb-10 md:pb-20">
      <Reveal variant="scale" loose className="max-w-6xl mx-auto">
        <div className="relative overflow-hidden rounded-[24px] md:rounded-[32px] px-5 md:px-6 py-14 md:py-28 text-center">
          {/* A mesma paisagem da hero, agora preenchendo o cartão: o fecho da
              página rima com a abertura em vez de inventar outro fundo. */}
          <div aria-hidden="true" className="absolute inset-0 bg-card-brand-soft/50">
            <HeroBackdrop variante="cartao" />
          </div>

          <div className="relative">
            <h2 className="text-[58px] max-[1100px]:text-[44px] max-[850px]:text-[30px] max-[420px]:text-[26px] font-medium tracking-[-0.035em] leading-[1.06] text-ink mb-5 max-w-[20ch] mx-auto">
              Saiba se cada projeto está dando lucro{" "}
              <span className="italic">antes de terminar.</span>
            </h2>

            <m.p
              initial={reducedMotion ? false : { opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: 0.6, ease: EASE.out, delay: 0.15 }}
              className="text-[15px] text-ink/70 max-w-lg mx-auto mb-9 leading-relaxed"
            >
              14 dias grátis, sem cartão e sem contrato. O fluxo inteiro num lugar só, do lead ao resultado.
            </m.p>

            <div className="flex flex-col items-center gap-4">
              <SplitButton href={primario.href} onClick={() => trackCta(primario.evento, "cta_final")}>
                {primario.label}
              </SplitButton>
              <a
                href="https://wa.me/5514998721100"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackCta("agende_demo", "cta_final")}
                className="text-[13.5px] text-ink/60 hover:text-ink transition-colors underline decoration-ink/25 underline-offset-4"
              >
                Ou agende uma demo
              </a>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
