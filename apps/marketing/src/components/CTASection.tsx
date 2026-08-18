import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { APP_URL } from "../config";
import { trackCta } from "../analytics";
import { useLoginHint } from "../loginHint";
import { Reveal } from "./Reveal";

export function CTASection() {
  const loggedIn = useLoginHint();

  return (
    <section className="py-28 md:py-36 bg-paper">
      <div className="container mx-auto px-6 md:px-10">
        <Reveal className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-6xl font-medium text-ink leading-[1.05] tracking-tight mb-8">
            Veja o Pilar rodando. <em className="landing-highlight">Do lead ao resultado do projeto.</em>
          </h2>
          <p className="text-slate-600 text-lg max-w-xl mx-auto mb-4 font-light leading-relaxed">
            14 dias grátis. Sem cartão. Sem contrato. O fluxo inteiro num lugar só.
          </p>
          <p className="text-xs text-ink/40 font-light mb-12">Cancele quando quiser · Migração assistida disponível</p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {loggedIn ? (
              <a
                href={`${APP_URL}/inicio`}
                onClick={() => trackCta("abrir_pilar", "cta_final")}
                className="w-full sm:w-auto px-7 py-3.5 bg-brand text-ink rounded-full font-medium text-sm hover:bg-brand/80 transition-colors flex items-center justify-center gap-2 group"
              >
                Abrir Pilar
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </a>
            ) : (
              <a
                href={`${APP_URL}/cadastro`}
                onClick={() => trackCta("testar_gratis", "cta_final")}
                className="w-full sm:w-auto px-7 py-3.5 bg-brand text-ink rounded-full font-medium text-sm hover:bg-brand/80 transition-colors flex items-center justify-center gap-2 group"
              >
                Testar grátis por 14 dias
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </a>
            )}
            <Link
              to="/planos"
              onClick={() => trackCta("ver_planos", "cta_final")}
              className="w-full sm:w-auto px-6 py-3 text-ink-soft rounded-full font-medium text-sm hover:text-ink hover:bg-slate-50 transition-colors underline decoration-brand underline-offset-4"
            >
              Ver planos
            </Link>
            <a
              href="https://wa.me/5514998721100"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackCta("agende_demo", "cta_final")}
              className="w-full sm:w-auto px-6 py-3 text-ink-soft rounded-full font-medium text-sm hover:text-ink hover:bg-slate-50 transition-colors"
            >
              Agende uma demo
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
