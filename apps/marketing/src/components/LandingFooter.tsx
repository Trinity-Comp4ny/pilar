import { Link } from "react-router-dom";
import { APP_URL } from "../config";
import { requestCookieConsentReview } from "../cookieConsent";
import { MODULOS_NAV, PUBLICOS_LINKS, RECURSOS_NAV } from "../lib/navegacao";
import { Logo } from "./Logo";
import { DEMO_PATH, REDES_SOCIAIS } from "../lib/contato";

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

/**
 * Marcas de Instagram e LinkedIn desenhadas à mão: o lucide 1.x tirou os ícones
 * de marca. Traço no mesmo peso do lucide (2 px, ponta redonda), em tinta.
 */
function IconeRede({ nome }: { nome: (typeof REDES_SOCIAIS)[number]["nome"] }) {
  const comum = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (nome === "Instagram") {
    return (
      <svg {...comum}>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg {...comum}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M8 10.5v6" />
      <path d="M8 7.5v.01" />
      <path d="M12 16.5v-6" />
      <path d="M12 13.2c0-1.6 1-2.7 2.4-2.7s2.1 1 2.1 2.6v3.4" />
    </svg>
  );
}

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
            <ul className="flex items-center gap-2 mt-5">
              {REDES_SOCIAIS.map((rede) => (
                <li key={rede.nome}>
                  <a
                    href={rede.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={rede.rotulo}
                    title={rede.rotulo}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-ink/15 text-ink/75 transition-colors hover:border-ink/40 hover:text-ink"
                  >
                    <IconeRede nome={rede.nome} />
                  </a>
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
