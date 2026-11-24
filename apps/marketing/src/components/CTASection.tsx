import { m, useReducedMotion } from "framer-motion";
import { Reveal } from "./Reveal";
import { HeroBackdrop } from "./hero/HeroBackdrop";
import { EASE } from "../lib/motion";
import { BotoesCta } from "./BotoesCta";

/**
 * Fecho da página: um cartão largo com a paisagem desfocada por dentro, no
 * formato da referência. O verde sai das bordas do cartão e continua no rodapé,
 * então o fim da página é um bloco de cor só, e não mais uma parede branca com
 * três links de peso igual. Os botões são os mesmos da hero (`BotoesCta`).
 */
export function CTASection() {
  const reducedMotion = useReducedMotion();

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
            <h2 className="text-[58px] max-[1100px]:text-[44px] max-[850px]:text-[30px] max-[420px]:text-[26px] font-medium tracking-[-0.035em] leading-[1.06] text-ink mb-5 max-w-[24ch] mx-auto text-balance">
              Gestão de projetos e obras, <span className="italic">com agentes de IA.</span>
            </h2>

            <m.p
              initial={reducedMotion ? false : { opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: 0.6, ease: EASE.out, delay: 0.15 }}
              className="text-[15px] text-ink/70 max-w-lg mx-auto mb-9 leading-relaxed"
            >
              Escolha o plano e comece hoje: a conta fica pronta assim que o pagamento é confirmado. Prefere ver antes?
              Agende uma demonstração com a equipe.
            </m.p>

            <BotoesCta local="cta_final" className="justify-center" />
          </div>
        </div>
      </Reveal>
    </section>
  );
}
