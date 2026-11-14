import { m, useReducedMotion } from "framer-motion";
import { trackCta } from "../analytics";
import { useAcesso } from "../loginHint";
import { Reveal } from "./Reveal";
import { SplitButton } from "./ui/SplitButton";
import { HeroBackdrop } from "./hero/HeroBackdrop";
import { EASE } from "../lib/motion";
import { LinkDemo } from "./LinkDemo";

/**
 * Fecho da página: um cartão largo com a paisagem desfocada por dentro, no
 * formato da referência. O verde sai das bordas do cartão e continua no rodapé,
 * então o fim da página é um bloco de cor só, e não mais uma parede branca com
 * três links de peso igual. Desde a SPEC 133 o primário é agendar a demo.
 */
export function CTASection() {
  const acesso = useAcesso();
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
              Gestão com agentes de IA para escritórios de <span className="italic">engenharia e arquitetura.</span>
            </h2>

            <m.p
              initial={reducedMotion ? false : { opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: 0.6, ease: EASE.out, delay: 0.15 }}
              className="text-[15px] text-ink/70 max-w-lg mx-auto mb-9 leading-relaxed"
            >
              Escolha o plano e comece hoje: a conta fica pronta assim que o pagamento é confirmado. Os agentes
              preparam, você aprova.
            </m.p>

            <div className="flex flex-col items-center gap-4">
              {/* Os mesmos dois botões da hero e do header, na mesma ordem. */}
              <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
                <SplitButton to="/planos" onClick={() => trackCta("ver_planos", "cta_final")}>
                  Ver planos
                </SplitButton>
                <SplitButton href={acesso.href} onClick={() => trackCta(acesso.evento, "cta_final")} fantasma>
                  {acesso.rotulo}
                </SplitButton>
              </div>
              {!acesso.logado && <LinkDemo local="cta_final" />}
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
