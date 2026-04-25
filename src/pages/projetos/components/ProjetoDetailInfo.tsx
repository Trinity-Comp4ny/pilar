import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { User, DollarSign, Calendar, Ruler } from "lucide-react";
import type { Projeto } from "@/types/projetos";
import { formatCurrency, formatDate } from "@/types/projetos";

interface ProjetoDetailInfoProps {
  projeto: Projeto;
  progress: number;
  margemBrutaPct: number | null;
}

export function ProjetoDetailInfo({ projeto, progress, margemBrutaPct }: ProjetoDetailInfoProps) {
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
                    ? "text-green-600"
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
        <Progress value={progress} className="h-2" />
      </div>
    </>
  );
}
