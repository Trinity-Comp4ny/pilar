import { Link } from "react-router-dom";
import { APP_URL } from "../config";
import { requestCookieConsentReview } from "../cookieConsent";

export function LandingFooter() {
  return (
    <footer className="bg-ink-soft text-white py-12">
      <div className="container mx-auto px-6 md:px-10">
        <div className="grid md:grid-cols-4 gap-12 mb-12">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-3 mb-6">
              <img
                src="/pilar-logo.svg"
                alt="Pilar"
                width={32}
                height={32}
                className="h-8 w-8 brightness-0 invert hover:rotate-12 transition-transform duration-300"
              />
              <span className="text-xl font-medium tracking-tight">
                Pilar<sup className="text-[9px] font-normal text-slate-300 ml-0.5 relative -top-2">®</sup>
              </span>
              <span className="relative flex h-1.5 w-1.5 ml-1">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-60" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-brand" />
              </span>
            </div>
            <p className="text-slate-300 max-w-sm mb-6 font-light leading-relaxed">
              O sistema de gestão dos escritórios brasileiros de engenharia, com PIX, nota fiscal e linguagem técnica
              nativa.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-6 tracking-wider text-white">Produto</h3>
            <ul className="space-y-4 text-slate-300 font-light text-sm">
              <li>
                <a href="#prova" className="hover:text-brand transition-colors">
                  Por que Pilar
                </a>
              </li>
              <li>
                <a href="#produto" className="hover:text-brand transition-colors">
                  Produto
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-brand transition-colors">
                  FAQ
                </a>
              </li>
              <li>
                <a href={`${APP_URL}/login`} className="hover:text-brand transition-colors">
                  Entrar
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-6 tracking-wider text-white">Legal</h3>
            <ul className="space-y-4 text-slate-300 font-light text-sm">
              <li>
                <Link to="/termos" className="hover:text-brand transition-colors">
                  Termos de Uso
                </Link>
              </li>
              <li>
                <Link to="/privacidade" className="hover:text-brand transition-colors">
                  Privacidade
                </Link>
              </li>
              <li>
                <button
                  type="button"
                  onClick={requestCookieConsentReview}
                  className="hover:text-brand transition-colors text-left"
                >
                  Preferências de cookies
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/5 pt-8 flex items-center justify-center text-xs text-slate-300 font-light">
          <p>&copy; {new Date().getFullYear()} Pilar. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
