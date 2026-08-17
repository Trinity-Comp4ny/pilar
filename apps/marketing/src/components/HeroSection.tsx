import { ArrowRight } from "lucide-react";
import { APP_URL } from "../config";

export function HeroSection() {
  return (
    <div className="container mx-auto px-6 md:px-10">
      <div className="text-center">
        <div className="flex items-center justify-center gap-3 mb-8 animate-fade-up" style={{ animationDelay: "0ms" }}>
          <span className="w-6 h-px bg-slate-300" />
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-60" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-brand" />
            </span>
            <span className="text-[11px] font-medium uppercase tracking-[0.32em] text-slate-600">
              Pilar® · Gestão para engenharia
            </span>
          </div>
          <span className="w-6 h-px bg-slate-300" />
        </div>

        <h1 className="text-[clamp(48px,7vw,96px)] font-light tracking-[-0.02em] text-ink mb-6 leading-[1.1]">
          <span className="block">Pare de trabalhar no caos.</span>
          <em className="hero-italic-highlight">Lidere seus projetos.</em>
        </h1>

        <p className="text-base md:text-lg text-slate-600 max-w-xl mx-auto mb-10 leading-relaxed font-light">
          Do lead à cobrança, um fluxo só: proposta, projeto e portal do cliente conectados no mesmo sistema.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-16">
          <a
            href={`${APP_URL}/cadastro`}
            className="relative w-full sm:w-auto px-7 py-3.5 bg-ink-soft text-white rounded-full font-medium text-sm hover:bg-ink transition-colors flex items-center justify-center gap-2 group overflow-hidden"
          >
            <span className="absolute inset-0 -skew-x-12 translate-x-[-160%] group-hover:translate-x-[200%] transition-transform duration-700 bg-white/10 pointer-events-none" />
            Testar grátis por 14 dias
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </a>
          <a
            href="https://wa.me/5514998721100"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-6 py-3 text-slate-600 rounded-full font-medium text-sm hover:text-ink-soft hover:bg-slate-50 transition-colors"
          >
            Agende uma demo →
          </a>
        </div>
      </div>
    </div>
  );
}
