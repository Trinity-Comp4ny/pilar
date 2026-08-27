import { Link } from "react-router-dom";
import { APP_URL } from "../config";
import { requestCookieConsentReview } from "../cookieConsent";
import { COMPARATIVOS } from "../lib/comparativos";
import { MODULOS } from "../lib/modules";
import { Logo } from "./Logo";

/**
 * Rodapé no verde da marca, como na referência: o fim da página é um bloco de
 * cor cheio, e não mais um cinza-escuro que parecia outro site colado embaixo.
 *
 * Como o fundo é o verde, o texto vai em tinta escura (regra da marca: verde só
 * aguenta texto escuro por cima, nunca branco).
 *
 * As comparações ("Pilar vs X") vieram do header pro rodapé: nenhum dos sites
 * de referência (Notion, Slack, Stripe) trata isso como item de navegação
 * principal, e com só duas páginas um dropdown inteiro pesava mais do que o
 * conteúdo merecia. O Slack guarda exatamente esse tipo de link no rodapé.
 */

const COLUNAS = [
  {
    titulo: "Empresa",
    links: [
      { label: "Planos", to: "/planos" },
      { label: "Perguntas frequentes", to: "/faq" },
      { label: "Termos de uso", to: "/termos" },
      { label: "Privacidade", to: "/privacidade" },
    ],
  },
];

export function LandingFooter() {
  return (
    <footer className="w-full bg-card-brand px-5 md:px-10 pt-12 md:pt-20 pb-8 md:pb-10">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-[1.2fr_1fr_1fr_1fr_1fr] gap-10 md:gap-8 mb-14">
          <div>
            <Logo size="sm" className="text-ink mb-5" />
            <p className="text-[13.5px] text-ink/65 max-w-xs leading-relaxed">
              Saiba se cada projeto está dando lucro antes de terminar. Feito para escritórios de engenharia
              multidisciplinar, com agentes que preparam o trabalho e esperam o seu aval.
            </p>
          </div>

          <div>
            <h3 className="text-[10.5px] uppercase tracking-[0.14em] text-ink/50 mb-4">Produto</h3>
            <ul className="flex flex-col gap-3">
              {MODULOS.map((mo) => (
                <li key={mo.slug}>
                  <Link to={`/${mo.slug}`} className="text-[13.5px] text-ink/75 hover:text-ink transition-colors">
                    {mo.nome}
                  </Link>
                </li>
              ))}
            </ul>
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
            <h3 className="text-[10.5px] uppercase tracking-[0.14em] text-ink/50 mb-4">Comparações</h3>
            <ul className="flex flex-col gap-3">
              {COMPARATIVOS.map((c) => (
                <li key={c.slug}>
                  <Link to={`/vs/${c.slug}`} className="text-[13.5px] text-ink/75 hover:text-ink transition-colors">
                    Pilar vs {c.adversario}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

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

        <div className="pt-7 border-t border-ink/10">
          <p className="text-[12.5px] text-ink/55">© 2026 Pilar. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
