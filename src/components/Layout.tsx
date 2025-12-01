import { Outlet } from "react-router-dom";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

function LayoutContent() {
  const { state } = useSidebar();
  const marginLeft = state === "collapsed" ? "ml-[64px]" : "ml-[240px]";
  
  return (
    <div className="min-h-screen bg-white">
      <AppSidebar />
      <div className={`${marginLeft}`}>
        <main className="p-6 md:p-10">
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