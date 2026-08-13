import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CalendarClock, CalendarDays, LayoutGrid, List, ListFilter, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { QuadroTrabalho } from "./components/QuadroTrabalho";
import { ListaTrabalho } from "./components/ListaTrabalho";
import { TarefaDialog } from "./components/TarefaDialog";
import { AbaAgenda } from "./components/AbaAgenda";
import { FiltroPessoa, FiltroPill } from "./components/FiltrosTrabalho";
import {
  useMinhaPessoa,
  usePessoasEmpresa,
  useProjetosLite,
  useSetDisciplinaStatus,
  useTarefaMutations,
  type TarefaInput,
  type TarefaItem,
} from "./hooks";
import { useItensTrabalho, type FiltroTipo, type ItemTrabalho } from "./useItensTrabalho";
import { useEtapas, useEtapaMutations, type Etapa } from "./useEtapas";
import { useColunasLista } from "./colunas";
import type { Prioridade } from "./status";

const LS_VISAO = "pilar.meu-trabalho.visao";
const EU = "eu";

type Visao = "lista" | "quadro" | "agenda";
type FiltroData = "todas" | "atrasadas" | "hoje" | "semana" | "sem_prazo";

const TIPO_LABEL: Record<FiltroTipo, string> = {
  tudo: "Tudo",
  tarefa: "Tarefas",
  disciplina: "Disciplinas",
};

const DATA_LABEL: Record<FiltroData, string> = {
  todas: "Tudo",
  atrasadas: "Atrasadas",
  hoje: "Vencem hoje",
  semana: "Próximos 7 dias",
  sem_prazo: "Sem prazo",
};

function noPeriodo(prazo: string | null, filtro: FiltroData): boolean {
  if (filtro === "todas") return true;
  if (filtro === "sem_prazo") return !prazo;
  if (!prazo) return false;
  const d = new Date(`${prazo}T00:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  if (filtro === "atrasadas") return d < hoje;
  if (filtro === "hoje") return d.getTime() === hoje.getTime();
  const fim = new Date(hoje);
  fim.setDate(fim.getDate() + 7);
  return d >= hoje && d <= fim; // semana
}

export default function MeuTrabalho() {
  usePageTitle("Meu trabalho");
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAdmin } = usePermissions();
  const { canView: temProjetos } = useFeatureAccess("projetos");
  const { data: minhaPessoa } = useMinhaPessoa();
  const { data: pessoas } = usePessoasEmpresa();
  const { data: projetos } = useProjetosLite();
  const { data: etapas } = useEtapas();
  const etapaMut = useEtapaMutations();
  const colunas = useColunasLista();
  const [searchParams, setSearchParams] = useSearchParams();

  const [visao, setVisao] = useState<Visao>(() => {
    try {
      const v = localStorage.getItem(LS_VISAO);
      if (v === "agenda") return "agenda";
      if (v === "quadro") return "quadro";
      return "lista";
    } catch {
      return "lista";
    }
  });
  const [tipo, setTipo] = useState<FiltroTipo>(temProjetos ? "tudo" : "tarefa");
  const [filtroData, setFiltroData] = useState<FiltroData>("todas");
  const [busca, setBusca] = useState("");

  const trocarVisao = (v: Visao) => {
    setVisao(v);
    try {
      localStorage.setItem(LS_VISAO, v);
    } catch {
      // sem persistência, sem erro.
    }
  };

  // Filtro de pessoa: só admin escolhe. Não-admin fica preso a si mesmo.
  const filtroPessoa = searchParams.get("pessoa") ?? EU;
  const setFiltroPessoa = (v: string) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (v === EU) next.delete("pessoa");
        else next.set("pessoa", v);
        return next;
      },
      { replace: true }
    );

  const minhaPessoaId = minhaPessoa?.id ?? null;
  const pessoaIdEfetiva = !isAdmin || filtroPessoa === EU ? minhaPessoaId : filtroPessoa;

  const { itens, isLoading, isError } = useItensTrabalho(pessoaIdEfetiva, {
    comDisciplinas: temProjetos,
    tipo,
  });

  const itensFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return itens.filter((i) => {
      if (!noPeriodo(i.prazo, filtroData)) return false;
      if (!termo) return true;
      const numeroTermo = termo.replace(/^#/, "");
      return (
        i.titulo.toLowerCase().includes(termo) ||
        (i.numero != null && String(i.numero) === numeroTermo) ||
        (i.projetoNome?.toLowerCase().includes(termo) ?? false) ||
        i.responsaveis.some((r) => r.nome.toLowerCase().includes(termo)) ||
        i.labels.some((l) => l.toLowerCase().includes(termo))
      );
    });
  }, [itens, busca, filtroData]);

  // --- Cache otimista (o card salta de coluna na hora) ---
  const patchTarefa = (id: string, patch: Record<string, unknown>) =>
    qc.setQueryData(["meu-trabalho", "tarefas", pessoaIdEfetiva], (old: unknown) =>
      Array.isArray(old) ? old.map((t) => (t.id === id ? { ...t, ...patch } : t)) : old
    );
  const patchDisciplina = (id: string, patch: Record<string, unknown>) =>
    qc.setQueryData(["meu-trabalho", "disciplinas", pessoaIdEfetiva], (old: unknown) =>
      Array.isArray(old) ? old.map((d) => (d.id === id ? { ...d, ...patch } : d)) : old
    );

  const { criar, atualizar, excluir } = useTarefaMutations();
  const setDisciplinaStatus = useSetDisciplinaStatus();

  // Arrastou o card para outra coluna (etapa). Tarefa vai para a etapa; disciplina
  // só entra em coluna-âncora (que tem bucket), nunca numa coluna extra.
  const moverItem = async (item: ItemTrabalho, destinoEtapaId: string) => {
    const destino = (etapas ?? []).find((e) => e.id === destinoEtapaId);
    if (!destino) return;
    try {
      if (item.tipo === "tarefa") {
        const patch = destino.bucket ? { etapa_id: destino.id, status: destino.bucket } : { etapa_id: destino.id };
        patchTarefa(item.id, patch);
        await atualizar.mutateAsync({ id: item.id, input: patch });
      } else {
        if (!destino.bucket) {
          toast("Essa coluna é só para tarefas.");
          return;
        }
        patchDisciplina(item.id, { status_bucket: destino.bucket });
        await setDisciplinaStatus.mutateAsync({ disciplinaId: item.id, bucket: destino.bucket });
      }
    } catch {
      qc.invalidateQueries({ queryKey: ["meu-trabalho", item.tipo === "tarefa" ? "tarefas" : "disciplinas"] });
      toast.error("Não deu para mover o card.");
    }
  };

  const mudarPrioridade = async (item: ItemTrabalho, prioridade: Prioridade) => {
    if (item.tipo !== "tarefa") return;
    try {
      patchTarefa(item.id, { prioridade });
      await atualizar.mutateAsync({ id: item.id, input: { prioridade } });
    } catch {
      toast.error("Não deu para mudar a prioridade.");
    }
  };

  const mudarResponsaveis = async (item: ItemTrabalho, pessoaIds: string[]) => {
    if (item.tipo !== "tarefa") return;
    const novos = (pessoas ?? []).filter((p) => pessoaIds.includes(p.id)).map((p) => ({ id: p.id, nome: p.nome }));
    try {
      patchTarefa(item.id, { responsaveis: novos, responsavel_id: pessoaIds[0] ?? null });
      await atualizar.mutateAsync({ id: item.id, input: { responsaveis: pessoaIds } });
    } catch {
      toast.error("Não deu para mudar os responsáveis.");
    }
  };

  const mudarPrazo = async (item: ItemTrabalho, iso: string | null) => {
    if (item.tipo !== "tarefa") return;
    try {
      patchTarefa(item.id, { prazo: iso });
      await atualizar.mutateAsync({ id: item.id, input: { prazo: iso } });
    } catch {
      toast.error("Não deu para mudar o prazo.");
    }
  };

  const mudarProjeto = async (item: ItemTrabalho, projetoId: string | null) => {
    if (item.tipo !== "tarefa") return;
    // Otimista: além do id, atualiza o objeto aninhado para o nome trocar na hora.
    const proj = (projetos ?? []).find((p) => p.id === projetoId) ?? null;
    try {
      patchTarefa(item.id, { projeto_id: projetoId, projeto: proj });
      await atualizar.mutateAsync({ id: item.id, input: { projeto_id: projetoId } });
    } catch {
      toast.error("Não deu para mudar o projeto.");
    }
  };

  const mudarEtiquetas = async (item: ItemTrabalho, labels: string[]) => {
    if (item.tipo !== "tarefa") return;
    try {
      patchTarefa(item.id, { labels });
      await atualizar.mutateAsync({ id: item.id, input: { labels } });
    } catch {
      toast.error("Não deu para mudar as etiquetas.");
    }
  };

  const mudarHoras = async (item: ItemTrabalho, dec: number | null) => {
    if (item.tipo !== "tarefa") return;
    try {
      patchTarefa(item.id, { horas_estimadas: dec });
      await atualizar.mutateAsync({ id: item.id, input: { horas_estimadas: dec } });
    } catch {
      toast.error("Não deu para mudar as horas.");
    }
  };

  const mudarHorasReais = async (item: ItemTrabalho, dec: number | null) => {
    if (item.tipo !== "tarefa") return;
    try {
      patchTarefa(item.id, { horas_reais: dec });
      await atualizar.mutateAsync({ id: item.id, input: { horas_reais: dec } });
    } catch {
      toast.error("Não deu para mudar as horas reais.");
    }
  };

  // Dialog de tarefa
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<TarefaItem | null>(null);
  const [etapaInicial, setEtapaInicial] = useState<string | null>(null);
  const [aExcluir, setAExcluir] = useState<ItemTrabalho | null>(null);

  // Nova tarefa: sem etapa (cai na âncora "A fazer") pelo botão do topo, ou já
  // na coluna clicada quando vem do "+" de um grupo da lista.
  const abrirNova = (etapaId?: string) => {
    setEditando(null);
    setEtapaInicial(etapaId ?? null);
    setDialogOpen(true);
  };

  const abrirItem = (item: ItemTrabalho) => {
    if (item.tipo === "tarefa" && item.tarefa) {
      setEditando(item.tarefa);
      setEtapaInicial(null);
      setDialogOpen(true);
    } else if (item.tipo === "disciplina" && item.projetoId) {
      navigate(`/projetos/${item.projetoId}`);
    }
  };

  const confirmarExclusao = async () => {
    if (!aExcluir) return;
    try {
      await excluir.mutateAsync(aExcluir.id);
      toast.success("Tarefa excluída.");
    } catch {
      toast.error("Não deu para excluir.");
    } finally {
      setAExcluir(null);
    }
  };

  const salvarTarefa = async (input: TarefaInput) => {
    try {
      if (editando) {
        await atualizar.mutateAsync({ id: editando.id, input });
        toast.success("Tarefa atualizada.");
      } else {
        // Nova tarefa nasce na primeira coluna (âncora "A fazer") e, se o campo
        // de responsável vier vazio, atribuída a quem está criando.
        const etapaPadrao = (etapas ?? []).find((e) => e.bucket === "a_fazer") ?? (etapas ?? [])[0];
        await criar.mutateAsync({
          ...input,
          etapa_id: input.etapa_id ?? etapaPadrao?.id ?? null,
          responsaveis: input.responsaveis ?? (minhaPessoaId ? [minhaPessoaId] : []),
        });
        toast.success("Tarefa criada.");
      }
      setDialogOpen(false);
    } catch {
      toast.error("Não deu para salvar a tarefa. Tente de novo.");
    }
  };

  // --- Colunas (etapas) personalizáveis ---
  const [renomeando, setRenomeando] = useState<{ id: string; nome: string } | null>(null);
  const [aEtapaExcluir, setAEtapaExcluir] = useState<Etapa | null>(null);

  // Criação inline (estilo ClickUp): recebe nome + cor do campo no fim das colunas.
  const criarEtapa = async (nome: string, cor: string | null): Promise<boolean> => {
    const limpo = nome.trim();
    if (!limpo) return false;
    const ordem = (etapas ?? []).reduce((m, e) => Math.max(m, e.ordem), -1) + 1;
    try {
      await etapaMut.criar.mutateAsync({ nome: limpo, ordem, cor });
      return true;
    } catch {
      toast.error("Não deu para criar a coluna.");
      return false;
    }
  };

  const salvarRenomear = async () => {
    if (!renomeando) return;
    const nome = renomeando.nome.trim();
    if (!nome) return;
    try {
      await etapaMut.renomear.mutateAsync({ id: renomeando.id, nome });
      setRenomeando(null);
    } catch {
      toast.error("Não deu para renomear a coluna.");
    }
  };

  const reordenarEtapa = async (id: string, dir: -1 | 1) => {
    const lista = [...(etapas ?? [])].sort((a, b) => a.ordem - b.ordem);
    const i = lista.findIndex((e) => e.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= lista.length) return;
    try {
      await etapaMut.reordenar.mutateAsync([
        { id: lista[i].id, ordem: lista[j].ordem },
        { id: lista[j].id, ordem: lista[i].ordem },
      ]);
    } catch {
      toast.error("Não deu para reordenar as colunas.");
    }
  };

  const confirmarExcluirEtapa = async () => {
    if (!aEtapaExcluir) return;
    try {
      await etapaMut.excluir.mutateAsync(aEtapaExcluir.id);
      toast.success('Coluna excluída. As tarefas foram para "A fazer".');
    } catch {
      toast.error("Não deu para excluir a coluna.");
    } finally {
      setAEtapaExcluir(null);
    }
  };

  const autorNome = minhaPessoa?.nome ?? "Eu";

  // Gestão das listas/status (etapas), compartilhada por lista e quadro.
  const etapaControls = {
    etapas: etapas ?? [],
    onCriar: criarEtapa,
    criando: etapaMut.criar.isPending,
    onRenomear: (e: Etapa) => setRenomeando({ id: e.id, nome: e.nome }),
    onExcluir: (e: Etapa) => setAEtapaExcluir(e),
    onReordenar: reordenarEtapa,
  };

  return (
    <PageLayout
      header={
        <PageHeader
          title="Meu trabalho"
          search={
            visao !== "agenda" ? { value: busca, onChange: setBusca, placeholder: "Buscar no meu trabalho" } : undefined
          }
          primaryAction={
            visao !== "agenda" ? { label: "Nova tarefa", icon: Plus, onClick: () => abrirNova() } : undefined
          }
        />
      }
    >
      {/* Toolbar: visão + (no quadro) filtros de tipo e data */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border bg-muted/40 p-0.5">
          <button
            type="button"
            onClick={() => trocarVisao("lista")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-sm transition-colors",
              visao === "lista" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
            )}
          >
            <List className="h-4 w-4" /> Lista
          </button>
          <button
            type="button"
            onClick={() => trocarVisao("quadro")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-sm transition-colors",
              visao === "quadro" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
            )}
          >
            <LayoutGrid className="h-4 w-4" /> Quadro
          </button>
          <button
            type="button"
            onClick={() => trocarVisao("agenda")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-sm transition-colors",
              visao === "agenda" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
            )}
          >
            <CalendarDays className="h-4 w-4" /> Agenda
          </button>
        </div>

        {visao !== "agenda" && (
          <>
            {isAdmin && (
              <FiltroPessoa
                value={filtroPessoa}
                pessoas={pessoas ?? []}
                minhaPessoaId={minhaPessoaId}
                meuNome={autorNome}
                onChange={setFiltroPessoa}
              />
            )}

            {temProjetos && (
              <FiltroPill
                icon={ListFilter}
                value={tipo}
                onChange={(v) => setTipo(v as FiltroTipo)}
                options={(Object.keys(TIPO_LABEL) as FiltroTipo[]).map((t) => ({ value: t, label: TIPO_LABEL[t] }))}
              />
            )}

            <FiltroPill
              icon={CalendarClock}
              value={filtroData}
              onChange={(v) => setFiltroData(v as FiltroData)}
              options={(Object.keys(DATA_LABEL) as FiltroData[]).map((d) => ({ value: d, label: DATA_LABEL[d] }))}
            />
          </>
        )}
      </div>

      {visao === "agenda" ? (
        <AbaAgenda pessoaId={pessoaIdEfetiva} minhaPessoaId={minhaPessoaId} canEdit temProjetos={temProjetos} />
      ) : isLoading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Carregando seu trabalho...</p>
      ) : isError ? (
        <p className="py-12 text-center text-sm text-destructive">Não deu para carregar. Recarregue a página.</p>
      ) : visao === "lista" ? (
        <ListaTrabalho
          itens={itensFiltrados}
          etapas={etapas ?? []}
          pessoas={pessoas ?? []}
          projetos={projetos ?? []}
          colunas={colunas}
          podeEditarResponsavel={isAdmin}
          onAbrir={abrirItem}
          onPrioridade={mudarPrioridade}
          onResponsaveis={mudarResponsaveis}
          onPrazo={mudarPrazo}
          onProjeto={mudarProjeto}
          onEtiquetas={mudarEtiquetas}
          onHoras={mudarHoras}
          onHorasReais={mudarHorasReais}
          onExcluir={setAExcluir}
          onMover={moverItem}
          onCriarNoGrupo={abrirNova}
          etapaControls={etapaControls}
        />
      ) : (
        <QuadroTrabalho
          itens={itensFiltrados}
          onAbrir={abrirItem}
          onPrioridade={mudarPrioridade}
          onExcluir={setAExcluir}
          onMover={moverItem}
          etapaControls={etapaControls}
        />
      )}

      <TarefaDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        tarefa={editando}
        pessoas={pessoas ?? []}
        projetos={projetos ?? []}
        etapas={etapas ?? []}
        defaultEtapaId={etapaInicial}
        defaultResponsavelId={minhaPessoaId}
        podeEscolherResponsavel={isAdmin}
        autorNome={autorNome}
        onSave={salvarTarefa}
        saving={criar.isPending || atualizar.isPending}
      />

      <ConfirmDialog
        open={!!aExcluir}
        onOpenChange={(open) => !open && setAExcluir(null)}
        onConfirm={confirmarExclusao}
        title="Excluir tarefa"
        description="Esta ação não pode ser desfeita."
        itemName={aExcluir?.titulo}
        confirmText="Excluir"
        loading={excluir.isPending}
      />

      <Dialog open={!!renomeando} onOpenChange={(open) => !open && setRenomeando(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Renomear coluna</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="etapa-nome">Nome da coluna</Label>
            <Input
              id="etapa-nome"
              autoFocus
              value={renomeando?.nome ?? ""}
              onChange={(e) => setRenomeando((prev) => (prev ? { ...prev, nome: e.target.value } : prev))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  salvarRenomear();
                }
              }}
              placeholder="Bloqueado, Em revisão, Aprovado..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenomeando(null)}>
              Cancelar
            </Button>
            <Button
              variant="brand"
              onClick={salvarRenomear}
              disabled={!renomeando?.nome.trim() || etapaMut.renomear.isPending}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!aEtapaExcluir}
        onOpenChange={(open) => !open && setAEtapaExcluir(null)}
        onConfirm={confirmarExcluirEtapa}
        title="Excluir coluna"
        description='As tarefas desta coluna não são apagadas: voltam para "A fazer".'
        itemName={aEtapaExcluir?.nome}
        confirmText="Excluir coluna"
        loading={etapaMut.excluir.isPending}
      />
    </PageLayout>
  );
}
