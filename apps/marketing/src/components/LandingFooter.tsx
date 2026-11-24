import { Link } from "react-router-dom";
import { APP_URL } from "../config";
import { requestCookieConsentReview } from "../cookieConsent";
import { MODULOS_NAV, PUBLICOS_LINKS, RECURSOS_NAV } from "../lib/navegacao";
import { Logo } from "./Logo";
import { DEMO_PATH } from "../lib/contato";

/**
 * Rodapé no verde da marca, como na referência: o fim da página é um bloco de
 * cor cheio, e não mais um cinza-escuro que parecia outro site colado embaixo.
 *
 * Como o fundo é o verde, o texto vai em tinta escura (regra da marca: verde só
 * aguenta texto escuro por cima, nunca branco).
 *
 * Desde 2026-11-24 é aqui que moram blog, ferramentas, FAQ e segurança (saíram do
 * header). As comparações "Pilar vs X" saíram do rodapé: são páginas de busca, que
 * o Google acha pelo sitemap e pelos links dos artigos e das páginas de público.
 */

const COLUNAS: { titulo: string; links: { label: string; to: string }[] }[] = [
  {
    titulo: "Produto",
    links: [
      { label: "Funcionalidades", to: "/funcionalidades" },
      ...MODULOS_NAV.map((mo) => ({ label: mo.nome, to: `/${mo.slug}` })),
      { label: "Agentes de IA", to: "/funcionalidades/agentes" },
      { label: "Planos", to: "/planos" },
    ],
  },
  { titulo: "Para quem", links: PUBLICOS_LINKS.map((l) => ({ label: l.rotulo, to: l.to })) },
  {
    titulo: "Conteúdo",
    links: RECURSOS_NAV.map((l) => ({ label: l.rotulo, to: l.to })),
  },
  {
    titulo: "Empresa",
    links: [
      { label: "Agendar demonstração", to: DEMO_PATH },
      { label: "Segurança", to: "/seguranca" },
      { label: "Termos de uso", to: "/termos" },
      { label: "Privacidade", to: "/privacidade" },
    ],
  },
];

export function LandingFooter() {
  return (
    <footer className="w-full bg-card-brand px-5 md:px-10 pt-12 md:pt-20 pb-8 md:pb-10">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_0.8fr] gap-10 md:gap-8 mb-14">
          <div className="col-span-2 md:col-span-1">
            <Logo size="sm" className="text-ink mb-5" />
            <p className="text-[13.5px] text-ink/80 max-w-xs leading-relaxed">
              Gestão de projetos e obras, com agentes de IA. A IA prepara o trabalho, você confere e aprova.
            </p>
          </div>

          {COLUNAS.map((coluna) => (
            <div key={coluna.titulo}>
              <h3 className="text-[10.5px] uppercase tracking-[0.14em] text-ink/70 mb-4">{coluna.titulo}</h3>
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
            <h3 className="text-[10.5px] uppercase tracking-[0.14em] text-ink/70 mb-4">Conta</h3>
            <ul className="flex flex-col gap-3">
              <li>
                <a href={`${APP_URL}/login`} className="text-[13.5px] text-ink/75 hover:text-ink transition-colors">
                  Entrar
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
          <p className="text-[12.5px] text-ink/75">© 2026 Pilar. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
