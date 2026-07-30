import { Outlet } from "react-router-dom";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AlertsBell } from "@/components/AlertsBell";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { UltraAdminPlatformBanner } from "@/components/UltraAdminPlatformBanner";

function LayoutContent() {
  const { state, isMobile } = useSidebar();
  const marginLeft = isMobile ? "ml-0" : state === "collapsed" ? "ml-[64px]" : "ml-[240px]";

  return (
    <div className="min-h-screen w-full flex-1 min-w-0 bg-white">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:rounded focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-md focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Pular para conteúdo principal
      </a>
      <AppSidebar />
      <div className={`${marginLeft}`}>
        <UltraAdminPlatformBanner />
        <div className="flex justify-end items-center px-6 pt-4 md:px-10">
          <AlertsBell />
        </div>
        <main id="main-content" className="md:px-10 md:pb-10 md:pt-4">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
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
