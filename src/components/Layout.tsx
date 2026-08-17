import { Suspense, lazy } from "react";
import { Outlet } from "react-router-dom";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { CommandPaletteHint } from "@/components/CommandPaletteHint";
import { useCommandPalette } from "@/hooks/useCommandPalette";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { UltraAdminPlatformBanner } from "@/components/UltraAdminPlatformBanner";

// Lazy: o CommandPalette carrega o cmdk. Fora do bundle de entrada; só baixa no 1º ⌘K.
const CommandPalette = lazy(() => import("@/components/CommandPalette").then((m) => ({ default: m.CommandPalette })));

// Lazy: onboarding (checklist + tour driver.js) fica fora do bundle de entrada.
const OnboardingChecklist = lazy(() =>
  import("@/components/OnboardingChecklist").then((m) => ({ default: m.OnboardingChecklist }))
);
const OnboardingTourController = lazy(() =>
  import("@/components/onboarding/OnboardingTourController").then((m) => ({
    default: m.OnboardingTourController,
  }))
);

// Atalho ⌘K sempre ativo (hook leve); o dialog pesado só monta quando aberto.
function CommandPaletteMount() {
  const { open, setOpen } = useCommandPalette();
  return (
    <>
      <CommandPaletteHint />
      <Suspense fallback={null}>{open && <CommandPalette open={open} onOpenChange={setOpen} />}</Suspense>
    </>
  );
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
  const marginLeft = isMobile ? "ml-0" : state === "collapsed" ? "ml-[64px]" : "ml-[240px]";

  return (
    <div className="min-h-screen w-full flex-1 min-w-0 bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:rounded focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-md focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Pular para conteúdo principal
      </a>
      <AppSidebar />
      <div className={`${marginLeft}`}>
        <UltraAdminPlatformBanner />
        <main id="main-content" className="md:px-10 md:pb-10 md:pt-4">
          <ErrorBoundary>
            <DevErrorTrigger />
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
      <CommandPaletteMount />
      <Suspense fallback={null}>
        <OnboardingChecklist />
        <OnboardingTourController />
      </Suspense>
    </div>
  );
}

export default function Layout() {
  return (
    <SidebarProvider>
      <LayoutContent />
    </SidebarProvider>
  );
}
