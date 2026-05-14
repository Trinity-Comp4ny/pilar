import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { User, DollarSign, Calendar, Ruler, TrendingUp, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { Projeto } from "@/types/projetos";
import { formatCurrency, formatDate } from "@/types/projetos";
import type { ProjetoRentabilidade } from "@/hooks/useRentabilidade";

interface ProjetoDetailInfoProps {
  projeto: Projeto;
  progress: number;
  margemBrutaPct: number | null;
  rentabilidade: ProjetoRentabilidade | null;
}

function margemColor(pct: number): string {
  if (pct >= 20) return "text-positive";
  if (pct >= 10) return "text-yellow-600";
  return "text-red-600";
}

export function ProjetoDetailInfo({ projeto, progress, margemBrutaPct, rentabilidade }: ProjetoDetailInfoProps) {
  return (
    <>
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <User className="h-3 w-3" />
              Cliente
            </div>
            <p className="text-sm font-medium truncate">{projeto.cliente_nome || "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <DollarSign className="h-3 w-3" />
              Contrato
            </div>
            <p className="text-sm font-medium">{formatCurrency(projeto.valor_contrato)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <Ruler className="h-3 w-3" />
              Área
            </div>
            <p className="text-sm font-medium">{projeto.area_m2 || 0} m²</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <Calendar className="h-3 w-3" />
              Prazo
            </div>
            <p className="text-sm font-medium">{formatDate(projeto.data_previsao)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground mb-1">Margem Bruta</div>
            <p
              className={`text-sm font-bold ${
                margemBrutaPct !== null
                  ? margemBrutaPct >= 20
                    ? "text-positive"
                    : margemBrutaPct >= 0
                      ? "text-yellow-600"
                      : "text-red-600"
                  : ""
              }`}
            >
              {margemBrutaPct !== null ? `${margemBrutaPct.toFixed(1)}%` : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">Progresso das disciplinas</span>
          <span className="text-xs font-medium">{progress}%</span>
        </div>
        <Progress value={progress} className="h-2" indicatorClassName="bg-brand" />
      </div>

      {/* Card Resultado do Projeto */}
      <Card className="mb-6">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Resultado do Projeto
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {rentabilidade === null ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-md" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Receitas */}
              <div>
                <p className="text-[10px] uppercase text-muted-foreground mb-1">Receitas</p>
                <p className="text-sm font-semibold text-positive">
                  {formatCurrency(rentabilidade.receitas_recebidas)}
                </p>
                {rentabilidade.receitas_total > rentabilidade.receitas_recebidas && (
                  <p className="text-[11px] text-muted-foreground">
                    + {formatCurrency(rentabilidade.receitas_total - rentabilidade.receitas_recebidas)} pendente
                  </p>
                )}
              </div>

              {/* Custo estimado */}
              <div>
                <p className="text-[10px] uppercase text-muted-foreground mb-1">Custo estimado</p>
                <p className="text-sm font-semibold">
                  {formatCurrency(rentabilidade.despesas_diretas)}
                </p>
              </div>

              {/* Margem bruta */}
              <div>
                <p className="text-[10px] uppercase text-muted-foreground mb-1">Margem atual</p>
                <p
                  className={cn(
                    "text-sm font-bold",
                    margemColor(rentabilidade.margem_bruta_pct)
                  )}
                >
                  {rentabilidade.margem_bruta_pct.toFixed(1)}%
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {formatCurrency(rentabilidade.margem_bruta)}
                </p>
              </div>

              {/* Link análise */}
              <div className="flex items-end">
                <Link
                  to={`/financeiro?tab=rentabilidade&projeto=${projeto.id}`}
                  className="inline-flex items-center gap-1 text-xs text-brand hover:underline font-medium"
                >
                  Ver análise completa
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
