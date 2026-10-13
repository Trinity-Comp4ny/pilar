import { lazy, Suspense, useEffect, useLayoutEffect, useRef } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { domAnimation, LazyMotion } from "framer-motion";
import { LandingHeader } from "./components/LandingHeader";
import { LandingFooter } from "./components/LandingFooter";
import { CookieConsentBanner } from "./components/CookieConsentBanner";
import { ScrollProgress } from "./components/motion";
import { SiteFrame } from "./components/chrome/SiteFrame";
import { SmoothScroll } from "./components/chrome/SmoothScroll";
import { Home } from "./pages/Home";
import { EntryVeil } from "../../../src/components/motion/EntryVeil";
import { isEntryVeilMounted } from "../../../src/components/motion/veilState";
import { dismissBoot } from "../../../src/components/motion/boot";
import { useRouteEnter } from "../../../src/components/motion/useRouteEnter";
import { conteudoProntoDe } from "./lib/htmlPronto";

// Só a home entra no bundle inicial. Páginas de módulo e FAQ viram chunks
// próprios: ninguém que cai na landing paga por elas no primeiro carregamento.
const ModulePage = lazy(() => import("./pages/ModulePage").then((m) => ({ default: m.ModulePage })));
const ComparativoPage = lazy(() => import("./pages/ComparativoPage").then((m) => ({ default: m.ComparativoPage })));
const Faq = lazy(() => import("./pages/Faq").then((m) => ({ default: m.Faq })));
const Planos = lazy(() => import("./pages/Planos").then((m) => ({ default: m.Planos })));
const Termos = lazy(() => import("./pages/Termos").then((m) => ({ default: m.Termos })));
const Privacidade = lazy(() => import("./pages/Privacidade").then((m) => ({ default: m.Privacidade })));
const NotFound = lazy(() => import("./pages/NotFound").then((m) => ({ default: m.NotFound })));

/**
 * Troca de rota volta ao topo: sem isso a página nova abre no meio.
 *
 * Também desliga a restauração automática de scroll do navegador. Com ela
 * ligada (o padrão), recarregar a home devolvia a posição anterior: a página
 * abria já dentro da hero, com o header exibindo a linha divisória de
 * "rolou" antes de o visitante rolar qualquer coisa.
 */
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [pathname]);

  return null;
}

/**
 * O anel do boot (spa.html, rota sem HTML pronto) cobre a landing até a primeira tela
 * pintar. Numa rota preguiçosa, o fallback do Suspense herda o anel e só o tira quando
 * a página chega.
 */
function SoltaBoot() {
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (!isEntryVeilMounted()) dismissBoot();
    }, 0);
    return () => window.clearTimeout(id);
  }, []);
  return null;
}

/**
 * Fallback das rotas preguiçosas. Na primeira carga de uma rota pré-renderizada,
 * segura a própria página pronta enquanto o chunk baixa; sem HTML pronto (rota fora
 * do prerender, navegação no cliente), o véu com o anel.
 */
function EsperaDaRota() {
  const { pathname } = useLocation();
  const nos = conteudoProntoDe(pathname);
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (nos) ref.current?.replaceChildren(...nos);
  }, [nos]);

  if (!nos) return <EntryVeil label="" />;
  return <div ref={ref} className="contents" />;
}

export default function App() {
  const mainRef = useRef<HTMLElement>(null);
  useRouteEnter(mainRef);

  return (
    <LazyMotion features={domAnimation} strict>
      <div className="landing-grain min-h-screen bg-paper text-ink-soft font-sans selection:bg-brand/30 selection:text-ink">
        <ScrollToTop />
        <SoltaBoot />
        <SmoothScroll />
        <SiteFrame />
        <ScrollProgress />
        <LandingHeader />

        <main ref={mainRef}>
          <Suspense fallback={<EsperaDaRota />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/gestao" element={<ModulePage slug="gestao" />} />
              <Route path="/projetos" element={<ModulePage slug="projetos" />} />
              <Route path="/obra" element={<ModulePage slug="obra" />} />
              <Route path="/portal" element={<ModulePage slug="portal" />} />
              <Route path="/campo" element={<ModulePage slug="campo" />} />
              <Route path="/vs/planilha" element={<ComparativoPage slug="planilha" />} />
              <Route path="/vs/trello" element={<ComparativoPage slug="trello" />} />
              <Route path="/faq" element={<Faq />} />
              <Route path="/planos" element={<Planos />} />
              <Route path="/termos" element={<Termos />} />
              <Route path="/privacidade" element={<Privacidade />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </main>

        <LandingFooter />
        <CookieConsentBanner />
      </div>
    </LazyMotion>
  );
}
