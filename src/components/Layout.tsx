import { Outlet } from "react-router-dom";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AlertsBell } from "@/components/AlertsBell";

function LayoutContent() {
  const { state, isMobile } = useSidebar();
  const marginLeft = isMobile ? "ml-0" : state === "collapsed" ? "ml-[64px]" : "ml-[240px]";

  return (
    <div className="min-h-screen bg-white">
      <AppSidebar />
      <div className={`${marginLeft}`}>
        <div className="flex justify-end items-center px-6 pt-4 md:px-10">
          <AlertsBell />
        </div>
        <main className="md:px-10 md:pb-10 md:pt-4">
          <Outlet />
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