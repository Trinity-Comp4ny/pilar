import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, AlertTriangle, Users, TrendingUp, Gauge } from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { usePageTitle } from "@/hooks/usePageTitle";
import {
  addDays,
  buildCelulas,
  formatDateISO,
  getMonday,
  sumBreakdown,
  usePlanejamentoData,
  utilizacaoClass,
  type CelulaBreakdown,
  type PessoaPlanejamento,
} from "@/hooks/usePlanejamento";

type Mode = "planejado" | "realizado";
const NUM_WEEKS = 8;

export default function Planejamento() {
  usePageTitle("Planejamento");
  const [startMonday, setStartMonday] = useState(() => getMonday(new Date()));
  const [mode, setMode] = useState<Mode>("planejado");
  const [pessoaFiltro, setPessoaFiltro] = useState<string>("todas");
  const [projetoFiltro, setProjetoFiltro] = useState<string>("todos");

  const weeks = useMemo(
    () => Array.from({ length: NUM_WEEKS }, (_, i) => formatDateISO(addDays(startMonday, i * 7))),
    [startMonday]
  );
  const weekStart = weeks[0];
  const weekEnd = weeks[weeks.length - 1];
  const weekEndSunday = formatDateISO(addDays(new Date(weekEnd + "T00:00:00"), 6));

  const { pessoas, alocacoes, timesheets, projetos, isLoading } = usePlanejamentoData(weekStart, weekEndSunday);

  const alocacoesFiltradas = useMemo(
    () => (projetoFiltro === "todos" ? alocacoes : alocacoes.filter((a) => a.projeto_id === projetoFiltro)),
    [alocacoes, projetoFiltro]
  );
  const timesheetsFiltrados = useMemo(
    () => (projetoFiltro === "todos" ? timesheets : timesheets.filter((t) => t.projeto_id === projetoFiltro)),
    [timesheets, projetoFiltro]
  );

  const celulas = useMemo(
    () => buildCelulas(alocacoesFiltradas, timesheetsFiltrados, projetos),
    [alocacoesFiltradas, timesheetsFiltrados, projetos]
  );

  const pessoasVisiveis = useMemo(
    () => (pessoaFiltro === "todas" ? pessoas : pessoas.filter((p) => p.id === pessoaFiltro)),
    [pessoas, pessoaFiltro]
  );

  const hojeIso = formatDateISO(getMonday(new Date()));

  const stats = useMemo(
    () => computeStats(pessoasVisiveis, weeks, celulas, mode, hojeIso),
    [pessoasVisiveis, weeks, celulas, mode, hojeIso]
  );

  const navegar = (dir: number) => setStartMonday((prev) => addDays(prev, dir * 7 * 4));

  return (
    <TooltipProvider>
      <PageLayout
        header={
          <PageHeader title="Planejamento" description="Capacidade, alocação e horas realizadas em uma única visão">
            <ModoToggle mode={mode} onChange={setMode} />
          </PageHeader>
        }
        containerClassName="max-w-none"
      >
        <div className="space-y-4">
          <FiltrosBar
            pessoas={pessoas}
            projetos={projetos}
            pessoaFiltro={pessoaFiltro}
            projetoFiltro={projetoFiltro}
            onPessoaChange={setPessoaFiltro}
            onProjetoChange={setProjetoFiltro}
            weeks={weeks}
            onNavigate={navegar}
            onToday={() => setStartMonday(getMonday(new Date()))}
          />

          <div className="grid grid-cols-4 gap-4">
            <StatCard icon={Users} label="Equipe visível" value={pessoasVisiveis.length} />
            <StatCard
              icon={AlertTriangle}
              label="Estourados (semana atual)"
              value={stats.estourados.length}
              tone={stats.estourados.length > 0 ? "danger" : undefined}
            />
            <StatCard icon={Gauge} label="Ociosos (semana atual)" value={stats.ociosos.length} tone="muted" />
            <StatCard
              icon={TrendingUp}
              label={`${mode === "planejado" ? "Planejado" : "Realizado"} total (período)`}
              value={`${stats.totalPeriodo}h`}
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : pessoasVisiveis.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground text-sm">Nenhuma pessoa encontrada.</div>
            ) : (
              <GridPlanejamento pessoas={pessoasVisiveis} weeks={weeks} celulas={celulas} mode={mode} />
            )}

            <PainelAlertas stats={stats} mode={mode} />
          </div>

          <Legenda />
        </div>
      </PageLayout>
    </TooltipProvider>
  );
}

function ModoToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="inline-flex rounded-full border border-black/10 bg-white p-0.5 text-xs">
      {(["planejado", "realizado"] as const).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={`px-3 py-1.5 rounded-full transition-colors ${
            mode === m ? "bg-accent-orange text-ink" : "text-black/60 hover:text-black"
          }`}
        >
          {m === "planejado" ? "Planejado" : "Realizado"}
        </button>
      ))}
    </div>
  );
}

function FiltrosBar({
  pessoas,
  projetos,
  pessoaFiltro,
  projetoFiltro,
  onPessoaChange,
  onProjetoChange,
  weeks,
  onNavigate,
  onToday,
}: {
  pessoas: PessoaPlanejamento[];
  projetos: { id: string; nome: string; codigo_projeto: string | null }[];
  pessoaFiltro: string;
  projetoFiltro: string;
  onPessoaChange: (v: string) => void;
  onProjetoChange: (v: string) => void;
  weeks: string[];
  onNavigate: (dir: number) => void;
  onToday: () => void;
}) {
  const rangeLabel = `${new Date(weeks[0] + "T00:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  })} — ${new Date(weeks[weeks.length - 1] + "T00:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  })}`;

  return (
    <div className="flex flex-wrap items-center gap-3 bg-white rounded-lg border border-black/5 px-4 py-3">
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onNavigate(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium px-2 min-w-[160px] text-center">{rangeLabel}</span>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onNavigate(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" className="text-xs ml-1" onClick={onToday}>
          Hoje
        </Button>
      </div>

      <div className="h-5 w-px bg-black/10" />

      <Select value={pessoaFiltro} onValueChange={onPessoaChange}>
        <SelectTrigger className="h-8 text-xs rounded-full w-[180px]">
          <SelectValue placeholder="Todas as pessoas" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todas">Todas as pessoas</SelectItem>
          {pessoas.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={projetoFiltro} onValueChange={onProjetoChange}>
        <SelectTrigger className="h-8 text-xs rounded-full w-[220px]">
          <SelectValue placeholder="Todos os projetos" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos os projetos</SelectItem>
          {projetos.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.codigo_projeto ? `[${p.codigo_projeto}] ` : ""}
              {p.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Users;
  label: string;
  value: number | string;
  tone?: "danger" | "muted";
}) {
  const toneClass = tone === "danger" ? "text-red-600" : tone === "muted" ? "text-black/50" : "text-black";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon size={13} />
          {label}
        </div>
        <p className={`text-xl font-medium tracking-tight mt-1 ${toneClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function GridPlanejamento({
  pessoas,
  weeks,
  celulas,
  mode,
}: {
  pessoas: PessoaPlanejamento[];
  weeks: string[];
  celulas: Map<string, CelulaBreakdown[]>;
  mode: Mode;
}) {
  return (
    <Card>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b bg-gray-50/50">
              <th className="text-left py-2 px-3 font-medium text-muted-foreground min-w-[180px] sticky left-0 bg-gray-50/50 z-10">
                Pessoa
              </th>
              {weeks.map((w) => {
                const d = new Date(w + "T00:00:00");
                return (
                  <th key={w} className="text-center py-2 px-1 font-medium text-muted-foreground w-[88px]">
                    {d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                  </th>
                );
              })}
              <th className="text-center py-2 px-2 font-medium text-muted-foreground w-[72px]">Total</th>
              <th className="text-center py-2 px-2 font-medium text-muted-foreground w-[64px]">%</th>
            </tr>
          </thead>
          <tbody>
            {pessoas.map((pessoa) => {
              const totais = weeks.map((w) => {
                const rows = celulas.get(`${pessoa.id}::${w}`) || [];
                return sumBreakdown(rows, mode);
              });
              const totalPessoa = totais.reduce((a, b) => a + b, 0);
              const capacidadeTotal = pessoa.horas_semanais * weeks.length;
              const pctTotal = capacidadeTotal > 0 ? Math.round((totalPessoa / capacidadeTotal) * 100) : 0;

              return (
                <tr key={pessoa.id} className="border-b hover:bg-black/[0.015]">
                  <td className="py-2 px-3 sticky left-0 bg-white z-10">
                    <div className="font-medium text-black tracking-tight">{pessoa.nome}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {pessoa.cargo || "—"} · {pessoa.horas_semanais}h/sem
                    </div>
                  </td>
                  {weeks.map((w, i) => {
                    const rows = celulas.get(`${pessoa.id}::${w}`) || [];
                    const horas = totais[i];
                    const pct = pessoa.horas_semanais > 0 ? (horas / pessoa.horas_semanais) * 100 : 0;

                    return (
                      <td key={w} className="py-1 px-1 text-center">
                        <CelulaTooltip rows={rows} mode={mode} horas={horas} pct={pct}>
                          <div className={`rounded-md px-1.5 py-1.5 ${utilizacaoClass(pct)} cursor-default`}>
                            {horas > 0 ? `${stripZeros(horas)}h` : "—"}
                          </div>
                        </CelulaTooltip>
                      </td>
                    );
                  })}
                  <td className="text-center py-1 px-2 text-[11px] font-medium">
                    {totalPessoa > 0 ? `${stripZeros(totalPessoa)}h` : "—"}
                  </td>
                  <td className="text-center py-1 px-2 text-[11px] text-black/60">
                    {totalPessoa > 0 ? `${pctTotal}%` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function CelulaTooltip({
  rows,
  mode,
  horas,
  pct,
  children,
}: {
  rows: CelulaBreakdown[];
  mode: Mode;
  horas: number;
  pct: number;
  children: React.ReactNode;
}) {
  if (horas === 0 || rows.length === 0) return <>{children}</>;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div>{children}</div>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs p-3 space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-white/70 border-b border-white/10 pb-1">
          <span>{mode === "planejado" ? "Planejado" : "Realizado"}</span>
          <span>{pct.toFixed(0)}% da capacidade</span>
        </div>
        {rows.map((r, i) => {
          const valor = mode === "planejado" ? r.planejado : r.realizado;
          if (valor === 0) return null;
          return (
            <div
              key={`${r.projeto_id}-${r.disciplina}-${i}`}
              className="flex items-start justify-between gap-3 text-[11px]"
            >
              <div className="min-w-0">
                <div className="truncate">
                  {r.projeto_codigo ? <span className="text-white/50">[{r.projeto_codigo}] </span> : null}
                  {r.projeto_nome}
                </div>
                <div className="text-white/60 truncate">{r.disciplina}</div>
              </div>
              <div className="flex-shrink-0 font-medium">{stripZeros(valor)}h</div>
            </div>
          );
        })}
      </TooltipContent>
    </Tooltip>
  );
}

function PainelAlertas({ stats, mode }: { stats: Stats; mode: Mode }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-red-700 mb-2">
              <AlertTriangle size={13} /> Estourados na semana atual
            </div>
            {stats.estourados.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">Ninguém acima de 100%.</p>
            ) : (
              <ul className="space-y-1.5">
                {stats.estourados.map((e) => (
                  <li key={e.pessoa_id} className="flex items-center justify-between text-[11px]">
                    <span className="truncate">{e.nome}</span>
                    <Badge className="bg-red-100 text-red-700 border-transparent hover:bg-red-100">{e.pct}%</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-black/60 mb-2">
              <Gauge size={13} /> Ociosos na semana atual
            </div>
            {stats.ociosos.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">Time todo alocado.</p>
            ) : (
              <ul className="space-y-1.5">
                {stats.ociosos.map((p) => (
                  <li key={p.id} className="flex items-center justify-between text-[11px]">
                    <span className="truncate">{p.nome}</span>
                    <Badge variant="secondary" className="font-normal">
                      0h
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-black/60 mb-2">
            <TrendingUp size={13} /> Top 5 disciplinas por demanda
          </div>
          {stats.disciplinasTop.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              Sem dados de {mode === "planejado" ? "alocação" : "horas realizadas"} no período.
            </p>
          ) : (
            <ul className="space-y-2">
              {stats.disciplinasTop.map((d) => (
                <li key={d.disciplina}>
                  <div className="flex items-center justify-between text-[11px] mb-0.5">
                    <span className="truncate">{d.disciplina}</span>
                    <span className="text-black/50">{stripZeros(d.horas)}h</span>
                  </div>
                  <div className="h-1.5 bg-black/5 rounded-full overflow-hidden">
                    <div className="h-full bg-accent-orange/70" style={{ width: `${d.pct}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Legenda() {
  return (
    <div className="flex items-center gap-4 text-[11px] text-muted-foreground flex-wrap px-1">
      <div className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded bg-gray-50 border border-gray-100" /> 0%
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded bg-emerald-50 border border-emerald-100" /> ≤60%
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-200" /> 61–90%
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded bg-amber-100 border border-amber-200" /> 91–100%
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded bg-red-100 border border-red-200" /> &gt;100%
      </div>
    </div>
  );
}

type Stats = {
  estourados: { pessoa_id: string; nome: string; pct: number }[];
  ociosos: { id: string; nome: string }[];
  totalPeriodo: number;
  disciplinasTop: { disciplina: string; horas: number; pct: number }[];
};

function computeStats(
  pessoas: PessoaPlanejamento[],
  weeks: string[],
  celulas: Map<string, CelulaBreakdown[]>,
  mode: Mode,
  semanaAtual: string
): Stats {
  const estourados: Stats["estourados"] = [];
  const ociosos: Stats["ociosos"] = [];
  let totalPeriodo = 0;
  const disciplinaMap = new Map<string, number>();

  for (const pessoa of pessoas) {
    let horasSemanaAtual = 0;
    const rowsSemanaAtual = celulas.get(`${pessoa.id}::${semanaAtual}`) || [];
    horasSemanaAtual = sumBreakdown(rowsSemanaAtual, mode);

    const pct = pessoa.horas_semanais > 0 ? Math.round((horasSemanaAtual / pessoa.horas_semanais) * 100) : 0;
    if (pct > 100) estourados.push({ pessoa_id: pessoa.id, nome: pessoa.nome, pct });
    if (horasSemanaAtual === 0) ociosos.push({ id: pessoa.id, nome: pessoa.nome });

    for (const w of weeks) {
      const rows = celulas.get(`${pessoa.id}::${w}`) || [];
      for (const r of rows) {
        const valor = mode === "planejado" ? r.planejado : r.realizado;
        totalPeriodo += valor;
        if (valor > 0) {
          disciplinaMap.set(r.disciplina, (disciplinaMap.get(r.disciplina) || 0) + valor);
        }
      }
    }
  }

  const totalDisciplinas = Array.from(disciplinaMap.values()).reduce((a, b) => a + b, 0) || 1;
  const disciplinasTop = Array.from(disciplinaMap.entries())
    .map(([disciplina, horas]) => ({
      disciplina,
      horas,
      pct: Math.round((horas / totalDisciplinas) * 100),
    }))
    .sort((a, b) => b.horas - a.horas)
    .slice(0, 5);

  return {
    estourados: estourados.sort((a, b) => b.pct - a.pct),
    ociosos,
    totalPeriodo: Math.round(totalPeriodo),
    disciplinasTop,
  };
}

function stripZeros(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}
