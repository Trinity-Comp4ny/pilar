import { useState } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { GripVertical, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
import type { ItemLayout, Tamanho } from "@/hooks/usePainelLayout";
import { LIMITE_WIDGETS } from "@/hooks/usePainelLayout";
import type { PainelGestao } from "@/hooks/usePainelGestao";
import { CATALOGO, LARGURA, POR_ID, ROTULO_TAMANHO, SECOES, type Secao } from "./catalogo";

/**
 * Grade do painel e o modo de personalizar (ADR 0038).
 *
 * Fora do modo de edição a tela é só leitura: nenhum controle de widget
 * aparece, para o painel não competir com o dado. Em edição, cada card ganha
 * alça de arrastar, seletor de tamanho e remover, e um seletor lateral lista o
 * catálogo agrupado por módulo.
 *
 * Arrastar usa @hello-pangea/dnd, a mesma lib do Kanban de projetos: nenhuma
 * biblioteca de grid nova entra (ADR 0008 e 0020).
 */

type Props = {
  data: PainelGestao;
  layout: ItemLayout[];
  usandoPadrao: boolean;
  editando: boolean;
  salvando: boolean;
  onEditar: (v: boolean) => void;
  onSalvar: (layout: ItemLayout[]) => Promise<unknown>;
  onRestaurar: () => Promise<unknown>;
};

function CardWidget({
  titulo,
  sub,
  fase2,
  children,
  leitura,
  className,
  cabecalho,
}: {
  titulo: string;
  sub?: string;
  fase2?: string;
  children: React.ReactNode;
  leitura?: React.ReactNode;
  className?: string;
  cabecalho?: React.ReactNode;
}) {
  return (
    <article
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-2xl border border-black/10 bg-white p-4 shadow-sm",
        className
      )}
    >
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="text-sm font-medium tracking-tight">{titulo}</h3>
        {sub && <span className="text-[11.5px] text-muted-foreground">{sub}</span>}
        {fase2 && (
          <span
            title={fase2}
            className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
          >
            fase 2
          </span>
        )}
        {cabecalho && <div className="ml-auto flex items-center gap-1">{cabecalho}</div>}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">{children}</div>
      {leitura && (
        <p className="mt-auto border-t border-border pt-2.5 text-xs leading-snug text-muted-foreground">{leitura}</p>
      )}
    </article>
  );
}

export function PainelGrid({
  data,
  layout,
  usandoPadrao,
  editando,
  salvando,
  onEditar,
  onSalvar,
  onRestaurar,
}: Props) {
  const { can } = usePermissions();
  const [rascunho, setRascunho] = useState<ItemLayout[]>(layout);
  const [seletorAberto, setSeletorAberto] = useState(false);

  const atual = editando ? rascunho : layout;

  // Widget só existe se a permissão existe. Layout pode citar um id que a
  // pessoa perdeu acesso, e aí ele simplesmente não renderiza.
  const visiveis = atual.filter((item) => {
    const w = POR_ID.get(item.w);
    return w && (w.feature === null || can(w.feature));
  });

  const entrarEdicao = () => {
    setRascunho(layout);
    onEditar(true);
  };

  const cancelar = () => {
    setRascunho(layout);
    setSeletorAberto(false);
    onEditar(false);
  };

  const salvar = async () => {
    await onSalvar(rascunho);
    setSeletorAberto(false);
    onEditar(false);
  };

  const mover = (r: DropResult) => {
    if (!r.destination) return;
    const proximo = [...rascunho];
    const [item] = proximo.splice(r.source.index, 1);
    proximo.splice(r.destination.index, 0, item);
    setRascunho(proximo);
  };

  const trocarTamanho = (i: number, s: Tamanho) =>
    setRascunho((prev) => prev.map((item, idx) => (idx === i ? { ...item, s } : item)));

  const remover = (i: number) => setRascunho((prev) => prev.filter((_, idx) => idx !== i));

  const adicionar = (id: string) => {
    const w = POR_ID.get(id);
    if (!w || rascunho.length >= LIMITE_WIDGETS) return;
    setRascunho((prev) => [...prev, { w: id, s: w.padrao }]);
  };

  const disponiveis = CATALOGO.filter((w) => w.feature === null || can(w.feature));
  const jaUsados = new Set(rascunho.map((i) => i.w));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {usandoPadrao && !editando && (
          <span className="text-xs text-muted-foreground">
            Este é o painel padrão. Personalize para escolher seus indicadores.
          </span>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {editando ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setSeletorAberto((v) => !v)}>
                <Plus size={14} /> Adicionar indicador
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void onRestaurar().then(() => onEditar(false))}
                disabled={salvando}
              >
                <RotateCcw size={14} /> Restaurar padrão
              </Button>
              <Button variant="ghost" size="sm" onClick={cancelar} disabled={salvando}>
                Cancelar
              </Button>
              <Button variant="brand" size="sm" onClick={() => void salvar()} disabled={salvando}>
                {salvando ? "Salvando..." : "Salvar painel"}
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={entrarEdicao}>
              Personalizar
            </Button>
          )}
        </div>
      </div>

      {editando && seletorAberto && (
        <section
          aria-label="Indicadores disponíveis"
          className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm"
        >
          <div className="mb-3 flex items-center gap-2">
            <h3 className="text-sm font-medium">Indicadores disponíveis</h3>
            <span className="text-xs text-muted-foreground">
              {rascunho.length} de {LIMITE_WIDGETS} no painel
            </span>
            <button
              type="button"
              onClick={() => setSeletorAberto(false)}
              aria-label="Fechar"
              className="ml-auto rounded p-1 text-muted-foreground hover:bg-black/5 hover:text-ink"
            >
              <X size={15} />
            </button>
          </div>
          <div className="flex flex-col gap-4">
            {SECOES.map((secao) => {
              const doGrupo = disponiveis.filter((w) => w.secao === secao.key);
              if (doGrupo.length === 0) return null;
              return (
                <div key={secao.key}>
                  <h4 className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-muted">
                    {secao.label}
                  </h4>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {doGrupo.map((w) => {
                      const usado = jaUsados.has(w.id);
                      return (
                        <button
                          key={w.id}
                          type="button"
                          disabled={usado || rascunho.length >= LIMITE_WIDGETS}
                          onClick={() => adicionar(w.id)}
                          className={cn(
                            "flex flex-col gap-0.5 rounded-xl border border-black/10 p-3 text-left transition-colors",
                            usado
                              ? "cursor-default opacity-45"
                              : "hover:bg-black/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                          )}
                        >
                          <span className="flex items-center gap-2 text-[13px] font-medium text-ink">
                            {w.titulo}
                            {usado && <span className="text-[10px] font-normal text-muted-foreground">no painel</span>}
                          </span>
                          <span className="text-[11.5px] leading-snug text-muted-foreground">{w.descricao}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {visiveis.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-black/15 bg-white px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhum indicador no painel.{" "}
          {editando ? "Use Adicionar indicador." : "Clique em Personalizar para escolher os seus."}
        </p>
      ) : editando ? (
        <DragDropContext onDragEnd={mover}>
          <Droppable droppableId="painel">
            {(drop) => (
              <div
                ref={drop.innerRef}
                {...drop.droppableProps}
                className="grid grid-cols-1 gap-2.5 lg:grid-cols-12"
              >
                {rascunho.map((item, i) => {
                  const w = POR_ID.get(item.w);
                  if (!w || (w.feature !== null && !can(w.feature))) return null;
                  return (
                    <Draggable key={`${item.w}-${i}`} draggableId={`${item.w}-${i}`} index={i}>
                      {(drag, snapshot) => (
                        <div
                          ref={drag.innerRef}
                          {...drag.draggableProps}
                          className={cn(LARGURA[item.s], snapshot.isDragging && "opacity-90")}
                        >
                          <CardWidget
                            titulo={w.titulo}
                            fase2={w.fase2}
                            className="h-full ring-1 ring-brand/40"
                            cabecalho={
                              <>
                                <select
                                  aria-label={`Tamanho de ${w.titulo}`}
                                  value={item.s}
                                  onChange={(e) => trocarTamanho(i, e.target.value as Tamanho)}
                                  className="rounded-md border border-black/10 bg-white px-1.5 py-0.5 text-[11px] text-ink-soft"
                                >
                                  {w.tamanhos.map((t) => (
                                    <option key={t} value={t}>
                                      {ROTULO_TAMANHO[t]}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => remover(i)}
                                  aria-label={`Remover ${w.titulo}`}
                                  className="rounded p-1 text-muted-foreground hover:bg-black/5 hover:text-danger-mid"
                                >
                                  <Trash2 size={14} />
                                </button>
                                <span
                                  {...drag.dragHandleProps}
                                  aria-label={`Mover ${w.titulo}`}
                                  className="cursor-grab rounded p-1 text-muted-foreground hover:bg-black/5 hover:text-ink"
                                >
                                  <GripVertical size={14} />
                                </span>
                              </>
                            }
                          >
                            {w.render(data)}
                          </CardWidget>
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {drop.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-12">
          {visiveis.map((item, i) => {
            const w = POR_ID.get(item.w)!;
            return (
              <div key={`${item.w}-${i}`} className={LARGURA[item.s]}>
                <CardWidget
                  titulo={w.titulo}
                  fase2={w.fase2}
                  leitura={w.leitura?.(data)}
                  className="h-full"
                >
                  {w.render(data)}
                </CardWidget>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export type { Secao };
