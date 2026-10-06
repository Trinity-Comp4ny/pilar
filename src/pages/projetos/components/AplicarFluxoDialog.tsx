import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FormDialog } from "@/components/FormDialog";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAplicarFluxoNoProjeto } from "@/hooks/useProjetoDisciplinas";
import { formatDateLocal } from "@/lib/businessDays";
import { errorMessage } from "@/lib/errors";
import { formatDateShort } from "@/lib/format";
import { dataInicioPadraoFluxo, planejarAplicacaoFluxo } from "@/lib/fluxoCascata";
import type { FluxoDisciplinas } from "@/types/fluxoDisciplinas";
import type { ProjetoDisciplinaDB } from "@/types/projetos";
import { FluxoPipelineGraph, type FluxoNodeStatus, type FluxoPipelineStage } from "./FluxoPipelineGraph";

interface AplicarFluxoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projetoId: string;
  projetoDataInicio?: string;
  dbDisciplinas: ProjetoDisciplinaDB[];
  fluxos: FluxoDisciplinas[];
}

function statusVisual(status: string): FluxoNodeStatus {
  if (status === "Concluído") return "concluido";
  if (status === "Em Andamento") return "em_andamento";
  return "nao_iniciado";
}

/**
 * Aplica um fluxo de disciplinas num projeto já criado (spec 101). Disciplina
 * que falta é criada com coluna, datas e checklist; a que já existe com o mesmo
 * nome só entra na coluna e mantém o andamento.
 */
export function AplicarFluxoDialog({
  open,
  onOpenChange,
  projetoId,
  projetoDataInicio,
  dbDisciplinas,
  fluxos,
}: AplicarFluxoDialogProps) {
  const aplicarFluxo = useAplicarFluxoNoProjeto();
  // Montado só enquanto aberto (ver ProjetoDetailTabs): o estado nasce limpo a cada abertura.
  const [fluxoId, setFluxoId] = useState(() => (fluxos.length === 1 ? fluxos[0].id : ""));
  const [dataInicio, setDataInicio] = useState(() =>
    dataInicioPadraoFluxo(projetoDataInicio, formatDateLocal(new Date()))
  );

  const fluxo = fluxos.find((f) => f.id === fluxoId);

  const plano = useMemo(
    () => (fluxo ? planejarAplicacaoFluxo(fluxo.disciplinas, dbDisciplinas, dataInicio || undefined) : null),
    [fluxo, dbDisciplinas, dataInicio]
  );

  const stages = useMemo<FluxoPipelineStage[]>(() => {
    if (!plano) return [];
    const statusPorId = new Map(dbDisciplinas.map((d) => [d.id, d.status]));
    const nodes = [
      ...plano.novas.map((d, i) => ({
        ordem: d.ordem_etapa,
        node: {
          key: `nova-${i}`,
          titulo: d.nome,
          status: "nao_iniciado" as const,
          metaLabel: d.data_fim ? formatDateShort(d.data_fim) : undefined,
          checklistLabel: d.checklist_padrao?.length ? `${d.checklist_padrao.length} itens` : undefined,
        },
      })),
      ...plano.encaixadas.map((d) => ({
        ordem: d.ordem_etapa,
        node: {
          key: d.id,
          titulo: d.nome,
          status: statusVisual(statusPorId.get(d.id) ?? ""),
          metaLabel: "já no projeto",
        },
      })),
    ];
    const ordens = Array.from(new Set(nodes.map((n) => n.ordem))).sort((a, b) => a - b);
    return ordens.map((ordem) => ({
      key: String(ordem),
      titulo: String(ordem),
      nodes: nodes.filter((n) => n.ordem === ordem).map((n) => n.node),
    }));
  }, [plano, dbDisciplinas]);

  const avulsas = plano ? dbDisciplinas.length - plano.encaixadas.length : 0;

  const handleSubmit = async () => {
    if (!fluxo || !plano) return;
    try {
      await aplicarFluxo.mutateAsync({ projetoId, plano });
      toast.success("Fluxo aplicado", {
        description: `${plano.novas.length} disciplina(s) criada(s) e ${plano.encaixadas.length} encaixada(s) em "${fluxo.nome}"`,
      });
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error("Não foi possível aplicar o fluxo", {
        description: `${errorMessage(err)}. Confira as disciplinas antes de tentar de novo: parte pode ter sido gravada.`,
      });
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Aplicar fluxo de disciplinas"
      description="As disciplinas do fluxo entram nas colunas. As que já existem no projeto mantêm status, datas e responsáveis."
      size="lg"
      onSubmit={handleSubmit}
      submitLabel="Aplicar fluxo"
      isPending={aplicarFluxo.isPending}
      submitDisabled={!plano}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="aplicar-fluxo-select">Fluxo</Label>
          <Select value={fluxoId} onValueChange={setFluxoId}>
            <SelectTrigger id="aplicar-fluxo-select" className="h-9">
              <SelectValue placeholder="Selecione um fluxo" />
            </SelectTrigger>
            <SelectContent>
              {fluxos.map((f) => {
                const colunas = new Set(f.disciplinas.map((d) => d.ordem)).size;
                return (
                  <SelectItem key={f.id} value={f.id}>
                    {f.nome} ({colunas} coluna{colunas !== 1 ? "s" : ""})
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="aplicar-fluxo-inicio">Início das disciplinas novas</Label>
          <DatePicker id="aplicar-fluxo-inicio" value={dataInicio} onChange={setDataInicio} />
        </div>
      </div>

      {plano && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {plano.novas.length} nova{plano.novas.length !== 1 ? "s" : ""}
            {plano.encaixadas.length > 0 &&
              `, ${plano.encaixadas.length} já existe${plano.encaixadas.length !== 1 ? "m" : ""} e entra${
                plano.encaixadas.length !== 1 ? "m" : ""
              } na coluna`}
            {avulsas > 0 &&
              `, ${avulsas} fora do fluxo continua${avulsas !== 1 ? "m" : ""} avulsa${avulsas !== 1 ? "s" : ""}`}
            .
          </p>
          {stages.length > 0 && (
            <div className="bg-white border rounded-lg p-3">
              <FluxoPipelineGraph stages={stages} />
            </div>
          )}
        </div>
      )}
    </FormDialog>
  );
}
