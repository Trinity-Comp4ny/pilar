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
      <div className="fixed top-0 inset-x-0 z-[100] bg-[#2E2E2E] text-white text-[10px] md:text-xs py-2 flex justify-end px-6 md:px-10 border-b border-white/5 shadow-sm">
        <span className="opacity-80 font-light tracking-wide">Impulsionado por </span>
        <a
          href="https://trnty.com.br"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold hover:text-accent-orange transition-colors ml-1"
        >
          Trinity Company
        </a>
      </div>

      <header className="fixed top-[32px] inset-x-0 z-50 bg-white border-b border-gray-100 py-4 shadow-sm transition-all duration-300">
        <div className="container mx-auto px-6 md:px-10 flex items-center justify-between">
          <a href="#" onClick={onScrollToTop} className="flex items-center gap-3 group">
            <img
              src="/pilar-logo.svg"
              alt="Pilar"
              className="h-8 w-8 transition-transform duration-500 group-hover:rotate-12"
            />
            <span className="text-xl font-medium tracking-tight text-[#2E2E2E]">Pilar</span>
          </a>

          <nav className="hidden md:flex items-center gap-8 text-sm font-normal">
            <a
              href="#funcionalidades"
              className="text-slate-600 hover:text-accent-orange transition-colors duration-300 hover:-translate-y-0.5"
            >
              Funcionalidades
            </a>
            <a
              href="#sobre"
              className="text-slate-600 hover:text-accent-orange transition-colors duration-300 hover:-translate-y-0.5"
            >
              Sobre
            </a>
            <Link
              to="/login"
              className="px-6 py-2.5 bg-accent-orange text-white rounded-full hover:bg-orange-600 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 duration-200 font-medium text-xs"
            >
              Acessar Sistema
            </Link>
          </nav>

          <button className="md:hidden p-2 text-slate-600" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-white border-b border-black/5 p-6 flex flex-col gap-4 shadow-xl animate-in slide-in-from-top-5">
            <a
              href="#funcionalidades"
              className="text-lg font-medium text-slate-600"
              onClick={() => setMobileMenuOpen(false)}
            >
              Funcionalidades
            </a>
            <a href="#sobre" className="text-lg font-medium text-slate-600" onClick={() => setMobileMenuOpen(false)}>
              Sobre
            </a>
            <Link
              to="/login"
              className="text-lg font-medium text-accent-orange"
              onClick={() => setMobileMenuOpen(false)}
            >
              Entrar
            </Link>
          </div>
        )}
      </header>
    </>
  );
}
