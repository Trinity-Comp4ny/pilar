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
    titulo: "Pilar | Gestão integrada para empresas de engenharia",
    descricao:
      "Saiba se cada projeto está dando lucro antes de terminar. Gestão financeira para escritórios de engenharia multidisciplinar.",
    caminho: "/",
    ogTitulo: "Pilar | Onde times e agentes centralizam gestão, projetos e obras.",
    ogDescricao:
      "Do lead à cobrança, um fluxo só: proposta, projeto e portal do cliente conectados, com agentes de IA que preparam o trabalho sob aprovação da equipe.",
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
