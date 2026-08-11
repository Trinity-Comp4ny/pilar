// Visão em lista de "Meu trabalho", no formato compacto do ClickUp: as colunas
// (etapas) do board viram seções colapsáveis; cada item é uma linha densa com
// células editáveis inline (responsável, prazo, prioridade) e clique na linha
// para abrir. As colunas exibidas são personalizáveis (spec 014 / colunas.ts).
import { useState } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import {
  ChevronDown,
  ChevronRight,
  Link2,
  MessageSquare,
  MoreVertical,
  Pencil,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { corDaEtapa, type Prioridade } from "../status";
import {
  COLUNAS_ORDEM,
  COLUNA_LABEL,
  COLUNA_LARGURA,
  type ColunaLista,
  type ColunasLista,
} from "../colunas";
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
  onResponsavel: (item: ItemTrabalho, pessoaId: string | null) => void;
  onPrazo: (item: ItemTrabalho, iso: string | null) => void;
  onProjeto: (item: ItemTrabalho, projetoId: string | null) => void;
  onEtiquetas: (item: ItemTrabalho, labels: string[]) => void;
  onHoras: (item: ItemTrabalho, dec: number | null) => void;
  onHorasReais: (item: ItemTrabalho, dec: number | null) => void;
  onExcluir: (item: ItemTrabalho) => void;
  /** Arrastou a linha para outra coluna: destino = id da etapa alvo. */
  onMover: (item: ItemTrabalho, destinoEtapaId: string) => void;
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
  return `minmax(0,1fr) ${cols} 36px`;
}

function SeletorColunas({ colunas }: { colunas: ColunasLista }) {
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
  onResponsavel: (item: ItemTrabalho, pessoaId: string | null) => void;
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
          responsavelId={item.responsavelId}
          responsavelNome={item.responsavelNome}
          pessoas={pessoas}
          editavel={ehTarefa && podeEditarResponsavel}
          onChange={(pessoaId) => handlers.onResponsavel(item, pessoaId)}
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
      className="group grid cursor-pointer items-center gap-3 border-b px-3 py-1.5 text-sm last:border-b-0 hover:bg-muted/50"
    >
      {/* Nome + tipo + contadores */}
      <div className="flex min-w-0 items-center gap-2">
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
  onResponsavel,
  onPrazo,
  onProjeto,
  onEtiquetas,
  onHoras,
  onHorasReais,
  onExcluir,
  onMover,
}: Props) {
  const grupos = agruparPorEtapa(itens, etapas);
  const [colapsados, setColapsados] = useState<Set<string>>(new Set());
  const ativas = colunas.ativas;
  const template = gridTemplate(ativas);
  const handlers: CelulaHandlers = {
    onPrioridade,
    onResponsavel,
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
      <div className="min-w-[760px]">
        {/* Barra do seletor de colunas */}
        <div className="flex justify-end pb-2">
          <SeletorColunas colunas={colunas} />
        </div>

        {/* Cabeçalho das colunas */}
        <div
          style={{ gridTemplateColumns: template }}
          className="grid items-center gap-3 px-3 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
        >
          <span>Nome</span>
          {ativas.map((c) => (
            <span key={c}>{COLUNA_LABEL[c]}</span>
          ))}
          <span />
        </div>

        <DragDropContext onDragEnd={onDragEnd}>
          {grupos.map((grupo) => {
            const etapa = etapas.find((e) => e.id === grupo.chave);
            const aberto = !colapsados.has(grupo.chave);
            return (
              <section key={grupo.chave} className="mb-3">
                <button
                  type="button"
                  onClick={() => toggle(grupo.chave)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted/40"
                >
                  {aberto ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: corDaEtapa(etapa?.cor ?? null, etapa?.bucket ?? null) }}
                  />
                  <span className="text-sm font-medium text-foreground">{grupo.titulo}</span>
                  <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground">{grupo.itens.length}</span>
                </button>

                {aberto && (
                  <Droppable droppableId={grupo.chave}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={cn(
                          "mt-1 rounded-lg transition-colors",
                          snapshot.isDraggingOver && "bg-brand/5 ring-2 ring-brand/40"
                        )}
                      >
                        {grupo.itens.length === 0 && !snapshot.isDraggingOver ? (
                          <p className="px-3 py-3 text-xs text-muted-foreground">Nada aqui</p>
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
                )}
              </section>
            );
          })}
        </DragDropContext>
      </div>
    </div>
  );
}
