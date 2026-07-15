import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface TimelineDisciplina {
  disciplina: string;
  status?: string;
  data_inicio?: string;
  data_previsao?: string;
  data_final?: string;
  responsavel_nome?: string;
}

export function TimelineContent({ disciplinas }: { disciplinas: TimelineDisciplina[] }) {
  const total = disciplinas.length;
  const concluidas = disciplinas.filter((d) => d.status === "Concluído").length;
  const progress = total > 0 ? Math.round((concluidas / total) * 100) : 0;

  const formatDate = (d: string | undefined) => (d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—");

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-6">
          <h3 className="text-sm font-semibold mb-3">Progresso Geral</h3>
          <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
            <div className="bg-brand h-3 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">
            {progress}% concluído — {concluidas} de {total} etapas
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <h3 className="text-sm font-semibold mb-4">Etapas do Projeto</h3>
          {disciplinas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma etapa cadastrada.</p>
          ) : (
            <div className="relative">
              {disciplinas.map((d, i) => {
                const statusNorm = (d.status ?? "").toLowerCase();
                const isConcluido = statusNorm === "concluído";
                const isAndamento = statusNorm === "em andamento";
                return (
                  <div key={d.disciplina ?? i} className="flex gap-4 mb-4 last:mb-0">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-3 h-3 rounded-full ${isConcluido ? "bg-positive" : isAndamento ? "bg-blue-500" : "bg-gray-300"}`}
                      />
                      {i < disciplinas.length - 1 && <div className="w-0.5 flex-1 bg-gray-200 mt-1" />}
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{d.disciplina}</p>
                        <Badge variant={isConcluido ? "default" : "secondary"} className="text-[10px]">
                          {d.status || "Não iniciado"}
                        </Badge>
                      </div>
                      <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                        {d.data_inicio && <span>Início: {formatDate(d.data_inicio)}</span>}
                        {d.data_previsao && <span>Previsão: {formatDate(d.data_previsao)}</span>}
                        {d.data_final && <span>Concluído: {formatDate(d.data_final)}</span>}
                      </div>
                      {d.responsavel_nome && (
                        <p className="text-xs text-muted-foreground mt-0.5">Responsável: {d.responsavel_nome}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
