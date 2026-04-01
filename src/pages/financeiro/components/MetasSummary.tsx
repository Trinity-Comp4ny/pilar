import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Target, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();

  const { data: metas, isLoading } = useQuery({
    queryKey: ['metas-summary'],
    queryFn: async () => {
      const { data, error } = await supabase.from('metas').select('*').limit(3);
      if (error) throw error;
      return data as Meta[];
    }
  });

  const getProgressColor = (percent: number) => {
    return "bg-green-500";
  };

  if (isLoading) {
    return (
      <Card className="vrz-card w-full h-full">
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
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="vrz-card w-full h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Metas
          </CardTitle>
          <CardDescription className="mt-1">Principais metas</CardDescription>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => navigate('/financeiro?tab=metas')}
          className="text-xs rounded-full"
        >
          Ver Todas
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {!metas || metas.length === 0 ? (
          <div className="text-center text-muted-foreground py-4">Nenhuma meta cadastrada</div>
        ) : (
          metas.map((meta) => {
            const percent = Math.min(Math.round((meta.atual / meta.alvo) * 100), 100);
            return (
              <div key={meta.id} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">{meta.nome}</span>
                  <span className="text-sm font-bold">{percent}%</span>
                </div>
                <Progress value={percent} className="h-2 bg-black" indicatorClassName="bg-green-500" />
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
