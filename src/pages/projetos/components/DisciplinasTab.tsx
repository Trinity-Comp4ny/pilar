import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Loader2,
  Search,
  Layers,
  CheckCircle2,
  Clock,
  AlertTriangle,
  PauseCircle,
  ChevronDown,
  ChevronRight,
  User,
  LayoutGrid,
  List,
} from "lucide-react";
import { type DisciplinaResponsavel, type Projeto, formatDate, getResponsaveisList } from "@/pages/projetos/types";
import { PROJECT_STATUS_CONFIG } from "@/constants";
import { cn } from "@/lib/utils";

const DISCIPLINA_STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2; bgColor: string }> = {
  "Concluído": { label: "Concluído", color: "text-green-700", icon: CheckCircle2, bgColor: "bg-green-50 border-green-200" },
  "Em Andamento": { label: "Em Andamento", color: "text-blue-700", icon: Clock, bgColor: "bg-blue-50 border-blue-200" },
  "Não Iniciado": { label: "Não Iniciado", color: "text-gray-500", icon: PauseCircle, bgColor: "bg-gray-50 border-gray-200" },
  "Pendente": { label: "Pendente", color: "text-amber-700", icon: AlertTriangle, bgColor: "bg-amber-50 border-amber-200" },
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

function isAtrasada(disc: DisciplinaResponsavel): boolean {
  if (disc.status === "Concluído") return false;
  if (!disc.data_previsao) return false;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const previsao = new Date(disc.data_previsao + "T00:00:00");
  return previsao < hoje;
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
          projetosFiltrados = projetosFiltrados.filter(
            (p) => (p.disciplina.status || "Não Iniciado") === statusFilter
          );
        }

        if (projetosFiltrados.length === 0) return null;

        const totalConcluido = projetosFiltrados.filter((p) => p.disciplina.status === "Concluído").length;
        const totalEmAndamento = projetosFiltrados.filter((p) => p.disciplina.status === "Em Andamento").length;
        const totalPendente = projetosFiltrados.filter((p) => p.disciplina.status === "Pendente").length;
        const totalNaoIniciado = projetosFiltrados.filter((p) => (p.disciplina.status || "Não Iniciado") === "Não Iniciado").length;
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
    const atrasadas = allDiscs.filter((d) => isAtrasada(d)).length;
    return {
      total: allDiscs.length,
      concluidas,
      emAndamento,
      atrasadas,
      disciplinasUnicas: disciplinasAgrupadas.length,
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
    return projetos
      .filter((p) => p.disciplinas.length > 0)
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
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
      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Disciplinas</p>
            <p className="text-2xl font-bold">{metrics.disciplinasUnicas}</p>
            <p className="text-[11px] text-muted-foreground">{metrics.total} atribuições</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" /> Concluídas
            </p>
            <p className="text-2xl font-bold text-green-700">{metrics.concluidas}</p>
            <p className="text-[11px] text-muted-foreground">
              {metrics.total > 0 ? Math.round((metrics.concluidas / metrics.total) * 100) : 0}% do total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3 text-blue-500" /> Em Andamento
            </p>
            <p className="text-2xl font-bold text-blue-700">{metrics.emAndamento}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-red-500" /> Atrasadas
            </p>
            <p className="text-2xl font-bold text-red-600">{metrics.atrasadas}</p>
          </CardContent>
        </Card>
        <Card className="col-span-2 md:col-span-1">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Progresso Geral</p>
            <p className="text-2xl font-bold">
              {metrics.total > 0 ? Math.round((metrics.concluidas / metrics.total) * 100) : 0}%
            </p>
            <Progress
              value={metrics.total > 0 ? (metrics.concluidas / metrics.total) * 100 : 0}
              className="h-1.5 mt-2"
            />
          </CardContent>
        </Card>
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
                {p.codigo_projeto ? `${p.codigo_projeto} — ` : ""}{p.nome}
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
          <div className="flex border rounded-md">
            <Button
              variant={viewMode === "cards" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8 rounded-r-none"
              onClick={() => setViewMode("cards")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "table" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8 rounded-l-none"
              onClick={() => setViewMode("table")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Layers className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhuma disciplina encontrada.</p>
          {(searchTerm || statusFilter !== "todos" || projetoFilter !== "todos") && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 text-xs"
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
            return (
              <Card key={grupo.nome} className="overflow-hidden">
                <button
                  type="button"
                  className="w-full text-left p-4 hover:bg-gray-50/50 transition-colors"
                  onClick={() => toggleExpanded(grupo.nome)}
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium text-sm">{grupo.nome}</h3>
                        <Badge variant="secondary" className="text-[11px]">
                          {grupo.projetos.length} projeto{grupo.projetos.length !== 1 ? "s" : ""}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-4 mt-1.5">
                        <div className="flex-1 max-w-[200px]">
                          <Progress value={grupo.progresso} className="h-1.5" />
                        </div>
                        <span className="text-xs text-muted-foreground">{grupo.progresso}%</span>
                      </div>
                    </div>

                    <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
                      {grupo.totalConcluido > 0 && (
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[11px]">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              {grupo.totalConcluido}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>Concluídas</TooltipContent>
                        </Tooltip>
                      )}
                      {grupo.totalEmAndamento > 0 && (
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[11px]">
                              <Clock className="h-3 w-3 mr-1" />
                              {grupo.totalEmAndamento}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>Em Andamento</TooltipContent>
                        </Tooltip>
                      )}
                      {grupo.totalPendente > 0 && (
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[11px]">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              {grupo.totalPendente}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>Pendentes</TooltipContent>
                        </Tooltip>
                      )}
                      {grupo.totalNaoIniciado > 0 && (
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200 text-[11px]">
                              <PauseCircle className="h-3 w-3 mr-1" />
                              {grupo.totalNaoIniciado}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>Não Iniciadas</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t">
                    <div className="divide-y">
                      {grupo.projetos.map(({ projeto, disciplina }) => (
                        <div
                          key={projeto.id}
                          className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 hover:bg-gray-50/50"
                        >
                          <div className="flex-1 min-w-0 pl-7">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm truncate">{projeto.nome}</span>
                              {projeto.codigo_projeto && (
                                <span className="text-xs text-muted-foreground">
                                  {projeto.codigo_projeto}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                              {(() => {
                                const resps = getResponsaveisList(disciplina);
                                return resps.map((r, ri) => (
                                  <span key={ri} className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {r.responsavel_nome}
                                    {r.data_previsao && (
                                      <span className="text-muted-foreground/60 ml-0.5">({formatDate(r.data_previsao)})</span>
                                    )}
                                  </span>
                                ));
                              })()}
                              {projeto.cliente_nome && (
                                <span className="text-muted-foreground/70">
                                  {projeto.cliente_nome}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pl-7 sm:pl-0">
                            {getStatusBadge(disciplina.status)}
                            {isAtrasada(disciplina) && (
                              <Badge variant="destructive" className="text-[11px]">Atrasada</Badge>
                            )}
                            {PROJECT_STATUS_CONFIG[projeto.status] && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[11px]",
                                  PROJECT_STATUS_CONFIG[projeto.status].color
                                )}
                              >
                                {PROJECT_STATUS_CONFIG[projeto.status].label}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-gray-50/50">
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
                  grupo.projetos.map(({ projeto, disciplina }, idx) => (
                    <tr
                      key={`${grupo.nome}-${projeto.id}`}
                      className="border-b hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="py-2.5 px-4">
                        {idx === 0 ? (
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{grupo.nome}</span>
                            <Badge variant="secondary" className="text-[10px]">{grupo.projetos.length}</Badge>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/40">↳</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="font-medium text-sm">{projeto.nome}</div>
                        {projeto.codigo_projeto && (
                          <div className="text-xs text-muted-foreground">{projeto.codigo_projeto}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-sm">
                        {(() => {
                          const resps = getResponsaveisList(disciplina);
                          return resps.length > 0
                            ? resps.map((r) => r.responsavel_nome).join(", ")
                            : "—";
                        })()}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-1">
                          {getStatusBadge(disciplina.status)}
                          {isAtrasada(disciplina) && (
                            <Badge variant="destructive" className="text-[10px]">Atrasada</Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-sm text-muted-foreground">
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
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
