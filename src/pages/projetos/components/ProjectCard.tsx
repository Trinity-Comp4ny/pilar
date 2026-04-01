import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Calendar, DollarSign, HardHat, Ruler } from "lucide-react";
import { type Projeto, formatCurrency, formatDateShort, getDeadlineStatus, getProjectProgress } from "@/pages/projetos/types";

interface ProjectCardProps {
  projeto: Projeto;
  onClick: (projeto: Projeto) => void;
  isDragging?: boolean;
}

export function ProjectCard({ projeto, onClick, isDragging = false }: ProjectCardProps) {
  return (
    <Card
      onClick={() => onClick(projeto)}
      className={`cursor-pointer hover:shadow-md transition-shadow w-full ${isDragging ? "shadow-lg rotate-2" : ""}`}
    >
      <CardHeader className="p-2.5 pb-1.5">
        {(() => {
          const deadlineStatus = getDeadlineStatus(projeto);
          return deadlineStatus ? (
            <div className="mb-1 flex items-center justify-between">
              <Badge className={`text-[9px] px-1.5 py-0 ${deadlineStatus.color}`}>
                {deadlineStatus.label}
                {deadlineStatus.days > 0 && ` (${deadlineStatus.days}d)`}
              </Badge>
            </div>
          ) : null;
        })()}
        <div className="flex items-start justify-between gap-1.5 mb-1">
          <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">
            {projeto.codigo_projeto}
          </Badge>
        </div>
        <CardTitle className="text-xs font-medium line-clamp-2 leading-tight">
          {projeto.nome}
        </CardTitle>
        <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{projeto.cliente_nome}</p>
      </CardHeader>
      <CardContent className="p-2.5 pt-0 space-y-1.5">
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-gray-500">
            <span>Progresso</span>
            <span>{getProjectProgress(projeto.disciplinas)}%</span>
          </div>
          <Progress value={getProjectProgress(projeto.disciplinas)} className="h-1.5" />
        </div>

        {projeto.disciplinas && projeto.disciplinas.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {projeto.disciplinas.slice(0, 2).map((disc, i) => (
              <span key={i} className={`text-[9px] px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                disc.status === 'Concluído' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'
              }`}>
                <HardHat size={8} /> {disc.disciplina}
              </span>
            ))}
            {projeto.disciplinas.length > 2 && (
              <span className="text-[9px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                +{projeto.disciplinas.length - 2}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between text-[10px] pt-1.5 border-t">
          <div className="flex items-center gap-0.5 font-medium text-green-600">
            <DollarSign size={10} className="flex-shrink-0" />
            <span className="truncate">{formatCurrency(projeto.valor_contrato)}</span>
          </div>
          <div className="flex flex-col items-end gap-0.5 text-[10px] text-gray-500">
            {projeto.area_m2 !== undefined && (
              <div className="flex items-center gap-0.5">
                <Ruler size={10} />
                <span>{projeto.area_m2 || 0} m²</span>
              </div>
            )}
            {projeto.data_previsao && (
              <div className="flex items-center gap-0.5">
                <Calendar size={10} />
                <span>{formatDateShort(projeto.data_previsao)}</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
