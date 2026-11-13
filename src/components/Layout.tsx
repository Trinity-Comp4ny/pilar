import { Suspense, lazy, useRef } from "react";
import { Outlet } from "react-router-dom";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { sidebarOffset, telaEstreitaParaPainel } from "@/lib/shellLayout";
import { BottomNav } from "@/components/BottomNav";
import { useCommandPalette } from "@/hooks/useCommandPalette";
import { useAtalhosTeclado } from "@/hooks/useAtalhosTeclado";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageLoader } from "@/components/motion/PageLoader";
import { VeilExit } from "@/components/motion/EntryVeil";
import { useRouteEnter } from "@/components/motion/useRouteEnter";
import { AvatarDiretorioProvider } from "@/contexts/AvatarDiretorioContext";
import { DentroDoMainProvider } from "@/components/mainLandmark";

// Lazy: o CommandPalette carrega o cmdk. Fora do bundle de entrada; só baixa no 1º ⌘K.
const CommandPalette = lazy(() => import("@/components/CommandPalette").then((m) => ({ default: m.CommandPalette })));

// Lazy: o painel de atalhos só baixa no 1º "?" (ou pelo item da paleta).
const AtalhosTecladoDialog = lazy(() =>
  import("@/components/AtalhosTecladoDialog").then((m) => ({ default: m.AtalhosTecladoDialog }))
);

// Lazy: onboarding (checklist + tour driver.js) fica fora do bundle de entrada.
const OnboardingChecklist = lazy(() =>
  import("@/components/OnboardingChecklist").then((m) => ({ default: m.OnboardingChecklist }))
);
// Lazy: modal "O que mudou" (SPEC 152). Só monta conteúdo quando há mudança de fluxo nova.
const OQueMudou = lazy(() => import("@/components/novidades/OQueMudou").then((m) => ({ default: m.OQueMudou })));
// Lazy: agente da ajuda no canto (SPEC 155). Traz o markdown dos artigos; fora do bundle de entrada.
const AgenteAjuda = lazy(() => import("@/components/agente/AgenteAjuda").then((m) => ({ default: m.AgenteAjuda })));
// Lazy: comunicado em modal (SPEC 157).
const ComunicadoModal = lazy(() =>
  import("@/components/ComunicadoModal").then((m) => ({ default: m.ComunicadoModal }))
);
// Lazy: registro do navegador para o alerta de acesso novo (SPEC 159).
const RegistroDispositivo = lazy(() =>
  import("@/components/RegistroDispositivo").then((m) => ({ default: m.RegistroDispositivo }))
);
// Lazy: faixas do topo (Termos e avisos, SPEC 153/157) e o bloco fixo que mede a altura delas.
// Fora do bundle de entrada: o teto do boot é apertado (scripts/check-bundle-size.mjs).
const FaixasDoTopo = lazy(() => import("@/components/FaixasDoTopo").then((m) => ({ default: m.FaixasDoTopo })));
// Lazy: NPS no Início (SPEC 156).
const NpsCard = lazy(() => import("@/components/pesquisas/NpsCard").then((m) => ({ default: m.NpsCard })));
const OnboardingTourController = lazy(() =>
  import("@/components/onboarding/OnboardingTourController").then((m) => ({
    default: m.OnboardingTourController,
  }))
);

// Atalho ⌘K sempre ativo (hook leve); o dialog pesado só monta quando aberto. A dica visual
// do atalho mora no trilho da sidebar (CommandPaletteHint), não flutuando sobre o conteúdo.
function CommandPaletteMount() {
  const { open, setOpen } = useCommandPalette();
  return <Suspense fallback={null}>{open && <CommandPalette open={open} onOpenChange={setOpen} />}</Suspense>;
}

// Atalho "?" sempre ativo (hook leve); o painel só monta quando aberto.
function AtalhosTecladoMount() {
  const { open, setOpen } = useAtalhosTeclado();
  return <Suspense fallback={null}>{open && <AtalhosTecladoDialog open={open} onOpenChange={setOpen} />}</Suspense>;
}

// Gatilho só-dev para pré-visualizar o ErrorBoundary: abra qualquer página com ?boom
// na URL (ex.: /financeiro?boom). Nunca renderiza em produção.
function DevErrorTrigger() {
  if (!import.meta.env.DEV) return null;
  if (new URLSearchParams(window.location.search).has("boom")) {
    throw new Error("Cannot read properties of undefined (reading 'periodo')");
  }
  return null;
}

function LayoutContent() {
  const { state, isMobile } = useSidebar();
  const mainRef = useRef<HTMLElement>(null);
  useRouteEnter(mainRef);

  return (
    <div className="min-h-dvh w-full flex-1 min-w-0 bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-9999 focus:rounded focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-md focus:outline-hidden focus:ring-2 focus:ring-ring"
      >
        Pular para conteúdo principal
      </a>
      <Suspense fallback={null}>
        <FaixasDoTopo left={sidebarOffset(state, isMobile)} />
      </Suspense>
      <AppSidebar />
      <div style={{ marginLeft: sidebarOffset(state, isMobile), paddingTop: "var(--faixas-h, 0px)" }}>
        <main
          ref={mainRef}
          id="main-content"
          // Alvo do skip link: sem tabIndex o foco não vai para o conteúdo (Safari e leitores
          // de tela ficam no link). -1 = focável por script e por âncora, fora da ordem do Tab.
          tabIndex={-1}
          className="pb-[calc(6.5rem+env(safe-area-inset-bottom))] outline-hidden md:px-10 md:pb-10 md:pt-4"
        >
          <DentroDoMainProvider value>
            <ErrorBoundary>
              <DevErrorTrigger />
              {/* Página preguiçosa baixando: a sidebar fica e o anel ocupa só o conteúdo. */}
              <Suspense fallback={<PageLoader size="page" />}>
                <Outlet />
              </Suspense>
            </ErrorBoundary>
          </DentroDoMainProvider>
        </main>
      </div>
      {/* Navegação mobile (spec 097 / ADR 0040): substitui o drawer da sidebar
          abaixo de md. Fixa; PageLayout e este <main> reservam o espaço embaixo. */}
      <BottomNav />
      <VeilExit />
      <CommandPaletteMount />
      <AtalhosTecladoMount />
      <Suspense fallback={null}>
        <OnboardingChecklist />
        <OnboardingTourController />
        <OQueMudou />
        <AgenteAjuda />
        <NpsCard />
        <RegistroDispositivo />
        <ComunicadoModal />
      </Suspense>
    </div>
  );
}

export default function Layout() {
  return (
    // Tela estreita começa com o painel recolhido; o cookie com a escolha da pessoa vence.
    <SidebarProvider defaultOpen={!telaEstreitaParaPainel()}>
      <AvatarDiretorioProvider>
        <LayoutContent />
      </AvatarDiretorioProvider>
    </SidebarProvider>
  );
}
