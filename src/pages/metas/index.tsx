import { useState } from "react";
import { useSidebar } from "@/components/ui/sidebar";
import { sidebarOffset } from "@/lib/shellLayout";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import MetasDashboard from "./tabs/MetasDashboard";
import { MetaFormDialog } from "./components/MetaFormDialog";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function MetasPage() {
  usePageTitle("Metas");
  const { state, isMobile } = useSidebar();
  const [novaMetaOpen, setNovaMetaOpen] = useState(false);

  return (
    <div
      className="fixed top-0 right-0 bottom-0 bg-background z-40 overflow-hidden flex flex-col transition-[left] duration-300 ease-in-out"
      style={{ left: sidebarOffset(state, isMobile) }}
    >
      <div className="sticky top-0 z-20 w-full bg-background border-b">
        <PageHeader title="Metas">
          <Button
            variant="brand"
            className="rounded-full h-9 px-4 text-[13px] font-medium"
            onClick={() => setNovaMetaOpen(true)}
          >
            <Plus size={14} className="mr-1.5" />
            Nova meta
          </Button>
        </PageHeader>
      </div>

      {/* Área com rolagem própria: precisa receber foco para rolar pelo teclado (axe
          scrollable-region-focusable) quando o conteúdo não tem nada focável. */}
      <div
        className="flex-1 overflow-y-auto w-full bg-background p-6 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:p-8"
        tabIndex={0}
        role="region"
        aria-label="Painel de metas"
      >
        <div className="w-full mx-auto space-y-6">
          <MetasDashboard onCreate={() => setNovaMetaOpen(true)} />
        </div>
      </div>

      <MetaFormDialog open={novaMetaOpen} onOpenChange={setNovaMetaOpen} />
    </div>
  );
}
