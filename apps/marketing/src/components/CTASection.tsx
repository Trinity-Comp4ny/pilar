import { ArrowRight } from "lucide-react";
import { APP_URL } from "../config";
import { trackCta } from "../analytics";

export function CTASection() {
  return (
    <section className="py-28 md:py-36 bg-paper">
      <div className="container mx-auto px-6 md:px-10">
        <div className="max-w-4xl mx-auto text-center reveal-up">
          <h2 className="text-4xl md:text-6xl font-medium text-ink leading-[1.05] tracking-tight mb-8">
            Veja o Pilar rodando. <em className="landing-highlight">Do lead ao resultado do projeto.</em>
          </h2>
          <p className="text-slate-600 text-lg max-w-xl mx-auto mb-4 font-light leading-relaxed">
            14 dias grátis. Sem cartão. Sem contrato. O fluxo inteiro num lugar só.
          </p>
          <p className="text-xs text-ink/40 font-light mb-12">Cancele quando quiser · Migração assistida disponível</p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href={`${APP_URL}/cadastro`}
              onClick={() => trackCta("testar_gratis", "cta_final")}
              className="w-full sm:w-auto px-7 py-3.5 bg-brand text-ink rounded-full font-medium text-sm hover:bg-brand/80 transition-colors flex items-center justify-center gap-2 group"
            >
              Testar grátis por 14 dias
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </a>
            <a
              href={`${APP_URL}/planos`}
              onClick={() => trackCta("ver_planos", "cta_final")}
              className="w-full sm:w-auto px-6 py-3 text-ink-soft rounded-full font-medium text-sm hover:text-ink hover:bg-slate-50 transition-colors underline decoration-brand underline-offset-4"
            >
              Ver planos
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
