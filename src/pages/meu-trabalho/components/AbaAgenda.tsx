import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ViewSwitcher } from "@/components/ViewSwitcher";
import { useIsMobile } from "@/hooks/use-mobile";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
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
import { useEtapas } from "../useEtapas";
import { TarefaDialog } from "./TarefaDialog";
import { NovaTarefaNoDia, type NovaTarefaNoDiaDados } from "./NovaTarefaNoDia";

type Props = {
  pessoaIds: string[] | null;
  minhaPessoaId: string | null;
  canEdit: boolean;
  /** Empresa só-Gestão (sem módulo Projetos) não tem camada de disciplinas. */
  temProjetos: boolean;
  /** Só admin escolhe o responsável de uma tarefa nova (igual ao formulário completo). */
  podeEscolherResponsavel?: boolean;
};

/**
 * Aba Agenda: o mesmo motor do /calendario, mas com escopo pessoal. Mostra as
 * minhas disciplinas e as minhas tarefas com prazo, cada uma numa camada que dá
 * pra ligar/desligar. Clicar numa tarefa abre a edição; numa disciplina, o
 * projeto de origem.
 */
export function AbaAgenda({ pessoaIds, minhaPessoaId, canEdit, temProjetos, podeEscolherResponsavel = false }: Props) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { data: disciplinas } = useDisciplinas(temProjetos ? pessoaIds : null, { enabled: temProjetos });
  const { data: tarefas } = useTarefas(pessoaIds);
  const { data: pessoas } = usePessoasEmpresa();
  const { data: projetos } = useProjetosLite();
  const { data: etapas } = useEtapas();
  const { atualizar, criar } = useTarefaMutations();

  const camadas: CamadaId[] = temProjetos ? ["disciplina", "tarefa"] : ["tarefa"];
  const { cursor, setCursor, view, setView, step, goHoje } = useCalendarioNav();
  const { visiveis, toggle } = useCamadasVisiveis({ disciplina: true, tarefa: true });

  const [tarefaAberta, setTarefaAberta] = useState<TarefaItem | null>(null);
  // Formulário completo aberto pelo "Mais campos" do quadro curto: nasce com o prazo do dia.
  const [novaNoDia, setNovaNoDia] = useState<{ prazo: string; titulo: string } | null>(null);

  // Mês/Semana usam grid de 7 colunas fixas: ilegível em 390px (achado da
  // auditoria mobile). Agenda já é responsiva, então em mobile ela é a única
  // opção; a view muda sozinha se o usuário girar a tela ou entrar direto
  // pelo celular com uma view salva de outra sessão em desktop.
  useEffect(() => {
    if (isMobile && view !== "agenda") setView("agenda");
  }, [isMobile, view, setView]);

  const eventos = useMemo(() => {
    const eventosDisc = buildEventosDisciplinas(
      (disciplinas ?? []).map((d) => ({
        id: d.id,
        titulo: d.titulo,
        prazo: d.prazo,
        concluida: d.status_bucket === "concluida",
        pausada: /pausad/i.test(d.status_raw ?? ""),
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
    if (evento.projetoId) navigate(`/projetos/${evento.projetoId}?disciplina=${evento.id}`);
  };

  const salvarTarefa = async (input: TarefaInput): Promise<string | null> => {
    try {
      if (!tarefaAberta) {
        const id = await criar.mutateAsync(input);
        toast.success("Tarefa criada.");
        setNovaNoDia(null);
        return id;
      }
      await atualizar.mutateAsync({ id: tarefaAberta.id, input });
      toast.success("Tarefa atualizada.");
      setTarefaAberta(null);
      return tarefaAberta.id;
    } catch {
      toast.error("Não deu para salvar a tarefa. Tente de novo.");
      return null;
    }
  };

  // Quadro curto do "+" de um dia: grava na primeira coluna (A fazer) com o prazo do dia.
  const etapaInicial = (etapas ?? []).find((e) => e.bucket === "a_fazer") ?? (etapas ?? [])[0];
  const criarNoDia = async (dia: Date, dados: NovaTarefaNoDiaDados): Promise<boolean> => {
    try {
      await criar.mutateAsync({
        titulo: dados.titulo,
        status: "a_fazer",
        etapa_id: etapaInicial?.id ?? null,
        prazo: format(dia, "yyyy-MM-dd"),
        responsaveis: dados.responsavelId ? [dados.responsavelId] : [],
        projeto_id: dados.projetoId,
      });
      toast.success(`Tarefa criada para ${format(dia, "d/MM")}.`);
      return true;
    } catch {
      toast.error("Não deu para criar a tarefa. Tente de novo.");
      return false;
    }
  };

  const renderNovoNoDia = canEdit
    ? (dia: Date, fechar: () => void) => (
        <NovaTarefaNoDia
          rotuloDia={dia.toLocaleDateString("pt-BR", { day: "numeric", month: "long" })}
          rotuloPrazo={dia.toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" })}
          pessoas={pessoas ?? []}
          projetos={projetos ?? []}
          minhaPessoaId={minhaPessoaId}
          podeEscolherResponsavel={podeEscolherResponsavel}
          onCriar={(dados) => criarNoDia(dia, dados)}
          onMaisCampos={(titulo) => {
            setNovaNoDia({ prazo: format(dia, "yyyy-MM-dd"), titulo });
            fechar();
          }}
          onFechar={fechar}
        />
      )
    : undefined;

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

        {/* Mês/Semana ficam ilegíveis em 390px (grid de 7 colunas fixas); em
            mobile só Agenda é oferecida, então o seletor vira redundante. */}
        {!isMobile && (
          <ViewSwitcher
            options={(Object.keys(VIEW_LABEL) as CalendarioView[]).map((v) => ({ value: v, label: VIEW_LABEL[v] }))}
            value={view}
            onChange={setView}
            ariaLabel="Modo do calendário"
          />
        )}
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
          {view === "mes" && (
            <MesView
              cursor={cursor}
              eventosPorDia={eventosPorDia}
              onEventoClick={abrirEvento}
              renderNovoNoDia={renderNovoNoDia}
            />
          )}
          {view === "semana" && (
            <SemanaView cursor={cursor} eventosPorDia={eventosPorDia} onEventoClick={abrirEvento} />
          )}
          {view === "agenda" && (
            <AgendaView
              cursor={cursor}
              eventos={eventos}
              onEventoClick={abrirEvento}
              renderNovoNoDia={renderNovoNoDia}
            />
          )}
        </div>
      </div>

      <TarefaDialog
        open={!!tarefaAberta || !!novaNoDia}
        onOpenChange={(open) => {
          if (open) return;
          setTarefaAberta(null);
          setNovaNoDia(null);
        }}
        tarefa={tarefaAberta}
        defaultPrazo={novaNoDia?.prazo}
        defaultTitulo={novaNoDia?.titulo}
        defaultEtapaId={etapaInicial?.id}
        podeEscolherResponsavel={podeEscolherResponsavel}
        pessoas={pessoas ?? []}
        projetos={projetos ?? []}
        etapas={etapas ?? []}
        defaultResponsavelId={minhaPessoaId}
        autorNome={(pessoas ?? []).find((p) => p.id === minhaPessoaId)?.nome ?? "Eu"}
        onSave={salvarTarefa}
        saving={atualizar.isPending || criar.isPending}
        readOnly={!canEdit}
      />
    </div>
  );
}
