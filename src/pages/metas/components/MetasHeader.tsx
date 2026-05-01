import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";

export function MetasHeader() {
  const { isMobile } = useSidebar();

  return (
    <div className="sticky top-0 z-10 bg-white border-b shadow-sm w-full">
      <div className="px-6 py-4">
        <div className="flex items-start gap-3">
          {isMobile && (
            <SidebarTrigger className="mt-0.5 text-black/80 hover:text-brand hover:bg-black/5 transition-colors rounded-full h-9 w-9" />
          )}
          <div>
            <h1 className="text-2xl md:text-3xl font-medium tracking-tight">Metas</h1>
            <p className="text-sm text-black/60 mt-1">Acompanhe e gerencie seus objetivos</p>
          </div>
        </div>
      </div>
    </div>
  );
}
