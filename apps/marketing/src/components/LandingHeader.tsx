import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronDown, Menu, X } from "lucide-react";
import { APP_URL } from "../config";
import { trackCta } from "../analytics";
import { useLoginHint } from "../loginHint";
import { MODULOS } from "../lib/modules";
import { Logo } from "./Logo";
import { SplitButton } from "./ui/SplitButton";

/** Atraso no fechar, pra dar tempo do mouse atravessar o vão até o painel. */
const FECHAR_MS = 160;

/**
 * Header em pílula flutuante, encaixado dentro da moldura branca do site.
 *
 * Não é mais uma barra de ponta a ponta: é um cartão branco centralizado, com
 * largura própria, que paira sobre o conteúdo. Continua `fixed`, mas colado à
 * borda interna da moldura (`top: var(--frame-w)`), então nunca há a faixa de
 * conteúdo aparecendo acima dele que o iOS Safari criava.
 */
export function LandingHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [produtoAberto, setProdutoAberto] = useState(false);
  const [rolou, setRolou] = useState(false);
  const loggedIn = useLoginHint();
  const fecharTimer = useRef<number | null>(null);

  useEffect(() => {
    const onScroll = () => setRolou(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const abrir = () => {
    if (fecharTimer.current) {
      window.clearTimeout(fecharTimer.current);
      fecharTimer.current = null;
    }
    setProdutoAberto(true);
  };

  const fechar = (delay = 0) => {
    if (fecharTimer.current) window.clearTimeout(fecharTimer.current);
    fecharTimer.current = window.setTimeout(() => setProdutoAberto(false), delay);
  };

  useEffect(
    () => () => {
      if (fecharTimer.current) window.clearTimeout(fecharTimer.current);
    },
    []
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setProdutoAberto(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const navLink =
    "flex items-center gap-1 text-[14px] text-ink-soft px-3 py-2 rounded-full hover:text-ink transition-colors";

  /** Na home, rola suave até os módulos; fora dela, deixa o Link navegar. */
  const irParaProduto = (e: React.MouseEvent) => {
    const alvo = document.getElementById("produto");
    if (!alvo) return;
    e.preventDefault();
    alvo.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <header className="fixed inset-x-0 z-50 flex justify-center px-3 md:px-6" style={{ top: "var(--frame-w)" }}>
      <div
        className={`relative w-full max-w-[1216px] rounded-b-[22px] bg-frame transition-shadow duration-300 ${
          rolou ? "shadow-[0_10px_36px_-16px_rgba(0,0,0,0.28)]" : "shadow-[0_2px_10px_-6px_rgba(0,0,0,0.14)]"
        }`}
      >
        <div className="flex h-16 md:h-20 items-center gap-6 px-5 md:px-7">
          <Link to="/" className="shrink-0" onClick={() => setMobileMenuOpen(false)}>
            <Logo size="sm" className="text-ink" />
          </Link>

          <nav className="hidden md:flex items-center gap-1 mx-auto">
            <div className="relative" onMouseEnter={abrir} onMouseLeave={() => fechar(FECHAR_MS)}>
              <button
                type="button"
                className={navLink}
                aria-expanded={produtoAberto}
                onClick={() => (produtoAberto ? fechar() : abrir())}
              >
                Produto
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${produtoAberto ? "rotate-180" : ""}`}
                />
              </button>

              {/* Painel do Produto: uma linha por módulo, com resumo e a seta
                  redonda da casa aparecendo no hover. O grid de 3 colunas
                  anterior espremia "Portal do cliente" e "Pilar Campo" e
                  deixava tudo com o mesmo peso de miniatura. */}
              <div
                className={`absolute top-[calc(100%+10px)] left-1/2 -translate-x-1/2 w-[420px] rounded-[22px] border border-paper-border bg-frame p-2 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.35)] transition-all duration-200 ${
                  produtoAberto ? "opacity-100 visible translate-y-0" : "opacity-0 invisible -translate-y-1"
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
                      <span className="block text-[13.5px] font-medium text-ink">{mo.nome}</span>
                      <span className="block truncate text-[12px] leading-snug text-ink-muted">{mo.resumo}</span>
                    </span>
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-ink/15 text-ink opacity-0 transition-opacity group-hover:opacity-100">
                      <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.9} />
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Âncora, não rota: leva à seção dos módulos na home. Fora da
                home, o Link com hash navega e depois desce até a seção. */}
            <Link to="/#produto" className={navLink} onClick={irParaProduto}>
              Funcionalidades
            </Link>
            <Link to="/planos" className={navLink}>
              Planos
            </Link>
          </nav>

          <div className="hidden md:flex items-center gap-3 shrink-0">
            {!loggedIn && (
              <a
                href={`${APP_URL}/login`}
                onClick={() => trackCta("entrar", "header")}
                className="text-[14px] text-ink-soft hover:text-ink transition-colors"
              >
                Entrar
              </a>
            )}
            <SplitButton
              tamanho="sm"
              href={loggedIn ? `${APP_URL}/inicio` : `${APP_URL}/cadastro`}
              onClick={() => trackCta(loggedIn ? "abrir_pilar" : "testar_gratis", "header")}
            >
              {loggedIn ? "Abrir Pilar" : "Testar grátis"}
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

        <div
          className={`md:hidden absolute top-full left-0 right-0 mt-2 rounded-2xl border border-paper-border bg-frame p-5 flex flex-col gap-1 shadow-xl transition-all duration-200 ${
            mobileMenuOpen ? "opacity-100 visible translate-y-0" : "opacity-0 invisible -translate-y-1.5"
          }`}
        >
          {MODULOS.map((mo) => (
            <Link
              key={mo.slug}
              to={`/${mo.slug}`}
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5 py-2.5 text-[15px] text-ink"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${mo.cor.strong}`} />
              {mo.nome}
            </Link>
          ))}
          <span className="h-px bg-paper-border my-2" />
          <Link
            to="/#produto"
            onClick={(e) => {
              setMobileMenuOpen(false);
              irParaProduto(e);
            }}
            className="py-2.5 text-[15px] text-ink"
          >
            Funcionalidades
          </Link>
          <Link to="/planos" onClick={() => setMobileMenuOpen(false)} className="py-2.5 text-[15px] text-ink">
            Planos
          </Link>
          <SplitButton
            className="mt-3"
            href={loggedIn ? `${APP_URL}/inicio` : `${APP_URL}/cadastro`}
            onClick={() => trackCta(loggedIn ? "abrir_pilar" : "testar_gratis", "header_mobile")}
          >
            {loggedIn ? "Abrir Pilar" : "Testar grátis por 14 dias"}
          </SplitButton>
        </div>
      </div>
    </header>
  );
}
