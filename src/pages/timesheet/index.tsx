import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { useUserRole } from "@/hooks/useUserRole";
import { usePessoaAtual, usePessoasEmpresa } from "@/hooks/useTimesheets";
import { TimesheetGrid } from "./components/TimesheetGrid";
import { TimesheetApproval } from "./components/TimesheetApproval";

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateISO(date: Date): string {
  return date.toISOString().split("T")[0];
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatWeekLabel(monday: Date): string {
  const sunday = addDays(monday, 6);
  const opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" };
  return `${monday.toLocaleDateString("pt-BR", opts)} — ${sunday.toLocaleDateString("pt-BR", opts)}`;
}

export default function Timesheet() {
  const { data: userRole } = useUserRole();
  const { data: pessoaAtual } = usePessoaAtual();
  const { data: todasPessoas = [] } = usePessoasEmpresa();

  const isAdmin = userRole === "admin" || userRole === "operacional";

  const [currentMonday, setCurrentMonday] = useState(() => getMonday(new Date()));
  const [selectedPessoaId, setSelectedPessoaId] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState("meu-timesheet");

  // Pessoa selecionada: ou a que o admin escolheu, ou a do próprio usuário
  const _pessoaId = activeTab === "aprovacao" ? undefined : (isAdmin && selectedPessoaId) || pessoaAtual?.id;

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => formatDateISO(addDays(currentMonday, i)));
  }, [currentMonday]);

  const weekStart = weekDays[0];
  const weekEnd = weekDays[6];

  const navegarSemana = (direcao: number) => {
    setCurrentMonday((prev) => addDays(prev, direcao * 7));
  };

  const irParaHoje = () => {
    setCurrentMonday(getMonday(new Date()));
  };

  return (
    <PageLayout>
      <PageHeader title="Timesheet" description="Registre as horas trabalhadas por projeto e disciplina" />

      {isAdmin ? (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="meu-timesheet">Meu Timesheet</TabsTrigger>
            <TabsTrigger value="equipe">Equipe</TabsTrigger>
            <TabsTrigger value="aprovacao">Aprovação</TabsTrigger>
          </TabsList>

          <TabsContent value="meu-timesheet" className="space-y-4">
            <WeekNavigator currentMonday={currentMonday} onNavigate={navegarSemana} onToday={irParaHoje} />
            {pessoaAtual?.id ? (
              <Card>
                <CardContent className="p-4">
                  <TimesheetGrid
                    pessoaId={pessoaAtual.id}
                    weekStart={weekStart}
                    weekEnd={weekEnd}
                    weekDays={weekDays}
                  />
                </CardContent>
              </Card>
            ) : (
              <NoPessoaMessage />
            )}
          </TabsContent>

          <TabsContent value="equipe" className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <Select value={selectedPessoaId || ""} onValueChange={setSelectedPessoaId}>
                <SelectTrigger className="w-[280px]">
                  <SelectValue placeholder="Selecione um colaborador" />
                </SelectTrigger>
                <SelectContent>
                  {todasPessoas.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome} {p.cargo ? `(${p.cargo})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <WeekNavigator currentMonday={currentMonday} onNavigate={navegarSemana} onToday={irParaHoje} />
            </div>
            {selectedPessoaId ? (
              <Card>
                <CardContent className="p-4">
                  <TimesheetGrid
                    pessoaId={selectedPessoaId}
                    weekStart={weekStart}
                    weekEnd={weekEnd}
                    weekDays={weekDays}
                  />
                </CardContent>
              </Card>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Selecione um colaborador para ver o timesheet.
              </div>
            )}
          </TabsContent>

          <TabsContent value="aprovacao">
            <TimesheetApproval />
          </TabsContent>
        </Tabs>
      ) : (
        <div className="space-y-4">
          <WeekNavigator currentMonday={currentMonday} onNavigate={navegarSemana} onToday={irParaHoje} />
          {pessoaAtual?.id ? (
            <Card>
              <CardContent className="p-4">
                <TimesheetGrid pessoaId={pessoaAtual.id} weekStart={weekStart} weekEnd={weekEnd} weekDays={weekDays} />
              </CardContent>
            </Card>
          ) : (
            <NoPessoaMessage />
          )}
        </div>
      )}
    </PageLayout>
  );
}

function WeekNavigator({
  currentMonday,
  onNavigate,
  onToday,
}: {
  currentMonday: Date;
  onNavigate: (dir: number) => void;
  onToday: () => void;
}) {
  const isCurrentWeek = formatDateISO(getMonday(new Date())) === formatDateISO(currentMonday);

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onNavigate(-1)}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="text-sm font-medium min-w-[200px] text-center">{formatWeekLabel(currentMonday)}</div>
      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onNavigate(1)}>
        <ChevronRight className="h-4 w-4" />
      </Button>
      {!isCurrentWeek && (
        <Button variant="ghost" size="sm" onClick={onToday} className="text-xs">
          Hoje
        </Button>
      )}
    </div>
  );
}

function NoPessoaMessage() {
  return (
    <div className="text-center py-12 text-muted-foreground">
      <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
      <p className="text-sm">Seu perfil ainda não está vinculado a um cadastro de pessoa.</p>
      <p className="text-xs mt-1">Peça ao administrador para vincular seu usuário.</p>
    </div>
  );
}
