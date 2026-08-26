import { HeroSection } from "../components/HeroSection";
import { StatementSection } from "../components/StatementSection";
import { BentoSection } from "../components/BentoSection";
import { AgentsSection } from "../components/AgentsSection";
import { PricingSection } from "../components/PricingSection";
import { FaqSection } from "../components/FaqSection";
import { CTASection } from "../components/CTASection";

/**
 * Ordem da home, no arranjo da referência: hero, tese em texto grande, bento
 * dos módulos, os agentes, preço, dúvidas e o fecho.
 *
 * Campo e Portal deixaram de ter seção própria: viraram cartões do bento, e
 * repetir os dois logo abaixo só alongava a página dizendo a mesma coisa duas
 * vezes. Quem quiser o detalhe entra em /obra.
 */
export function Home() {
  return (
    <>
      <HeroSection />
      <StatementSection />
      <BentoSection />
      <AgentsSection />
      <PricingSection />
      <FaqSection />
      <CTASection />
    </>
  );
}
