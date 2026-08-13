import { useState } from "react";
import { useSidebar } from "@/components/ui/sidebar";
import { Plus, DollarSign, User } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import MetasDashboard from "./tabs/MetasDashboard";
import { MetaFormDialog, type MetaTipo } from "./components/MetaFormDialog";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function MetasPage() {
  usePageTitle("Metas");
  const { state, isMobile } = useSidebar();
  const [novaMetaTipo, setNovaMetaTipo] = useState<MetaTipo | null>(null);

  return (
    <div
      className="fixed top-0 right-0 bottom-0 bg-white z-40 overflow-hidden flex flex-col transition-[left] duration-300 ease-in-out"
      style={{ left: isMobile ? "0px" : state === "collapsed" ? "64px" : "240px" }}
    >
      <div className="sticky top-0 z-20 w-full bg-white border-b">
        <PageHeader title="Metas">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="brand" className="rounded-full h-9 px-4 text-[13px] font-medium">
                <Plus size={14} className="mr-1.5" />
                Nova meta
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setNovaMetaTipo("financeira")}>
                <DollarSign className="mr-2 h-4 w-4" />
                Meta financeira
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setNovaMetaTipo("pessoal")}>
                <User className="mr-2 h-4 w-4" />
                Meta pessoal
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </PageHeader>
      </div>

      <div className="flex-1 overflow-y-auto w-full bg-muted/50 p-6 md:p-8">
        <div className="w-full mx-auto space-y-6">
          <MetasDashboard />
        </div>
      </div>

      {novaMetaTipo && (
        <MetaFormDialog open={!!novaMetaTipo} onOpenChange={(o) => !o && setNovaMetaTipo(null)} tipo={novaMetaTipo} />
      )}
    </div>
  );
}
