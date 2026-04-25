import { useCallback, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Copy, Loader2, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTimesheetsByWeek, useProjetosAtribuidos, useUpsertTimesheet } from "@/hooks/useTimesheets";

interface Props {
  pessoaId: string;
  weekStart: string;
  weekEnd: string;
  weekDays: string[];
}

const DAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export function TimesheetGridMobile({ pessoaId, weekStart, weekEnd, weekDays }: Props) {
  const { data: timesheets = [], isLoading: loadingTs } = useTimesheetsByWeek(pessoaId, weekStart, weekEnd);
  const { data: projetos = [], isLoading: loadingProjs } = useProjetosAtribuidos(pessoaId);
  const upsert = useUpsertTimesheet();

  const defaultIdx = useMemo(() => {
    const todayIso = new Date().toISOString().split("T")[0];
    const idx = weekDays.indexOf(todayIso);
    return idx >= 0 ? idx : 0;
  }, [weekDays]);

  const [activeIdx, setActiveIdx] = useState<number>(defaultIdx);
  const activeDay = weekDays[activeIdx];

  const horasPorDia = useMemo(() => {
    return weekDays.map((dia) => timesheets.filter((t) => t.data === dia).reduce((sum, t) => sum + Number(t.horas), 0));
  }, [timesheets, weekDays]);

  const totalSemana = horasPorDia.reduce((a, b) => a + b, 0);
  const totalDia = horasPorDia[activeIdx] ?? 0;

  const linhas = useMemo(() => {
    const out: Array<{ projetoId: string; projetoNome: string; projetoCodigo: string; disciplina: string }> = [];
    for (const p of projetos) {
      for (const disciplina of p.disciplinas) {
        out.push({ projetoId: p.id, projetoNome: p.nome, projetoCodigo: p.codigo_projeto, disciplina });
      }
    }
    return out;
  }, [projetos]);

  const entryFor = useCallback(
    (projetoId: string, disciplina: string, data: string) =>
      timesheets.find((t) => t.projeto_id === projetoId && t.disciplina === disciplina && t.data === data),
    [timesheets]
  );

  const upsertHoras = useCallback(
    (projetoId: string, disciplina: string, data: string, horas: number) => {
      if (horas < 0 || horas > 24) return;
      upsert.mutate(
        { pessoa_id: pessoaId, projeto_id: projetoId, disciplina, data, horas },
        {
          onError: () => toast.error("Erro ao salvar"),
        }
      );
    },
    [pessoaId, upsert]
  );

  const handleCopyPrevious = async () => {
    if (activeIdx === 0) {
      toast.info("Não há dia anterior nesta semana");
      return;
    }
    const prevDay = weekDays[activeIdx - 1];
    const prevEntries = timesheets.filter((t) => t.data === prevDay && Number(t.horas) > 0);
    if (prevEntries.length === 0) {
      toast.info("Dia anterior está vazio");
      return;
    }

    let copied = 0;
    for (const entry of prevEntries) {
      const existing = entryFor(entry.projeto_id, entry.disciplina, activeDay);
      if (existing?.status === "aprovado") continue;
      upsert.mutate(
        {
          pessoa_id: pessoaId,
          projeto_id: entry.projeto_id,
          disciplina: entry.disciplina,
          data: activeDay,
          horas: Number(entry.horas),
        },
        {
          onError: () => toast.error("Erro ao copiar"),
        }
      );
      copied++;
    }
    toast.success(`${copied} lançamento${copied === 1 ? "" : "s"} copiado${copied === 1 ? "" : "s"}`);
  };

  if (loadingTs || loadingProjs) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (linhas.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">Nenhum projeto atribuído.</p>
        <p className="text-xs mt-1">Peça ao administrador para atribuir disciplinas.</p>
      </div>
    );
  }

  const activeDate = new Date(activeDay + "T00:00:00");
  const activeDateLabel = activeDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

  return (
    <div className="space-y-4">
      {/* Totais semana */}
      <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
        <span>Semana</span>
        <Badge className="bg-accent-orange/10 text-accent-orange border-accent-orange/20 border">
          {totalSemana.toFixed(1)}h
        </Badge>
      </div>

      {/* Day selector — scroll horizontal */}
      <div className="-mx-4 px-4 overflow-x-auto">
        <div className="flex gap-1.5 min-w-max">
          {weekDays.map((dia, i) => {
            const isActive = i === activeIdx;
            const horas = horasPorDia[i];
            const d = new Date(dia + "T00:00:00");
            const isToday = dia === new Date().toISOString().split("T")[0];
            return (
              <button
                key={dia}
                onClick={() => setActiveIdx(i)}
                className={cn(
                  "flex flex-col items-center justify-center rounded-lg px-3 py-2 min-w-[64px] transition-colors border",
                  isActive
                    ? "bg-accent-orange text-ink border-accent-orange shadow-sm"
                    : "bg-white text-black/70 border-black/10 hover:border-accent-orange/40",
                  !isActive && isToday && "border-accent-orange/50"
                )}
              >
                <span className="text-[10px] uppercase tracking-wide opacity-80">{DAY_LABELS[i]}</span>
                <span className="text-base font-semibold">{d.getDate()}</span>
                <span className={cn("text-[10px] mt-0.5", isActive ? "text-white/90" : "text-black/50")}>
                  {horas > 0 ? `${horas.toFixed(1)}h` : "—"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Header do dia + Copiar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => setActiveIdx(Math.max(0, activeIdx - 1))}
            disabled={activeIdx === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="text-sm font-semibold">
              {DAY_LABELS[activeIdx]}, {activeDateLabel}
            </div>
            <div className="text-xs text-muted-foreground">Total do dia: {totalDia.toFixed(1)}h</div>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => setActiveIdx(Math.min(weekDays.length - 1, activeIdx + 1))}
            disabled={activeIdx === weekDays.length - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={handleCopyPrevious} disabled={activeIdx === 0}>
          <Copy className="h-3.5 w-3.5 mr-1.5" />
          Copiar anterior
        </Button>
      </div>

      {/* Cards de projeto × disciplina */}
      <div className="space-y-2">
        {linhas.map((linha) => (
          <LinhaCard
            key={`${linha.projetoId}-${linha.disciplina}`}
            projetoNome={linha.projetoNome}
            projetoCodigo={linha.projetoCodigo}
            disciplina={linha.disciplina}
            entry={entryFor(linha.projetoId, linha.disciplina, activeDay)}
            onChange={(h) => upsertHoras(linha.projetoId, linha.disciplina, activeDay, h)}
          />
        ))}
      </div>
    </div>
  );
}

function LinhaCard({
  projetoNome,
  projetoCodigo,
  disciplina,
  entry,
  onChange,
}: {
  projetoNome: string;
  projetoCodigo: string;
  disciplina: string;
  entry: { horas: number; status: string } | undefined;
  onChange: (horas: number) => void;
}) {
  const horas = entry ? Number(entry.horas) : 0;
  const isApproved = entry?.status === "aprovado";
  const isRejected = entry?.status === "rejeitado";
  const [local, setLocal] = useState<string | null>(null);

  const display = local !== null ? local : horas > 0 ? String(horas) : "";

  const commit = (value: string) => {
    const n = parseFloat(value);
    if (Number.isNaN(n)) {
      if (value === "" && horas > 0) onChange(0);
      setLocal(null);
      return;
    }
    if (n < 0 || n > 24) {
      setLocal(null);
      return;
    }
    if (n !== horas) onChange(n);
    setLocal(null);
  };

  const bump = (delta: number) => {
    if (isApproved) return;
    const next = Math.max(0, Math.min(24, horas + delta));
    onChange(next);
  };

  return (
    <Card
      className={cn(isApproved && "bg-emerald-50/50 border-emerald-200", isRejected && "bg-red-50/50 border-red-200")}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-xs text-muted-foreground truncate">{projetoCodigo}</div>
            <div className="text-sm font-medium truncate">{projetoNome}</div>
            <div className="text-xs text-black/60 truncate">{disciplina}</div>
          </div>
          {isApproved && (
            <Badge className="bg-emerald-100 text-emerald-800 border-transparent text-[10px]">Aprovado</Badge>
          )}
          {isRejected && <Badge className="bg-red-100 text-red-800 border-transparent text-[10px]">Rejeitado</Badge>}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-full flex-shrink-0"
            onClick={() => bump(-0.5)}
            disabled={isApproved || horas === 0}
          >
            <Minus className="h-4 w-4" />
          </Button>

          <div className="flex-1 relative">
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              max={24}
              step={0.5}
              value={display}
              placeholder="0"
              disabled={isApproved}
              className="h-12 text-center text-lg font-semibold pr-10"
              onChange={(e) => setLocal(e.target.value)}
              onBlur={(e) => commit(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
              h
            </span>
          </div>

          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-full flex-shrink-0"
            onClick={() => bump(0.5)}
            disabled={isApproved}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
