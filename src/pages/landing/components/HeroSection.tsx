import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export function HeroSection() {
  return (
    <div className="container mx-auto px-6 md:px-10 text-center">
      <div className="reveal-up">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent-orange/10 text-accent-orange text-xs md:text-sm font-medium tracking-wide mb-8 hover:scale-105 transition-all duration-300 cursor-default animate-fade-in shadow-sm border border-accent-orange/20 ring-4 ring-accent-orange/5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-orange opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-orange"></span>
          </span>
          Gestão para Engenharia e Arquitetura
        </div>

        <h1 className="text-5xl md:text-7xl font-medium tracking-tight text-[#2E2E2E] mb-8 leading-[1.1]">
          O pilar fundamental da <br className="hidden md:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-orange to-orange-600 animate-gradient-x">sua gestão.</span>
        </h1>

        <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed font-light">
          Simplifique o controle financeiro, gestão de projetos e operação da sua empresa em uma única plataforma.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
          <Link
            to="/login"
            className="w-full sm:w-auto px-8 py-4 bg-accent-orange text-white rounded-full font-medium hover:bg-orange-600 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 flex items-center justify-center gap-2 group text-sm"
          >
            Começar
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <a
            href="#funcionalidades"
            className="w-full sm:w-auto px-8 py-4 bg-white text-[#2E2E2E] border border-slate-200 rounded-full font-medium hover:bg-slate-50 transition-all hover:border-slate-300 text-sm"
          >
            Conhecer Recursos
          </a>
        </div>
      </div>
    </div>
  );
}
