import { m, useReducedMotion } from "framer-motion";
import { APP_URL } from "../config";
import { trackCta } from "../analytics";
import { useLoginHint } from "../loginHint";
import { Reveal } from "./Reveal";
import { SplitButton } from "./ui/SplitButton";
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
    <section className="w-full bg-paper px-6 md:px-10 pb-14 md:pb-20">
      <Reveal variant="scale" loose className="max-w-6xl mx-auto">
        <div className="relative overflow-hidden rounded-[32px] px-6 py-20 md:py-28 text-center">
          {/* Paisagem borrada: mesma família do fundo da hero, agora como cor
              chapada em movimento lento, sem desenho competindo com o texto. */}
          <div aria-hidden="true" className="absolute inset-0 bg-card-brand">
            <m.div
              className="absolute -inset-1/4"
              animate={reducedMotion ? undefined : { rotate: [0, 8, 0], scale: [1, 1.08, 1] }}
              transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
              style={{
                background:
                  "radial-gradient(closest-side, hsl(var(--surface-landing-white) / 0.85), transparent 70%), radial-gradient(closest-side at 70% 60%, hsl(160 60% 72% / 0.75), transparent 70%)",
                filter: "blur(48px)",
              }}
            />
          </div>

          <div className="relative">
            <h2 className="text-[clamp(30px,4.6vw,58px)] font-medium tracking-[-0.035em] leading-[1.06] text-ink mb-5 max-w-[20ch] mx-auto">
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
