import { useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useTimesheetsByWeek,
  useProjetosAtribuidos,
  useUpsertTimesheet,
  useHorasOrcadasPorProjeto,
} from "@/hooks/useTimesheets";

interface TimesheetGridProps {
  pessoaId: string;
  weekStart: string; // YYYY-MM-DD (segunda-feira)
  weekEnd: string; // YYYY-MM-DD (domingo)
  weekDays: string[]; // array de 7 datas YYYY-MM-DD
}

export function TimesheetGrid({ pessoaId, weekStart, weekEnd, weekDays }: TimesheetGridProps) {
  const { toast } = useToast();
  const { data: timesheets = [], isLoading: loadingTimesheets } = useTimesheetsByWeek(pessoaId, weekStart, weekEnd);
  const { data: projetos = [], isLoading: loadingProjetos } = useProjetosAtribuidos(pessoaId);
  const upsert = useUpsertTimesheet();

  const projetoIds = projetos.map((p) => p.id);
  const { data: horasOrcadasMap = new Map() } = useHorasOrcadasPorProjeto(projetoIds);

  const debounceTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const getHoras = useCallback(
    (projetoId: string, disciplina: string, data: string): number => {
      const entry = timesheets.find(
        (t) => t.projeto_id === projetoId && t.disciplina === disciplina && t.data === data
      );
      return entry?.horas || 0;
    },
    [timesheets]
  );

  const getStatus = useCallback(
    (projetoId: string, disciplina: string, data: string): string | undefined => {
      const entry = timesheets.find(
        (t) => t.projeto_id === projetoId && t.disciplina === disciplina && t.data === data
      );
      return entry?.status;
    },
    [timesheets]
  );

  const handleHorasChange = useCallback(
    (projetoId: string, disciplina: string, data: string, value: string) => {
      const horas = parseFloat(value) || 0;
      if (horas < 0 || horas > 24) return;

      const key = `${projetoId}-${disciplina}-${data}`;
      const existing = debounceTimers.current.get(key);
      if (existing) clearTimeout(existing);

      debounceTimers.current.set(
        key,
        setTimeout(() => {
          upsert.mutate(
            { pessoa_id: pessoaId, projeto_id: projetoId, disciplina, data, horas },
            {
              onError: (error: Error) => {
                toast({
                  variant: "destructive",
                  title: "Erro ao salvar",
                  description: error.message,
                });
              },
            }
          );
          debounceTimers.current.delete(key);
        }, 800)
      );
    },
    [pessoaId, upsert, toast]
  );

  const dayLabels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

  // Calcula totais por dia
  const totaisPorDia = weekDays.map((dia) =>
    timesheets.filter((t) => t.data === dia).reduce((sum, t) => sum + Number(t.horas), 0)
  );

  const totalSemana = totaisPorDia.reduce((a, b) => a + b, 0);

  // Monta as linhas: cada combinação projeto + disciplina
  const linhas: Array<{ projetoId: string; projetoNome: string; projetoCodigo: string; disciplina: string }> = [];
  for (const projeto of projetos) {
    for (const disciplina of projeto.disciplinas) {
      linhas.push({
        projetoId: projeto.id,
        projetoNome: projeto.nome,
        projetoCodigo: projeto.codigo_projeto,
        disciplina,
      });
    }
  }

  if (loadingTimesheets || loadingProjetos) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Carregando...</span>
      </div>
    );
  }

  if (linhas.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">Nenhum projeto atribuído a você no momento.</p>
        <p className="text-xs mt-1">Peça ao administrador para atribuir disciplinas em seus projetos.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 px-3 font-medium text-muted-foreground min-w-[200px]">
              Projeto / Disciplina
            </th>
            {weekDays.map((dia, i) => {
              const dayNum = new Date(dia + "T00:00:00").getDate();
              return (
                <th key={dia} className="text-center py-2 px-1 font-medium text-muted-foreground w-[80px]">
                  <div>{dayLabels[i]}</div>
                  <div className="text-xs">{dayNum}</div>
                </th>
              );
            })}
            <th className="text-center py-2 px-2 font-medium text-muted-foreground w-[60px]">Total</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha) => {
            const totalLinha = weekDays.reduce((sum, dia) => sum + getHoras(linha.projetoId, linha.disciplina, dia), 0);

            return (
              <tr key={`${linha.projetoId}-${linha.disciplina}`} className="border-b hover:bg-muted/50">
                <td className="py-2 px-3">
                  <div className="font-medium text-xs truncate">
                    {linha.projetoCodigo} - {linha.projetoNome}
                  </div>
                  <div className="text-xs text-muted-foreground">{linha.disciplina}</div>
                  <HorasProgress projetoId={linha.projetoId} disciplina={linha.disciplina} horasMap={horasOrcadasMap} />
                </td>
                {weekDays.map((dia) => {
                  const status = getStatus(linha.projetoId, linha.disciplina, dia);
                  const isApproved = status === "aprovado";
                  const isRejected = status === "rejeitado";
                  const currentHoras = getHoras(linha.projetoId, linha.disciplina, dia);

                  return (
                    <td key={dia} className="py-1 px-1 text-center">
                      <Input
                        type="number"
                        min={0}
                        max={24}
                        step={0.5}
                        defaultValue={currentHoras || ""}
                        placeholder="—"
                        disabled={isApproved}
                        className={`h-8 w-[70px] text-center text-sm mx-auto ${
                          isApproved
                            ? "bg-green-50 border-green-200 text-green-700"
                            : isRejected
                              ? "bg-red-50 border-red-200 text-red-700"
                              : ""
                        }`}
                        onChange={(e) => handleHorasChange(linha.projetoId, linha.disciplina, dia, e.target.value)}
                      />
                    </td>
                  );
                })}
                <td className="py-2 px-2 text-center">
                  <Badge variant={totalLinha > 0 ? "default" : "secondary"} className="text-xs">
                    {totalLinha.toFixed(1)}h
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 font-medium">
            <td className="py-2 px-3 text-sm">Total do dia</td>
            {totaisPorDia.map((total, i) => (
              <td key={i} className="py-2 px-1 text-center text-sm">
                <span className={total > 8 ? "text-orange-600 font-semibold" : ""}>
                  {total > 0 ? `${total.toFixed(1)}h` : "—"}
                </span>
              </td>
            ))}
            <td className="py-2 px-2 text-center">
              <Badge variant={totalSemana > 0 ? "default" : "secondary"} className="text-xs font-semibold">
                {totalSemana.toFixed(1)}h
              </Badge>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function HorasProgress({
  projetoId,
  disciplina,
  horasMap,
}: {
  projetoId: string;
  disciplina: string;
  horasMap: Map<string, { orcadas: number; consumidas: number }>;
}) {
  const key = `${projetoId}::${disciplina}`;
  const data = horasMap.get(key);

  if (!data || data.orcadas <= 0) return null;

  const pct = Math.min((data.consumidas / data.orcadas) * 100, 100);
  const overflow = data.consumidas > data.orcadas;
  const color = overflow ? "bg-red-500" : pct >= 90 ? "bg-red-400" : pct >= 70 ? "bg-amber-400" : "bg-emerald-400";

  return (
    <div className="flex items-center gap-1.5 mt-1">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-[120px]">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-[10px] font-medium ${overflow ? "text-red-600" : "text-muted-foreground"}`}>
        {data.consumidas.toFixed(0)}/{data.orcadas.toFixed(0)}h
      </span>
    </div>
  );
}
