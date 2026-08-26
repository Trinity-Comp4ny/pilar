import { Link } from "react-router-dom";
import { APP_URL } from "../config";
import { requestCookieConsentReview } from "../cookieConsent";
import { Logo } from "./Logo";

/**
 * Rodapé no verde da marca, como na referência: o fim da página é um bloco de
 * cor cheio, e não mais um cinza-escuro que parecia outro site colado embaixo.
 *
 * Como o fundo é o verde, o texto vai em tinta escura (regra da marca: verde só
 * aguenta texto escuro por cima, nunca branco).
 */

const COLUNAS = [
  {
    titulo: "Produto",
    links: [
      { label: "Gestão", to: "/gestao" },
      { label: "Projetos", to: "/projetos" },
      { label: "Obra", to: "/obra" },
      { label: "Planos", to: "/planos" },
    ],
  },
  {
    titulo: "Empresa",
    links: [
      { label: "Perguntas frequentes", to: "/faq" },
      { label: "Termos de uso", to: "/termos" },
      { label: "Privacidade", to: "/privacidade" },
    ],
  },
];

export function LandingFooter() {
  return (
    <footer className="w-full bg-card-brand px-6 md:px-10 pt-16 md:pt-20 pb-10">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-[1.4fr_1fr_1fr_1fr] gap-10 md:gap-8 mb-14">
          <div>
            <Logo size="sm" className="text-ink mb-5" />
            <p className="text-[13.5px] text-ink/65 max-w-xs leading-relaxed">
              Saiba se cada projeto está dando lucro antes de terminar. Feito para escritórios de engenharia
              multidisciplinar, com agentes que preparam o trabalho e esperam o seu aval.
            </p>
          </div>

          {COLUNAS.map((coluna) => (
            <div key={coluna.titulo}>
              <h3 className="text-[10.5px] uppercase tracking-[0.14em] text-ink/50 mb-4">{coluna.titulo}</h3>
              <ul className="flex flex-col gap-3">
                {coluna.links.map((l) => (
                  <li key={l.label}>
                    <Link to={l.to} className="text-[13.5px] text-ink/75 hover:text-ink transition-colors">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h3 className="text-[10.5px] uppercase tracking-[0.14em] text-ink/50 mb-4">Conta</h3>
            <ul className="flex flex-col gap-3">
              <li>
                <a href={`${APP_URL}/login`} className="text-[13.5px] text-ink/75 hover:text-ink transition-colors">
                  Entrar
                </a>
              </li>
              <li>
                <a href={`${APP_URL}/cadastro`} className="text-[13.5px] text-ink/75 hover:text-ink transition-colors">
                  Criar conta
                </a>
              </li>
              <li>
                <button
                  type="button"
                  onClick={requestCookieConsentReview}
                  className="text-[13.5px] text-ink/75 hover:text-ink transition-colors"
                >
                  Preferências de cookies
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-7 border-t border-ink/10">
          <p className="text-[12.5px] text-ink/55">© 2026 Pilar. Todos os direitos reservados.</p>
          <p className="text-[12.5px] text-ink/55">Feito para engenharia multidisciplinar</p>
        </div>
      </div>
    </footer>
  );
}
