import { HeroSection } from "../components/HeroSection";
import { ModulesSection } from "../components/ModulesSection";
import { AgentsSection } from "../components/AgentsSection";
import { CampoSection } from "../components/CampoSection";
import { PortalSection } from "../components/PortalSection";
import { CTASection } from "../components/CTASection";

/**
 * "Para quem é" e a FAQ saíram da home por decisão do CEO (18/08) e viraram
 * a página /faq, linkada no header. O fluxo de 5 etapas foi removido: refletia
 * o sistema de um módulo só, e quem conta a história agora é ModulesSection.
 */
export function Home() {
  return (
    <>
      <HeroSection />
      <ModulesSection />
      <AgentsSection />
      <CampoSection />
      <PortalSection />
      <CTASection />
    </>
  );
}
