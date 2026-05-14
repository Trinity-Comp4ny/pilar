import { useState } from "react";
import { format, subDays } from "date-fns";
import { Clock, Plus, CheckCircle } from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useTimesheetLancamentos, useAprovarHoras } from "@/hooks/useTimesheet";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { useAuth } from "@/contexts/AuthContext";
import { LancarHorasDialog } from "@/components/LancarHorasDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Skeleton } from "@/components/ui/skeleton";
import type { TimesheetLancamento } from "@/hooks/useTimesheet";

const STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
};

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "aprovado"
      ? "default"
      : status === "rejeitado"
        ? "destructive"
        : "secondary";

  return (
    <Badge variant={variant} className="text-xs">
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

function LancamentosTable({
  lancamentos,
  isLoading,
  showUser,
  showAprovar,
  onAprovar,
  isAprovando,
}: {
  lancamentos: TimesheetLancamento[];
  isLoading: boolean;
  showUser?: boolean;
  showAprovar?: boolean;
  onAprovar?: (id: string) => void;
  isAprovando?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-md" />
        ))}
      </div>
    );
  }

  if (!lancamentos.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <div className="p-3 rounded-full bg-muted">
          <Clock className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">Nenhum lançamento encontrado</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Projeto</TableHead>
            <TableHead>Fase</TableHead>
            {showUser && <TableHead>Colaborador</TableHead>}
            <TableHead>Descrição</TableHead>
            <TableHead className="text-right">Horas</TableHead>
            <TableHead>Status</TableHead>
            {showAprovar && <TableHead />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {lancamentos.map((l) => (
            <TableRow key={l.id}>
              <TableCell className="whitespace-nowrap text-sm">
                {format(new Date(l.data + "T00:00:00"), "dd/MM/yyyy")}
              </TableCell>
              <TableCell className="text-sm font-medium max-w-[160px] truncate">
                {l.projeto_nome}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground max-w-[120px] truncate">
                {l.fase_nome ?? "—"}
              </TableCell>
              {showUser && (
                <TableCell className="text-sm">{l.user_nome}</TableCell>
              )}
              <TableCell className="text-sm max-w-[240px] truncate" title={l.descricao}>
                {l.descricao}
              </TableCell>
              <TableCell className="text-right text-sm font-medium">
                {l.horas}h
              </TableCell>
              <TableCell>
                <StatusBadge status={l.status} />
              </TableCell>
              {showAprovar && (
                <TableCell>
                  {l.status === "pendente" && onAprovar && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      disabled={isAprovando}
                      onClick={() => onAprovar(l.id)}
                    >
                      <CheckCircle className="h-3.5 w-3.5 mr-1" />
                      Aprovar
                    </Button>
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function FiltrosBar({
  dataInicio,
  dataFim,
  status,
  onDataInicio,
  onDataFim,
  onStatus,
}: {
  dataInicio: string;
  dataFim: string;
  status: string;
  onDataInicio: (v: string) => void;
  onDataFim: (v: string) => void;
  onStatus: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-3 items-center">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground whitespace-nowrap">De</span>
        <DatePicker value={dataInicio} onChange={onDataInicio} className="w-36" />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground whitespace-nowrap">Até</span>
        <DatePicker value={dataFim} onChange={onDataFim} className="w-36" />
      </div>
      <Select value={status} onValueChange={onStatus}>
        <SelectTrigger className="w-36 h-10">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos</SelectItem>
          <SelectItem value="pendente">Pendente</SelectItem>
          <SelectItem value="aprovado">Aprovado</SelectItem>
          <SelectItem value="rejeitado">Rejeitado</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export default function Timesheet() {
  usePageTitle("Timesheet");

  const { user } = useAuth();
  const { canEdit: podeGerirEquipe } = useFeatureAccess("pessoas");
  const { mutate: aprovarHoras, isPending: isAprovando } = useAprovarHoras();

  const [dialogAberto, setDialogAberto] = useState(false);

  const hoje = format(new Date(), "yyyy-MM-dd");
  const trintaDiasAtras = format(subDays(new Date(), 30), "yyyy-MM-dd");

  const [meusDataInicio, setMeusDataInicio] = useState(trintaDiasAtras);
  const [meusDataFim, setMeusDataFim] = useState(hoje);
  const [meusStatus, setMeusStatus] = useState("todos");

  const [equipeDataInicio, setEquipeDataInicio] = useState(trintaDiasAtras);
  const [equipeDataFim, setEquipeDataFim] = useState(hoje);
  const [equipeStatus, setEquipeStatus] = useState("todos");

  const meusFilters = {
    userId: user?.id,
    dataInicio: meusDataInicio || undefined,
    dataFim: meusDataFim || undefined,
    status: meusStatus !== "todos" ? meusStatus : undefined,
  };

  const equipeFilters = {
    dataInicio: equipeDataInicio || undefined,
    dataFim: equipeDataFim || undefined,
    status: equipeStatus !== "todos" ? equipeStatus : undefined,
  };

  const { data: meusLancamentos = [], isLoading: loadingMeus } = useTimesheetLancamentos(meusFilters);
  const { data: equipeData = [], isLoading: loadingEquipe } = useTimesheetLancamentos(
    podeGerirEquipe ? equipeFilters : {}
  );

  const totalHorasMeus = meusLancamentos.reduce((acc: number, l: TimesheetLancamento) => acc + l.horas, 0);

  return (
    <PageLayout>
      <PageHeader title="Timesheet">
        <Button onClick={() => setDialogAberto(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Lançar horas
        </Button>
      </PageHeader>

      <Tabs defaultValue="meus" className="space-y-4">
        <TabsList>
          <TabsTrigger value="meus">Meus Lançamentos</TabsTrigger>
          {podeGerirEquipe && <TabsTrigger value="equipe">Equipe</TabsTrigger>}
        </TabsList>

        <TabsContent value="meus" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <FiltrosBar
              dataInicio={meusDataInicio}
              dataFim={meusDataFim}
              status={meusStatus}
              onDataInicio={setMeusDataInicio}
              onDataFim={setMeusDataFim}
              onStatus={setMeusStatus}
            />
            {!loadingMeus && meusLancamentos.length > 0 && (
              <p className="text-sm text-muted-foreground whitespace-nowrap">
                Total: <span className="font-semibold text-foreground">{totalHorasMeus.toFixed(1)}h</span>
              </p>
            )}
          </div>

          <LancamentosTable
            lancamentos={meusLancamentos}
            isLoading={loadingMeus}
          />
        </TabsContent>

        {podeGerirEquipe && (
          <TabsContent value="equipe" className="space-y-4">
            <FiltrosBar
              dataInicio={equipeDataInicio}
              dataFim={equipeDataFim}
              status={equipeStatus}
              onDataInicio={setEquipeDataInicio}
              onDataFim={setEquipeDataFim}
              onStatus={setEquipeStatus}
            />

            <LancamentosTable
              lancamentos={equipeData}
              isLoading={loadingEquipe}
              showUser
              showAprovar
              onAprovar={(id) => aprovarHoras(id)}
              isAprovando={isAprovando}
            />
          </TabsContent>
        )}
      </Tabs>

      <LancarHorasDialog open={dialogAberto} onOpenChange={setDialogAberto} />
    </PageLayout>
  );
}
