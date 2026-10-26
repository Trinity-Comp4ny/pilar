import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CalendarClock, CalendarDays, LayoutGrid, List, ListFilter, Plus } from "lucide-react";
import { PilarPage } from "@/components/PilarPage";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EditColumnDialog, type ColunaEditavel } from "@/components/kanban/EditColumnDialog";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { QuadroTrabalho } from "./components/QuadroTrabalho";
import { TAREFAS_SORT_ACESSORES, TAREFAS_SORT_KEYS, TAREFAS_SORT_PADRAO } from "./ordenacao";
import { KanbanSortControl } from "@/components/kanban/KanbanSortControl";
import { useKanbanSort } from "@/hooks/useKanbanSort";
import { ordenarKanban } from "@/lib/kanbanSort";
import { ListaTrabalho, SeletorColunas } from "./components/ListaTrabalho";
import { TarefaDialog } from "./components/TarefaDialog";
import { AbaAgenda } from "./components/AbaAgenda";
import { ViewSwitcher, type ViewOption } from "@/components/ViewSwitcher";
import { FilterBar, FilterClear, FilterSelect } from "@/components/filters/FilterBar";
import { FiltroPessoa } from "./components/FiltrosTrabalho";
import {
  disciplinasQueryKey,
  tarefasQueryKey,
  useMinhaPessoa,
  usePessoasEmpresa,
  useProjetosLite,
  useSetDisciplinaStatus,
  useTarefaMutations,
  useTarefaPorId,
  type TarefaInput,
  type TarefaItem,
} from "./hooks";
import { resolverPessoaIds } from "./filtroPessoas";
import { useItensTrabalho, type FiltroTipo, type ItemTrabalho } from "./useItensTrabalho";
import { useEtapas, useEtapaMutations, type Etapa } from "./useEtapas";
import { useColunasLista } from "./colunas";
import { CORES_ETAPA, corDaEtapa, type Prioridade } from "./status";

import { PageLoader } from "@/components/motion/PageLoader";
const LS_VISAO = "pilar.meu-trabalho.visao";

type Visao = "lista" | "quadro" | "agenda";
type FiltroData = "todas" | "atrasadas" | "hoje" | "semana" | "sem_prazo";

const VISAO_OPCOES: ViewOption<Visao>[] = [
  { value: "lista", label: "Lista", icon: List },
  { value: "quadro", label: "Quadro", icon: LayoutGrid },
  { value: "agenda", label: "Agenda", icon: CalendarDays },
];

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
  usePageTitle("Tarefas");
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAdmin, role } = usePermissions();
  // Todos veem as tarefas de todos (RLS libera a empresa inteira). Editar fica com
  // admin/coordenador, o criador e os responsáveis (ver `bloqueado`).
  const podeGerenciarTudo = isAdmin || role === "coordenador";
  const { canView: temProjetos } = useFeatureAccess("projetos");
  const { profile } = useAuth();
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
  const [ordem, setOrdem] = useKanbanSort("tarefas", TAREFAS_SORT_PADRAO, TAREFAS_SORT_KEYS);

  const trocarVisao = (v: Visao) => {
    setVisao(v);
    try {
      localStorage.setItem(LS_VISAO, v);
    } catch {
      // sem persistência, sem erro.
    }
  };

  // Filtro de pessoa ("meu modo"): qualquer um escolhe, e pode marcar mais de
  // uma. Sem nenhuma marcada = tarefas de todos, inclusive as sem responsável.
  const filtroPessoas = useMemo(() => {
    const raw = searchParams.get("pessoas");
    return raw ? raw.split(",").filter(Boolean) : [];
  }, [searchParams]);
  const setFiltroPessoas = (v: string[]) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (v.length === 0) next.delete("pessoas");
        else next.set("pessoas", v.join(","));
        return next;
      },
      { replace: true }
    );

  // Cai no vínculo pelo profile quando a consulta de "minha pessoa" não resolve:
  // sem isso a mesma conta aparecia duas vezes no filtro.
  const minhaPessoaId =
    minhaPessoa?.id ?? (profile?.id ? (pessoas ?? []).find((p) => p.profileId === profile.id)?.id : undefined) ?? null;
  const pessoaIdsEfetivos = useMemo(
    () => resolverPessoaIds({ filtroPessoas, minhaPessoaId }),
    [filtroPessoas, minhaPessoaId]
  );

  const { itens, isLoading, isError } = useItensTrabalho(pessoaIdsEfetivos, {
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
        (i.obraCaminho?.toLowerCase().includes(termo) ?? false) ||
        i.responsaveis.some((r) => r.nome.toLowerCase().includes(termo)) ||
        i.labels.some((l) => l.toLowerCase().includes(termo))
      );
    });
  }, [itens, busca, filtroData]);

  // A lista usa a mesma ordenação do quadro (o controle "Ordenar" vale para as duas visões).
  const itensOrdenados = useMemo(
    () => ordenarKanban(itensFiltrados, ordem, TAREFAS_SORT_ACESSORES),
    [itensFiltrados, ordem]
  );

  // --- Cache otimista (o card salta de coluna na hora) ---
  const patchTarefa = (id: string, patch: Record<string, unknown>) =>
    qc.setQueryData(tarefasQueryKey(pessoaIdsEfetivos), (old: unknown) =>
      Array.isArray(old) ? old.map((t) => (t.id === id ? { ...t, ...patch } : t)) : old
    );
  const patchDisciplina = (id: string, patch: Record<string, unknown>) =>
    qc.setQueryData(disciplinasQueryKey(pessoaIdsEfetivos), (old: unknown) =>
      Array.isArray(old) ? old.map((d) => (d.id === id ? { ...d, ...patch } : d)) : old
    );

  const { criar, atualizar, excluir } = useTarefaMutations();
  const setDisciplinaStatus = useSetDisciplinaStatus();

  // Tarefa de outra pessoa dá para ver, não para mexer: a RLS só deixa
  // admin/coordenador, o criador e os responsáveis editarem.
  const podeEditarTarefa = (t: TarefaItem) =>
    podeGerenciarTudo ||
    (!!profile?.id && t.created_by === profile.id) ||
    (!!minhaPessoaId && t.responsaveis.some((r) => r.id === minhaPessoaId));
  const bloqueado = (item: ItemTrabalho) => {
    if (item.tipo !== "tarefa" || !item.tarefa || podeEditarTarefa(item.tarefa)) return false;
    toast("Só quem é responsável pode alterar esta tarefa.");
    return true;
  };

  // Arrastou o card para outra coluna (etapa). Tarefa vai para a etapa; disciplina
  // só entra em coluna-âncora (que tem bucket), nunca numa coluna extra.
  const moverItem = async (item: ItemTrabalho, destinoEtapaId: string) => {
    const destino = (etapas ?? []).find((e) => e.id === destinoEtapaId);
    if (!destino || bloqueado(item)) return;
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
    if (item.tipo !== "tarefa" || bloqueado(item)) return;
    try {
      patchTarefa(item.id, { prioridade });
      await atualizar.mutateAsync({ id: item.id, input: { prioridade } });
    } catch {
      toast.error("Não deu para mudar a prioridade.");
    }
  };

  const mudarResponsaveis = async (item: ItemTrabalho, pessoaIds: string[]) => {
    if (item.tipo !== "tarefa" || bloqueado(item)) return;
    const novos = (pessoas ?? []).filter((p) => pessoaIds.includes(p.id)).map((p) => ({ id: p.id, nome: p.nome }));
    try {
      patchTarefa(item.id, { responsaveis: novos, responsavel_id: pessoaIds[0] ?? null });
      await atualizar.mutateAsync({ id: item.id, input: { responsaveis: pessoaIds } });
    } catch {
      toast.error("Não deu para mudar os responsáveis.");
    }
  };

  const mudarPrazo = async (item: ItemTrabalho, iso: string | null) => {
    if (item.tipo !== "tarefa" || bloqueado(item)) return;
    try {
      patchTarefa(item.id, { prazo: iso });
      await atualizar.mutateAsync({ id: item.id, input: { prazo: iso } });
    } catch {
      toast.error("Não deu para mudar o prazo.");
    }
  };

  const mudarProjeto = async (item: ItemTrabalho, projetoId: string | null) => {
    if (item.tipo !== "tarefa" || bloqueado(item)) return;
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
    if (item.tipo !== "tarefa" || bloqueado(item)) return;
    try {
      patchTarefa(item.id, { labels });
      await atualizar.mutateAsync({ id: item.id, input: { labels } });
    } catch {
      toast.error("Não deu para mudar as etiquetas.");
    }
  };

  const mudarHoras = async (item: ItemTrabalho, dec: number | null) => {
    if (item.tipo !== "tarefa" || bloqueado(item)) return;
    try {
      patchTarefa(item.id, { horas_estimadas: dec });
      await atualizar.mutateAsync({ id: item.id, input: { horas_estimadas: dec } });
    } catch {
      toast.error("Não deu para mudar as horas.");
    }
  };

  const mudarHorasReais = async (item: ItemTrabalho, dec: number | null) => {
    if (item.tipo !== "tarefa" || bloqueado(item)) return;
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

  // Link de notificação (spec 103): ?tarefa=<id>[&comentario=<id>] abre a tarefa,
  // mesmo fora do filtro atual da lista, e destaca o comentário.
  const tarefaDoLink = searchParams.get("tarefa");
  const comentarioDoLink = searchParams.get("comentario");
  const tarefaLink = useTarefaPorId(tarefaDoLink);

  const limparLink = () =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("tarefa");
        next.delete("comentario");
        return next;
      },
      { replace: true }
    );

  // Aberta pelo link enquanto o parâmetro estiver na URL; fechar limpa o parâmetro.
  const tarefaDoLinkAberta = tarefaDoLink ? (tarefaLink.data ?? null) : null;
  const tarefaNoDialog = tarefaDoLinkAberta ?? editando;

  useEffect(() => {
    if (!tarefaDoLink || !tarefaLink.isFetched || tarefaLink.data) return;
    toast.error("Você não tem acesso a esta tarefa.", { description: "Peça ao responsável para te incluir." });
    limparLink();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarefaDoLink, tarefaLink.isFetched, tarefaLink.data]);

  const onDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open && tarefaDoLink) limparLink();
  };

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
      navigate(`/projetos/${item.projetoId}?disciplina=${item.id}`);
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

  const salvarTarefa = async (input: TarefaInput): Promise<string | null> => {
    try {
      let id: string;
      if (tarefaNoDialog) {
        await atualizar.mutateAsync({ id: tarefaNoDialog.id, input });
        id = tarefaNoDialog.id;
        toast.success("Tarefa atualizada.");
      } else {
        // Nova tarefa nasce na primeira coluna (âncora "A fazer") e, se o campo
        // de responsável vier vazio, atribuída a quem está criando.
        const etapaPadrao = (etapas ?? []).find((e) => e.bucket === "a_fazer") ?? (etapas ?? [])[0];
        id = await criar.mutateAsync({
          ...input,
          etapa_id: input.etapa_id ?? etapaPadrao?.id ?? null,
          responsaveis: input.responsaveis ?? (minhaPessoaId ? [minhaPessoaId] : []),
        });
        toast.success("Tarefa criada.");
      }
      onDialogOpenChange(false);
      return id;
    } catch {
      toast.error("Não deu para salvar a tarefa. Tente de novo.");
      return null;
    }
  };

  // --- Colunas (etapas) personalizáveis ---
  const [editandoEtapa, setEditandoEtapa] = useState<ColunaEditavel | null>(null);
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

  const salvarEtapa = async ({ id, nome, cor }: ColunaEditavel): Promise<boolean> => {
    try {
      await etapaMut.editar.mutateAsync({ id, nome, cor });
      return true;
    } catch {
      toast.error("Não deu para salvar a coluna.");
      return false;
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
    onEditar: (e: Etapa) => setEditandoEtapa({ id: e.id, nome: e.nome, cor: corDaEtapa(e.cor, e.bucket) }),
    onExcluir: (e: Etapa) => setAEtapaExcluir(e),
    onReordenar: reordenarEtapa,
  };

  const tipoPadrao: FiltroTipo = temProjetos ? "tudo" : "tarefa";
  const filtrosAtivos =
    (filtroPessoas.length > 0 ? 1 : 0) + (temProjetos && tipo !== "tudo" ? 1 : 0) + (filtroData !== "todas" ? 1 : 0);
  const limparFiltros = () => {
    setFiltroPessoas([]);
    setTipo(tipoPadrao);
    setFiltroData("todas");
  };

  // Toolbar (SPEC 124): visão primeiro, depois os filtros; ordenação (quadro) ou colunas (lista) à direita.
  const toolbar = (
    <FilterBar
      end={
        visao === "quadro" ? (
          <KanbanSortControl sort={ordem} onChange={setOrdem} keys={TAREFAS_SORT_KEYS} />
        ) : visao === "lista" ? (
          <>
            <KanbanSortControl sort={ordem} onChange={setOrdem} keys={TAREFAS_SORT_KEYS} />
            <SeletorColunas colunas={colunas} />
          </>
        ) : undefined
      }
    >
      <ViewSwitcher options={VISAO_OPCOES} value={visao} onChange={trocarVisao} iconOnlyOnMobile />
      {visao !== "agenda" && (
        <>
          <FiltroPessoa
            value={filtroPessoas}
            pessoas={pessoas ?? []}
            minhaPessoaId={minhaPessoaId}
            onChange={setFiltroPessoas}
          />
          {temProjetos && (
            <FilterSelect
              label="Tipo"
              icon={ListFilter}
              value={tipo}
              emptyValue="tudo"
              onChange={(v) => setTipo(v as FiltroTipo)}
              options={(Object.keys(TIPO_LABEL) as FiltroTipo[]).map((t) => ({ value: t, label: TIPO_LABEL[t] }))}
            />
          )}
          <FilterSelect
            label="Prazo"
            icon={CalendarClock}
            value={filtroData}
            emptyValue="todas"
            onChange={(v) => setFiltroData(v as FiltroData)}
            options={(Object.keys(DATA_LABEL) as FiltroData[]).map((d) => ({ value: d, label: DATA_LABEL[d] }))}
          />
          <FilterClear count={filtrosAtivos} onClick={limparFiltros} />
        </>
      )}
    </FilterBar>
  );

  return (
    <PilarPage
      title="Tarefas"
      toolbar={toolbar}
      search={
        visao !== "agenda" ? { value: busca, onChange: setBusca, placeholder: "Buscar no meu trabalho" } : undefined
      }
      primaryAction={visao !== "agenda" ? { label: "Nova tarefa", icon: Plus, onClick: () => abrirNova() } : undefined}
    >
      {visao === "agenda" ? (
        <AbaAgenda
          pessoaIds={pessoaIdsEfetivos}
          minhaPessoaId={minhaPessoaId}
          canEdit
          temProjetos={temProjetos}
          podeEscolherResponsavel={isAdmin}
        />
      ) : isLoading ? (
        <PageLoader label="Carregando seu trabalho" />
      ) : isError ? (
        <p className="py-12 text-center text-sm text-destructive">Não deu para carregar. Recarregue a página.</p>
      ) : visao === "lista" ? (
        <ListaTrabalho
          itens={itensOrdenados}
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
          onExcluir={(item) => !bloqueado(item) && setAExcluir(item)}
          onMover={moverItem}
          onCriarNoGrupo={abrirNova}
          etapaControls={etapaControls}
        />
      ) : (
        <QuadroTrabalho
          itens={itensFiltrados}
          sort={ordem}
          onAbrir={abrirItem}
          onPrioridade={mudarPrioridade}
          onExcluir={(item) => !bloqueado(item) && setAExcluir(item)}
          onMover={moverItem}
          etapaControls={etapaControls}
        />
      )}

      <TarefaDialog
        open={dialogOpen || !!tarefaDoLinkAberta}
        onOpenChange={onDialogOpenChange}
        tarefa={tarefaNoDialog}
        pessoas={pessoas ?? []}
        projetos={projetos ?? []}
        etapas={etapas ?? []}
        defaultEtapaId={etapaInicial}
        defaultResponsavelId={minhaPessoaId}
        podeEscolherResponsavel={isAdmin}
        autorNome={autorNome}
        onSave={salvarTarefa}
        saving={criar.isPending || atualizar.isPending}
        comentarioDestacado={comentarioDoLink}
        readOnly={!!tarefaNoDialog && !podeEditarTarefa(tarefaNoDialog)}
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

      <EditColumnDialog
        coluna={editandoEtapa}
        onClose={() => setEditandoEtapa(null)}
        colors={CORES_ETAPA}
        onSave={salvarEtapa}
        isPending={etapaMut.editar.isPending}
        placeholder="Bloqueado, Em revisão, Aprovado..."
      />

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
    </PilarPage>
  );
}
