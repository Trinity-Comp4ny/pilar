import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Layers, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { type Projeto, type DisciplinaResponsavel, getResponsaveisList } from "@/types/projetos";

interface CalendarioPrazosTabProps {
  projetos: Projeto[];
  cursor: Date;
  filtroProjeto: string;
  filtroResponsavel: string;
}

type EventoTipo = "projeto" | "disciplina";

interface PrazoEvento {
  data: string; // YYYY-MM-DD
  tipo: EventoTipo;
  projetoId: string;
  projetoNome: string;
  projetoCodigo: string;
  disciplinaNome?: string;
  responsavel?: string;
  status: string;
  atrasado: boolean;
  proximo: boolean;
  concluido: boolean;
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function fmtKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayKey(): string {
  return fmtKey(new Date());
}

export function CalendarioPrazosTab({ projetos, cursor, filtroProjeto, filtroResponsavel }: CalendarioPrazosTabProps) {
  const navigate = useNavigate();

  const eventos = useMemo<PrazoEvento[]>(() => {
    const today = todayKey();
    const in7Date = new Date();
    in7Date.setDate(in7Date.getDate() + 7);
    const in7 = fmtKey(in7Date);

    const list: PrazoEvento[] = [];

    for (const p of projetos) {
      if (p.data_previsao) {
        list.push({
          data: p.data_previsao,
          tipo: "projeto",
          projetoId: p.id,
          projetoNome: p.nome,
          projetoCodigo: p.codigo_projeto,
          status: p.status,
          atrasado: p.data_previsao < today && p.status !== "Concluído" && p.status !== "Cancelado",
          proximo: p.data_previsao >= today && p.data_previsao <= in7 && p.status !== "Concluído",
          concluido: p.status === "Concluído",
        });
      }

      for (const d of p.disciplinas as DisciplinaResponsavel[]) {
        if (!d.data_previsao) continue;
        const resps = getResponsaveisList(d);
        const respNome = resps.length > 0 ? resps.map((r) => r.responsavel_nome).join(", ") : undefined;
        const concluido = d.status === "Concluído";
        list.push({
          data: d.data_previsao,
          tipo: "disciplina",
          projetoId: p.id,
          projetoNome: p.nome,
          projetoCodigo: p.codigo_projeto,
          disciplinaNome: d.disciplina,
          responsavel: respNome,
          status: d.status || "Não Iniciado",
          atrasado: d.data_previsao < today && !concluido,
          proximo: d.data_previsao >= today && d.data_previsao <= in7 && !concluido,
          concluido,
        });
      }
    }

    return list.filter((e) => {
      if (filtroProjeto !== "todos" && e.projetoId !== filtroProjeto) return false;
      if (filtroResponsavel !== "todos") {
        if (!e.responsavel) return false;
        if (!e.responsavel.toLowerCase().includes(filtroResponsavel.toLowerCase())) return false;
      }
      return true;
    });
  }, [projetos, filtroProjeto, filtroResponsavel]);

  const eventosPorDia = useMemo(() => {
    const map = new Map<string, PrazoEvento[]>();
    for (const e of eventos) {
      const arr = map.get(e.data) || [];
      arr.push(e);
      map.set(e.data, arr);
    }
    return map;
  }, [eventos]);

  const dias = useMemo(() => {
    const start = startOfMonth(cursor);
    const end = endOfMonth(cursor);
    const startWeekday = start.getDay();
    const totalDays = end.getDate();

    const grid: (Date | null)[] = [];
    for (let i = 0; i < startWeekday; i++) grid.push(null);
    for (let d = 1; d <= totalDays; d++) grid.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    while (grid.length % 7 !== 0) grid.push(null);
    return grid;
  }, [cursor]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-500" /> Em atraso
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-500" /> Próximos 7 dias
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-blue-500" /> Futuro
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-positive/100" /> Concluído
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-[10px]">●</span> Projeto
          <span className="text-[10px] ml-2">○</span> Disciplina
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="grid grid-cols-7 border-b bg-muted/30">
            {WEEKDAYS.map((wd) => (
              <div key={wd} className="text-[11px] font-medium text-muted-foreground p-2 text-center">
                {wd}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {dias.map((d, idx) => {
              if (!d) return <div key={idx} className="min-h-[100px] border-r border-b bg-muted/10" />;
              const key = fmtKey(d);
              const eventosDoDia = eventosPorDia.get(key) || [];
              const isToday = key === todayKey();
              const isFimDeSemana = d.getDay() === 0 || d.getDay() === 6;

              return (
                <Popover key={idx}>
                  <PopoverTrigger asChild disabled={eventosDoDia.length === 0}>
                    <button
                      type="button"
                      className={cn(
                        "min-h-[100px] border-r border-b p-1.5 text-left transition-colors",
                        isFimDeSemana && "bg-muted/20",
                        isToday && "bg-brand/5",
                        eventosDoDia.length > 0 && "hover:bg-muted/40 cursor-pointer"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={cn(
                            "text-xs",
                            isToday
                              ? "bg-brand text-white rounded-full w-5 h-5 flex items-center justify-center font-semibold"
                              : "text-muted-foreground"
                          )}
                        >
                          {d.getDate()}
                        </span>
                      </div>
                      <div className="space-y-0.5">
                        {eventosDoDia.slice(0, 3).map((e, i) => (
                          <div
                            key={i}
                            className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded truncate",
                              e.atrasado && "bg-red-100 text-red-700",
                              !e.atrasado && e.proximo && "bg-amber-100 text-amber-700",
                              !e.atrasado && !e.proximo && e.concluido && "bg-positive/10 text-positive",
                              !e.atrasado && !e.proximo && !e.concluido && "bg-blue-100 text-blue-700"
                            )}
                          >
                            {e.tipo === "projeto" ? "● " : "○ "}
                            {e.disciplinaNome || e.projetoNome}
                          </div>
                        ))}
                        {eventosDoDia.length > 3 && (
                          <div className="text-[10px] text-muted-foreground px-1.5">+{eventosDoDia.length - 3}</div>
                        )}
                      </div>
                    </button>
                  </PopoverTrigger>
                  {eventosDoDia.length > 0 && (
                    <PopoverContent align="start" className="w-80 p-3">
                      <div className="text-xs font-medium mb-2">
                        {d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
                      </div>
                      <div className="space-y-2">
                        {eventosDoDia.map((e, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => navigate(`/projetos/${e.projetoId}`)}
                            className="w-full text-left p-2 rounded hover:bg-muted/50 border"
                          >
                            <div className="flex items-start gap-2">
                              {e.tipo === "projeto" ? (
                                <Building2 className="h-3.5 w-3.5 mt-0.5 text-blue-600 flex-shrink-0" />
                              ) : (
                                <Layers className="h-3.5 w-3.5 mt-0.5 text-purple-600 flex-shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-medium truncate">
                                    {e.disciplinaNome || e.projetoNome}
                                  </span>
                                  {e.atrasado && (
                                    <Badge variant="destructive" className="text-[9px] px-1 py-0">
                                      atraso
                                    </Badge>
                                  )}
                                  {e.proximo && !e.atrasado && (
                                    <Badge className="text-[9px] px-1 py-0 bg-amber-500 hover:bg-amber-500 text-white">
                                      próximo
                                    </Badge>
                                  )}
                                  {e.concluido && (
                                    <Badge className="text-[9px] px-1 py-0 bg-positive hover:bg-positive text-white">
                                      OK
                                    </Badge>
                                  )}
                                </div>
                                {e.tipo === "disciplina" && (
                                  <div className="text-[10px] text-muted-foreground truncate">
                                    {e.projetoCodigo} — {e.projetoNome}
                                  </div>
                                )}
                                {e.responsavel && (
                                  <div className="text-[10px] text-muted-foreground truncate">{e.responsavel}</div>
                                )}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  )}
                </Popover>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
