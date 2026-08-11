import { useMemo, useState } from "react";
import { format, subDays, parseISO } from "date-fns";
import { Clock, Plus, CheckCircle, XCircle, RotateCcw } from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { usePageTitle } from "@/hooks/usePageTitle";
import {
  useTimesheetLancamentos,
  useAprovarHoras,
  useAprovarHorasLote,
  useRejeitarHoras,
  useReabrirHoras,
} from "@/hooks/useTimesheet";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { useAuth } from "@/contexts/AuthContext";
import { LancarHorasDialog } from "@/components/LancarHorasDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FiltroPeriodo } from "@/components/filters/FiltroPeriodo";
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
  showAcoes,
  onAprovar,
  onRejeitar,
  onReabrir,
  onLancar,
  isMutando,
}: {
  lancamentos: TimesheetLancamento[];
  isLoading: boolean;
  showUser?: boolean;
  showAcoes?: boolean;
  onAprovar?: (l: TimesheetLancamento) => void;
  onRejeitar?: (l: TimesheetLancamento) => void;
  onReabrir?: (l: TimesheetLancamento) => void;
  onLancar?: () => void;
  isMutando?: boolean;
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
        {onLancar && (
          <Button size="sm" onClick={onLancar}>
            <Plus className="h-4 w-4 mr-2" />
            Lançar horas
          </Button>
        )}
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
            {showAcoes && <TableHead className="text-right">Ações</TableHead>}
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
              {showAcoes && (
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {l.status === "pendente" ? (
                      <>
                        {onAprovar && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-emerald-700"
                            disabled={isMutando}
                            onClick={() => onAprovar(l)}
                          >
                            <CheckCircle className="h-3.5 w-3.5 mr-1" />
                            Aprovar
                          </Button>
                        )}
                        {onRejeitar && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-red-600"
                            disabled={isMutando}
                            onClick={() => onRejeitar(l)}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" />
                            Rejeitar
                          </Button>
                        )}
                      </>
                    ) : (
                      onReabrir && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-muted-foreground"
                          disabled={isMutando}
                          onClick={() => onReabrir(l)}
                        >
                          <RotateCcw className="h-3.5 w-3.5 mr-1" />
                          Reabrir
                        </Button>
                      )
                    )}
                  </div>
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
      <FiltroPeriodo
        from={dataInicio ? parseISO(dataInicio) : undefined}
        to={dataFim ? parseISO(dataFim) : undefined}
        onChange={(from, to) => {
          onDataInicio(from ? format(from, "yyyy-MM-dd") : "");
          onDataFim(to ? format(to, "yyyy-MM-dd") : "");
        }}
        align="start"
      />
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
  const { mutate: aprovarLote, isPending: isAprovandoLote } = useAprovarHorasLote();
  const { mutate: rejeitarHoras, isPending: isRejeitando } = useRejeitarHoras();
  const { mutate: reabrirHoras, isPending: isReabrindo } = useReabrirHoras();

  const isMutando = isAprovando || isAprovandoLote || isRejeitando || isReabrindo;

  const [dialogAberto, setDialogAberto] = useState(false);

  // Confirmação leve para ações que mudam o estado de um lançamento.
  type ConfirmAction =
    | { type: "aprovar"; id: string; nome: string }
    | { type: "rejeitar"; id: string; nome: string }
    | { type: "reabrir"; id: string; nome: string }
    | { type: "aprovar-lote"; ids: string[] };
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const handleConfirm = () => {
    if (!confirmAction) return;
    if (confirmAction.type === "aprovar") aprovarHoras(confirmAction.id);
    else if (confirmAction.type === "rejeitar") rejeitarHoras(confirmAction.id);
    else if (confirmAction.type === "reabrir") reabrirHoras(confirmAction.id);
    else if (confirmAction.type === "aprovar-lote") aprovarLote(confirmAction.ids);
    setConfirmAction(null);
  };

  const confirmCopy: Record<ConfirmAction["type"], { title: string; description: string; variant: "default" | "destructive"; confirmText: string }> = {
    aprovar: { title: "Aprovar lançamento", description: "Confirmar a aprovação destas horas? Você poderá reabrir depois.", variant: "default", confirmText: "Aprovar" },
    rejeitar: { title: "Rejeitar lançamento", description: "As horas serão marcadas como rejeitadas. Você poderá reabrir depois.", variant: "destructive", confirmText: "Rejeitar" },
    reabrir: { title: "Reabrir lançamento", description: "As horas voltarão para pendente e precisarão de nova análise.", variant: "default", confirmText: "Reabrir" },
    "aprovar-lote": { title: "Aprovar pendentes", description: "Confirmar a aprovação de todos os lançamentos pendentes filtrados?", variant: "default", confirmText: "Aprovar todos" },
  };

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
  const totalHorasEquipe = equipeData.reduce((acc: number, l: TimesheetLancamento) => acc + l.horas, 0);
  const pendentesEquipe = useMemo(
    () => equipeData.filter((l: TimesheetLancamento) => l.status === "pendente"),
    [equipeData]
  );

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
            onLancar={() => setDialogAberto(true)}
          />
        </TabsContent>

        {podeGerirEquipe && (
          <TabsContent value="equipe" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <FiltrosBar
                dataInicio={equipeDataInicio}
                dataFim={equipeDataFim}
                status={equipeStatus}
                onDataInicio={setEquipeDataInicio}
                onDataFim={setEquipeDataFim}
                onStatus={setEquipeStatus}
              />
              <div className="flex items-center gap-3">
                {!loadingEquipe && equipeData.length > 0 && (
                  <p className="text-sm text-muted-foreground whitespace-nowrap">
                    Total: <span className="font-semibold text-foreground">{totalHorasEquipe.toFixed(1)}h</span>
                    {pendentesEquipe.length > 0 && (
                      <span className="ml-2 text-amber-600">{pendentesEquipe.length} pendente(s)</span>
                    )}
                  </p>
                )}
                {pendentesEquipe.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isMutando}
                    onClick={() =>
                      setConfirmAction({ type: "aprovar-lote", ids: pendentesEquipe.map((l: TimesheetLancamento) => l.id) })
                    }
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Aprovar pendentes ({pendentesEquipe.length})
                  </Button>
                )}
              </div>
            </div>

            <LancamentosTable
              lancamentos={equipeData}
              isLoading={loadingEquipe}
              showUser
              showAcoes
              onAprovar={(l) => setConfirmAction({ type: "aprovar", id: l.id, nome: l.projeto_nome ?? "" })}
              onRejeitar={(l) => setConfirmAction({ type: "rejeitar", id: l.id, nome: l.projeto_nome ?? "" })}
              onReabrir={(l) => setConfirmAction({ type: "reabrir", id: l.id, nome: l.projeto_nome ?? "" })}
              isMutando={isMutando}
            />
          </TabsContent>
        )}
      </Tabs>

      <LancarHorasDialog open={dialogAberto} onOpenChange={setDialogAberto} />

      <ConfirmDialog
        open={confirmAction !== null}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        onConfirm={handleConfirm}
        title={confirmAction ? confirmCopy[confirmAction.type].title : ""}
        description={confirmAction ? confirmCopy[confirmAction.type].description : ""}
        itemName={confirmAction && "nome" in confirmAction ? confirmAction.nome : undefined}
        confirmText={confirmAction ? confirmCopy[confirmAction.type].confirmText : "Confirmar"}
        variant={confirmAction ? confirmCopy[confirmAction.type].variant : "default"}
      />
    </PageLayout>
  );
}
