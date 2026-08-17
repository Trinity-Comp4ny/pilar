import { useEffect } from "react";
import { LandingHeader } from "./components/LandingHeader";
import { HeroSection } from "./components/HeroSection";
import { ProofSection } from "./components/ProofSection";
import { FeaturesSection } from "./components/FeaturesSection";
import { HowItWorksSection } from "./components/HowItWorksSection";
import { CTASection } from "./components/CTASection";
import { LandingFooter } from "./components/LandingFooter";

export default function App() {
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
    <div className="landing-grain min-h-screen bg-paper text-ink-soft font-sans selection:bg-brand/30 selection:text-ink">
      <LandingHeader onScrollToTop={scrollToTop} />

      <main>
        <section className="relative pt-40 pb-24 md:pt-56 md:pb-32 overflow-hidden">
          {/* Fundo aurora */}
          <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/3 w-[900px] h-[600px] bg-brand/7 rounded-full blur-[130px] animate-aurora" />
            <div className="absolute top-1/4 right-0 w-[500px] h-[400px] bg-blue-400/5 rounded-full blur-[100px] animate-aurora-alt" />
            <div className="absolute inset-0 hero-dot-grid" />
          </div>
          <HeroSection />
        </section>

        <ProofSection />
        <FeaturesSection />
        <HowItWorksSection />
        <CTASection />
      </main>

      <LandingFooter />
    </div>
  );
}
