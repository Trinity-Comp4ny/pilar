import { Link } from "react-router-dom";
import { APP_URL } from "../config";
import { requestCookieConsentReview } from "../cookieConsent";
import { COMPARATIVOS } from "../lib/comparativos";
import { MODULOS } from "../lib/modules";
import { Logo } from "./Logo";
import { DEMO_URL } from "../lib/contato";
import { trackCta } from "../analytics";

/**
 * Rodapé no verde da marca, como na referência: o fim da página é um bloco de
 * cor cheio, e não mais um cinza-escuro que parecia outro site colado embaixo.
 *
 * Como o fundo é o verde, o texto vai em tinta escura (regra da marca: verde só
 * aguenta texto escuro por cima, nunca branco).
 *
 * As comparações ("Pilar vs X") são páginas de busca: quem chega nelas vem do
 * Google ou de um artigo do blog. Ficam no rodapé porque é o único link fixo do
 * site até elas (ajuda o Google a achá-las), mas dentro de Conteúdo, que é o que
 * elas são, e não numa coluna própria disputando atenção com Produto.
 */

const COLUNAS = [
  {
    titulo: "Conteúdo",
    links: [
      { label: "Blog", to: "/blog" },
      { label: "Ferramentas", to: "/ferramentas" },
      { label: "Para engenharia", to: "/engenharia" },
      { label: "Para arquitetura", to: "/arquitetura" },
      ...COMPARATIVOS.map((c) => ({ label: `Pilar vs ${c.adversario}`, to: `/vs/${c.slug}` })),
    ],
  },
  {
    titulo: "Empresa",
    links: [
      { label: "Planos", to: "/planos" },
      { label: "Perguntas frequentes", to: "/faq" },
      { label: "Termos de uso", to: "/termos" },
      { label: "Privacidade", to: "/privacidade" },
      { label: "Segurança", to: "/seguranca" },
    ],
  },
];

export function LandingFooter() {
  return (
    <footer className="w-full bg-card-brand px-5 md:px-10 pt-12 md:pt-20 pb-8 md:pb-10">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr] gap-10 md:gap-8 mb-14">
          <div>
            <Logo size="sm" className="text-ink mb-5" />
            <p className="text-[13.5px] text-ink/80 max-w-xs leading-relaxed">
              Gestão com agentes de IA para escritórios de engenharia e arquitetura. Os agentes preparam o trabalho e
              esperam o seu aval.
            </p>
          </div>

          <div>
            <h3 className="text-[10.5px] uppercase tracking-[0.14em] text-ink/70 mb-4">Produto</h3>
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
                <a
                  href={DEMO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackCta("agende_demo", "footer")}
                  className="text-[13.5px] text-ink/75 hover:text-ink transition-colors"
                >
                  Agendar demonstração
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
