// Visão em lista de "Meu trabalho", no formato compacto do ClickUp: as colunas
// (etapas) do board viram seções colapsáveis; cada item é uma linha densa com
// células editáveis inline (responsável, prazo, prioridade) e clique na linha
// para abrir. As colunas exibidas são personalizáveis (spec 014 / colunas.ts).
import { useState } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Link2,
  MessageSquare,
  MoreHorizontal,
  MoreVertical,
  Pencil,
  Plus,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { agruparPorEtapa, type ItemTrabalho } from "../useItensTrabalho";
import type { Etapa } from "../useEtapas";
import type { PessoaOpcao } from "../hooks";
import { corDaEtapa, CORES_ETAPA, type Prioridade } from "../status";
import type { EtapaControls } from "./QuadroTrabalho";
import { COLUNAS_ORDEM, COLUNA_LABEL, COLUNA_LARGURA, type ColunaLista, type ColunasLista } from "../colunas";
import { EtiquetasCell, HorasCell, PrazoCell, PrioridadeCell, ProjetoCell, ResponsavelCell } from "./CelulasLista";

type Props = {
  itens: ItemTrabalho[];
  etapas: Etapa[];
  pessoas: PessoaOpcao[];
  projetos: PessoaOpcao[];
  colunas: ColunasLista;
  /** Só admin reatribui responsável; os demais veem só leitura. */
  podeEditarResponsavel: boolean;
  onAbrir: (item: ItemTrabalho) => void;
  onPrioridade: (item: ItemTrabalho, prioridade: Prioridade) => void;
  onResponsaveis: (item: ItemTrabalho, pessoaIds: string[]) => void;
  onPrazo: (item: ItemTrabalho, iso: string | null) => void;
  onProjeto: (item: ItemTrabalho, projetoId: string | null) => void;
  onEtiquetas: (item: ItemTrabalho, labels: string[]) => void;
  onHoras: (item: ItemTrabalho, dec: number | null) => void;
  onHorasReais: (item: ItemTrabalho, dec: number | null) => void;
  onExcluir: (item: ItemTrabalho) => void;
  /** Arrastou a linha para outra coluna: destino = id da etapa alvo. */
  onMover: (item: ItemTrabalho, destinoEtapaId: string) => void;
  /** Clicou no "+" do grupo: cria uma tarefa já naquela coluna (etapa). */
  onCriarNoGrupo: (etapaId: string) => void;
  /** Gestão das listas/status (criar, renomear, reordenar, excluir) — igual ao quadro. */
  etapaControls: EtapaControls;
};

function estaAtrasado(prazo: string | null, concluida: boolean): boolean {
  if (!prazo || concluida) return false;
  const d = new Date(`${prazo}T00:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return d < hoje;
}

function gridTemplate(ativas: ColunaLista[]): string {
  const cols = ativas.map((c) => COLUNA_LARGURA[c]).join(" ");
  // Nome cresce, mas não come todo o espaço: as colunas de conteúdo dividem a
  // sobra em vez de ficarem espremidas na direita (evita o "tudo colado").
  return `minmax(240px, 1.6fr) ${cols} 36px`;
}

export function SeletorColunas({ colunas }: { colunas: ColunasLista }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <SlidersHorizontal className="h-3.5 w-3.5" /> Colunas
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="text-xs">Mostrar colunas</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {COLUNAS_ORDEM.map((c) => (
          <DropdownMenuCheckboxItem
            key={c}
            checked={colunas.visiveis[c]}
            onCheckedChange={() => colunas.alternar(c)}
            onSelect={(e) => e.preventDefault()}
          >
            {COLUNA_LABEL[c]}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// "Add group" ao estilo ClickUp, versão lista: campo inline com nome + cor.
function NovaListaInline({ onCriar, criando }: Pick<EtapaControls, "onCriar" | "criando">) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState<string>(CORES_ETAPA[0]);

  const fechar = () => {
    setAberto(false);
    setNome("");
    setCor(CORES_ETAPA[0]);
  };

  const criar = async () => {
    if (!nome.trim() || criando) return;
    const ok = await onCriar(nome, cor);
    if (ok) fechar();
  };

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="flex h-10 w-full items-center gap-1.5 rounded-lg border border-dashed px-4 text-sm text-muted-foreground transition-colors hover:border-brand/50 hover:text-foreground"
      >
        <Plus className="h-4 w-4" /> Nova lista
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border bg-card p-3 shadow-sm">
      <Input
        autoFocus
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            criar();
          } else if (e.key === "Escape") {
            fechar();
          }
        }}
        placeholder="Nome da lista (ex.: Em revisão, Bloqueado...)"
        className="h-9 max-w-sm"
      />
      <div className="flex flex-wrap gap-1.5">
        {CORES_ETAPA.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCor(c)}
            aria-label={`Cor ${c}`}
            className={cn(
              "h-5 w-5 rounded-full ring-offset-2 ring-offset-card transition-shadow",
              cor === c && "ring-2 ring-foreground/60"
            )}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="brand" size="sm" className="h-8" onClick={criar} disabled={!nome.trim() || criando}>
          Adicionar
        </Button>
        <Button variant="ghost" size="sm" className="h-8" onClick={fechar}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

type LinhaProps = {
  item: ItemTrabalho;
  ativas: ColunaLista[];
  template: string;
  pessoas: PessoaOpcao[];
  projetos: PessoaOpcao[];
  podeEditarResponsavel: boolean;
  handlers: CelulaHandlers;
  onAbrir: (item: ItemTrabalho) => void;
  onExcluir: (item: ItemTrabalho) => void;
};

type CelulaHandlers = {
  onPrioridade: (item: ItemTrabalho, prioridade: Prioridade) => void;
  onResponsaveis: (item: ItemTrabalho, pessoaIds: string[]) => void;
  onPrazo: (item: ItemTrabalho, iso: string | null) => void;
  onProjeto: (item: ItemTrabalho, projetoId: string | null) => void;
  onEtiquetas: (item: ItemTrabalho, labels: string[]) => void;
  onHoras: (item: ItemTrabalho, dec: number | null) => void;
  onHorasReais: (item: ItemTrabalho, dec: number | null) => void;
};

function CelulaColuna({
  coluna,
  item,
  pessoas,
  projetos,
  podeEditarResponsavel,
  handlers,
}: {
  coluna: ColunaLista;
  item: ItemTrabalho;
  pessoas: PessoaOpcao[];
  projetos: PessoaOpcao[];
  podeEditarResponsavel: boolean;
  handlers: CelulaHandlers;
}) {
  const ehTarefa = item.tipo === "tarefa";
  switch (coluna) {
    case "projeto":
      return (
        <ProjetoCell
          projetoId={item.projetoId}
          projetoNome={item.projetoNome}
          projetos={projetos}
          editavel={ehTarefa}
          onChange={(id) => handlers.onProjeto(item, id)}
        />
      );
    case "responsavel":
      return (
        <ResponsavelCell
          responsaveis={item.responsaveis}
          pessoas={pessoas}
          editavel={ehTarefa && podeEditarResponsavel}
          onChange={(pessoaIds) => handlers.onResponsaveis(item, pessoaIds)}
        />
      );
    case "prazo":
      return (
        <PrazoCell
          prazo={item.prazo}
          atrasado={estaAtrasado(item.prazo, item.status === "concluida")}
          editavel={ehTarefa}
          onChange={(iso) => handlers.onPrazo(item, iso)}
        />
      );
    case "prioridade":
      return (
        <PrioridadeCell
          prioridade={item.prioridade}
          editavel={ehTarefa}
          onChange={(p) => handlers.onPrioridade(item, p)}
        />
      );
    case "etiquetas":
      return (
        <EtiquetasCell
          labels={item.labels}
          editavel={ehTarefa}
          onChange={(labels) => handlers.onEtiquetas(item, labels)}
        />
      );
    case "horas":
      return (
        <HorasCell valor={item.horasEstimadas} editavel={ehTarefa} onChange={(dec) => handlers.onHoras(item, dec)} />
      );
    case "horasreais":
      return (
        <HorasCell valor={item.horasReais} editavel={ehTarefa} onChange={(dec) => handlers.onHorasReais(item, dec)} />
      );
    default:
      return null;
  }
}

function Linha({
  item,
  ativas,
  template,
  pessoas,
  projetos,
  podeEditarResponsavel,
  handlers,
  onAbrir,
  onExcluir,
}: LinhaProps) {
  const ehTarefa = item.tipo === "tarefa";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onAbrir(item)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onAbrir(item);
      }}
      style={{ gridTemplateColumns: template }}
      className="group grid cursor-pointer items-center gap-4 border-b px-4 py-2 text-sm last:border-b-0 hover:bg-muted/50"
    >
      {/* Nome + tipo + contadores */}
      <div className="flex min-w-0 items-center gap-2">
        {item.numero != null && (
          <span className="shrink-0 font-mono text-xs text-muted-foreground/70">#{item.numero}</span>
        )}
        <span className="truncate text-foreground">{item.titulo}</span>
        <Badge variant="outline" className="shrink-0 text-[10px] font-normal text-muted-foreground">
          {ehTarefa ? "Tarefa" : "Disciplina"}
        </Badge>
        {(item.comentarios > 0 || item.links > 0) && (
          <span className="ml-0.5 hidden shrink-0 items-center gap-2 text-[11px] text-muted-foreground sm:inline-flex">
            {item.comentarios > 0 && (
              <span className="inline-flex items-center gap-0.5">
                <MessageSquare className="h-3 w-3" />
                {item.comentarios}
              </span>
            )}
            {item.links > 0 && (
              <span className="inline-flex items-center gap-0.5">
                <Link2 className="h-3 w-3" />
                {item.links}
              </span>
            )}
          </span>
        )}
      </div>

      {/* Colunas dinâmicas */}
      {ativas.map((coluna) => (
        <div key={coluna} className="min-w-0">
          <CelulaColuna
            coluna={coluna}
            item={item}
            pessoas={pessoas}
            projetos={projetos}
            podeEditarResponsavel={podeEditarResponsavel}
            handlers={handlers}
          />
        </div>
      ))}

      {/* Ações */}
      <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
        {ehTarefa && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
                aria-label="Ações da tarefa"
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onAbrir(item)}>
                <Pencil className="mr-2 h-4 w-4" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onExcluir(item)}>
                <Trash2 className="mr-2 h-4 w-4" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}

export function ListaTrabalho({
  itens,
  etapas,
  pessoas,
  projetos,
  colunas,
  podeEditarResponsavel,
  onAbrir,
  onPrioridade,
  onResponsaveis,
  onPrazo,
  onProjeto,
  onEtiquetas,
  onHoras,
  onHorasReais,
  onExcluir,
  onMover,
  onCriarNoGrupo,
  etapaControls,
}: Props) {
  const grupos = agruparPorEtapa(itens, etapas);
  const [colapsados, setColapsados] = useState<Set<string>>(new Set());
  const ativas = colunas.ativas;
  const template = gridTemplate(ativas);
  const handlers: CelulaHandlers = {
    onPrioridade,
    onResponsaveis,
    onPrazo,
    onProjeto,
    onEtiquetas,
    onHoras,
    onHorasReais,
  };

  const toggle = (chave: string) =>
    setColapsados((prev) => {
      const next = new Set(prev);
      if (next.has(chave)) next.delete(chave);
      else next.add(chave);
      return next;
    });

  const onDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId) return;
    const item = itens.find((i) => i.key === draggableId);
    if (!item) return;
    onMover(item, destination.droppableId);
  };

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[760px] space-y-4">
        <DragDropContext onDragEnd={onDragEnd}>
          {grupos.map((grupo, idx) => {
            const etapa = etapas.find((e) => e.id === grupo.chave);
            const aberto = !colapsados.has(grupo.chave);
            const podeExcluir = etapa != null && etapa.bucket == null; // âncora de status não sai
            // Uma tabela por status: cada grupo é um card próprio, com seu
            // cabeçalho de colunas e suas linhas.
            return (
              <section key={grupo.chave} className="overflow-hidden rounded-lg border bg-background">
                <div className="group/cab flex items-center gap-1 border-b bg-muted/30 px-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => toggle(grupo.chave)}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-0.5 text-left hover:bg-muted/50"
                  >
                    {aberto ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: corDaEtapa(etapa?.cor ?? null, etapa?.bucket ?? null) }}
                    />
                    <span className="truncate text-sm font-medium text-foreground">{grupo.titulo}</span>
                    <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground">
                      {grupo.itens.length}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onCriarNoGrupo(grupo.chave)}
                    className="flex h-6 items-center gap-1 rounded-md px-1.5 text-xs text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover/cab:opacity-100"
                    aria-label={`Nova tarefa em ${grupo.titulo}`}
                  >
                    <Plus className="h-3.5 w-3.5" /> Tarefa
                  </button>
                  {etapa && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" aria-label="Ações da lista">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => etapaControls.onRenomear(etapa)}>
                          <Pencil className="mr-2 h-4 w-4" /> Renomear
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled={idx === 0} onClick={() => etapaControls.onReordenar(etapa.id, -1)}>
                          <ChevronUp className="mr-2 h-4 w-4" /> Mover para cima
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={idx >= grupos.length - 1}
                          onClick={() => etapaControls.onReordenar(etapa.id, 1)}
                        >
                          <ChevronDown className="mr-2 h-4 w-4" /> Mover para baixo
                        </DropdownMenuItem>
                        {podeExcluir && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => etapaControls.onExcluir(etapa)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Excluir lista
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                {aberto && (
                  <>
                    {/* Cabeçalho das colunas desta tabela */}
                    {grupo.itens.length > 0 && (
                      <div
                        style={{ gridTemplateColumns: template }}
                        className="grid items-center gap-4 border-b bg-muted/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                      >
                        <span>Nome</span>
                        {ativas.map((c) => (
                          <span key={c}>{COLUNA_LABEL[c]}</span>
                        ))}
                        <span />
                      </div>
                    )}

                    <Droppable droppableId={grupo.chave}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={cn(
                            "transition-colors",
                            snapshot.isDraggingOver && "bg-brand/5 ring-2 ring-inset ring-brand/40"
                          )}
                        >
                          {grupo.itens.length === 0 && !snapshot.isDraggingOver ? (
                            <button
                              type="button"
                              onClick={() => onCriarNoGrupo(grupo.chave)}
                              className="flex w-full items-center gap-1.5 px-4 py-2.5 text-left text-xs text-muted-foreground/70 hover:bg-muted/40 hover:text-foreground"
                            >
                              <Plus className="h-3.5 w-3.5" /> Nova tarefa
                            </button>
                          ) : (
                            grupo.itens.map((item, index) => (
                              <Draggable key={item.key} draggableId={item.key} index={index}>
                                {(dragProvided, dragSnapshot) => (
                                  <div
                                    ref={dragProvided.innerRef}
                                    {...dragProvided.draggableProps}
                                    {...dragProvided.dragHandleProps}
                                    className={cn(dragSnapshot.isDragging && "rounded-md bg-card opacity-90 shadow-md")}
                                  >
                                    <Linha
                                      item={item}
                                      ativas={ativas}
                                      template={template}
                                      pessoas={pessoas}
                                      projetos={projetos}
                                      podeEditarResponsavel={podeEditarResponsavel}
                                      handlers={handlers}
                                      onAbrir={onAbrir}
                                      onExcluir={onExcluir}
                                    />
                                  </div>
                                )}
                              </Draggable>
                            ))
                          )}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </>
                )}
              </section>
            );
          })}
        </DragDropContext>

        <NovaListaInline onCriar={etapaControls.onCriar} criando={etapaControls.criando} />
      </div>
    </div>
  );
}
