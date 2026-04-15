import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { RefreshCw, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const tabTriggerClass =
  "rounded-none border-b-2 border-transparent data-[state=active]:border-[#FF4000] data-[state=active]:bg-white data-[state=active]:text-[#FF4000] py-3 px-4 min-w-max whitespace-nowrap text-sm";

export function MetasHeader() {
  const { isMobile } = useSidebar();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("rpc_sync_metas");
      if (error) throw error;
      return data as number;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["metas"] });
      toast({ title: `${count} meta(s) sincronizada(s)` });
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Erro", description: err.message }),
  });

  return (
    <div className="sticky top-0 z-10 bg-white border-b shadow-sm w-full">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-3">
            {isMobile && (
              <SidebarTrigger className="mt-0.5 text-black/80 hover:text-accent-orange hover:bg-black/5 transition-colors rounded-full h-9 w-9" />
            )}
            <div>
              <h1 className="text-2xl md:text-3xl font-medium tracking-tight">Metas</h1>
              <p className="text-sm text-black/60 mt-1">Acompanhe e gerencie seus objetivos</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
            {syncMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
            )}
            Sincronizar
          </Button>
        </div>
      </div>

      <div className="w-full bg-white border-t overflow-x-auto">
        <TabsList className="rounded-none bg-transparent border-none h-auto p-0 flex flex-nowrap gap-0 min-w-max w-full">
          <TabsTrigger value="dashboard" className={tabTriggerClass}>
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="financeiras" className={tabTriggerClass}>
            Financeiras
          </TabsTrigger>
          <TabsTrigger value="pessoais" className={tabTriggerClass}>
            Pessoais
          </TabsTrigger>
          <TabsTrigger value="projetos" className={tabTriggerClass}>
            Projetos
          </TabsTrigger>
        </TabsList>
      </div>
    </div>
  );
}
