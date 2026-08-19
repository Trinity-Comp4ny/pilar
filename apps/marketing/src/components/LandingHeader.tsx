import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronDown, Menu, Smartphone, Sparkles, X } from "lucide-react";
import { APP_URL } from "../config";
import { trackCta } from "../analytics";
import { useLoginHint } from "../loginHint";
import { MODULOS } from "../lib/modules";
import { Logo } from "./Logo";

/** Atraso no fechar, pra dar tempo do mouse atravessar o vão até o painel. */
const FECHAR_MS = 160;

export function LandingHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [produtoAberto, setProdutoAberto] = useState(false);
  const [rolou, setRolou] = useState(false);
  const loggedIn = useLoginHint();
  const fecharTimer = useRef<number | null>(null);
  const produtoRef = useRef<HTMLDivElement>(null);

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
    "text-[13.5px] font-normal text-ink-soft px-3.5 py-2 rounded-full hover:bg-paper-alt hover:text-ink transition-colors";

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 bg-paper-white border-b transition-colors duration-300 transform-gpu ${
        rolou ? "border-paper-border/70" : "border-transparent"
      }`}
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      {/* Grade de 3 colunas: as laterais equilibram, então a navegação fica
          opticamente centralizada mesmo com logo e CTAs de larguras diferentes. */}
      <div className="container mx-auto px-6 md:px-10 h-16 flex md:grid md:grid-cols-[1fr_auto_1fr] items-center gap-6">
        <Link
          to="/"
          className="flex items-center gap-2 shrink-0 justify-self-start"
          onClick={() => setMobileMenuOpen(false)}
        >
          <Logo size="sm" className="text-ink-soft" />
        </Link>

        <nav className="hidden md:flex items-center gap-1 justify-self-center">
          <div
            ref={produtoRef}
            className="relative"
            onMouseEnter={abrir}
            onMouseLeave={() => fechar(FECHAR_MS)}
            onFocus={abrir}
            onBlur={(e) => {
              if (!produtoRef.current?.contains(e.relatedTarget as Node)) setProdutoAberto(false);
            }}
          >
            <button
              type="button"
              aria-expanded={produtoAberto}
              aria-haspopup="true"
              onClick={() => setProdutoAberto((v) => !v)}
              className={`${navLink} inline-flex items-center gap-1.5 ${produtoAberto ? "bg-paper-alt text-ink" : ""}`}
            >
              Produto
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${produtoAberto ? "rotate-180" : ""}`} />
            </button>

            <div
              className={`absolute top-[calc(100%+9px)] left-1/2 -translate-x-1/2 w-[760px] max-w-[calc(100vw-3rem)] bg-white border border-paper-border rounded-xl shadow-xl overflow-hidden transition-all duration-200 ${
                produtoAberto ? "opacity-100 visible translate-y-0" : "opacity-0 invisible -translate-y-1.5"
              }`}
            >
              <div className="p-4">
                <div className="flex justify-between items-center px-1 mb-3">
                  <span className="text-xs text-ink-muted">Módulos</span>
                  <Link to="/" className="text-xs text-modulo-projetos-strong inline-flex items-center gap-1">
                    Ver a plataforma
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  {MODULOS.map((mo) => (
                    <Link
                      key={mo.slug}
                      to={`/${mo.slug}`}
                      onClick={() => setProdutoAberto(false)}
                      className={`rounded-xl p-3.5 text-left hover:-translate-y-0.5 transition-transform ${mo.cor.fill}`}
                    >
                      <span className="block h-[76px] rounded-lg bg-white/80 border border-ink/5 mb-3 p-2 overflow-hidden">
                        <span className="block h-1 w-3/5 rounded-full bg-ink/10 mb-1.5" />
                        <span className="block h-1 w-2/5 rounded-full bg-ink/10 mb-2" />
                        <span className="grid grid-cols-3 gap-1">
                          <span className={`h-6 rounded ${mo.cor.strong} opacity-50`} />
                          <span className="h-6 rounded bg-ink/5" />
                          <span className="h-6 rounded bg-ink/5" />
                        </span>
                      </span>
                      <span className="block text-base font-semibold text-ink tracking-tight mb-0.5">{mo.nome}</span>
                      <span className="block text-xs text-ink-soft leading-snug">{mo.resumo}</span>
                    </Link>
                  ))}
                </div>
              </div>

              <div className="border-t border-paper-border/60 bg-paper-alt px-5 py-3 flex flex-wrap gap-6">
                <Link
                  to="/"
                  onClick={() => setProdutoAberto(false)}
                  className="inline-flex items-center gap-2 text-[12.5px] text-ink-soft"
                >
                  <Sparkles className="w-3.5 h-3.5 text-ink-muted shrink-0" strokeWidth={1.8} />
                  Agentes de IA. <span className="text-modulo-projetos-strong">Veja o que cada um faz →</span>
                </Link>
                <Link
                  to="/obra"
                  onClick={() => setProdutoAberto(false)}
                  className="inline-flex items-center gap-2 text-[12.5px] text-ink-soft"
                >
                  <Smartphone className="w-3.5 h-3.5 text-ink-muted shrink-0" strokeWidth={1.8} />
                  Pilar Campo, offline no canteiro. <span className="text-modulo-projetos-strong">Conhecer →</span>
                </Link>
              </div>
            </div>
          </div>

          <Link to="/planos" className={navLink}>
            Planos
          </Link>
          <Link to="/faq" className={navLink}>
            Perguntas frequentes
          </Link>
        </nav>

        <div className="hidden md:flex items-center gap-2 shrink-0 justify-self-end">
          {loggedIn ? (
            <a
              href={`${APP_URL}/inicio`}
              onClick={() => trackCta("abrir_pilar", "header_desktop")}
              className="px-5 py-2.5 bg-brand text-ink rounded-full font-medium text-[13.5px] hover:bg-brand/80 transition-colors"
            >
              Abrir Pilar
            </a>
          ) : (
            <>
              <a href={`${APP_URL}/login`} className={navLink}>
                Entrar
              </a>
              <a
                href={`${APP_URL}/cadastro`}
                onClick={() => trackCta("comecar_gratis", "header_desktop")}
                className="px-5 py-2.5 bg-brand text-ink rounded-full font-medium text-[13.5px] hover:bg-brand/80 transition-colors"
              >
                Testar grátis
              </a>
            </>
          )}
        </div>

        <button
          type="button"
          className="md:hidden relative w-9 h-9 shrink-0 flex items-center justify-center text-ink-soft ml-auto"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
          aria-expanded={mobileMenuOpen}
          aria-controls="landing-mobile-menu"
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
        id="landing-mobile-menu"
        className={`md:hidden absolute top-full left-0 right-0 bg-paper-white p-6 flex flex-col gap-1 shadow-xl transition-all duration-200 ${
          mobileMenuOpen ? "opacity-100 visible translate-y-0" : "opacity-0 invisible -translate-y-1.5"
        }`}
      >
        <p className="text-[10px] uppercase tracking-[0.14em] text-ink-muted font-medium mb-2">Módulos</p>
        {MODULOS.map((mo) => (
          <Link
            key={mo.slug}
            to={`/${mo.slug}`}
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 py-2.5"
          >
            <span className={`w-7 h-7 rounded-lg shrink-0 ${mo.cor.fill}`} />
            <span>
              <span className="block text-base font-medium text-ink">{mo.nome}</span>
              <span className="block text-xs text-ink-muted">{mo.resumo}</span>
            </span>
          </Link>
        ))}

        <div className="h-px bg-paper-border my-3" />

        <Link
          to="/planos"
          onClick={() => setMobileMenuOpen(false)}
          className="text-base font-medium text-ink-soft py-2"
        >
          Planos
        </Link>
        <Link to="/faq" onClick={() => setMobileMenuOpen(false)} className="text-base font-medium text-ink-soft py-2">
          Perguntas frequentes
        </Link>

        {loggedIn ? (
          <a
            href={`${APP_URL}/inicio`}
            onClick={() => trackCta("abrir_pilar", "header_mobile")}
            className="mt-3 px-6 py-3 bg-brand text-ink rounded-full text-center font-medium text-sm hover:bg-brand/80 transition-colors"
          >
            Abrir Pilar
          </a>
        ) : (
          <>
            <a
              href={`${APP_URL}/cadastro`}
              onClick={() => trackCta("comecar_gratis", "header_mobile")}
              className="mt-3 px-6 py-3 bg-brand text-ink rounded-full text-center font-medium text-sm hover:bg-brand/80 transition-colors"
            >
              Testar grátis
            </a>
            <a href={`${APP_URL}/login`} className="text-center text-sm font-medium text-ink-soft py-2">
              Já tenho conta, entrar
            </a>
          </>
        )}
      </div>
    </header>
  );
}
