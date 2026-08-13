import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Target, Loader2 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Meta {
  id: string;
  nome: string;
  alvo: number;
  atual: number;
  prazo: string;
  categoria: "receita" | "lucro" | "economia" | "investimento";
}

export default function MetasSummary() {
  const { data: metas, isLoading } = useQuery({
    queryKey: ["metas-summary"],
    queryFn: async () => {
      const { data, error } = await supabase.from("metas").select("*").limit(3);
      if (error) throw error;
      return data as Meta[];
    },
  });

  if (isLoading) {
    return (
      <Card className="w-full h-full">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Metas
            </CardTitle>
            <CardDescription className="mt-1">Principais metas</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-40">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Metas
          </CardTitle>
          <CardDescription className="mt-1">Principais metas</CardDescription>
        </div>
        {/* <Button variant="outline" size="sm" onClick={() => navigate("/gestao/metas")} className="text-xs rounded-full">
          Ver Todas
        </Button> */}
      </CardHeader>
      <CardContent className="space-y-4">
        {!metas || metas.length === 0 ? (
          <EmptyState
            icon={Target}
            title="Nenhuma meta cadastrada"
            description="Defina metas para acompanhar o progresso do time."
            className="py-6"
          />
        ) : (
          metas.map((meta) => {
            const percent = Math.min(Math.round((meta.atual / meta.alvo) * 100), 100);
            return (
              <div key={meta.id} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">{meta.nome}</span>
                  <span className="text-sm font-bold">{percent}%</span>
                </div>
                <Progress value={percent} className="h-2 bg-black" indicatorClassName="bg-positive/100" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>R$ {(meta.atual / 1000).toFixed(0)}k</span>
                  <span>R$ {(meta.alvo / 1000).toFixed(0)}k</span>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
