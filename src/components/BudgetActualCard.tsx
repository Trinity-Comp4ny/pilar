import { useQuery } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

// ---------- tipos ----------

interface OrcamentoFase {
  id: string;
  disciplina: string;
  horas_estimadas: number | null;
  custo_hora: number | null;
  valor_venda: number | null;
}

interface BudgetActualCardProps {
  projetoId: string;
  /** Callback para abrir o form de orçamento quando não há dados */
  onAddBudget?: () => void;
}

// ---------- helpers ----------

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

// ---------- componente ----------

export function BudgetActualCard({ projetoId, onAddBudget }: BudgetActualCardProps) {
  const { data: fases = [], isLoading } = useQuery({
    queryKey: ["budget-actual", projetoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_orcamento_fases")
        .select("id, disciplina, horas_estimadas, custo_hora, valor_venda")
        .eq("projeto_id", projetoId)
        .is("deleted_at", null)
        .order("disciplina");
      if (error) throw error;
      return (data ?? []) as OrcamentoFase[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const totalValorVenda = fases.reduce((acc, f) => acc + (f.valor_venda ?? 0), 0);
  const totalHoras = fases.reduce((acc, f) => acc + (f.horas_estimadas ?? 0), 0);

  if (isLoading) return <BudgetActualSkeleton />;

  return (
    <Card className="rounded-2xl border border-black/5 bg-white">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-medium tracking-tight flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              Orçamento por Disciplina
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Dados reais disponíveis após registrar horas no Timesheet
            </CardDescription>
          </div>
          {fases.length > 0 && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Total orçado</p>
              <p className="text-sm font-semibold">{formatBRL(totalValorVenda)}</p>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {fases.length === 0 ? (
          <EmptyBudget onAdd={onAddBudget} />
        ) : (
          <div className="space-y-4">
            {fases.map((fase) => {
              const valorVenda = fase.valor_venda ?? 0;
              const horas = fase.horas_estimadas ?? 0;
              return (
                <div key={fase.id} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{fase.disciplina}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs font-normal">
                        Sem dados reais
                      </Badge>
                      <span className="text-xs text-muted-foreground">{formatBRL(valorVenda)}</span>
                    </div>
                  </div>

                  <Progress value={0} className="h-1.5 bg-muted" />

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>0% realizado</span>
                    <span>
                      {horas > 0 ? `${horas}h estimadas` : "Sem horas estimadas"}
                      {fase.custo_hora ? ` · ${formatBRL(fase.custo_hora)}/h` : ""}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Rodapé resumo */}
            <div className="pt-2 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
              <span>{fases.length} disciplina{fases.length !== 1 ? "s" : ""}</span>
              <span>{totalHoras > 0 ? `${totalHoras}h no total` : "Horas não informadas"}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- empty state ----------

function EmptyBudget({ onAdd }: { onAdd?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
      <div className="rounded-full bg-muted p-3">
        <BarChart3 className="h-5 w-5 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium">Sem orçamento cadastrado</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Adicione o orçamento do projeto para ver a análise por disciplina
        </p>
      </div>
      {onAdd && (
        <Button variant="outline" size="sm" onClick={onAdd} className="rounded-full">
          Adicionar orçamento
        </Button>
      )}
    </div>
  );
}

// ---------- skeleton ----------

function BudgetActualSkeleton() {
  return (
    <Card className="rounded-2xl border border-black/5 bg-white">
      <CardHeader className="pb-3">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-3 w-64 mt-1" />
      </CardHeader>
      <CardContent className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-1.5 w-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
