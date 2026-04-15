import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTimesheetsPendentes, useAprovarTimesheet, type TimesheetWithDetails } from "@/hooks/useTimesheets";

export function TimesheetApproval() {
  const { toast } = useToast();
  const { data: pendentes = [], isLoading } = useTimesheetsPendentes();
  const aprovar = useAprovarTimesheet();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleAprovar = (id: string, status: "aprovado" | "rejeitado") => {
    setProcessingId(id);
    aprovar.mutate(
      { id, status },
      {
        onSuccess: () => {
          toast({
            title: status === "aprovado" ? "Timesheet aprovado" : "Timesheet rejeitado",
          });
          setProcessingId(null);
        },
        onError: (error: Error) => {
          toast({
            variant: "destructive",
            title: "Erro",
            description: error.message,
          });
          setProcessingId(null);
        },
      }
    );
  };

  const handleAprovarTodos = () => {
    pendentes.forEach((t) => {
      aprovar.mutate({ id: t.id, status: "aprovado" });
    });
    toast({ title: `${pendentes.length} timesheets aprovados` });
  };

  // Agrupa por pessoa
  const agrupado = pendentes.reduce<Record<string, TimesheetWithDetails[]>>((acc, t) => {
    const key = t.pessoa_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  const formatData = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (pendentes.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
        <p className="text-sm">Nenhum timesheet pendente de aprovação.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {pendentes.length} registro{pendentes.length !== 1 ? "s" : ""} pendente{pendentes.length !== 1 ? "s" : ""}
        </p>
        <Button size="sm" onClick={handleAprovarTodos} disabled={aprovar.isPending}>
          <CheckCircle2 className="h-4 w-4 mr-1" />
          Aprovar Todos
        </Button>
      </div>

      {Object.entries(agrupado).map(([pessoaId, entries]) => {
        const pessoaNome = entries[0]?.pessoa_nome || "—";
        const totalHoras = entries.reduce((sum, e) => sum + Number(e.horas), 0);

        return (
          <Card key={pessoaId}>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <span>{pessoaNome}</span>
                <Badge variant="secondary">{totalHoras.toFixed(1)}h total</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Data</TableHead>
                    <TableHead className="text-xs">Projeto</TableHead>
                    <TableHead className="text-xs">Disciplina</TableHead>
                    <TableHead className="text-xs text-center">Horas</TableHead>
                    <TableHead className="text-xs text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-xs py-2">{formatData(entry.data)}</TableCell>
                      <TableCell className="text-xs py-2">
                        <span className="font-medium">{entry.projeto_codigo}</span>
                        <span className="text-muted-foreground ml-1">- {entry.projeto_nome}</span>
                      </TableCell>
                      <TableCell className="text-xs py-2">{entry.disciplina}</TableCell>
                      <TableCell className="text-xs py-2 text-center font-medium">
                        {Number(entry.horas).toFixed(1)}h
                      </TableCell>
                      <TableCell className="text-xs py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => handleAprovar(entry.id, "aprovado")}
                            disabled={processingId === entry.id}
                          >
                            {processingId === entry.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleAprovar(entry.id, "rejeitado")}
                            disabled={processingId === entry.id}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
