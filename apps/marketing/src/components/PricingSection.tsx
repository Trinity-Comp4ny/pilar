import { Link } from "react-router-dom";
import { trackCta } from "../analytics";
import { Reveal } from "./Reveal";
import { IncluidoEmTodos, PlanCards } from "./PlanCards";

/**
 * Preço na home. Os cartões e os valores vêm de `PlanCards`/`lib/planos.ts`,
 * os mesmos da página cheia: preço em dois lugares diverge no dia em que muda.
 */
export function PricingSection() {
  return (
    <section id="planos" className="w-full bg-paper px-5 md:px-10 py-16 md:py-32 scroll-mt-28">
      <div className="max-w-6xl mx-auto">
        <Reveal variant="up" className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-[52px] max-[1100px]:text-[42px] max-[850px]:text-[29px] max-[420px]:text-[25px] font-medium tracking-[-0.035em] leading-[1.08] text-ink mb-4">
            Um preço por escritório.{" "}
            <span className="italic text-ink/45">Sem contar cabeças.</span>
          </h2>
          <p className="text-[15px] text-ink-soft leading-relaxed">
            Todo plano tem a plataforma inteira. O que muda é quantos projetos você toca ao mesmo tempo.
          </p>
        </Reveal>

        <div className="mb-6">
          <PlanCards contexto="home" />
        </div>

        <Reveal variant="up" delay={0.1}>
          <IncluidoEmTodos />
        </Reveal>

        <Reveal variant="fade" delay={0.15} className="text-center mt-8">
          <Link
            to="/planos"
            onClick={() => trackCta("ver_planos", "pricing_home")}
            className="text-[13.5px] text-ink-soft underline decoration-brand underline-offset-4 hover:text-ink transition-colors"
          >
            Ver a página de planos
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
