import { HeroSection } from "../components/HeroSection";
import { CapabilityStrip } from "../components/CapabilityStrip";
import { ModulesSection } from "../components/ModulesSection";
import { AgentsSection } from "../components/AgentsSection";
import { CampoSection } from "../components/CampoSection";
import { PortalSection } from "../components/PortalSection";
import { CTASection } from "../components/CTASection";

/**
 * "Para quem é" e a FAQ saíram da home por decisão do CEO (18/08) e viraram
 * a página /faq, linkada no header. O fluxo de 5 etapas foi removido: refletia
 * o sistema de um módulo só, e quem conta a história agora é ModulesSection.
 *
 * A ordem alterna claro e escuro de propósito (SPEC 060): a seção de agentes é
 * o clímax escuro no meio da página, e o CTA fecha em escuro. Antes eram cinco
 * seções seguidas em dois cinzas quase idênticos, sem nenhum ponto de virada.
 */
export function Home() {
  return (
    <>
      <HeroSection />
      <CapabilityStrip />
      <ModulesSection />
      <AgentsSection />
      <CampoSection />
      <PortalSection />
      <CTASection />
    </>
  );
}
