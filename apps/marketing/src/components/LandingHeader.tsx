import { useState } from "react";
import { Menu, X } from "lucide-react";
import { APP_URL } from "../config";

interface LandingHeaderProps {
  onScrollToTop: (e: React.MouseEvent) => void;
}

export function LandingHeader({ onScrollToTop }: LandingHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSectionLink = (sectionId: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <>
      <div className="fixed top-0 inset-x-0 z-[100] bg-ink-soft text-white text-[10px] md:text-xs py-2 flex justify-end px-6 md:px-10 border-b border-white/5">
        <span className="opacity-80 font-light tracking-wide">Impulsionado por </span>
        <a
          href="https://trnty.com.br"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold hover:text-brand transition-colors ml-1"
        >
          Trinity Company
        </a>
      </div>

      <header className="fixed top-[32px] inset-x-0 z-50 bg-paper border-b border-paper-border py-5 transition-all duration-300">
        <div className="container mx-auto px-6 md:px-10 grid md:grid-cols-3 items-center">
          <a href="#" onClick={onScrollToTop} className="flex items-center gap-2.5 group">
            <img
              src="/pilar-logo.svg"
              alt="Pilar"
              width={40}
              height={40}
              className="h-10 w-auto transition-transform duration-500 group-hover:rotate-12"
            />
            <span className="text-[2rem] font-medium tracking-tight text-ink-soft">
              Pilar<sup className="text-[10px] font-normal text-slate-600 ml-0.5 relative -top-3">®</sup>
            </span>
          </a>

          <nav className="hidden md:flex items-center justify-center gap-10">
            <a
              href="#prova"
              onClick={handleSectionLink("prova")}
              className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-600 relative after:absolute after:bottom-[-3px] after:left-0 after:h-px after:w-0 after:bg-brand hover:after:w-full after:transition-all after:duration-300"
            >
              Por que Pilar
            </a>
            <a
              href="#modulos"
              onClick={handleSectionLink("modulos")}
              className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-600 relative after:absolute after:bottom-[-3px] after:left-0 after:h-px after:w-0 after:bg-brand hover:after:w-full after:transition-all after:duration-300"
            >
              Módulos
            </a>
            <a
              href={`${APP_URL}/planos`}
              className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-600 relative after:absolute after:bottom-[-3px] after:left-0 after:h-px after:w-0 after:bg-brand hover:after:w-full after:transition-all after:duration-300"
            >
              Preços
            </a>
            <a
              href="#faq"
              onClick={handleSectionLink("faq")}
              className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-600 relative after:absolute after:bottom-[-3px] after:left-0 after:h-px after:w-0 after:bg-brand hover:after:w-full after:transition-all after:duration-300"
            >
              FAQ
            </a>
          </nav>

          <div className="hidden md:flex items-center gap-4 justify-end">
            <a
              href={`${APP_URL}/login`}
              className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-600 hover:text-slate-800 transition-colors"
            >
              Entrar
            </a>
            <a
              href={`${APP_URL}/cadastro`}
              className="px-6 py-2.5 bg-brand text-ink rounded-full hover:bg-brand/90 transition-all hover:-translate-y-0.5 active:translate-y-0 duration-200 font-medium text-[11px] uppercase tracking-[0.12em]"
            >
              Começar Grátis
            </a>
          </div>

          <button
            type="button"
            className="md:hidden p-2 text-slate-600 col-start-3 justify-self-end"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="landing-mobile-menu"
          >
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div
            id="landing-mobile-menu"
            className="md:hidden absolute top-full left-0 right-0 bg-paper border-b border-paper-border p-6 flex flex-col gap-4 shadow-xl animate-in slide-in-from-top-5"
          >
            <a href="#prova" onClick={handleSectionLink("prova")} className="text-lg font-medium text-slate-600">
              Por que Pilar
            </a>
            <a href="#modulos" onClick={handleSectionLink("modulos")} className="text-lg font-medium text-slate-600">
              Módulos
            </a>
            <a href={`${APP_URL}/planos`} className="text-lg font-medium text-slate-600">
              Preços
            </a>
            <a href="#faq" onClick={handleSectionLink("faq")} className="text-lg font-medium text-slate-600">
              FAQ
            </a>
            <a
              href={`${APP_URL}/cadastro`}
              className="px-6 py-3 bg-brand text-ink rounded-full text-center font-medium text-sm uppercase tracking-[0.12em]"
            >
              Começar Grátis
            </a>
            <a href={`${APP_URL}/login`} className="text-center text-sm font-medium text-slate-600">
              Já tenho conta, entrar
            </a>
          </div>
        )}
      </header>
    </>
  );
}
