import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, ChevronDown, Menu, X } from "lucide-react";
import { trackCta } from "../analytics";
import { useAcesso } from "../loginHint";
import { MODULOS } from "../lib/modules";
import { Logo } from "./Logo";
import { SplitButton } from "./ui/SplitButton";

type MenuNome = "produto";

/** Atraso no fechar, pra dar tempo do mouse atravessar o vão até o painel. */
const FECHAR_MS = 160;

/**
 * Header em pílula flutuante, encaixado dentro da moldura branca do site.
 *
 * Não é mais uma barra de ponta a ponta: é um cartão branco centralizado, com
 * largura própria, que paira sobre o conteúdo. Continua `fixed`, colado à borda
 * interna da moldura (`top: var(--frame-w)`).
 *
 * No iPhone a página rola por baixo da barra de status (e, no puxão elástico do
 * topo, acima do header): a pílula descia `env(safe-area-inset-top)` sem nada
 * por cima, e o conteúdo aparecia passando ali. A tampa (`TampaDoTopo`) pinta
 * essa faixa com a cor da moldura, de ponta a ponta, e sobe além da borda.
 *
 * Os dois CTAs são os mesmos da hero e do fecho, na mesma ordem: o acesso
 * (Entrar ou Abrir Pilar, ver `useAcesso`) e "Ver planos".
 */
export function LandingHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [menuAberto, setMenuAberto] = useState<MenuNome | null>(null);
  const [rolou, setRolou] = useState(false);
  const acesso = useAcesso();
  const { pathname } = useLocation();
  const fecharTimer = useRef<number | null>(null);

  // Trocar de rota fecha os dois menus (o link já fecha, mas o voltar do navegador não).
  useEffect(() => {
    setMobileMenuOpen(false);
    setMenuAberto(null);
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setRolou(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const abrir = (nome: MenuNome) => {
    if (fecharTimer.current) {
      window.clearTimeout(fecharTimer.current);
      fecharTimer.current = null;
    }
    setMenuAberto(nome);
  };

  const fechar = (delay = 0) => {
    if (fecharTimer.current) window.clearTimeout(fecharTimer.current);
    fecharTimer.current = window.setTimeout(() => setMenuAberto(null), delay);
  };

  useEffect(
    () => () => {
      if (fecharTimer.current) window.clearTimeout(fecharTimer.current);
    },
    []
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMenuAberto(null);
      setMobileMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const navLink =
    "flex items-center gap-1 text-[14px] text-ink-soft px-3 py-2 rounded-full hover:text-ink transition-colors";

  /** Os três módulos de escritório levam o prefixo; Portal e Campo são nomes próprios. */
  const rotuloDe = (slug: string, nome: string) =>
    slug === "gestao" || slug === "projetos" || slug === "obra" ? `Módulo ${nome}` : nome;

  return (
    <>
      {/* Véu do menu do celular: escurece a página e fecha ao tocar fora. */}
      <div
        aria-hidden="true"
        onClick={() => setMobileMenuOpen(false)}
        className={`md:hidden fixed inset-0 z-40 bg-ink/25 transition-opacity duration-200 ${
          mobileMenuOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <header
        className="fixed inset-x-0 z-50 flex justify-center px-3 md:px-6"
        style={{ top: "var(--frame-w)", paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        {/* Tampa do topo: cobre a área segura do iPhone e sobe além da borda, então o
          conteúdo nunca aparece passando acima da pílula. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-full h-[100vh] bg-frame"
          style={{ marginBottom: "calc(env(safe-area-inset-top, 0px) * -1)" }}
        />
        <div
          className={`relative w-full max-w-[1216px] rounded-b-[22px] bg-frame transition-shadow duration-300 ${
            rolou ? "shadow-[0_10px_36px_-16px_rgba(0,0,0,0.28)]" : "shadow-[0_2px_10px_-6px_rgba(0,0,0,0.14)]"
          }`}
        >
          <div className="flex h-16 md:h-20 items-center gap-6 px-5 md:px-7">
            <Link
              to="/"
              aria-label="Pilar, página inicial"
              className="shrink-0"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Logo size="sm" className="text-ink" />
            </Link>

            <nav className="hidden md:flex items-center gap-1 mx-auto">
              <div className="relative" onMouseEnter={() => abrir("produto")} onMouseLeave={() => fechar(FECHAR_MS)}>
                <button
                  type="button"
                  className={navLink}
                  aria-expanded={menuAberto === "produto"}
                  onClick={() => (menuAberto === "produto" ? fechar() : abrir("produto"))}
                >
                  Produto
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${menuAberto === "produto" ? "rotate-180" : ""}`}
                  />
                </button>

                {/* Painel do Produto: uma linha por módulo, com resumo e a seta
                  redonda da casa aparecendo no hover. O grid de 3 colunas
                  anterior espremia "Portal do cliente" e "Pilar Campo" e
                  deixava tudo com o mesmo peso de miniatura. */}
                <div
                  className={`absolute top-[calc(100%+10px)] left-1/2 -translate-x-1/2 w-[420px] rounded-[22px] border border-paper-border bg-frame p-2 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.35)] transition-all duration-200 ${
                    menuAberto === "produto"
                      ? "opacity-100 visible translate-y-0"
                      : "opacity-0 invisible -translate-y-1"
                  }`}
                >
                  {MODULOS.map((mo) => (
                    <Link
                      key={mo.slug}
                      to={`/${mo.slug}`}
                      onClick={() => fechar()}
                      className="group flex items-center gap-3.5 rounded-[16px] px-3.5 py-3 hover:bg-card-brand-soft transition-colors"
                    >
                      <span className={`h-2 w-2 shrink-0 rounded-full ${mo.cor.strong}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] font-medium text-ink">{rotuloDe(mo.slug, mo.nome)}</span>
                        <span className="block truncate text-[12px] leading-snug text-ink-muted">{mo.resumo}</span>
                      </span>
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-ink/15 text-ink opacity-0 transition-opacity group-hover:opacity-100">
                        <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.9} />
                      </span>
                    </Link>
                  ))}
                </div>
              </div>

              <Link to="/planos" className={navLink}>
                Planos
              </Link>
            </nav>

            <div className="hidden md:flex items-center gap-4 shrink-0">
              <a
                href={acesso.href}
                onClick={() => trackCta(acesso.evento, "header")}
                className="text-[14px] text-ink-soft hover:text-ink transition-colors"
              >
                {acesso.rotulo}
              </a>
              <SplitButton tamanho="sm" to="/planos" onClick={() => trackCta("ver_planos", "header")}>
                Ver planos
              </SplitButton>
            </div>

            <button
              type="button"
              className="md:hidden relative w-9 h-9 shrink-0 flex items-center justify-center text-ink ml-auto"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
              aria-expanded={mobileMenuOpen}
            >
              <Menu
                className={`absolute w-5 h-5 transition-all duration-300 ${
                  mobileMenuOpen ? "opacity-0 rotate-45 scale-75" : "opacity-100 rotate-0 scale-100"
                }`}
              />
              <X
                className={`absolute w-5 h-5 transition-all duration-300 ${
                  mobileMenuOpen ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-45 scale-75"
                }`}
              />
            </button>
          </div>

          {/* Menu do celular: o mesmo painel do Produto no desktop (módulo com
            resumo), depois Planos, e no pé os dois CTAs lado a lado, iguais aos
            da hero. */}
          <nav
            aria-label="Menu"
            className={`md:hidden absolute top-full left-0 right-0 mt-2 max-h-[calc(100dvh-6rem)] overflow-y-auto overscroll-contain rounded-[22px] border border-paper-border bg-frame p-2 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.35)] transition-all duration-200 ${
              mobileMenuOpen ? "opacity-100 visible translate-y-0" : "opacity-0 invisible -translate-y-1.5"
            }`}
          >
            <p className="px-3.5 pt-2.5 pb-1.5 text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-muted">
              Produto
            </p>
            {MODULOS.map((mo) => {
              const atual = pathname === `/${mo.slug}`;
              return (
                <Link
                  key={mo.slug}
                  to={`/${mo.slug}`}
                  onClick={() => setMobileMenuOpen(false)}
                  aria-current={atual ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-[16px] px-3.5 py-2.5 transition-colors active:bg-card-brand-soft ${
                    atual ? "bg-card-brand-soft" : ""
                  }`}
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${mo.cor.strong}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] font-medium text-ink">{rotuloDe(mo.slug, mo.nome)}</span>
                    <span className="block truncate text-[12px] leading-snug text-ink-muted">{mo.resumo}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-ink/35" strokeWidth={1.9} />
                </Link>
              );
            })}

            <span className="mx-3.5 my-2 block h-px bg-paper-border" />

            <Link
              to="/planos"
              onClick={() => setMobileMenuOpen(false)}
              aria-current={pathname === "/planos" ? "page" : undefined}
              className={`flex items-center justify-between rounded-[16px] px-3.5 py-3 text-[14.5px] font-medium text-ink transition-colors active:bg-card-brand-soft ${
                pathname === "/planos" ? "bg-card-brand-soft" : ""
              }`}
            >
              Planos
              <ArrowRight className="h-4 w-4 shrink-0 text-ink/35" strokeWidth={1.9} />
            </Link>

            <div className="mt-2 grid grid-cols-2 gap-2 p-1.5">
              <SplitButton
                fantasma
                className="w-full"
                href={acesso.href}
                onClick={() => trackCta(acesso.evento, "header_mobile")}
              >
                {acesso.rotulo}
              </SplitButton>
              <SplitButton
                className="w-full"
                to="/planos"
                onClick={() => {
                  setMobileMenuOpen(false);
                  trackCta("ver_planos", "header_mobile");
                }}
              >
                Ver planos
              </SplitButton>
            </div>
          </nav>
        </div>
      </header>
    </>
  );
}
