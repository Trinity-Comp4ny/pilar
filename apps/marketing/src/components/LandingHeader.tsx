import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, ChevronDown, Menu, X } from "lucide-react";
import { trackCta } from "../analytics";
import { useAcesso } from "../loginHint";
import { COLUNAS_MENU, PUBLICOS_NAV } from "../lib/navegacao";
import { Logo } from "./Logo";
import { SplitButton } from "./ui/SplitButton";

type MenuNome = "produto" | "publico";

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
 * O menu fica com o que decide a compra: Funcionalidades, Para quem e Planos. Blog,
 * ferramentas, FAQ e segurança moram no rodapé. À direita, "Entrar" em texto e "Ver planos". A
 * demonstração fica na hero e nas chamadas da página, não no header (pedido do dono, 24/11).
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

            <nav aria-label="Principal" className="hidden md:flex items-center gap-0.5 mx-auto">
              <button
                type="button"
                className={navLink}
                aria-expanded={menuAberto === "produto"}
                aria-controls="menu-funcionalidades"
                onMouseEnter={() => abrir("produto")}
                onMouseLeave={() => fechar(FECHAR_MS)}
                onClick={() => (menuAberto === "produto" ? fechar() : abrir("produto"))}
              >
                Funcionalidades
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${menuAberto === "produto" ? "rotate-180" : ""}`}
                />
              </button>

              <div className="relative" onMouseEnter={() => abrir("publico")} onMouseLeave={() => fechar(FECHAR_MS)}>
                <button
                  type="button"
                  className={navLink}
                  aria-expanded={menuAberto === "publico"}
                  onClick={() => (menuAberto === "publico" ? fechar() : abrir("publico"))}
                >
                  Para quem
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${menuAberto === "publico" ? "rotate-180" : ""}`}
                  />
                </button>
                <div
                  className={`absolute top-[calc(100%+10px)] left-1/2 -translate-x-1/2 w-[340px] rounded-[22px] border border-paper-border bg-frame p-2 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.35)] transition-all duration-200 ${
                    menuAberto === "publico"
                      ? "opacity-100 visible translate-y-0"
                      : "opacity-0 invisible -translate-y-1"
                  }`}
                >
                  {PUBLICOS_NAV.map((g) => (
                    <div key={g.grupo}>
                      <p className="px-3.5 pt-2.5 pb-1 text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-muted">
                        {g.grupo}
                      </p>
                      {g.links.map((l) => (
                        <Link
                          key={l.to}
                          to={l.to}
                          onClick={() => fechar()}
                          className="group flex items-center gap-3 rounded-[16px] px-3.5 py-2.5 hover:bg-card-brand-soft transition-colors"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13.5px] font-medium text-ink">{l.rotulo}</span>
                            <span className="block text-[12px] leading-snug text-ink-muted">{l.resumo}</span>
                          </span>
                          <ArrowRight
                            className="h-4 w-4 shrink-0 text-ink opacity-0 transition-opacity group-hover:opacity-100"
                            strokeWidth={1.9}
                          />
                        </Link>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              <Link to="/planos" className={navLink}>
                Planos
              </Link>
            </nav>

            {/* Mega-menu de Funcionalidades: ancorado à pílula (não ao botão), com a
              largura que precisa. Seis colunas espelham o catálogo (três módulos, Portal,
              Campo e Agentes) e já listam os recursos de cada uma, então o visitante chega
              direto na página que procura, sem passar pelo índice. Vobi e Mais Controle
              agrupam do mesmo jeito. */}
            <div
              id="menu-funcionalidades"
              onMouseEnter={() => abrir("produto")}
              onMouseLeave={() => fechar(FECHAR_MS)}
              className={`hidden md:block absolute top-[calc(100%+10px)] left-1/2 -translate-x-1/2 w-[min(920px,calc(100vw-48px))] rounded-[24px] border border-paper-border bg-frame p-3 shadow-[0_28px_70px_-26px_rgba(0,0,0,0.38)] transition-all duration-200 ${
                menuAberto === "produto" ? "opacity-100 visible translate-y-0" : "opacity-0 invisible -translate-y-1"
              }`}
            >
              <div className="grid grid-cols-3 gap-x-2 gap-y-1">
                {COLUNAS_MENU.map((c) => (
                  <div key={c.id} className="rounded-[18px] p-3">
                    <Link to={c.href} onClick={() => fechar()} className="group mb-2 block">
                      <span className="flex items-center gap-2 text-[14px] font-medium text-ink">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${c.corStrong}`} />
                        {c.titulo}
                        <ArrowRight
                          className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100"
                          strokeWidth={1.9}
                        />
                      </span>
                      <span className="mt-0.5 block text-[12px] leading-snug text-ink-muted">{c.resumo}</span>
                    </Link>
                    <ul className="flex flex-col">
                      {c.links.map((l) => (
                        <li key={l.to}>
                          <Link
                            to={l.to}
                            onClick={() => fechar()}
                            className="flex items-center justify-between gap-2 rounded-[10px] px-2 py-[6px] text-[13px] text-ink-soft transition-colors hover:bg-card-brand-soft hover:text-ink"
                          >
                            <span>{l.rotulo}</span>
                            {l.selo ? (
                              <span
                                className={`shrink-0 rounded-full px-1.5 py-[1px] text-[9.5px] font-medium uppercase tracking-[0.08em] ${
                                  l.selo === "IA" ? "bg-brand text-ink" : "border border-ink/20 text-ink/70"
                                }`}
                              >
                                {l.selo}
                              </span>
                            ) : null}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <Link
                to="/funcionalidades"
                onClick={() => {
                  fechar();
                  trackCta("ver_funcionalidades", "header");
                }}
                className="group mt-1 flex items-center justify-center gap-1.5 rounded-[14px] border-t border-paper-border px-5 pt-3 pb-1.5 text-[13px] text-ink-soft transition-colors hover:text-ink"
              >
                Ver todas as funcionalidades
                <ArrowRight
                  className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                  strokeWidth={1.9}
                />
              </Link>
            </div>

            <div className="hidden md:flex items-center gap-3 shrink-0">
              <a
                href={acesso.href}
                onClick={() => trackCta(acesso.evento, "header")}
                className="px-1 text-[14px] text-ink-soft hover:text-ink transition-colors"
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
              Funcionalidades
            </p>
            {COLUNAS_MENU.map((c) => {
              const atual = pathname === c.href;
              return (
                <Link
                  key={c.id}
                  to={c.href}
                  onClick={() => setMobileMenuOpen(false)}
                  aria-current={atual ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-[16px] px-3.5 py-2.5 transition-colors active:bg-card-brand-soft ${
                    atual ? "bg-card-brand-soft" : ""
                  }`}
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${c.corStrong}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] font-medium text-ink">{c.titulo}</span>
                    <span className="block truncate text-[12px] leading-snug text-ink-muted">{c.resumo}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-ink/35" strokeWidth={1.9} />
                </Link>
              );
            })}
            <Link
              to="/funcionalidades"
              onClick={() => {
                setMobileMenuOpen(false);
                trackCta("ver_funcionalidades", "header_mobile");
              }}
              className="flex items-center justify-between rounded-[16px] px-3.5 py-2.5 text-[13.5px] text-ink-soft transition-colors active:bg-card-brand-soft"
            >
              Ver todas as funcionalidades
              <ArrowRight className="h-4 w-4 shrink-0 text-ink/35" strokeWidth={1.9} />
            </Link>

            <p className="px-3.5 pt-4 pb-1.5 text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-muted">
              Para quem
            </p>
            {PUBLICOS_NAV.flatMap((g) => g.links).map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setMobileMenuOpen(false)}
                aria-current={pathname === l.to ? "page" : undefined}
                className={`flex items-center justify-between rounded-[16px] px-3.5 py-2.5 text-[14.5px] font-medium text-ink transition-colors active:bg-card-brand-soft ${
                  pathname === l.to ? "bg-card-brand-soft" : ""
                }`}
              >
                {l.rotulo}
                <ArrowRight className="h-4 w-4 shrink-0 text-ink/35" strokeWidth={1.9} />
              </Link>
            ))}

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

            <a
              href={acesso.href}
              onClick={() => trackCta(acesso.evento, "header_mobile")}
              className="flex items-center justify-between rounded-[16px] px-3.5 py-3 text-[14.5px] font-medium text-ink transition-colors active:bg-card-brand-soft"
            >
              {acesso.rotulo}
              <ArrowRight className="h-4 w-4 shrink-0 text-ink/35" strokeWidth={1.9} />
            </a>

            <div className="mt-2 p-1.5">
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
