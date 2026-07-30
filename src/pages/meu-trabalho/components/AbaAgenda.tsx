import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  type CamadaId,
  type PrazoEvento,
  buildEventosDisciplinas,
  buildEventosTarefas,
  filtrarVisiveis,
  groupByDia,
} from "@/components/calendario/eventos";
import {
  VIEW_LABEL,
  type CalendarioView,
  labelPeriodo,
  useCalendarioNav,
  useCamadasVisiveis,
  useDiasComEvento,
} from "@/components/calendario/useCalendario";
import { CalendarioSidebar } from "@/components/calendario/CalendarioSidebar";
import { CalendarioLegenda } from "@/components/calendario/EventoItem";
import { MesView } from "@/components/calendario/MesView";
import { SemanaView } from "@/components/calendario/SemanaView";
import { AgendaView } from "@/components/calendario/AgendaView";
import {
  usePessoasEmpresa,
  useProjetosLite,
  useDisciplinas,
  useTarefas,
  useTarefaMutations,
  type TarefaInput,
  type TarefaItem,
} from "../hooks";
import { TarefaDialog } from "./TarefaDialog";

type Props = {
  pessoaId: string | null;
  minhaPessoaId: string | null;
  canEdit: boolean;
  /** Empresa só-Gestão (sem módulo Projetos) não tem camada de disciplinas. */
  temProjetos: boolean;
};

/**
 * Aba Agenda: o mesmo motor do /calendario, mas com escopo pessoal. Mostra as
 * minhas disciplinas e as minhas tarefas com prazo, cada uma numa camada que dá
 * pra ligar/desligar. Clicar numa tarefa abre a edição; numa disciplina, o
 * projeto de origem.
 */
export function AbaAgenda({ pessoaId, minhaPessoaId, canEdit, temProjetos }: Props) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: disciplinas } = useDisciplinas(temProjetos ? pessoaId : null, { enabled: temProjetos });
  const { data: tarefas } = useTarefas(pessoaId);
  const { data: pessoas } = usePessoasEmpresa();
  const { data: projetos } = useProjetosLite();
  const { atualizar } = useTarefaMutations();

  const camadas: CamadaId[] = temProjetos ? ["disciplina", "tarefa"] : ["tarefa"];
  const { cursor, setCursor, view, setView, step, goHoje } = useCalendarioNav();
  const { visiveis, toggle } = useCamadasVisiveis({ disciplina: true, tarefa: true });

  const [tarefaAberta, setTarefaAberta] = useState<TarefaItem | null>(null);

  const eventos = useMemo(() => {
    const eventosDisc = buildEventosDisciplinas(
      (disciplinas ?? []).map((d) => ({
        id: d.id,
        titulo: d.titulo,
        prazo: d.prazo,
        concluida: d.status_bucket === "concluida",
        projetoId: d.projeto_id,
        projetoNome: d.projeto_nome,
      }))
    );
    const eventosTar = buildEventosTarefas(
      (tarefas ?? []).map((t) => ({
        id: t.id,
        titulo: t.titulo,
        prazo: t.prazo,
        concluida: t.status === "concluida",
        projetoNome: t.projeto?.nome ?? null,
      }))
    );
    return filtrarVisiveis([...eventosDisc, ...eventosTar], visiveis);
  }, [disciplinas, tarefas, visiveis]);

  const eventosPorDia = useMemo(() => groupByDia(eventos), [eventos]);
  const diasComEvento = useDiasComEvento(eventosPorDia);

  const abrirEvento = (evento: PrazoEvento) => {
    if (evento.camada === "tarefa") {
      const t = (tarefas ?? []).find((x) => x.id === evento.id);
      if (t) setTarefaAberta(t);
      return;
    }
    if (evento.projetoId) navigate(`/projetos/${evento.projetoId}`);
  };

  const salvarTarefa = async (input: TarefaInput) => {
    if (!tarefaAberta) return;
    try {
      await atualizar.mutateAsync({ id: tarefaAberta.id, input });
      toast({ description: "Tarefa atualizada." });
      setTarefaAberta(null);
    } catch {
      toast({ variant: "destructive", description: "Não deu para salvar a tarefa. Tente de novo." });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => step(-1)} aria-label="Anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[150px] text-center">{labelPeriodo(view, cursor)}</span>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => step(1)} aria-label="Próximo">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="ml-1 h-9 text-sm rounded-full" onClick={goHoje}>
            Hoje
          </Button>
        </div>

        <Select value={view} onValueChange={(v) => setView(v as CalendarioView)}>
          <SelectTrigger className="w-[120px] h-9 text-sm rounded-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(VIEW_LABEL) as CalendarioView[]).map((v) => (
              <SelectItem key={v} value={v}>
                {VIEW_LABEL[v]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-4 rounded-lg border bg-white overflow-hidden min-h-[480px]">
        <CalendarioSidebar
          selecionado={cursor}
          diasComEvento={diasComEvento}
          onSelectDate={setCursor}
          camadas={camadas}
          visiveis={visiveis}
          onToggleCamada={toggle}
        />
        <div className="flex-1 min-w-0 p-4 space-y-4 overflow-y-auto">
          <CalendarioLegenda camadas={camadas} />
          {view === "mes" && <MesView cursor={cursor} eventosPorDia={eventosPorDia} onEventoClick={abrirEvento} />}
          {view === "semana" && (
            <SemanaView cursor={cursor} eventosPorDia={eventosPorDia} onEventoClick={abrirEvento} />
          )}
          {view === "agenda" && <AgendaView cursor={cursor} eventos={eventos} onEventoClick={abrirEvento} />}
        </div>
      </div>

      <TarefaDialog
        open={!!tarefaAberta}
        onOpenChange={(open) => !open && setTarefaAberta(null)}
        tarefa={tarefaAberta}
        pessoas={pessoas ?? []}
        projetos={projetos ?? []}
        defaultResponsavelId={minhaPessoaId}
        autorNome={(pessoas ?? []).find((p) => p.id === minhaPessoaId)?.nome ?? "Eu"}
        onSave={salvarTarefa}
        saving={atualizar.isPending}
        readOnly={!canEdit}
      />
    </div>
  );
}
