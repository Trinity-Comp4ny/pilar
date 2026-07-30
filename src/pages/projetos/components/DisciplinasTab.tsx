import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { KPICard } from "@/components/KPICard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Loader2,
  Search,
  Layers,
  CheckCircle2,
  Clock,
  AlertTriangle,
  PauseCircle,
  ChevronDown,
  User,
  LayoutGrid,
  List,
  Calendar,
  TrendingUp,
} from "lucide-react";
import {
  type DisciplinaResponsavel,
  type Projeto,
  formatDate,
  formatDateShort,
  getResponsaveisList,
  getDiscDeadlineStatus,
} from "@/types/projetos";
import { PROJECT_STATUS_CONFIG } from "@/constants";
import { cn } from "@/lib/utils";

const DISCIPLINA_STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: typeof CheckCircle2; bgColor: string }
> = {
  Concluído: {
    label: "Concluído",
    color: "text-positive-strong",
    icon: CheckCircle2,
    bgColor: "bg-positive/10 border-positive/20",
  },
  "Em Andamento": {
    label: "Em Andamento",
    color: "text-blue-700",
    icon: Clock,
    bgColor: "bg-blue-50 border-blue-200",
  },
  "Não Iniciado": {
    label: "Não Iniciado",
    color: "text-gray-500",
    icon: PauseCircle,
    bgColor: "bg-gray-50 border-gray-200",
  },
  Pendente: {
    label: "Pendente",
    color: "text-amber-700",
    icon: AlertTriangle,
    bgColor: "bg-amber-50 border-amber-200",
  },
};

interface DisciplinaAgrupada {
  nome: string;
  projetos: {
    projeto: Projeto;
    disciplina: DisciplinaResponsavel;
  }[];
  totalConcluido: number;
  totalEmAndamento: number;
  totalPendente: number;
  totalNaoIniciado: number;
  progresso: number;
}

function getStatusBadge(status: string | undefined) {
  const config = DISCIPLINA_STATUS_CONFIG[status || "Não Iniciado"] || DISCIPLINA_STATUS_CONFIG["Não Iniciado"];
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={cn("text-[11px] gap-1 font-normal", config.bgColor, config.color)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

/** Mini stacked bar showing status distribution */
function StatusDistributionBar({ grupo }: { grupo: DisciplinaAgrupada }) {
  const total = grupo.projetos.length;
  if (total === 0) return null;

  const segments = [
    { count: grupo.totalConcluido, color: "bg-positive/100", label: "Concluído" },
    { count: grupo.totalEmAndamento, color: "bg-blue-500", label: "Em Andamento" },
    { count: grupo.totalPendente, color: "bg-amber-500", label: "Pendente" },
    { count: grupo.totalNaoIniciado, color: "bg-gray-300", label: "Não Iniciado" },
  ].filter((s) => s.count > 0);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex h-2 w-28 rounded-full overflow-hidden bg-gray-100 cursor-default">
          {segments.map((seg) => (
            <div
              key={seg.label}
              className={cn("h-full transition-all", seg.color)}
              style={{ width: `${(seg.count / total) * 100}%` }}
            />
          ))}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-2">
            <span className={cn("h-2 w-2 rounded-full", seg.color)} />
            {seg.label}: {seg.count}
          </div>
        ))}
      </TooltipContent>
    </Tooltip>
  );
}

interface DisciplinasTabProps {
  projetos: Projeto[];
  isLoading?: boolean;
}

export function DisciplinasTab({ projetos, isLoading }: DisciplinasTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [projetoFilter, setProjetoFilter] = useState<string>("todos");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [expandedDisciplinas, setExpandedDisciplinas] = useState<Set<string>>(new Set());

  const disciplinasAgrupadas = useMemo((): DisciplinaAgrupada[] => {
    const map = new Map<string, DisciplinaAgrupada>();

    for (const projeto of projetos) {
      for (const disc of projeto.disciplinas) {
        const nome = disc.disciplina;
        if (!map.has(nome)) {
          map.set(nome, {
            nome,
            projetos: [],
            totalConcluido: 0,
            totalEmAndamento: 0,
            totalPendente: 0,
            totalNaoIniciado: 0,
            progresso: 0,
          });
        }
        const grupo = map.get(nome)!;
        grupo.projetos.push({ projeto, disciplina: disc });

        const status = disc.status || "Não Iniciado";
        if (status === "Concluído") grupo.totalConcluido++;
        else if (status === "Em Andamento") grupo.totalEmAndamento++;
        else if (status === "Pendente") grupo.totalPendente++;
        else grupo.totalNaoIniciado++;
      }
    }

    for (const grupo of map.values()) {
      const total = grupo.projetos.length;
      grupo.progresso = total > 0 ? Math.round((grupo.totalConcluido / total) * 100) : 0;
    }

    return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [projetos]);

  const filtered = useMemo(() => {
    return disciplinasAgrupadas
      .map((grupo) => {
        let projetosFiltrados = grupo.projetos;

        if (projetoFilter !== "todos") {
          projetosFiltrados = projetosFiltrados.filter((p) => p.projeto.id === projetoFilter);
        }

        if (statusFilter !== "todos") {
          projetosFiltrados = projetosFiltrados.filter((p) => (p.disciplina.status || "Não Iniciado") === statusFilter);
        }

        if (projetosFiltrados.length === 0) return null;

        const totalConcluido = projetosFiltrados.filter((p) => p.disciplina.status === "Concluído").length;
        const totalEmAndamento = projetosFiltrados.filter((p) => p.disciplina.status === "Em Andamento").length;
        const totalPendente = projetosFiltrados.filter((p) => p.disciplina.status === "Pendente").length;
        const totalNaoIniciado = projetosFiltrados.filter(
          (p) => (p.disciplina.status || "Não Iniciado") === "Não Iniciado"
        ).length;
        const total = projetosFiltrados.length;

        return {
          ...grupo,
          projetos: projetosFiltrados,
          totalConcluido,
          totalEmAndamento,
          totalPendente,
          totalNaoIniciado,
          progresso: total > 0 ? Math.round((totalConcluido / total) * 100) : 0,
        };
      })
      .filter((g): g is DisciplinaAgrupada => {
        if (!g) return false;
        if (!searchTerm) return true;
        return g.nome.toLowerCase().includes(searchTerm.toLowerCase());
      });
  }, [disciplinasAgrupadas, searchTerm, statusFilter, projetoFilter]);

  const metrics = useMemo(() => {
    const allDiscs = projetos.flatMap((p) => p.disciplinas);
    const concluidas = allDiscs.filter((d) => d.status === "Concluído").length;
    const emAndamento = allDiscs.filter((d) => d.status === "Em Andamento").length;
    const statuses = allDiscs.map((d) => getDiscDeadlineStatus(d));
    const atrasadas = statuses.filter((s) => s?.status_data === "em_atraso").length;
    const emAtencao = statuses.filter((s) => s?.status_data === "atencao").length;
    return {
      total: allDiscs.length,
      concluidas,
      emAndamento,
      atrasadas,
      emAtencao,
      disciplinasUnicas: disciplinasAgrupadas.length,
      progressoPct: allDiscs.length > 0 ? Math.round((concluidas / allDiscs.length) * 100) : 0,
    };
  }, [projetos, disciplinasAgrupadas]);

  const toggleExpanded = (nome: string) => {
    setExpandedDisciplinas((prev) => {
      const next = new Set(prev);
      if (next.has(nome)) next.delete(nome);
      else next.add(nome);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedDisciplinas(new Set(filtered.map((g) => g.nome)));
  };

  const collapseAll = () => {
    setExpandedDisciplinas(new Set());
  };

  const projetosUnicos = useMemo(() => {
    return projetos.filter((p) => p.disciplinas.length > 0).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [projetos]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progresso geral + Métricas */}
      <div className="space-y-4">
        {/* Barra de progresso geral */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Progresso Geral</span>
              </div>
              <span className="text-sm font-bold">{metrics.progressoPct}%</span>
            </div>
            <Progress value={metrics.progressoPct} className="h-2.5" indicatorClassName="bg-brand" />
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span>
                {metrics.concluidas} de {metrics.total} atribuições concluídas
              </span>
              <span>·</span>
              <span>{metrics.disciplinasUnicas} disciplinas únicas</span>
            </div>
          </CardContent>
        </Card>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KPICard
            icon={CheckCircle2}
            label="Concluídas"
            value={metrics.concluidas.toString()}
            tone="positive"
            subtitle={`${metrics.progressoPct}%`}
          />
          <KPICard icon={Clock} label="Em Andamento" value={metrics.emAndamento.toString()} tone="info" />
          <KPICard icon={Clock} label="Atenção" value={metrics.emAtencao.toString()} tone="warning" />
          <KPICard icon={AlertTriangle} label="Atrasadas" value={metrics.atrasadas.toString()} tone="danger" />
          <KPICard icon={Layers} label="Total" value={metrics.total.toString()} tone="neutral" subtitle="atribuições" />
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar disciplina..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="Não Iniciado">Não Iniciado</SelectItem>
            <SelectItem value="Em Andamento">Em Andamento</SelectItem>
            <SelectItem value="Concluído">Concluído</SelectItem>
            <SelectItem value="Pendente">Pendente</SelectItem>
          </SelectContent>
        </Select>

        <Select value={projetoFilter} onValueChange={setProjetoFilter}>
          <SelectTrigger className="w-[220px] h-9">
            <SelectValue placeholder="Projeto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os projetos</SelectItem>
            {projetosUnicos.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.codigo_projeto ? `${p.codigo_projeto} — ` : ""}
                {p.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1 ml-auto">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={expandedDisciplinas.size > 0 ? collapseAll : expandAll}
          >
            {expandedDisciplinas.size > 0 ? "Recolher" : "Expandir"} tudo
          </Button>
          <div className="flex border rounded-md overflow-hidden">
            <Button
              variant={viewMode === "cards" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8 rounded-none"
              onClick={() => setViewMode("cards")}
              aria-label="Visualizar em cards"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "table" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8 rounded-none"
              onClick={() => setViewMode("table")}
              aria-label="Visualizar em tabela"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Layers className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm font-medium">Nenhuma disciplina encontrada</p>
          {(searchTerm || statusFilter !== "todos" || projetoFilter !== "todos") && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3 text-xs"
              onClick={() => {
                setSearchTerm("");
                setStatusFilter("todos");
                setProjetoFilter("todos");
              }}
            >
              Limpar filtros
            </Button>
          )}
        </div>
      ) : viewMode === "cards" ? (
        <div className="space-y-3">
          {filtered.map((grupo) => {
            const isExpanded = expandedDisciplinas.has(grupo.nome);
            const hasAtrasadas = grupo.projetos.some(({ disciplina }) => {
              const s = getDiscDeadlineStatus(disciplina);
              return s?.status_data === "em_atraso";
            });

            return (
              <Card key={grupo.nome} className={cn("overflow-hidden transition-all", isExpanded && "shadow-sm")}>
                {/* Group header */}
                <button
                  type="button"
                  className="w-full text-left p-4 hover:bg-muted/30 transition-colors"
                  onClick={() => toggleExpanded(grupo.nome)}
                >
                  <div className="flex items-center gap-3">
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform",
                        !isExpanded && "-rotate-90"
                      )}
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm">{grupo.nome}</h3>
                        <Badge variant="secondary" className="text-[11px] font-normal">
                          {grupo.projetos.length} projeto
                          {grupo.projetos.length !== 1 ? "s" : ""}
                        </Badge>
                        {hasAtrasadas && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-red-100 text-red-700 flex items-center gap-1">
                            <AlertTriangle size={10} /> Atraso
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex-1 max-w-[200px]">
                          <Progress value={grupo.progresso} className="h-1.5" indicatorClassName="bg-brand" />
                        </div>
                        <span className="text-xs font-medium text-muted-foreground">{grupo.progresso}%</span>
                      </div>
                    </div>

                    {/* Status distribution bar + counts */}
                    <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
                      <StatusDistributionBar grupo={grupo} />
                      <div className="flex items-center gap-1.5">
                        {grupo.totalConcluido > 0 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="flex items-center gap-0.5 text-xs text-positive-strong bg-positive/10 rounded-full px-2 py-0.5">
                                <CheckCircle2 className="h-3 w-3" />
                                {grupo.totalConcluido}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Concluídas</TooltipContent>
                          </Tooltip>
                        )}
                        {grupo.totalEmAndamento > 0 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="flex items-center gap-0.5 text-xs text-blue-700 bg-blue-50 rounded-full px-2 py-0.5">
                                <Clock className="h-3 w-3" />
                                {grupo.totalEmAndamento}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Em Andamento</TooltipContent>
                          </Tooltip>
                        )}
                        {grupo.totalPendente > 0 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="flex items-center gap-0.5 text-xs text-amber-700 bg-amber-50 rounded-full px-2 py-0.5">
                                <AlertTriangle className="h-3 w-3" />
                                {grupo.totalPendente}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Pendentes</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  </div>
                </button>

                {/* Expanded: project rows */}
                {isExpanded && (
                  <div className="border-t bg-muted/10">
                    <div className="divide-y">
                      {grupo.projetos.map(({ projeto, disciplina }) => {
                        const dlStatus = getDiscDeadlineStatus(disciplina);
                        const atrasada = dlStatus?.status_data === "em_atraso";
                        const atencao = dlStatus?.status_data === "atencao";
                        const resps = getResponsaveisList(disciplina);

                        return (
                          <div
                            key={projeto.id}
                            className={cn(
                              "px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 transition-colors hover:bg-muted/20",
                              atrasada && "bg-red-50/30",
                              atencao && "bg-yellow-50/30"
                            )}
                          >
                            <div className="flex-1 min-w-0 pl-7">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm truncate">{projeto.nome}</span>
                                {projeto.codigo_projeto && (
                                  <span className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                    {projeto.codigo_projeto}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {resps.length > 0 ? resps.map((r) => r.responsavel_nome).join(", ") : "—"}
                                </span>
                                {disciplina.data_previsao && (
                                  <>
                                    <span className="text-muted-foreground/30">·</span>
                                    <span
                                      className={cn("flex items-center gap-1", atrasada && "text-red-600 font-medium")}
                                    >
                                      <Calendar className="h-3 w-3" />
                                      Prev: {formatDateShort(disciplina.data_previsao)}
                                    </span>
                                  </>
                                )}
                                {projeto.cliente_nome && (
                                  <>
                                    <span className="text-muted-foreground/30">·</span>
                                    <span>{projeto.cliente_nome}</span>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 pl-7 sm:pl-0 flex-shrink-0">
                              {getStatusBadge(disciplina.status)}
                              {atrasada && dlStatus && (
                                <Badge variant="destructive" className="text-[10px] gap-0.5">
                                  <AlertTriangle className="h-3 w-3" />
                                  Em Atraso {dlStatus.days > 0 ? `(${dlStatus.days}d)` : ""}
                                </Badge>
                              )}
                              {atencao && dlStatus && (
                                <Badge className="text-[10px] gap-0.5 bg-yellow-500 hover:bg-yellow-500 text-white">
                                  <Clock className="h-3 w-3" />
                                  Atenção {dlStatus.days > 0 ? `(${dlStatus.days}d)` : ""}
                                </Badge>
                              )}
                              {PROJECT_STATUS_CONFIG[projeto.status] && (
                                <Badge
                                  variant="outline"
                                  className={cn("text-[11px]", PROJECT_STATUS_CONFIG[projeto.status].color)}
                                >
                                  {PROJECT_STATUS_CONFIG[projeto.status].label}
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        /* Table view */
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/50 sticky top-0">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs">Disciplina</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs">Projeto</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs">Responsável</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs">Previsão</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs">Projeto Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.flatMap((grupo) =>
                  grupo.projetos.map(({ projeto, disciplina }, idx) => {
                    const dlStatus = getDiscDeadlineStatus(disciplina);
                    const atrasada = dlStatus?.status_data === "em_atraso";
                    const atencao = dlStatus?.status_data === "atencao";

                    return (
                      <tr
                        key={`${grupo.nome}-${projeto.id}`}
                        className={cn(
                          "border-b transition-colors",
                          atrasada
                            ? "bg-red-50/30 hover:bg-red-50/50"
                            : atencao
                              ? "bg-yellow-50/30 hover:bg-yellow-50/50"
                              : "hover:bg-muted/30"
                        )}
                      >
                        <td className="py-2.5 px-4">
                          {idx === 0 ? (
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{grupo.nome}</span>
                              <Badge variant="secondary" className="text-[10px] font-normal">
                                {grupo.projetos.length}
                              </Badge>
                            </div>
                          ) : (
                            <span className="text-muted-foreground/30 pl-2">↳</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="font-medium text-sm">{projeto.nome}</div>
                          {projeto.codigo_projeto && (
                            <div className="text-[11px] text-muted-foreground">{projeto.codigo_projeto}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-sm">
                          {(() => {
                            const resps = getResponsaveisList(disciplina);
                            return resps.length > 0 ? resps.map((r) => r.responsavel_nome).join(", ") : "—";
                          })()}
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-1">
                            {getStatusBadge(disciplina.status)}
                            {atrasada && dlStatus && (
                              <Badge variant="destructive" className="text-[10px] gap-0.5">
                                <AlertTriangle className="h-3 w-3" />
                                {dlStatus.days}d
                              </Badge>
                            )}
                            {atencao && dlStatus && (
                              <Badge className="text-[10px] gap-0.5 bg-yellow-500 hover:bg-yellow-500 text-white">
                                <Clock className="h-3 w-3" />
                                {dlStatus.days}d
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td
                          className={cn(
                            "py-2.5 px-4 text-sm",
                            atrasada
                              ? "text-red-600 font-medium"
                              : atencao
                                ? "text-yellow-600 font-medium"
                                : "text-muted-foreground"
                          )}
                        >
                          {formatDate(disciplina.data_previsao)}
                        </td>
                        <td className="py-2.5 px-4">
                          {PROJECT_STATUS_CONFIG[projeto.status] && (
                            <Badge
                              variant="outline"
                              className={cn("text-[11px]", PROJECT_STATUS_CONFIG[projeto.status].color)}
                            >
                              {PROJECT_STATUS_CONFIG[projeto.status].label}
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
