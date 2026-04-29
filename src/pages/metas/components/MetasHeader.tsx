import { Button } from "@/components/ui/button";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { RefreshCw, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function MetasHeader() {
  const { isMobile } = useSidebar();
  const queryClient = useQueryClient();

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("rpc_sync_metas");
      if (error) throw error;
      return data as number;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["metas"] });
      toast.success(`${count} meta(s) sincronizada(s)`);
    },
    onError: () => toast.error("Erro"),
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
    </div>
  );
}
