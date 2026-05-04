import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";

interface LandingHeaderProps {
  onScrollToTop: (e: React.MouseEvent) => void;
}

export function LandingHeader({ onScrollToTop }: LandingHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
              className="h-10 w-auto transition-transform duration-500 group-hover:rotate-12"
            />
            <span className="text-[2rem] font-medium tracking-tight text-ink-soft">
              Pilar<sup className="text-[10px] font-normal text-slate-400 ml-0.5 relative -top-3">®</sup>
            </span>
          </a>

          <nav className="hidden md:flex items-center justify-center gap-10">
            <a
              href="#prova"
              className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 relative after:absolute after:bottom-[-3px] after:left-0 after:h-px after:w-0 after:bg-brand hover:after:w-full after:transition-all after:duration-300"
            >
              Por que Pilar
            </a>
            <a
              href="#modulos"
              className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 relative after:absolute after:bottom-[-3px] after:left-0 after:h-px after:w-0 after:bg-brand hover:after:w-full after:transition-all after:duration-300"
            >
              Módulos
            </a>
            <Link
              to="/planos"
              className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 relative after:absolute after:bottom-[-3px] after:left-0 after:h-px after:w-0 after:bg-brand hover:after:w-full after:transition-all after:duration-300"
            >
              Preços
            </Link>
          </nav>

          <div className="hidden md:flex items-center gap-4 justify-end">
            <Link
              to="/login"
              className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500 hover:text-slate-800 transition-colors"
            >
              Entrar
            </Link>
            <Link
              to="/login"
              className="px-6 py-2.5 bg-brand text-ink rounded-full hover:bg-brand/90 transition-all hover:-translate-y-0.5 active:translate-y-0 duration-200 font-medium text-[11px] uppercase tracking-[0.12em]"
            >
              Começar Grátis
            </Link>
          </div>

          <button
            className="md:hidden p-2 text-slate-600 col-start-3 justify-self-end"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-paper border-b border-paper-border p-6 flex flex-col gap-4 shadow-xl animate-in slide-in-from-top-5">
            <a href="#prova" className="text-lg font-medium text-slate-600" onClick={() => setMobileMenuOpen(false)}>
              Por que Pilar
            </a>
            <a href="#modulos" className="text-lg font-medium text-slate-600" onClick={() => setMobileMenuOpen(false)}>
              Módulos
            </a>
            <Link to="/planos" className="text-lg font-medium text-slate-600" onClick={() => setMobileMenuOpen(false)}>
              Preços
            </Link>
            <Link
              to="/login"
              className="px-6 py-3 bg-brand text-ink rounded-full text-center font-medium text-sm uppercase tracking-[0.12em]"
              onClick={() => setMobileMenuOpen(false)}
            >
              Começar Grátis
            </Link>
            <Link
              to="/login"
              className="text-center text-sm font-medium text-slate-400"
              onClick={() => setMobileMenuOpen(false)}
            >
              Já tenho conta — Entrar
            </Link>
          </div>
        )}
      </header>
    </>
  );
}
