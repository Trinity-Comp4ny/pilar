import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, Users, FolderKanban, BarChart3, PieChart } from "lucide-react";
import type { Feature } from "./landing/types";
import { LandingHeader } from "./landing/components/LandingHeader";
import { HeroSection } from "./landing/components/HeroSection";
import { MockupTablet } from "./landing/components/MockupTablet";
import { FeaturesSection } from "./landing/components/FeaturesSection";
import { AboutSection } from "./landing/components/AboutSection";
import { CTASection } from "./landing/components/CTASection";
import { LandingFooter } from "./landing/components/LandingFooter";

const features: Feature[] = [
  {
    icon: <DollarSign className="w-6 h-6" />,
    title: "Financeiro Completo",
    description: "Fluxo de caixa, receitas, despesas e indicadores financeiros em tempo real para sua empresa.",
  },
  {
    icon: <Users className="w-6 h-6" />,
    title: "Gestão de Leads",
    description: "Pipeline visual para acompanhar suas oportunidades comerciais do contato ao fechamento.",
  },
  {
    icon: <FolderKanban className="w-6 h-6" />,
    title: "Projetos",
    description: "Gerencie tarefas e etapas de cada projeto com visualização Kanban intuitiva.",
  },
  {
    icon: <Users className="w-6 h-6" />,
    title: "Pessoas",
    description: "Gerencie sua equipe, acompanhe desempenho e organize a estrutura organizacional.",
  },
  {
    icon: <BarChart3 className="w-6 h-6" />,
    title: "Metas Empresariais",
    description: "Defina objetivos estratégicos e acompanhe o progresso da sua empresa em tempo real.",
  },
  {
    icon: <PieChart className="w-6 h-6" />,
    title: "Relatórios",
    description: "Dashboards que mostram a saúde do seu negócio para tomada de decisões.",
  },
];

export default function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) navigate("/dashboard");
    };
    checkUser();
  }, [navigate]);

  useEffect(() => {
    const elements = document.querySelectorAll<HTMLElement>(".reveal-up");
    if (!("IntersectionObserver" in window) || elements.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        }
      },
      { root: null, rootMargin: "0px 0px -10% 0px", threshold: 0.1 }
    );

    elements.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const scrollToTop = (e: React.MouseEvent) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-white text-[#2E2E2E] font-sans selection:bg-accent-orange/20 selection:text-accent-orange">
      <LandingHeader onScrollToTop={scrollToTop} />

      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-accent-orange/5 rounded-[100%] blur-3xl -z-10 animate-pulse duration-[10000ms]" />
        <HeroSection />
        <MockupTablet />
      </section>

      <FeaturesSection features={features} />
      <AboutSection />
      <CTASection />
      <LandingFooter />
    </div>
  );
}
