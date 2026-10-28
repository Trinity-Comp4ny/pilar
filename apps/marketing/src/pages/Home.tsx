import { usePageMeta } from "../lib/seo";
import { HeroSection } from "../components/HeroSection";
import { StatementSection } from "../components/StatementSection";
import { BentoSection } from "../components/BentoSection";
import { AgentsSection } from "../components/AgentsSection";
import { PricingSection } from "../components/PricingSection";
import { CTASection } from "../components/CTASection";

/**
 * Ordem da home, no arranjo da referência: hero, tese em texto grande, bento
 * dos módulos, os agentes, preço e o fecho. As dúvidas ficam em /faq.
 *
 * Campo e Portal deixaram de ter seção própria: viraram cartões do bento, e
 * repetir os dois logo abaixo só alongava a página dizendo a mesma coisa duas
 * vezes. Quem quiser o detalhe entra em /obra.
 */
export function Home() {
  // Restaura as metas do index.html ao voltar de outra rota (SPA: a última
  // página visitada teria deixado as dela penduradas no head).
  usePageMeta({
    titulo: "Pilar | Gestão com agentes de IA para engenharia e arquitetura",
    descricao:
      "Do contrato à execução, num fluxo só. Gestão com agentes de IA para escritórios de engenharia e arquitetura: proposta, projeto, obra e financeiro.",
    caminho: "/",
    ogTitulo: "Pilar | Do contrato à execução, num fluxo só.",
    ogDescricao:
      "Proposta, projeto, obra e financeiro num fluxo só, com agentes de IA que preparam o trabalho e esperam a aprovação da equipe.",
  });

  return (
    <>
      <HeroSection />
      <StatementSection />
      <BentoSection />
      <AgentsSection />
      <PricingSection />
      <CTASection />
    </>
  );
}
